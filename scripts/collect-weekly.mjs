#!/usr/bin/env node
/* ==================================================================
   collect-weekly.mjs (2026-09-27 신설 — Phase 2 최초 실제 구현)

   역할: SOURCE_POLICY.md 1순위(RSS)에 따라 disciplestoday.org/feed/ 를
   수집하고, STATE_POLICY.md의 최초 상태(COLLECTED)를 부여해
   data/collected/articles.json 에 누적 저장한다.

   범위 제한 (의도적):
   - 이 스크립트는 "수집"까지만 한다. 후보 선정(점수화)·승인·카드뉴스
     생성은 하지 않는다. STATE_POLICY의 다음 단계(CANDIDATE 선정 기준)는
     아직 정책 결정이 없으므로, 이 스크립트가 임의로 점수를 매기거나
     선별하지 않는다 — 운영자가 다음 단계에서 결정한다.
   - RSS의 본문 전체(content:encoded)는 저장하지 않는다. CONTENT_POLICY의
     "원문 전체 번역 금지" 원칙에 따라 요약/발췌 수준만 보존한다.
   - 이미지는 URL만 기록한다. 다운로드·재게시하지 않는다
     (CONTENT_POLICY "원본 이미지 복제 금지").

   의존성: 없음 (Node 24 내장 fetch만 사용). 외부 npm 패키지를 쓰지
   않는 이유는 "월 0원·최소 복잡도" 원칙과, 설치 여부를 실행 환경마다
   확인할 수 없기 때문이다. RSS 2.0 구조가 비교적 단순해 정규식 기반
   경량 파서로 충분하다고 판단했다.

   스키마 근거: 9.6 실험(DEC-026)에서 정책 문서(SOURCE_POLICY/
   STATE_POLICY/CONTENT_POLICY) 검토 후 이미 승인된 필드 구조를
   그대로 재사용한다. collectionMethod만 "mock"에서 "rss"로 변경했다.
   ================================================================== */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FEED_URL = "https://disciplestoday.org/feed/";
const USER_AGENT =
  "Mozilla/5.0 (compatible; kcoc-weekly-collector/1.0; +https://github.com/ppihhi/kcoc-weekly)";

// SOURCE_POLICY.md "수집 원칙": 최근 7~10일 기사만 확인한다.
const LOOKBACK_DAYS = 10;

const OUTPUT_PATH = path.join(ROOT, "data", "collected", "articles.json");

// ------------------------------------------------------------------
// 1. RSS 가져오기
// ------------------------------------------------------------------
async function fetchFeed(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    // 원인별로 구분해 안내한다 — "fetch failed"만으로는 사람이 원인을
    // 알 수 없다(2026-09-27 로컬 검증 중 실제로 겪은 문제).
    const cause = err.cause?.code || err.cause?.message || err.message;
    if (cause?.includes("ENOTFOUND")) {
      throw new Error(
        `DNS 조회 실패 (${cause}) — 이 실행 환경에서 외부 인터넷 접속이 ` +
          `차단되어 있을 수 있습니다. 방화벽/프록시/오프라인 환경인지 확인하십시오.`
      );
    }
    if (cause?.includes("ECONNREFUSED") || cause?.includes("ETIMEDOUT")) {
      throw new Error(
        `연결 실패 (${cause}) — 대상 서버가 응답하지 않거나 네트워크 ` +
          `경로가 차단되었을 수 있습니다.`
      );
    }
    throw new Error(`RSS 요청 자체가 실패했습니다: ${cause}`);
  }
  if (!res.ok) {
    throw new Error(`RSS 가져오기 실패: HTTP ${res.status} (${url})`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("xml")) {
    throw new Error(
      `예상치 못한 Content-Type: ${contentType} — RSS 형식이 아닐 수 있음`
    );
  }
  return res.text();
}

// ------------------------------------------------------------------
// 2. 경량 RSS 파서 (의존성 없음, RSS 2.0 <item> 구조 전제)
// ------------------------------------------------------------------
function decodeEntitiesOnePass(str) {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
}

// 2026-09-27 실측 발견 (2차): disciplestoday.org RSS는 일부 항목에서
// 앰퍼샌드를 "&amp;amp;"처럼 이중으로 인코딩해 내려보낸다. 이는 WordPress가
// 저장한 "&amp;"(HTML 엔티티)를, RSS를 생성할 때 XML 규격에 맞춰 다시
// 이스케이프하면서 발생하는 흔한 현상이다. 단일 패스 치환으로는
// "&amp;amp;" → "&amp;"까지만 풀리고 최종 "&"까지 도달하지 못해,
// 화면에 "&amp;"가 그대로 노출되는 결함이 있었다. 결과가 더 이상
// 바뀌지 않을 때까지 반복 적용해 몇 겹으로 인코딩되어 있어도 전부
// 풀리도록 한다. 무한 루프 방지를 위해 최대 5회로 제한한다
// (실무에서 3중 이상 인코딩은 사실상 없다).
function decodeEntities(str) {
  if (!str) return str;
  let prev = str;
  for (let i = 0; i < 5; i++) {
    const next = decodeEntitiesOnePass(prev);
    if (next === prev) break;
    prev = next;
  }
  return prev.trim();
}

function extractTag(itemXml, tagName) {
  // 네임스페이스 접두사(dc:, content: 등) 포함 태그도 매칭
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const m = itemXml.match(re);
  return m ? decodeEntities(m[1]) : null;
}

function extractAllTags(itemXml, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "gi");
  const out = [];
  let m;
  while ((m = re.exec(itemXml)) !== null) {
    out.push(decodeEntities(m[1]));
  }
  return out;
}

function extractImageUrl(itemXml) {
  // media:content 또는 enclosure의 url 속성만 추출 (다운로드 아님)
  const media = itemXml.match(/<media:content[^>]*url="([^"]+)"/i);
  if (media) return media[1];
  const enclosure = itemXml.match(
    /<enclosure[^>]*url="([^"]+)"[^>]*type="image[^"]*"/i
  );
  if (enclosure) return enclosure[1];
  return null;
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRssItems(xml) {
  const itemBlocks = xml.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
  return itemBlocks.map((block) => {
    const title = extractTag(block, "title") || "(제목 없음)";
    const link = extractTag(block, "link") || "";
    const guid = extractTag(block, "guid") || link;
    const pubDateRaw = extractTag(block, "pubDate");
    const creator = extractTag(block, "dc:creator");
    const description = extractTag(block, "description");
    const categories = extractAllTags(block, "category");
    const imageUrl = extractImageUrl(block);

    const publishedAt = pubDateRaw
      ? new Date(pubDateRaw).toISOString().slice(0, 10)
      : null;

    // CONTENT_POLICY: 전문 번역 금지 — description(발췌/요약)만 보존,
    // content:encoded(본문 전체)는 의도적으로 사용하지 않는다.
    const summarySource = stripHtml(description).slice(0, 500);

    return {
      title,
      publishedAt,
      author: creator || null,
      url: link,
      guid,
      summary: summarySource,
      categories,
      tags: [],
      imageUrl: imageUrl || null,
      collectedAt: new Date().toISOString(),
      collectionMethod: "rss",
      status: "COLLECTED", // STATE_POLICY.md 최초 상태값
    };
  });
}

// ------------------------------------------------------------------
// 3. 최근 N일 필터 + 콘텐츠 해시(중복 판정용)
// ------------------------------------------------------------------
function withinLookback(article, days) {
  if (!article.publishedAt) return false;
  const published = new Date(article.publishedAt).getTime();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return published >= cutoff;
}

function computeHash(article) {
  const basis = `${article.url}|${article.title}|${article.publishedAt}`;
  return crypto.createHash("sha256").update(basis, "utf8").digest("hex");
}

// ------------------------------------------------------------------
// 4. 기존 저장분과 병합 (URL 기준 중복 제거, 기존 항목의 상태는 보존)
// ------------------------------------------------------------------
function loadExisting(outputPath) {
  if (!fs.existsSync(outputPath)) return [];
  let parsed;
  try {
    const raw = fs.readFileSync(outputPath, "utf8");
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `기존 articles.json 파싱 실패 — 수동 확인 필요: ${err.message}`
    );
  }

  // 방어 코드 (2026-09-27 실측 발견): 이 스크립트는 최상위가 배열인
  // 형식으로 저장하지만, Phase 1 스캐폴딩 당시 { "articles": [] }
  // 형태의 플레이스홀더가 이미 존재했을 가능성이 있다. 최상위가
  // 배열이 아니면 무조건 실패시키지 않고, articles 키가 있으면
  // 그 배열을 꺼내 쓰고 명시적으로 경고한다. 그 외 알 수 없는 형태는
  // 무엇을 가정할지 알 수 없으므로 계속 에러로 처리한다 — 데이터를
  // 조용히 손상시키는 것보다 안전하다.
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && Array.isArray(parsed.articles)) {
    console.warn(
      `⚠️ 기존 ${path.basename(outputPath)}가 { "articles": [...] } 형식입니다. ` +
        `이 스크립트는 최상위 배열 형식으로 저장합니다. 이번 실행부터 ` +
        `배열 형식으로 정규화해 덮어씁니다(기존 ${parsed.articles.length}건 유지).`
    );
    return parsed.articles;
  }
  throw new Error(
    `기존 ${path.basename(outputPath)}의 최상위 구조를 알 수 없습니다 ` +
      `(배열도 아니고 { articles: [...] } 형태도 아님). ` +
      `내용을 직접 확인한 뒤 수동으로 정리하십시오.`
  );
}

function mergeArticles(existing, incoming) {
  const byUrl = new Map(existing.map((a) => [a.url, a]));
  let added = 0;
  let skipped = 0;
  for (const article of incoming) {
    if (byUrl.has(article.url)) {
      // 이미 수집된 기사 — 상태(승인 여부 등)를 덮어쓰지 않는다.
      skipped++;
      continue;
    }
    article.contentHash = computeHash(article);
    byUrl.set(article.url, article);
    added++;
  }
  return {
    merged: Array.from(byUrl.values()).sort(
      (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
    ),
    added,
    skipped,
  };
}

// ------------------------------------------------------------------
// 5. 메인
// ------------------------------------------------------------------
async function main() {
  console.log(`RSS 수집 시작: ${FEED_URL}`);
  const xml = await fetchFeed(FEED_URL);

  const allItems = parseRssItems(xml);
  console.log(`RSS 항목 파싱: ${allItems.length}건`);

  const recent = allItems.filter((a) => withinLookback(a, LOOKBACK_DAYS));
  console.log(
    `최근 ${LOOKBACK_DAYS}일 이내 항목: ${recent.length}건 (전체 ${allItems.length}건 중)`
  );

  if (recent.length === 0) {
    console.log(
      "⚠️ 최근 항목이 없습니다. 발행 주기 대비 실행 시점을 확인하십시오."
    );
  }

  const existing = loadExisting(OUTPUT_PATH);
  const { merged, added, skipped } = mergeArticles(existing, recent);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(merged, null, 2), "utf8");

  console.log(`\n결과: 신규 ${added}건 추가 · 기존 ${skipped}건 유지 (중복 제외)`);
  console.log(`저장 위치: ${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log(`누적 총 ${merged.length}건`);

  if (added > 0) {
    console.log("\n신규 수집 기사 목록:");
    merged
      .filter((a) => recent.some((r) => r.url === a.url) && !existing.some((e) => e.url === a.url))
      .forEach((a) => console.log(`  - [${a.publishedAt}] ${a.title}`));
  }
}

// ------------------------------------------------------------------
// 6. export (테스트 가능성 확보) + 직접 실행 시에만 main() 호출
// ------------------------------------------------------------------
// 이 모듈을 다른 스크립트(테스트 등)가 import할 때 main()이 즉시
// 실행되어 실제 네트워크 호출이 발생하면 안 된다. "node collect-weekly.mjs"
// 처럼 직접 실행된 경우에만 main()을 호출하도록 가드한다.
export {
  parseRssItems,
  extractImageUrl,
  decodeEntities,
  extractTag,
  extractAllTags,
  stripHtml,
  withinLookback,
  computeHash,
  mergeArticles,
  fetchFeed,
  FEED_URL,
  LOOKBACK_DAYS,
};

// 2026-09-27 실측 발견(치명적 버그): `file://${process.argv[1]}` 방식은
// Windows에서 항상 실패한다. process.argv[1]은 백슬래시 경로
// (예: "scripts\collect-weekly.mjs")를 그대로 담고 있는데, import.meta.url은
// 항상 정규화된 file:///C:/... 형태(슬래시, 드라이브 문자 처리 포함)라
// 문자열 비교가 절대 일치하지 않는다. 그 결과 main()이 조용히 한 번도
// 실행되지 않았고, 빈 배열({ "articles": [] })만 남았다. 반드시 Node의
// 표준 변환 함수(pathToFileURL)로 양쪽을 같은 형식으로 맞춰 비교해야 한다.
const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error(`❌ 수집 실패: ${err.message}`);
    process.exit(1);
  });
}

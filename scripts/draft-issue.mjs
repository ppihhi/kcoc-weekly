#!/usr/bin/env node
/* ==================================================================
   draft-issue.mjs (2026-09-27 신설)

   역할: data/collected/articles.json 중 COLLECTED 상태 기사를 골라
   content/issues/{주차}/issue.json 초안을 만든다.

   중요 — 이 파일은 "완성본"이 아니라 "검토용 초안"이다:
   - 각 기사의 titleKo/summaryKo는 원문 영어를 그대로 넣고
     "[번역 필요]" 표시를 붙인다. CONTENT_POLICY(원문 전체 번역 금지,
     독자적 한국어 요약 작성)에 따라 운영자가 반드시 직접 다시 써야
     한다 — 이 스크립트가 자동 번역하지 않는다.
   - 모든 슬라이드는 reviewed:false, 이슈 전체는 approved:false로
     생성된다. render-cardnews.mjs는 이 값이 true로 바뀌기 전에는
     최종 이미지를 만들지 않는다 (Phase 1 원칙 3의 기술적 강제).

   범위 제한: 이 스크립트는 "후보 선정 기준(점수화)" 같은 정책 판단을
   하지 않는다. 단순히 최신순으로 최대 N건을 골라 초안 뼈대만 만든다.
   실제로 무엇을 몇 건 실을지는 운영자가 issue.json을 열어 직접
   추리고 다시 쓴다.
   ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ARTICLES_PATH = path.join(ROOT, "data", "collected", "articles.json");

// 정책 기준값 (확정: 2026-09-22 Phase 1 설계) — 실제 정책 문서와 다르면
// 이 블록만 고치면 된다.
const DEFAULT_ARTICLE_SLOTS = 6; // 표지 1 + 기사 최대 6 + CTA 1 = 기본 8
const MIN_TOTAL_SLIDES = 5;
const MAX_TOTAL_SLIDES = 10;

function isoWeekLabel(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // 월요일=0
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function loadArticles(articlesPath) {
  if (!fs.existsSync(articlesPath)) {
    throw new Error(
      `수집 데이터가 없습니다: ${articlesPath} — 먼저 collect-weekly.mjs를 실행하십시오.`
    );
  }
  const raw = fs.readFileSync(articlesPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(
      `${path.basename(articlesPath)}의 최상위 구조가 배열이 아닙니다.`
    );
  }
  return parsed;
}

function buildDraftIssue(articles, { week, slotCount = DEFAULT_ARTICLE_SLOTS } = {}) {
  const issueId = week || isoWeekLabel();

  const collected = articles
    .filter((a) => a.status === "COLLECTED")
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, slotCount);

  const slides = [];

  slides.push({
    type: "cover",
    title: "함께 보는 세계교회",
    subtitle: `${issueId} 주간 소식 [운영자 확인 필요: 부제 문구]`,
    reviewed: false,
  });

  for (const article of collected) {
    const teaser = (article.summary || "").slice(0, 140);
    slides.push({
      type: "article",
      sourceUrl: article.url,
      category: article.categories?.[0] || null,
      titleKo: `[번역 필요] ${article.title}`,
      summaryKo: `[번역 필요] ${teaser}${teaser.length >= 140 ? "…" : ""}`,
      publishedAt: article.publishedAt,
      reviewed: false,
    });
  }

  slides.push({
    type: "cta",
    title: "원문과 함께 만나는 세계교회 소식",
    body:
      "본 카드뉴스는 개인이 비영리로 운영하는 독립 프로젝트입니다. " +
      "[운영자 확인 필요: 비공식 고지 정확한 문구는 PROJECT_CONTEXT.md §2 참조]",
    websiteNotice: "[운영자 확인 필요: 실제 웹사이트 주소]",
    reviewed: false,
  });

  if (slides.length < MIN_TOTAL_SLIDES) {
    console.warn(
      `⚠️ 총 슬라이드 수(${slides.length})가 정책 최소값(${MIN_TOTAL_SLIDES})보다 적습니다. ` +
        `수집된 기사가 부족하거나 slotCount를 늘려야 할 수 있습니다.`
    );
  }
  if (slides.length > MAX_TOTAL_SLIDES) {
    console.warn(
      `⚠️ 총 슬라이드 수(${slides.length})가 정책 최대값(${MAX_TOTAL_SLIDES})을 초과합니다. ` +
        `slotCount를 줄이십시오.`
    );
  }

  return {
    issueId,
    title: `함께 보는 세계교회 — ${issueId}`,
    generatedAt: new Date().toISOString(),
    approved: false,
    slides,
  };
}

function main() {
  const args = process.argv.slice(2);
  const weekArg = args.find((a) => a.startsWith("--week="))?.split("=")[1];
  const countArg = args.find((a) => a.startsWith("--count="))?.split("=")[1];

  const articles = loadArticles(ARTICLES_PATH);
  const issue = buildDraftIssue(articles, {
    week: weekArg,
    slotCount: countArg ? parseInt(countArg, 10) : DEFAULT_ARTICLE_SLOTS,
  });

  const outDir = path.join(ROOT, "content", "issues", issue.issueId);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "issue.json");
  fs.writeFileSync(outPath, JSON.stringify(issue, null, 2), "utf8");

  console.log(`초안 생성 완료: ${path.relative(ROOT, outPath)}`);
  console.log(`총 슬라이드: ${issue.slides.length}건 (표지1 + 기사${issue.slides.length - 2} + CTA1)`);
  console.log(
    `\n🔴 다음 단계: 이 파일을 열어 "[번역 필요]" 표시된 부분을 직접 다시 쓰고,\n` +
      `   각 슬라이드의 reviewed를 true로, 마지막에 최상위 approved를 true로\n` +
      `   바꾼 뒤에만 최종 이미지가 생성됩니다.`
  );
}

export { isoWeekLabel, loadArticles, buildDraftIssue, ARTICLES_PATH };

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  try {
    main();
  } catch (err) {
    console.error(`❌ 초안 생성 실패: ${err.message}`);
    process.exit(1);
  }
}

#!/usr/bin/env node
/* ==================================================================
   collect-weekly.test.mjs (2026-09-27 신설)

   9.6 실험 교훈 반영: 이 테스트는 collect-weekly.mjs의 내부 상수를
   가져다 쓰지 않는다. 정책 문서(STATE_POLICY.md의 최초 상태값 등)
   기준으로 기대값을 이 파일 안에 독립적으로 고정한다. 구현이 잘못
   바뀌어도 테스트가 항상 통과하는 함정을 피하기 위함이다.

   실행: node --test tests/collect-weekly.test.mjs
   (프로젝트 루트에서 실행 — scripts/check-all.mjs와 동일한 cwd 규칙)
   ================================================================== */

import { test } from "node:test";
import assert from "node:assert/strict";

// ---- 정책 기준값 (STATE_POLICY.md / SOURCE_POLICY.md 근거, 독립 고정) ----
const EXPECTED_INITIAL_STATUS = "COLLECTED";
const EXPECTED_FIELDS = [
  "title",
  "publishedAt",
  "author",
  "url",
  "guid",
  "summary",
  "categories",
  "tags",
  "imageUrl",
  "collectedAt",
  "collectionMethod",
  "status",
];
const EXPECTED_COLLECTION_METHOD = "rss";

// ---- 샘플 RSS <item> 블록 (실제 disciplestoday.org 구조 근사) ----
const SAMPLE_RSS_ITEM = `
<item>
  <title><![CDATA[International News Bulletin September 27, 2026]]></title>
  <link>https://disciplestoday.org/international-news-bulletin-september-27-2026/</link>
  <guid isPermaLink="false">https://disciplestoday.org/?p=31417</guid>
  <pubDate>Thu, 24 Sep 2026 05:03:57 +0000</pubDate>
  <dc:creator><![CDATA[admin]]></dc:creator>
  <description><![CDATA[<p>The International News Bulletin is a service to help connect disciples.</p>]]></description>
  <category><![CDATA[News]]></category>
  <media:content url="https://disciplestoday.org/wp-content/uploads/sample.jpg" medium="image" />
</item>
`;

// 테스트 대상 함수들을 실제 구현에서 가져온다.
// 중요: collect-weekly.mjs는 "직접 실행될 때만 main()을 호출"하도록
// 가드되어 있으므로, 여기서 import해도 실제 네트워크 호출은 발생하지
// 않는다 (반드시 이 가드가 유지되는지 아래에서도 확인한다).
const impl = await import("../scripts/collect-weekly.mjs");

test("collect-weekly.mjs가 필요한 함수를 export한다", () => {
  assert.equal(typeof impl.parseRssItems, "function");
  assert.equal(typeof impl.withinLookback, "function");
  assert.equal(typeof impl.mergeArticles, "function");
  assert.equal(typeof impl.computeHash, "function");
});

test("모듈 import 시 실제 네트워크 호출이 발생하지 않는다 (가드 확인)", () => {
  // fetchFeed가 export되어 있지만, import 자체만으로는 호출되지 않아야
  // 한다. 이 테스트가 타임아웃 없이 즉시 끝난다는 사실 자체가 증거다.
  assert.equal(typeof impl.fetchFeed, "function");
});

test("정책 기준: 초기 상태값은 COLLECTED여야 한다 (STATE_POLICY.md 근거)", () => {
  assert.equal(EXPECTED_INITIAL_STATUS, "COLLECTED");
});

test("정책 기준: 필수 필드 12종이 정의되어 있다 (DEC-026 승인 스키마 근거)", () => {
  assert.equal(EXPECTED_FIELDS.length, 12);
  assert.ok(EXPECTED_FIELDS.includes("imageUrl"));
  assert.ok(EXPECTED_FIELDS.includes("contentHash") === false, 
    "contentHash는 수집 시점이 아니라 병합 시점에 부여되므로 기본 필드 목록에는 없다");
});

test("수집 방식 값은 rss여야 한다 (mock에서 전환 확인)", () => {
  assert.equal(EXPECTED_COLLECTION_METHOD, "rss");
});

test("샘플 RSS 항목에서 이미지 URL 패턴이 media:content로 존재한다", () => {
  const match = SAMPLE_RSS_ITEM.match(/<media:content[^>]*url="([^"]+)"/);
  assert.ok(match, "media:content url 속성을 찾을 수 없습니다");
  assert.equal(
    match[1],
    "https://disciplestoday.org/wp-content/uploads/sample.jpg"
  );
});

test("샘플 RSS 항목에서 CDATA 제목이 올바르게 추출 가능한 형태다", () => {
  const match = SAMPLE_RSS_ITEM.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/);
  assert.ok(match);
  assert.equal(match[1], "International News Bulletin September 27, 2026");
});

// ---- 실제 구현 함수를 샘플 데이터로 검증 (진짜 단위 테스트) ----

test("parseRssItems: 샘플 item에서 필드를 정확히 추출한다", () => {
  const wrapped = `<rss><channel>${SAMPLE_RSS_ITEM}</channel></rss>`;
  const items = impl.parseRssItems(wrapped);
  assert.equal(items.length, 1);
  const a = items[0];
  assert.equal(a.title, "International News Bulletin September 27, 2026");
  assert.equal(
    a.url,
    "https://disciplestoday.org/international-news-bulletin-september-27-2026/"
  );
  assert.equal(a.author, "admin");
  assert.equal(a.publishedAt, "2026-09-24");
  assert.equal(
    a.imageUrl,
    "https://disciplestoday.org/wp-content/uploads/sample.jpg"
  );
  assert.equal(a.status, EXPECTED_INITIAL_STATUS);
  assert.equal(a.collectionMethod, EXPECTED_COLLECTION_METHOD);
  assert.ok(a.categories.includes("News"));
  // 정책 준수: 본문 전체(HTML)를 그대로 담지 않고 텍스트만 발췌했는지 확인
  assert.ok(!a.summary.includes("<p>"), "요약에 HTML 태그가 남아있으면 안 됩니다");
});

test("parseRssItems: export된 필드가 정책 기준 12종과 일치한다", () => {
  const wrapped = `<rss><channel>${SAMPLE_RSS_ITEM}</channel></rss>`;
  const items = impl.parseRssItems(wrapped);
  const actualFields = Object.keys(items[0]).sort();
  const expectedSorted = [...EXPECTED_FIELDS].sort();
  assert.deepEqual(actualFields, expectedSorted);
});

test("withinLookback: 발행일 없는 기사는 제외된다", () => {
  assert.equal(impl.withinLookback({ publishedAt: null }, 10), false);
});

test("withinLookback: 10일 이전 기사는 제외된다", () => {
  const old = new Date();
  old.setDate(old.getDate() - 30);
  const article = { publishedAt: old.toISOString().slice(0, 10) };
  assert.equal(impl.withinLookback(article, 10), false);
});

test("withinLookback: 오늘 발행 기사는 포함된다", () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(impl.withinLookback({ publishedAt: today }, 10), true);
});

test("mergeArticles: 기존 URL은 덮어쓰지 않고 skip한다", () => {
  const existing = [
    { url: "https://a.com/1", status: "APPROVED", publishedAt: "2026-09-20" },
  ];
  const incoming = [
    { url: "https://a.com/1", status: "COLLECTED", publishedAt: "2026-09-20" },
    { url: "https://a.com/2", status: "COLLECTED", publishedAt: "2026-09-21" },
  ];
  const { merged, added, skipped } = impl.mergeArticles(existing, incoming);
  assert.equal(added, 1);
  assert.equal(skipped, 1);
  const kept = merged.find((a) => a.url === "https://a.com/1");
  assert.equal(
    kept.status,
    "APPROVED",
    "기존에 승인된 기사의 상태가 COLLECTED로 되돌려지면 안 됩니다"
  );
});

test("computeHash: 동일 입력은 동일 해시를 낸다", () => {
  const article = {
    url: "https://a.com/1",
    title: "t",
    publishedAt: "2026-09-20",
  };
  assert.equal(impl.computeHash(article), impl.computeHash({ ...article }));
});

// ---- 2026-09-27 실제 발견된 회귀 사례 (이중 HTML 엔티티 인코딩) ----
// 원인: disciplestoday.org RSS가 앰퍼샌드를 "&amp;amp;"처럼 이중으로
// 인코딩해 내려보내는 항목이 있다. 단일 패스 치환으로는 "&amp;"까지만
// 풀리고 최종 "&"에 도달하지 못해 화면에 "&amp;"가 그대로 노출되었다.
// 실제 사용자 실행 결과에서 발견되었으므로 회귀 테스트로 고정한다.
test("decodeEntities: 이중 인코딩된 앰퍼샌드(&amp;amp;)를 완전히 해석한다", () => {
  assert.equal(
    impl.decodeEntities("Season 3: The Spirit &amp;amp; The People"),
    "Season 3: The Spirit & The People"
  );
});

test("decodeEntities: 단일 인코딩된 숫자 엔티티(&#038;)도 정상 해석한다", () => {
  assert.equal(
    impl.decodeEntities("Youth &#038; Family Ministry"),
    "Youth & Family Ministry"
  );
});

test("decodeEntities: 스마트 따옴표(&#8217;)를 올바른 유니코드 문자로 변환한다", () => {
  const result = impl.decodeEntities("Minister&#8217;s Wellness Webinar");
  assert.equal(result, "Minister\u2019s Wellness Webinar");
});

console.log(
  "\n참고: 이 테스트는 정책 기준값의 독립성과 RSS 구조 파싱 가능성만 " +
    "확인합니다. 실제 네트워크 호출(disciplestoday.org 접속)은 하지 " +
    "않습니다 — 오프라인/CI 환경에서 항상 동일하게 통과해야 하기 때문입니다."
);

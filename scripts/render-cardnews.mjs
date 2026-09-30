#!/usr/bin/env node
/* ==================================================================
   render-cardnews.mjs (2026-09-27 신설)

   역할: content/issues/{주차}/issue.json을 읽어 슬라이드를 HTML로
   만들고, Playwright로 PNG 이미지를 생성한다.

   🔴 중요 — 이 스크립트는 의도적으로 2단계로 분리되어 있다:

   [1단계] --html-only (기본값, Playwright 불필요)
     issue.json → content/issues/{주차}/preview/slide-NN.html 생성.
     운영자가 이 HTML 파일들을 브라우저에서 직접 열어 디자인을 먼저
     확인한다. Playwright 설치·실행 문제와 완전히 분리되어 있어,
     디자인 확인 자체는 항상 가능하다.

   [2단계] --render (Playwright 필요, 승인 게이트 있음)
     실제 PNG를 생성한다. 다음 조건을 모두 만족해야만 실행된다:
       - issue.approved === true
       - 모든 slide.reviewed === true
     하나라도 아니면 즉시 중단하고 어떤 슬라이드가 미검토 상태인지
     알려준다 — Phase 1 원칙 3("AI가 직접 발행하지 않는다")을
     기술적으로 강제하기 위함이다.

   의존성: playwright (devDependency로 별도 설치 필요, 무료).
   [1단계]는 playwright 없이도 동작한다 — 이 스크립트는 --render가
   지정된 경우에만 playwright를 동적으로 import한다.
   ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// 카드 규격 — 실제 EDITORIAL_GUIDE.md "시각 요소" 절 확정 전 기본값.
// 이 블록만 고치면 전체 디자인이 일괄 반영된다.
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;
const DEVICE_SCALE_FACTOR = 2; // 고해상도(@2x) 출력

const PALETTE = {
  bg: "#FFFFFF",
  primary: "#1B2A4A", // 남색 — 기본값, 브랜드 컬러 확정 전 임시
  accent: "#C9A227", // 골드 — 기본값
  text: "#222222",
  muted: "#6B7280",
};

const FONT_STACK =
  "'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', -apple-system, sans-serif";

// 2026-09-27 추가: 카테고리별 자체 제작 일러스트 배너.
// CONTENT_POLICY(원본 사이트 이미지 재사용 금지)를 위반하지 않도록
// disciplestoday.org의 사진을 전혀 사용하지 않고, 이 프로젝트를 위해
// 새로 생성한 창작 일러스트만 사용한다. 카테고리 매핑이 없으면
// default.jpg로 대체하고, 그마저 없으면 이미지 없이 렌더링한다
// (장식 요소이므로 실패해도 전체 렌더링을 막지 않는다).
const ILLUSTRATION_DIR = path.join(ROOT, "assets", "illustrations");

function slugifyCategory(category) {
  if (!category) return "default";
  return category
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadIllustrationDataUri(category) {
  const slug = slugifyCategory(category);
  const candidates = [
    path.join(ILLUSTRATION_DIR, `${slug}.jpg`),
    path.join(ILLUSTRATION_DIR, "default.jpg"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    }
  }
  return null; // 이미지 없이도 카드는 정상 렌더링된다 (장식 요소)
}

// ------------------------------------------------------------------
// HTML 템플릿 (슬라이드 타입별)
// ------------------------------------------------------------------
function baseStyle() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${CARD_WIDTH}px;
      height: ${CARD_HEIGHT}px;
      font-family: ${FONT_STACK};
      background: ${PALETTE.bg};
      color: ${PALETTE.text};
      overflow: hidden;
    }
    .card {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 80px 64px;
    }
    .badge {
      display: inline-block;
      background: ${PALETTE.accent};
      color: #fff;
      font-size: 24px;
      font-weight: 700;
      padding: 8px 20px;
      border-radius: 999px;
      align-self: flex-start;
      margin-bottom: 40px;
    }
  `;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCoverSlide(slide) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyle()}
    .cover { justify-content: center; align-items: center; text-align: center; background: ${PALETTE.primary}; color: #fff; }
    .cover h1 { font-size: 72px; font-weight: 800; line-height: 1.3; }
    .cover p { font-size: 32px; margin-top: 32px; color: ${PALETTE.accent}; }
  </style></head><body>
    <div class="card cover">
      <h1>${escapeHtml(slide.title)}</h1>
      <p>${escapeHtml(slide.subtitle)}</p>
    </div>
  </body></html>`;
}

function renderArticleSlide(slide) {
  const imageUri = loadIllustrationDataUri(slide.category);
  // 이미지가 있으면 상단 배너(540px) + 하단 본문, 없으면(장식 이미지
  // 생성에 실패한 예외적 경우) 기존처럼 본문만 채운 레이아웃으로
  // 안전하게 대체한다.
  const bannerHtml = imageUri
    ? `<div class="banner"><img src="${imageUri}" alt="" /></div>`
    : "";
  const cardPadding = imageUri ? "0" : "80px 64px";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyle()}
    .card.article { padding: ${cardPadding}; }
    .banner { width: 100%; height: 540px; overflow: hidden; flex-shrink: 0; }
    .banner img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .article-body { padding: 48px 64px; display: flex; flex-direction: column; flex: 1; }
    .article-body .badge { margin-bottom: 24px; }
    .article h2 { font-size: 48px; font-weight: 700; line-height: 1.4; margin-bottom: 32px; }
    .article .summary { font-size: 30px; line-height: 1.6; color: ${PALETTE.text}; flex: 1; }
    .article .source { font-size: 22px; color: ${PALETTE.muted}; word-break: break-all; margin-top: 24px; }
  </style></head><body>
    <div class="card article">
      ${bannerHtml}
      <div class="article-body">
        ${slide.category ? `<span class="badge">${escapeHtml(slide.category)}</span>` : ""}
        <h2>${escapeHtml(slide.titleKo)}</h2>
        <p class="summary">${escapeHtml(slide.summaryKo)}</p>
        <p class="source">원문: ${escapeHtml(slide.sourceUrl)}</p>
      </div>
    </div>
  </body></html>`;
}

function renderCtaSlide(slide) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyle()}
    .cta { justify-content: center; text-align: center; background: ${PALETTE.primary}; color: #fff; }
    .cta h2 { font-size: 48px; font-weight: 700; margin-bottom: 40px; }
    .cta .body { font-size: 28px; line-height: 1.6; color: #E5E7EB; }
    .cta .website { font-size: 28px; margin-top: 48px; color: ${PALETTE.accent}; font-weight: 700; }
  </style></head><body>
    <div class="card cta">
      <h2>${escapeHtml(slide.title)}</h2>
      <p class="body">${escapeHtml(slide.body)}</p>
      <p class="website">${escapeHtml(slide.websiteNotice)}</p>
    </div>
  </body></html>`;
}

function renderSlideHtml(slide) {
  switch (slide.type) {
    case "cover":
      return renderCoverSlide(slide);
    case "article":
      return renderArticleSlide(slide);
    case "cta":
      return renderCtaSlide(slide);
    default:
      throw new Error(`알 수 없는 슬라이드 타입: ${slide.type}`);
  }
}

// ------------------------------------------------------------------
// 승인 게이트
// ------------------------------------------------------------------
function checkApprovalGate(issue) {
  const problems = [];
  if (issue.approved !== true) {
    problems.push("이슈 최상위 approved가 true가 아닙니다.");
  }
  issue.slides.forEach((s, i) => {
    if (s.reviewed !== true) {
      problems.push(`슬라이드 ${i + 1}(${s.type})이 reviewed:true가 아닙니다.`);
    }
  });
  return problems;
}

// ------------------------------------------------------------------
// 메인 흐름
// ------------------------------------------------------------------
function loadIssue(issuePath) {
  if (!fs.existsSync(issuePath)) {
    throw new Error(`이슈 파일을 찾을 수 없습니다: ${issuePath}`);
  }
  return JSON.parse(fs.readFileSync(issuePath, "utf8"));
}

function writeHtmlPreview(issue, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const paths = [];
  issue.slides.forEach((slide, i) => {
    const html = renderSlideHtml(slide);
    const p = path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.html`);
    fs.writeFileSync(p, html, "utf8");
    paths.push(p);
  });
  return paths;
}

async function renderPngs(issue, htmlPaths, outDir) {
  // playwright는 여기서만 동적으로 불러온다 — --html-only 단계에서는
  // 이 함수 자체가 호출되지 않으므로 playwright 미설치 상태에서도
  // 1단계는 항상 동작한다.
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (err) {
    throw new Error(
      `playwright를 불러올 수 없습니다: ${err.message}\n` +
        `다음을 먼저 실행하십시오:\n` +
        `  npm install -D playwright\n` +
        `  npx playwright install chromium`
    );
  }

  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });
    for (let i = 0; i < htmlPaths.length; i++) {
      const fileUrl = pathToFileURL(htmlPaths[i]).href;
      await page.goto(fileUrl);
      const outPath = path.join(outDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
      await page.screenshot({ path: outPath });
      console.log(`생성됨: ${path.relative(ROOT, outPath)}`);
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const weekArg = args.find((a) => a.startsWith("--week="))?.split("=")[1];
  const doRender = args.includes("--render");

  if (!weekArg) {
    throw new Error("--week=YYYY-Www 를 지정하십시오 (예: --week=2026-W39)");
  }

  const issueDir = path.join(ROOT, "content", "issues", weekArg);
  const issuePath = path.join(issueDir, "issue.json");
  const issue = loadIssue(issuePath);

  console.log(`이슈 로드: ${issue.issueId} (${issue.slides.length}개 슬라이드)`);

  // 1단계: HTML 미리보기는 언제나 생성한다 (검토용)
  const previewDir = path.join(issueDir, "preview");
  const htmlPaths = writeHtmlPreview(issue, previewDir);
  console.log(`HTML 미리보기 생성 완료: ${path.relative(ROOT, previewDir)}`);
  console.log(`브라우저에서 위 폴더의 slide-NN.html 파일들을 열어 확인하십시오.`);

  if (!doRender) {
    console.log(`\n(PNG 생성 건너뜀 — --render 옵션 없음)`);
    return;
  }

  // 2단계: 승인 게이트 확인 후에만 PNG 생성
  const problems = checkApprovalGate(issue);
  if (problems.length > 0) {
    console.error(`\n🔴 승인 게이트 미통과 — PNG를 생성하지 않습니다:`);
    problems.forEach((p) => console.error(`  - ${p}`));
    console.error(
      `\nissue.json을 열어 검토 후 reviewed/approved를 true로 바꾸고 재실행하십시오.`
    );
    process.exit(1);
  }

  console.log(`\n✅ 승인 게이트 통과 — PNG 생성을 시작합니다.`);
  const imagesDir = path.join(issueDir, "images");
  await renderPngs(issue, htmlPaths, imagesDir);
  console.log(`\n완료: ${path.relative(ROOT, imagesDir)}`);
}

export {
  renderSlideHtml,
  checkApprovalGate,
  writeHtmlPreview,
  loadIssue,
  CARD_WIDTH,
  CARD_HEIGHT,
};

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error(`❌ 렌더링 실패: ${err.message}`);
    process.exit(1);
  });
}

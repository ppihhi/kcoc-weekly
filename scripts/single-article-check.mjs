#!/usr/bin/env node
/* ==================================================================
   single-article-check.mjs (2026-09-29, Gate 전용 임시 검증 도구)
   목적: "단일 기사 검증 → 성공 확인 → 6건 전체 실행" Gate 순서를
   지키기 위해, 실제 issue.json을 건드리지 않고 번역이 필요한
   슬라이드 중 1건만 복제해 translateWithGemini()를 직접 호출한다.
   - 원본 content/issues/{week}/issue.json은 절대 쓰지 않는다(읽기 전용).
   - 이 스크립트는 검증 전용이며 scripts/ 정식 파이프라인의 일부가
     아니다. Gate 통과 후에는 삭제하거나 .gitignore 대상으로 두어도 된다.
   사용:
     node scripts/single-article-check.mjs --week=2026-W40
   ================================================================== */
import {
  loadIssue,
  needsTranslation,
  extractOriginal,
  callGeminiWithRetry,
} from "./translate-summarize.mjs";

async function main() {
  const args = process.argv.slice(2);
  const week = args.find((a) => a.startsWith("--week="))?.split("=")[1];
  if (!week) {
    throw new Error("--week=YYYY-Www 를 지정하십시오 (예: --week=2026-W40)");
  }
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY가 설정되어 있지 않습니다. 이 검증은 실제 Gemini 호출이 필요합니다."
    );
  }

  const { issue } = loadIssue(week); // 읽기 전용, 저장하지 않음
  const targets = issue.slides.filter(needsTranslation);
  if (targets.length === 0) {
    console.log("번역이 필요한 슬라이드가 없어 단일 기사 검증을 생략합니다.");
    return;
  }

  // 실제 파일은 그대로 두고, 메모리상 사본에서 첫 번째 대상 1건만 사용한다.
  const singleSlide = targets[0];
  const original = extractOriginal(singleSlide);

  console.log(`[단일 기사 검증] 대상: "${original.title.slice(0, 60)}..."`);
  console.log("(주의) 이 스크립트는 issue.json에 결과를 저장하지 않습니다 — 검증 전용입니다.\n");

  const start = Date.now();
  try {
    const result = await callGeminiWithRetry(original, singleSlide.category);
    const elapsed = Date.now() - start;
    console.log(`\n소요 시간: ${elapsed}ms`);
    console.log("✅ 단일 기사 검증 성공 — 결과 미리보기 (저장되지 않음):");
    console.log(`   titleKo: ${result.titleKo}`);
    console.log(`   summaryKo: ${result.summaryKo}`);
    console.log("\n다음 단계: 이제 6건 전체 실행으로 진행해도 좋습니다.");
    console.log(`  node scripts/translate-summarize.mjs --week=${week}`);
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`\n소요 시간: ${elapsed}ms`);
    console.log(`❌ 단일 기사 검증 실패: ${err.message}`);
    console.log("6건 전체 실행으로 넘어가지 마십시오. AI_WORKING_RULES.md §8 중단 기준을 확인하십시오.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`❌ 단일 기사 검증 오류: ${err.message}`);
  process.exit(1);
});

/* ==================================================================
   load-env.mjs (2026-09-27 신설)

   역할: 프로젝트 루트의 .env 파일을 읽어 process.env에 주입하는
   경량 로더. 외부 패키지(dotenv 등) 설치 없이 동작한다 — Node
   내장 fs만 사용해 "월 0원·최소 의존성" 원칙을 유지한다.

   사용법 (다른 스크립트 맨 위에 추가):
     import "./load-env.mjs";
   또는 명시적으로 여러 번 안전하게 호출 가능:
     import { loadEnv } from "./load-env.mjs";
     loadEnv();

   동작 원칙:
   - .env 파일이 없어도 오류를 내지 않는다(조용히 건너뜀) — 예를 들어
     $env:GEMINI_API_KEY를 셸에서 직접 설정한 사용자는 .env가 없어도
     정상 동작해야 한다.
   - 이미 process.env에 설정된 값(셸에서 직접 export/$env:로 지정한
     값)은 절대 덮어쓰지 않는다. 즉 "셸 설정 > .env 파일" 우선순위를
     지킨다 — 임시 세션 설정이 파일 설정보다 우선해야 직관적이다.
   - 값에 따옴표(" 또는 ')가 둘러져 있으면 제거한다.
   - #으로 시작하는 줄과 빈 줄은 무시한다.
   - 파싱 실패(형식이 이상한 줄)는 해당 줄만 건너뛰고 전체를 중단하지
     않는다 — 사용자가 실수로 이상한 줄을 넣었다고 전체 파이프라인이
     막히면 안 된다. 다만 무엇을 건너뛰었는지는 경고로 알린다.
   ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

function stripQuotes(value) {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function parseEnvContent(content) {
  const result = {};
  const lines = content.split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      console.warn(
        `⚠️ .env ${i + 1}번째 줄 형식을 해석할 수 없어 건너뜁니다: "${trimmed}"`
      );
      return;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1);
    if (!key) {
      console.warn(`⚠️ .env ${i + 1}번째 줄에 키가 없어 건너뜁니다.`);
      return;
    }

    result[key] = stripQuotes(rawValue);
  });
  return result;
}

function loadEnv({ path: envPath = ENV_PATH, verbose = false } = {}) {
  if (!fs.existsSync(envPath)) {
    if (verbose) {
      console.log(
        `(.env 파일 없음: ${envPath} — 셸 환경변수만 사용합니다. 문제 아님.)`
      );
    }
    return { loaded: 0, skipped: 0, source: null };
  }

  const content = fs.readFileSync(envPath, "utf8");
  const parsed = parseEnvContent(content);

  let loaded = 0;
  let skipped = 0;
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] !== undefined) {
      // 셸에서 이미 설정된 값을 우선한다 — 파일 값으로 덮어쓰지 않는다.
      skipped++;
      if (verbose) {
        console.log(
          `  (${key}는 이미 셸 환경변수로 설정되어 있어 .env 값을 무시합니다)`
        );
      }
      continue;
    }
    process.env[key] = value;
    loaded++;
  }

  if (verbose) {
    console.log(
      `.env 로드 완료: ${loaded}건 적용 · ${skipped}건 건너뜀(셸 값 우선) — ${path.relative(ROOT, envPath)}`
    );
  }

  return { loaded, skipped, source: envPath };
}

// 2026-09-27 설계 변경: 이 모듈은 import만으로 자동 실행되지 않는다.
// 초기 설계는 "import만 해도 즉시 로드"였는데, 실제 테스트 중
// "모듈 레벨 자동 실행"과 "사용자의 명시적 loadEnv() 호출"이 겹쳐
// 두 번째 호출 시 결과가 항상 "이미 설정됨(skipped)"으로만 나와
// 혼란을 일으키는 결함이 발견됐다(로드 자체는 정상이었지만 로그가
// 오해를 낳았다). 따라서 반드시 아래처럼 명시적으로 호출해야 한다:
//
//   import { loadEnv } from "./load-env.mjs";
//   loadEnv({ verbose: true });
//
// "암묵적으로 조용히 실행되는 것"보다 "명시적으로 호출하고 결과를
// 눈으로 확인하는 것"이 이 프로젝트의 반복된 교훈(WORKFLOW.md §9)과
// 일치한다.

export { loadEnv, parseEnvContent, ENV_PATH };

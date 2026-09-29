#!/usr/bin/env node
/* ==================================================================
   translate-summarize.mjs (2026-09-27 신설, .env 로더 통합)
   (2026-09-29 FIX SPEC v1 반영: 재시도/구조화 출력, DEC-028 참조)
   (2026-09-29 FIX SPEC v2 반영: 모델 폴백 추가, DEC-030 참조)
   역할: content/issues/{주차}/issue.json 안의 "[번역 필요]" 표시된
   기사 슬라이드를 실제로 한국어 번역·요약한다.
   두 가지 경로 (자동 선택):
   [경로 A] GEMINI_API_KEY가 설정된 경우 (셸 환경변수 또는 .env 파일)
     Google Gemini API(무료 티어)를 호출해 자동으로 번역·요약한다.
   [경로 B] 없는 경우 (기본 대체 경로)
     translation-request.md 파일을 생성해 Copilot 대화창에 붙여넣을
     수 있게 한다.
   GEMINI_API_KEY 확인 순서: 셸 환경변수 우선 → 없으면 .env 파일
   (load-env.mjs가 이 우선순위를 보장한다).
   중요 원칙 (CONTENT_POLICY 준수):
   - 원문 전체를 그대로 번역하지 않는다. 독자적인 한국어 요약을
     만들도록 프롬프트에 명시한다.
   - 번역·요약 후에도 각 슬라이드의 reviewed는 false로 유지된다.
     이 스크립트는 초안을 채울 뿐, 검토·승인은 여전히 사람이 한다.

   FIX SPEC v1 요약 (DEC-028 / WORKSPACE.md §15 반영):
   - 408, 429, 500, 502, 503, 504, 네트워크 오류, 타임아웃만 제한적으로
     재시도한다(모델당 최대 4회, 지수 백오프 + 지터, Retry-After 우선).
   - 400, 401, 403, 404는 즉시 실패 처리한다(재시도하지 않음).
   - Gemini 응답은 responseMimeType/responseSchema로 JSON 구조화 출력을
     강제한다. HTTP 성공 후에도 JSON 형식이 어긋나면 최대 1회만 재시도한다.
   - 성공한 슬라이드만 저장하고, 실패한 슬라이드는 "[번역 필요]" placeholder를
     그대로 유지해 다음 실행에서 재처리 가능하게 한다.

   FIX SPEC v2 추가 (2026-09-29, 실사용 확인: gemini-3.8-flash가 무료
   티어에서 503 UNAVAILABLE(high demand)과 429(일일 할당량 20 RPD 소진)를
   함께 반환하는 사례 확인. 503은 Google 서버 측 컴퓨팅 자원 부족, 429는
   무료 티어 일일 한도 소진으로, 둘 다 코드 문제가 아님):
   - 기본 모델에서 재시도 한도(MAX_HTTP_RETRIES)를 모두 소진해도 503/429
     등 재시도 가능한 오류가 계속되면, GEMINI_FALLBACK_MODELS에 정의된
     다음 모델로 자동 전환해 같은 요청을 다시 시도한다.
   - 기본 폴백 순서: gemini-3.8-flash(기본) → gemini-3.5-flash-lite.
     (2026-09-29 1차로 시도했던 gemini-2.5-flash는 Google이 2026-09-18부터
     "과거에 2.5 계열을 활발히 사용한 사용자"에게만 접근을 제한해, 신규
     프로젝트에서는 HTTP 404 "no longer available to new users"로 즉시
     실패한다는 것을 실사용 로그로 확인해 제외했다. gemini-3.5-flash-lite는
     Google이 신규 프로젝트에 공식 권장하는 대체 모델이며, 무료 티어
     일일 한도도 500 RPD로 gemini-3.8-flash(20 RPD)보다 훨씬 넉넉하다.)
   - 모든 모델을 순서대로 시도한 뒤에도 실패하면, 마지막 모델의 오류를
     그대로 전파한다(거짓 성공 금지).
   - 어떤 모델로 최종 성공했는지 로그에 남긴다(문서 반영 시 참고용).
   ================================================================== */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnv } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// .env 파일을 명시적으로 로드한다(셸 값이 있으면 그쪽이 우선 유지됨).
// verbose:true로 두어 어느 값이 어디서 왔는지 항상 눈으로 확인 가능하게 한다.
loadEnv({ verbose: true });

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const PLACEHOLDER_PREFIX = "[번역 필요]";

// ---- FIX SPEC v2: 모델 폴백 순서 ----
// GEMINI_FALLBACK_MODELS="model1,model2"로 재정의 가능. 지정 없으면 기본값 사용.
// 기본 모델(GEMINI_MODEL)이 목록에 이미 있으면 중복 제거한다.
const DEFAULT_FALLBACKS = ["gemini-3.5-flash-lite"];
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS
  ? process.env.GEMINI_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
  : DEFAULT_FALLBACKS
).filter((m) => m !== PRIMARY_MODEL);
const MODEL_CHAIN = [PRIMARY_MODEL, ...FALLBACK_MODELS];

function buildEndpoint(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

// ---- FIX SPEC v1: 재시도 정책 상수 (DEC-028) ----
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_HTTP_RETRIES = 4;
const MAX_FORMAT_RETRIES = 1;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 20000;

function buildIssuePath(week) {
  return path.join(ROOT, "content", "issues", week, "issue.json");
}

function loadIssue(week) {
  const p = buildIssuePath(week);
  if (!fs.existsSync(p)) {
    throw new Error(`이슈 파일을 찾을 수 없습니다: ${p}`);
  }
  return { issue: JSON.parse(fs.readFileSync(p, "utf8")), issuePath: p };
}

function saveIssue(issuePath, issue) {
  fs.writeFileSync(issuePath, JSON.stringify(issue, null, 2), "utf8");
}

function needsTranslation(slide) {
  return (
    slide.type === "article" &&
    typeof slide.titleKo === "string" &&
    slide.titleKo.startsWith(PLACEHOLDER_PREFIX)
  );
}

function extractOriginal(slide) {
  return {
    title: slide.titleKo.replace(PLACEHOLDER_PREFIX, "").trim(),
    summary: slide.summaryKo.replace(PLACEHOLDER_PREFIX, "").trim(),
  };
}

function buildPrompt(original, category) {
  return `너는 한국어 교회 소식 카드뉴스의 편집자다. 다음 영어 기사 정보를
읽고, 한국어 독자를 위한 제목과 요약을 새로 작성해라.
# 원문
제목: ${original.title}
카테고리: ${category || "일반"}
요약(영어): ${original.summary}
# 작성 지침
- 원문을 그대로 직역하지 말고, 핵심 내용을 이해한 뒤 독자적인
  한국어 문장으로 다시 써라.
- 문체는 쉽고 친근한 설명형("~합니다/~됩니다" 톤)으로 쓴다.
- 제목은 20자 내외, 한국 독자가 바로 이해할 수 있는 자연스러운
  표현으로 쓴다.
- 요약은 2문장, 합쳐서 90자 내외로 간결하게 쓴다.
- 광고성 문구, 원문 사이트명 반복, "더 알아보기" 같은 상투구는
  넣지 않는다.
- 반드시 아래 JSON 형식으로만 응답한다. 다른 설명·머리말·코드펜스를
  붙이지 않는다.
{"titleKo": "...", "summaryKo": "..."}`;
}

function parseGeminiResponse(raw) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`응답에서 JSON을 찾을 수 없습니다: ${raw.slice(0, 200)}`);
  }
  const parsed = JSON.parse(match[0]);
  if (!parsed.titleKo || !parsed.summaryKo) {
    throw new Error(`필수 필드 누락: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

// ---- FIX SPEC: 타입이 있는 HTTP 오류 (재시도 판단에 사용) ----
class GeminiHttpError extends Error {
  constructor(status, retryAfterSeconds, body) {
    super(`Gemini API 오류 HTTP ${status}: ${body.slice(0, 300)}`);
    this.name = "GeminiHttpError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 지수 백오프 + 지터. Retry-After가 있으면 그 값을 우선한다.
function computeBackoffMs(attempt, retryAfterSeconds) {
  if (retryAfterSeconds != null && !Number.isNaN(retryAfterSeconds)) {
    return Math.min(Math.max(retryAfterSeconds, 0) * 1000, MAX_DELAY_MS);
  }
  const exp = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  const jitter = Math.random() * exp * 0.5;
  return exp + jitter;
}

// 408/429/5xx가 아닌 네트워크·타임아웃 오류만 재시도 대상으로 판단한다.
function isRetryableNetworkError(err) {
  const name = err?.name || "";
  if (name === "AbortError" || name === "TimeoutError") return true;
  if (err?.code && ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "ECONNREFUSED"].includes(err.code)) {
    return true;
  }
  if (name === "TypeError" && /fetch/i.test(err?.message || "")) return true;
  return false;
}

// 단일 HTTP 호출(특정 모델 대상). 실패 시 상태코드와 Retry-After를 담은 에러를 던진다.
async function fetchGeminiRaw(model, prompt) {
  const url = `${buildEndpoint(model)}?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 300,
        // FIX SPEC: 프롬프트 지시에만 의존하지 않고 구조화 출력을 강제한다.
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            titleKo: { type: "STRING" },
            summaryKo: { type: "STRING" },
          },
          required: ["titleKo", "summaryKo"],
        },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : null;
    throw new GeminiHttpError(res.status, retryAfterSeconds, body);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini 응답 구조를 해석할 수 없습니다: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return text;
}

// 단일 모델에 대해 HTTP 재시도(최대 4회)와 형식 오류 재시도(최대 1회)를 수행한다.
// 재시도를 모두 소진하고도 재시도 가능한 오류(503/429/네트워크 등)로 실패하면
// "모델 전환이 필요함"을 나타내는 결과를 반환한다. 재시도 불가능한 오류
// (400/401/403/404, 형식 오류 한도 초과)는 즉시 위로 던진다(모델을 바꿔도
// 소용없는 오류이기 때문).
async function callGeminiOnModel(model, prompt) {
  let httpAttempt = 0;
  let formatAttempt = 0;

  for (;;) {
    let rawText;
    try {
      rawText = await fetchGeminiRaw(model, prompt);
    } catch (err) {
      const isHttpRetryable =
        err instanceof GeminiHttpError && RETRYABLE_STATUS.has(err.status);
      const isNetworkRetryable =
        !(err instanceof GeminiHttpError) && isRetryableNetworkError(err);

      if ((isHttpRetryable || isNetworkRetryable) && httpAttempt < MAX_HTTP_RETRIES) {
        const retryAfterSeconds =
          err instanceof GeminiHttpError ? err.retryAfterSeconds : null;
        const delay = computeBackoffMs(httpAttempt, retryAfterSeconds);
        httpAttempt++;
        console.error(
          `  ⚠ [${model}] 재시도 ${httpAttempt}/${MAX_HTTP_RETRIES} - ${err.message} - ${Math.round(delay)}ms 대기`
        );
        await sleep(delay);
        continue;
      }
      if (isHttpRetryable || isNetworkRetryable) {
        err.exhaustedRetries = true;
      }
      throw err;
    }

    try {
      return parseGeminiResponse(rawText);
    } catch (parseErr) {
      if (formatAttempt < MAX_FORMAT_RETRIES) {
        formatAttempt++;
        console.error(`  ⚠ [${model}] JSON 형식 오류, 1회 재시도: ${parseErr.message}`);
        continue;
      }
      parseErr.exhaustedRetries = true;
      throw parseErr;
    }
  }
}

// FIX SPEC v2 핵심: 기본 모델부터 시작해 재시도 가능한 오류로 한 모델의
// 재시도 한도를 모두 소진하면 다음 모델로 자동 전환한다. 재시도 불가능한
// 오류(400/401/403/404)는 모델 전환 없이 즉시 실패로 전파한다.
async function callGeminiWithRetry(original, category) {
  const prompt = buildPrompt(original, category);
  let lastErr;
  for (let i = 0; i < MODEL_CHAIN.length; i++) {
    const model = MODEL_CHAIN[i];
    try {
      const result = await callGeminiOnModel(model, prompt);
      if (i > 0) {
        console.error(`  ℹ 폴백 모델 "${model}"로 성공했습니다 (기본 모델 "${PRIMARY_MODEL}" 실패 후 전환).`);
      }
      return result;
    } catch (err) {
      lastErr = err;
      const isImmediateFail =
        err instanceof GeminiHttpError && !RETRYABLE_STATUS.has(err.status);
      if (isImmediateFail) {
        throw err;
      }
      if (i < MODEL_CHAIN.length - 1) {
        console.error(`  ⚠ 모델 "${model}"에서 재시도 한도 소진 — 다음 모델 "${MODEL_CHAIN[i + 1]}"로 전환합니다.`);
      }
    }
  }
  throw lastErr;
}

async function translateWithGemini(issue) {
  const targets = issue.slides.filter(needsTranslation);
  if (targets.length === 0) {
    console.log("번역이 필요한 슬라이드가 없습니다.");
    return { translated: 0, failed: 0 };
  }
  console.log(`Gemini API로 ${targets.length}건 번역·요약을 시도합니다... (모델 순서: ${MODEL_CHAIN.join(" → ")})`);
  let translated = 0;
  let failed = 0;
  for (const slide of targets) {
    const original = extractOriginal(slide);
    try {
      const result = await callGeminiWithRetry(original, slide.category);
      slide.titleKo = result.titleKo;
      slide.summaryKo = result.summaryKo;
      translated++;
      console.log(`  ✅ ${result.titleKo}`);
    } catch (err) {
      failed++;
      console.error(`  ❌ 실패 (${original.title.slice(0, 40)}...): ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { translated, failed };
}

function writeTranslationRequest(issue, issuePath) {
  const targets = issue.slides.filter(needsTranslation);
  if (targets.length === 0) {
    console.log("번역이 필요한 슬라이드가 없습니다.");
    return null;
  }
  const lines = [];
  lines.push(`# 번역 요청 — ${issue.issueId}`);
  lines.push("");
  lines.push(
    "아래 기사들을 CONTENT_POLICY·EDITORIAL_GUIDE 기준으로 번역·요약해줘. " +
      "원문을 직역하지 말고 핵심을 이해해서 독자적인 한국어 문장으로 다시 써줘. " +
      "각 기사마다 제목(20자 내외)과 요약(2문장, 90자 내외)을 줘."
  );
  lines.push("");
  targets.forEach((slide, i) => {
    const original = extractOriginal(slide);
    lines.push(`## 기사 ${i + 1} (카테고리: ${slide.category || "일반"})`);
    lines.push(`제목: ${original.title}`);
    lines.push(`요약: ${original.summary}`);
    lines.push("");
  });
  const outPath = path.join(path.dirname(issuePath), "translation-request.md");
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  return outPath;
}

async function main() {
  const args = process.argv.slice(2);
  const week = args.find((a) => a.startsWith("--week="))?.split("=")[1];
  const forceManual = args.includes("--manual");
  if (!week) {
    throw new Error("--week=YYYY-Www 를 지정하십시오 (예: --week=2026-W39)");
  }
  const { issue, issuePath } = loadIssue(week);
  if (GEMINI_API_KEY && !forceManual) {
    console.log(`[경로 A] GEMINI_API_KEY 감지됨 — 자동 번역을 시도합니다.`);
    const { translated, failed } = await translateWithGemini(issue);
    saveIssue(issuePath, issue);
    console.log(`\n완료: 번역 ${translated}건 · 실패 ${failed}건`);
    if (failed > 0) {
      console.log(
        `일부 실패한 항목은 여전히 "[번역 필요]" 표시가 남아있습니다. ` +
          `재실행하거나 --manual 옵션으로 수동 경로를 이용하십시오.`
      );
    }
  } else {
    console.log(
      forceManual
        ? `[경로 B] --manual 지정됨 — 수동 번역 요청 파일을 생성합니다.`
        : `[경로 B] GEMINI_API_KEY가 설정되지 않음 — 수동 번역 요청 파일을 생성합니다.`
    );
    const outPath = writeTranslationRequest(issue, issuePath);
    if (outPath) {
      console.log(`생성됨: ${path.relative(ROOT, outPath)}`);
      console.log(
        `\n다음 단계: 이 파일 내용을 Copilot 대화창에 붙여넣어 번역을 받은 뒤,\n` +
          `그 응답을 scripts/apply-manual-translation.mjs로 병합하십시오.`
      );
    }
  }
}

export {
  needsTranslation,
  extractOriginal,
  buildPrompt,
  parseGeminiResponse,
  writeTranslationRequest,
  loadIssue,
  callGeminiWithRetry,
  GeminiHttpError,
  MODEL_CHAIN,
  PLACEHOLDER_PREFIX,
};

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch((err) => {
    console.error(`❌ 번역·요약 실패: ${err.message}`);
    process.exit(1);
  });
}

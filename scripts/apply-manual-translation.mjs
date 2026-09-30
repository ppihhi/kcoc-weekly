#!/usr/bin/env node
/* ==================================================================
   apply-manual-translation.mjs (2026-09-27 신설)

   역할: translate-summarize.mjs --manual 로 생성된 translation-request.md에
   대해 Copilot 대화창에서 받은 번역 응답을, 정해진 형식으로 저장한
   translation-response.md 파일에서 읽어 issue.json에 병합한다.

   응답 파일 형식 (translation-response.md):
   ## 기사 1
   제목: 국제 소식지, 9월 27일자 발행
   요약: 전 세계 제자들과 교회를 잇는 국제 소식지 이번 주호가 나왔습니다. ...

   순서는 translation-request.md에 나열된 순서와 정확히 일치해야 한다.
   ================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { needsTranslation, loadIssue } from "./translate-summarize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function parseResponseFile(content) {
  const blocks = content.split(/^## 기사 \d+/m).slice(1);
  return blocks.map((block) => {
    const titleMatch = block.match(/제목:\s*(.+)/);
    const summaryMatch = block.match(/요약:\s*(.+)/);
    if (!titleMatch || !summaryMatch) {
      throw new Error(
        `응답 블록에서 제목 또는 요약을 찾을 수 없습니다:\n${block.slice(0, 100)}`
      );
    }
    return {
      titleKo: titleMatch[1].trim(),
      summaryKo: summaryMatch[1].trim(),
    };
  });
}

function applyTranslations(issue, translations) {
  const targets = issue.slides.filter(needsTranslation);
  if (targets.length !== translations.length) {
    throw new Error(
      `번역 대상(${targets.length}건)과 응답 개수(${translations.length}건)가 ` +
        `일치하지 않습니다. translation-request.md와 응답 파일의 순서를 확인하십시오.`
    );
  }
  targets.forEach((slide, i) => {
    slide.titleKo = translations[i].titleKo;
    slide.summaryKo = translations[i].summaryKo;
  });
  return targets.length;
}

function main() {
  const args = process.argv.slice(2);
  const week = args.find((a) => a.startsWith("--week="))?.split("=")[1];
  if (!week) {
    throw new Error("--week=YYYY-Www 를 지정하십시오");
  }

  const { issue, issuePath } = loadIssue(week);
  const responsePath = path.join(
    path.dirname(issuePath),
    "translation-response.md"
  );

  if (!fs.existsSync(responsePath)) {
    throw new Error(
      `응답 파일을 찾을 수 없습니다: ${responsePath}\n` +
        `translation-request.md 내용을 Copilot에 붙여넣고 받은 답변을 ` +
        `이 경로에 지정된 형식으로 저장하십시오.`
    );
  }

  const content = fs.readFileSync(responsePath, "utf8");
  const translations = parseResponseFile(content);
  const count = applyTranslations(issue, translations);

  fs.writeFileSync(issuePath, JSON.stringify(issue, null, 2), "utf8");
  console.log(`병합 완료: ${count}건 반영됨 → ${path.relative(ROOT, issuePath)}`);
}

export { parseResponseFile, applyTranslations };

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main();
}

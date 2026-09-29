### CHANGELOG.md

### kcoc-weekly — 변경 이력
- **기준일:** 2026-09-27  
실제 변경을 최신순으로 기록한다. 결정 이유는 DECISION_LOG.md, 현재 상태는
CURRENT_STATE.md를 따른다.

#### [Gemini 번역 파이프라인 FIX SPEC 및 모델 폴백] - 2026-09-29

##### Added
- 408/429/500/502/503/504 및 네트워크/타임아웃 오류에 한정한 재시도
(모델당 최대 4회, 지수 백오프+지터, Retry-After 우선)
- Gemini responseMimeType/responseSchema 기반 JSON 구조화 출력
- HTTP 성공 후 형식 오류 최대 1회 재시도(HTTP 재시도와 분리)
- 기본 모델(gemini-3.8-flash) 재시도 소진 시 gemini-3.5-flash-lite로
자동 전환하는 모델 폴백 로직 (GEMINI_FALLBACK_MODELS로 재정의 가능)
- scripts/single-article-check.mjs (Gate 전용 단일 기사 검증 도구,
issue.json을 저장하지 않는 읽기 전용 스크립트)

##### Fixed
- gemini-3.8-flash의 HTTP 503(서버 고부하)과 HTTP 429(무료 티어 일일
한도 20 RPD 소진)로 인한 번역 실패를 모델 폴백으로 우회
- scripts/translate-summarize.restore-test.mjs 삭제 — 이전 디버깅
세션의 미추적 잔재 파일로, 이미 해결된 /models/models/ 중복
엔드포인트 버그가 남아있었음(실행/참조된 적 없어 실제 영향은 없었음)

##### Tests
- mock fetch 기반 로직 테스트: 재시도 정책 7종, 모델 폴백 전환 3종
전부 통과
- 실제 GEMINI_API_KEY로 단일 기사 검증 성공(gemini-3.5-flash-lite로
폴백되어 정상 번역·요약 확인)
- 6건 전체 실행 성공: 번역 6건 · 실패 0건 (대상: 2026-W40)

##### Known Issues
- gemini-3.8-flash 무료 티어 일일 한도(20 RPD)가 낮아, 반복 테스트만
으로도 쉽게 소진됨. 발행 규모 확대 시 유료 티어 전환 또는
gemini-3.5-flash-lite 기본 모델 승격을 별도 검토 필요(미확정)

#### [Unreleased]

##### Added
- CURRENT_STATE.md, CHANGELOG.md, WORKSPACE.md 신설 (9.5 트랙 — 하나테니스
방법론 이식 검증 결과 반영)

##### Operations
- 하나테니스클럽 프로젝트에서 검증된 5역할 문서 체계(장기정책/현재상태/
결정로그/변경이력/작업환경) 중 누락되었던 3종을 보완했다.
- 기존 7개 도메인 정책 문서(CONTENT_POLICY 등)는 그대로 유지한다 — 이식
검증 결과 도메인 특화 분리 자체는 타당하다고 판정했다(9.5 검증 항목 1).


### [Phase 1] — 저장소 기반 구조 (2026-09-23)

#### Added
- 정책 문서 7종을 APPROVED / 1.0 기준선으로 승인
- 저장소 구조 생성 (.github/workflows, config, content/issues, data, docs,
  public, scripts, src, templates, tests)
- 정적 웹사이트 골격 (메인·소개·이용안내·아카이브·404, 모바일 반응형 CSS)
- 자동검증 4종 신설: check-static.mjs, check-content.mjs, check-links.mjs,
  check-all.mjs
- GitHub Actions 3종 구성:
  - validate-content.yml (push/PR 자동검증)
  - deploy-pages.yml (검증 통과 후 public/ 을 GitHub Pages에 배포)
  - collect-weekly.yml (매주 월요일 06:00 KST 실행 예정, 현재 dry-run
    placeholder)

#### Changed
- 저장소명을 이전 명칭에서 kcoc-weekly로 변경 (사유·경과는 DEC-025 참조)
- 비공식 개인 프로젝트 고지를 메인·소개·이용안내·README에 강화

#### Tests
- check-all.mjs 최초 실행 시 전체 통과 확인 (OK static 6 / OK content
  policy / OK internal HTML)
- npm audit 취약점 0건 확인

### [9.5 감사] — 2026-09-27

#### Tests
- 검증 스크립트 5종(check-static/content/links/naming/all) 전체 재실행,
  전부 통과 확인
- 전체 프로젝트 용량 0.03MB 확인 — Bundle 도구 불필요 규모로 판정
- GitHub Actions 워크플로 3종 내용 확인, Node 24 버전 고정 확인

### [Gemini 번역 파이프라인 디버깅] - 2026-09-28

#### Fixed
- 종료된 `gemini-2.0-flash` 사용 문제를 확인했다.
- 모델 ID와 API 리소스 경로의 중복 조립 원인을 확인하고 내부 모델 ID를 `gemini-3.8-flash` 형식으로 정규화했다.
- `/v1beta/models/models/...` 형태의 잘못된 엔드포인트를 제거했다.
- 손상된 `translate-summarize.mjs`를 정상 백업에서 복원하고 UTF-8 BOM 및 한글 인코딩 손상을 제거했다.
- `node --check`와 종료 코드 0으로 문법 정상 상태를 확인했다.

#### Known Issues
- Gemini 모델 고수요 시 HTTP 503 `UNAVAILABLE`을 즉시 실패로 처리한다.
- HTTP 200 응답이 요구한 JSON 형식을 따르지 않으면 파싱에 실패한다.
- 제한된 지수 백오프, 지터, `Retry-After` 처리와 구조화 출력은 아직 구현되지 않았다.

#### Pending
- 503 및 일시적 오류의 제한된 재시도 구현
- JSON 구조화 출력과 형식 오류 1회 재시도 구현
- 단일 기사 검증 성공 후 6건 전체 번역 실행
- 전체 Gate 및 Git diff 검토 후 커밋 여부 결정

#### Operations
- PowerShell 형식명 오타, 비종료 오류 후 거짓 성공 메시지, `.mjs` BOM 추가, 한글 인코딩 손상을 재발 방지 규칙으로 등록했다.
- 공통 실행 안전 규칙은 `AI_WORKING_RULES.md`, 프로젝트 세부 규칙은 `WORKSPACE.md`, 정책급 결정은 `DECISION_LOG.md`에서 관리한다.

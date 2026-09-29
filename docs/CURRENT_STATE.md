## CURRENT_STATE.md

### kcoc-weekly — 변경 이력
- **기준일:** 2026-09-27 
실제 변경을 최신순으로 기록한다. 결정 이유는 DECISION_LOG.md, 현재 상태는 CURRENT_STATE.md를 따른다. 
#### [Gemini 번역 파이프라인 FIX SPEC 및 모델 폴백] - 2026-09-29 
(...기존 Added/Fixed/Tests/Known Issues 내용 그대로, 헤딩만 h5→h4로...) 
#### [Unreleased]

## kcoc-weekly — 현재 상태
- **기준일:** 2026-09-27
- **제품 버전:** Phase 1 (정적 사이트·정책 문서만 존재, 수집기 미구현)
- **문서 상태:** 9.5 트랙(하나테니스 방법론 이식 검증) 중 신설

이 문서는 "지금 어디까지 왔는가"만 기록한다. 장기 정책은 PROJECT_CONTEXT.md,
결정 이유는 DECISION_LOG.md, 도메인별 세부 정책은 CONTENT_POLICY.md /
SOURCE_POLICY.md / STATE_POLICY.md / EDITORIAL_GUIDE.md / OPERATIONS_GUIDE.md를
따른다.

### 1. 현재 확인된 상태

#### 완료됨 (Phase 1)
- 저장소명 kcoc-weekly로 확정(비공식 고지 강화 포함, DEC-025)
- 정적 웹사이트 골격(메인·소개·이용안내·아카이브·404) 생성
- 검증 스크립트 5종 전부 통과 확인 (2026-09-27 감사)
  - check-static.mjs: OK static 6
  - check-content.mjs: OK content policy
  - check-links.mjs: OK internal HTML
  - check-naming.mjs: OK naming kcoc-weekly
  - check-all.mjs: ALL CHECKS PASSED
- GitHub Actions 3종 구성 (validate-content / deploy-pages / collect-weekly placeholder)

#### 🔴 아직 구현되지 않음 (Phase 2 대상)
- 실제 콘텐츠 수집기 코드 (collect-weekly.yml은 현재 dry-run placeholder)
- STATE_POLICY.md에 정의된 기사상태·발행호상태 전이를 실제로 구현하는 코드
- 카드뉴스 생성·발송 로직 자체

### 2. 현재 코드·문서 기준
- 프로젝트 루트: C:\Projects\kcoc-weekly
- 웹 공개 폴더: public\
- 정책 문서: docs\ (7개 — PROJECT_CONTEXT/CONTENT_POLICY/SOURCE_POLICY/
  STATE_POLICY/EDITORIAL_GUIDE/OPERATIONS_GUIDE/DECISION_LOG)
- 총 프로젝트 용량: 약 0.03MB (2026-09-27 감사 기준, Bundle 도구 불필요 규모)

### 3. 최근 완료된 기능 변경
- Phase 1 저장소 기반 구조·정적 사이트·GitHub Actions 구축 (2026-09-23)
- 저장소명 kcoc-weekly 확정 및 비공식 고지 강화 (DEC-025, 2026-09-23)

### 4. 미확인·미완료 항목

#### 🔴 최우선 — Phase 2 착수 여부 결정
-  실제 수집기(collect-weekly.yml의 dry-run placeholder를 실제 로직으로 교체) 설계 필요
-  STATE_POLICY.md의 기사상태 전이가 실제 코드에서 어떻게 구현될지 미정

#### 문서 체계 보완 (9.5 트랙에서 발견)
-  이 CURRENT_STATE.md 자체가 이번에 신설됨 — 실제 반영 여부 확인 필요
-  CHANGELOG.md, WORKSPACE.md도 함께 신설 필요 (별첨)
-  check-static.mjs의 문서버전 파싱 방식 점검 — 하나테니스에서 겪은
   `parseFloat("1.0-slim")` 오판 사례와 동일한 위험이 있는지 확인 필요

#### 하나테니스로부터 역이식 검토 대상
-  하나테니스는 GitHub Actions 미도입(DEC-P01 보류) — 카드뉴스의
   validate-content.yml / deploy-pages.yml 구성을 하나테니스에도
   적용할지 검토 가치 있음

### 5. 다음으로 수행할 가장 작은 안전한 작업
- CURRENT_STATE.md / CHANGELOG.md / WORKSPACE.md 3개를 docs\에 실제로 추가한다.
- check-static.mjs가 이 신규 문서들을 정상 인식하는지 재검증한다.
- Phase 2(실제 수집기 설계) 착수 여부를 결정한다.

### 6. Gemini 번역 파이프라인 상태 - 2026-09-29 갱신
- **상태:** 재개 완료
- **대상 이슈:** 2026-W40
- **결과:** 번역 6건 · 실패 0건 (2026-09-29)

#### FIX SPEC 구현 및 검증 (DEC-029)
- 재시도: 408/429/5xx/네트워크 오류, 모델당 최대 4회, 지수 백오프+지터,
  Retry-After 우선
- 구조화 출력: responseMimeType/responseSchema로 JSON 형식 강제, 형식
  오류는 최대 1회만 추가 재시도
- 모델 폴백: gemini-3.8-flash(기본) 실패 시 gemini-3.5-flash-lite로
  자동 전환. 1차로 시도한 gemini-2.5-flash는 Google이 신규 프로젝트
  접근을 제한(HTTP 404)해 제외했다.
- 성공분만 저장, 실패분은 [번역 필요] placeholder 유지(재처리 가능)

#### 실사용 중 확인된 사실
- gemini-3.8-flash 무료 티어 일일 한도: 20 RPD (여러 차례 단일 기사
  검증을 반복하며 당일 한도를 소진, HTTP 429 발생)
- gemini-3.8-flash는 이 외에도 HTTP 503(UNAVAILABLE, Google 서버 측
  일시적 고부하)도 함께 관찰됨
- gemini-3.5-flash-lite 무료 티어 일일 한도: 500 RPD (여유 충분)

#### 정리된 잔재 파일
- scripts/translate-summarize.restore-test.mjs 삭제 (미추적 상태였고
  다른 코드에서 참조되지 않음을 확인, 구 /models/models/ 중복
  엔드포인트 버그가 남아있던 일회성 검증 파일)

#### 다음으로 수행할 가장 작은 안전한 작업
- node scripts\check-all.mjs 실행 및 통과 확인
- git diff로 scripts/translate-summarize.mjs, content/issues/2026-W40/
  issue.json 변경 범위 검토
- 통과 후 커밋 여부 결정
- (참고) git status에 미추적/미커밋 상태인 파이프라인 스크립트
  다수(apply-manual-translation.mjs, draft-issue.mjs,
  render-cardnews.mjs 등)와 수정된 docs 파일들이 있어, 이번 커밋
  범위를 번역 파이프라인 FIX SPEC 관련 파일로 한정할지 함께 정리할지
  판단 필요

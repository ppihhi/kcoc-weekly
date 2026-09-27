## CHANGELOG.md

## kcoc-weekly — 변경 이력
- **기준일:** 2026-09-27

실제 변경을 최신순으로 기록한다. 결정 이유는 DECISION_LOG.md, 현재 상태는
CURRENT_STATE.md를 따른다.

### [Unreleased]

#### Added
- CURRENT_STATE.md, CHANGELOG.md, WORKSPACE.md 신설 (9.5 트랙 — 하나테니스
  방법론 이식 검증 결과 반영)

#### Operations
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

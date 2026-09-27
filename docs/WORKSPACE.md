## WORKSPACE.md

## kcoc-weekly — 작업환경 안내서
- **기준일:** 2026-09-27
- **대상 OS:** Windows

### 1. 프로젝트 경로
#### 프로젝트 루트
C:\Projects\kcoc-weekly

#### 웹 공개 폴더
C:\Projects\kcoc-weekly\public

### 2. 폴더 구조
C:\Projects\kcoc-weekly\
├─ .github\workflows\
│  ├─ collect-weekly.yml   (dry-run placeholder — Phase 2에서 실제 로직 교체)
│  ├─ deploy-pages.yml
│  └─ validate-content.yml
├─ config\
├─ content\issues\
├─ data\
├─ docs\
│  ├─ PROJECT_CONTEXT.md
│  ├─ CONTENT_POLICY.md
│  ├─ SOURCE_POLICY.md
│  ├─ STATE_POLICY.md
│  ├─ EDITORIAL_GUIDE.md
│  ├─ OPERATIONS_GUIDE.md
│  ├─ DECISION_LOG.md
│  ├─ CURRENT_STATE.md   (9.5 트랙 신설)
│  ├─ CHANGELOG.md       (9.5 트랙 신설)
│  └─ WORKSPACE.md       (9.5 트랙 신설, 이 문서)
├─ public\
├─ scripts\
│  ├─ check-static.mjs
│  ├─ check-content.mjs
│  ├─ check-links.mjs
│  ├─ check-naming.mjs
│  └─ check-all.mjs
├─ src\
├─ templates\
├─ tests\
├─ .gitignore
├─ CONTENT-LICENSE.md
├─ LICENSE
├─ README.md
├─ package.json
└─ package-lock.json

### 3. 기본 명령
프로젝트 루트로 이동:
Set-Location C:\Projects\kcoc-weekly

현재 Git 상태(루트에서 실행):
git status --short
git branch --show-current
git rev-parse --short HEAD

🔴 검증 스크립트 파일은 scripts\ 폴더 안에 있지만, 실행은 반드시
프로젝트 루트(cwd)에서 해야 한다. check-all.mjs 내부가 다른 검증
스크립트를 프로젝트 루트 기준 상대경로로 불러오기 때문에, cwd를
scripts\로 옮기면 스스로를 "scripts\scripts\..."에서 찾으려다
MODULE_NOT_FOUND가 발생한다(2026-09-27 실측 확인, 아래 §9 참조).

전체 검증 실행(루트에서, scripts\ 상대경로로 호출):
node scripts\check-all.mjs

개별 검증:
node scripts\check-static.mjs
node scripts\check-content.mjs
node scripts\check-links.mjs
node scripts\check-naming.mjs

### 4. 배포
- 로컬에서 직접 배포하지 않는다. main 브랜치에 push하면
  deploy-pages.yml이 자동으로 GitHub Pages에 배포한다.
- push 전 validate-content.yml과 동일한 검증을 루트에서 먼저 돌린다:
  node scripts\check-all.mjs

### 5. Git 운영
#### 작업 시작
git status --short
git pull --ff-only

#### 권장 커밋 형식 (하나테니스 WORKSPACE.md와 동일 컨벤션)
feat: 콘텐츠·기능 추가
fix: 오류 수정
test: 검증 스크립트 추가·갱신
docs: 문서 변경
chore: 도구·환경·정리

### 6. Copilot 대화 운영
#### 새 대화 시작 시 첨부 순서
- docs\PROJECT_CONTEXT.md
- docs\CURRENT_STATE.md
- docs\DECISION_LOG.md
- 이 문서(WORKSPACE.md)
- 작업 성격에 따라: CONTENT_POLICY.md(글쓰기) / SOURCE_POLICY.md(수집) /
  STATE_POLICY.md(상태전이) / EDITORIAL_GUIDE.md(문체) /
  OPERATIONS_GUIDE.md(배포)

### 7. Source of Truth 요약
- 장기 정책: docs\PROJECT_CONTEXT.md
- 현재 상태: docs\CURRENT_STATE.md
- 결정 이유: docs\DECISION_LOG.md
- 변경 이력: docs\CHANGELOG.md
- 작업 방법: 이 문서
- 도메인 세부 정책: CONTENT_POLICY / SOURCE_POLICY / STATE_POLICY /
  EDITORIAL_GUIDE / OPERATIONS_GUIDE (각 문서가 자기 영역의 진실의 원천)
- 실제 코드: Git 저장소
- 운영 상태: GitHub Pages 실제 배포 결과

### 8. 하나테니스클럽과의 구조적 차이 (9.5 트랙 기록)
- 하나테니스는 도메인 정책을 PROJECT_CONTEXT.md 한 문서 안의 절(section)로
  통합하지만, kcoc-weekly는 도메인별로 별도 파일로 분리한다. 이는 작업자가
  자신의 역할(작가/수집기 개발자/배포 담당)에 맞는 문서만 골라 보는 구조로,
  두 방식 모두 유효하며 프로젝트 성격에 따라 선택하면 된다.
- 하나테니스는 Firebase Hosting에 수동/반자동(deploy-safe.ps1) 배포하지만,
  kcoc-weekly는 GitHub Actions로 push 시 완전 자동 배포한다.

### 9. 실패 패턴 기록 (하나테니스 WORKFLOW.md §9 관행 적용)
- **#1 (2026-09-27) 검증 스크립트 위치를 두 번 잘못 기재함** — 최초에는
  check-*.mjs가 프로젝트 루트에 있다고 오기재했다(실제로는 scripts\
  안에 있음). 정정 과정에서 이번엔 반대로 "실행도 scripts\에서 해야
  한다"고 잘못 안내했다. 실측 결과는 정반대였다:
  - cwd=scripts\에서 `node check-all.mjs` 실행 → MODULE_NOT_FOUND
  - cwd=루트에서 `node scripts\check-all.mjs`(전체/상대 경로) 실행 →
    정상 동작
  원인: check-all.mjs 내부가 다른 검증 스크립트를 자기 위치(__dirname)
  기준이 아니라 **프로젝트 루트 기준 상대경로**로 불러오도록 작성되어
  있다. 교훈: "파일이 있는 위치"와 "실행해야 하는 위치(cwd)"는 다를 수
  있다 — 스크립트 내부의 경로 해석 방식을 실제로 확인하기 전에는 실행
  위치를 단정하지 않는다.

- **#2 (2026-09-27) AI가 생성한 신규 문서가 프로젝트 자체 가드레일을
  위반함** — 9.5 트랙에서 신설한 CHANGELOG.md 초안에 구 저장소명
  "world-church-weekly" 문자열을 그대로 기재했다가 check-naming.mjs가
  이를 "Legacy name"으로 정확히 탐지·차단했다. 이는 결함이 아니라
  **가드레일이 설계대로 작동한 사례**이며, 9.5 트랙("이 방법론이
  실제로 새 기여를 걸러내는가")의 실증 사례로 기록할 가치가 있다.
  이후 문서에서 구 저장소명은 "이전 명칭"으로 우회 표기하고, 필요시
  DEC-025를 참조하도록 통일한다.

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
  위반함** — 9.5 트랙에서 신설한 CHANGELOG.md 초안에 구 저장소명(이전 명칭, DEC-025 참조)을 그대로 기재했다가 check-naming.mjs가
  이를 "Legacy name"으로 정확히 탐지·차단했다. 이는 결함이 아니라
  **가드레일이 설계대로 작동한 사례**이며, 9.5 트랙("이 방법론이
  실제로 새 기여를 걸러내는가")의 실증 사례로 기록할 가치가 있다.
  이후 문서에서 구 저장소명은 "이전 명칭"으로 우회 표기하고, 필요시
  DEC-025를 참조하도록 통일한다.

### 10. PowerShell 실행 정책 — 영구 규칙 (2026-09-27 추가)

**배경:** Copilot이 생성해 다운로드로 전달하는 `.ps1` 파일은 전부
디지털 서명이 없다. Windows 기본 실행 정책(`AllSigned`/`Restricted`)에서는
이런 스크립트가 `UnauthorizedAccess`(PSSecurityException)로 즉시 차단된다.
이 문제는 스크립트 내용과 무관하게 **모든 신규 .ps1 첫 실행마다 반복**되므로,
매번 개별적으로 대응하지 않고 규칙으로 고정한다.

**규칙 1 — Copilot이 새 .ps1을 안내할 때:**
실행 명령 바로 앞에 반드시 아래 줄을 포함한다. 스크립트 내용이나 목적과
무관하게 예외 없이 적용한다.
```powershell
Set-ExecutionPolicy -Scope Process Bypass
```
이 안내를 누락하는 것은 WORKFLOW.md §9(실패 패턴 축적) 대상 결함으로
간주한다.

**규칙 2 — 매번 타이핑하기 번거로우면(선택, 사용자 판단):**
`-Scope Process`가 아니라 `-Scope CurrentUser`로 한 번만 설정하면 이후
새 PowerShell 창을 열 때마다 반복할 필요가 없다. 다만 이는 시스템 계정
설정을 영구적으로 바꾸는 것이므로, 회사 보안 정책과 충돌하지 않는지
사용자가 먼저 확인한 뒤 아래를 1회만 실행한다.
```powershell
Get-ExecutionPolicy -List        # 현재 설정 확인(먼저 확인)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
`RemoteSigned`는 로컬에서 직접 작성/저장한 스크립트는 서명 없이 실행을
허용하되, 인터넷에서 받은 파일에는 여전히 서명을 요구하는 중간 수준
정책이다. 다운로드 폴더를 거쳐 온 파일은 Windows가 "인터넷 zone"
표시(Zone.Identifier)를 붙이는 경우가 있어, 이 경우 `RemoteSigned`로도
차단될 수 있다 — 그럴 때는 아래로 표시를 제거한다.
```powershell
Unblock-File -Path .\스크립트이름.ps1
```

**규칙 3 — 회사 정책(GPO)으로 실행 정책 자체가 강제된 경우:**
`Set-ExecutionPolicy`가 "정책에 의해 재정의되었습니다"류의 오류를
낸다면, 이는 사용자 권한 밖의 조직 정책이다. 이 경우 `-Scope Process`도
막힐 수 있으므로, 매번 스크립트 내용을 대화창에서 직접 검토한 뒤
사용자가 코드를 복사해 새 `.ps1`로 직접 저장(`Unblock-File` 불필요,
로컬 편집기로 저장한 파일은 보통 인터넷 zone 표시가 없음)하는 방식을
대안으로 사용한다.

### 11. Git 페이저로 인한 출력 정지 — 영구 규칙 (2026-09-27 추가)

**배경:** `git diff`, `git log` 등은 결과가 화면 한 페이지를 넘으면
자동으로 페이저(pager)를 열어 출력을 멈춘다. Windows PowerShell에서는
이게 `(END)` 표시와 함께 화면이 그대로 멈춘 것처럼 보여서, 스크립트가
멈췄거나 오류가 난 것으로 오인하기 쉽다. 실제로는 스크립트가 다음 단계로
진행하지 못하고 사용자의 키 입력(`q`)을 기다리는 정상 상태다.

**규칙 1 — 사용자 조치:**
화면 아래에 `(END)` 또는 `:` 프롬프트가 보이면, 오류가 아니라 페이저가
열린 것이다. **`q`를 눌러 종료**하면 나머지 출력이나 다음 단계가 이어진다.

**규칙 2 — Copilot이 진단·조회 스크립트를 만들 때:**
`git diff`, `git log`처럼 페이저를 열 수 있는 명령을 스크립트에 포함할
때는 반드시 `--no-pager` 플래그를 붙이거나(`git --no-pager diff ...`),
스크립트 시작 부분에서 `$env:GIT_PAGER = "cat"`을 설정해 페이저 자체를
비활성화한다. 이를 누락하면 스크립트의 후속 단계 출력이 전부 가려지는
문제가 재발한다.

### 12. 실험 브랜치 종료 시 미추적 파일 잔존 — 영구 규칙 (2026-09-27 추가)

**배경:** `experiment/*` 브랜치에서 Agent Mode 등이 생성한 파일(예:
9.6 실험의 `content/issues/mock-article-*.json`,
`scripts/collect-mock.mjs`)은 실험 도중 Git에 커밋되지 않은 미추적
상태였다. 실험 종료 후 `git checkout main`으로 브랜치를 전환했지만,
Git은 브랜치 전환 시 **추적 중인 파일만** 전환하고 미추적 파일은
워킹 디렉터리에 그대로 둔다. 그 결과 실험 잔재가 `main` 브랜치의
워킹 디렉터리에 계속 남아, 이후 무관한 작업(Phase 2 실제 구현)의
커밋 대상 목록에 섞여 나타나는 혼란을 일으켰다.

**규칙 — 실험 브랜치 종료 시 체크리스트:**
1. 실험이 끝나면 `git status --short`로 미추적 파일 목록을 반드시
   확인한다.
2. main으로 돌아가기 **전에** 미추적 산출물 중 보존할 가치가 있는
   것이 있는지 판단한다(대개는 없다 — 실험용 mock 데이터이기 때문).
3. 필요 없다고 판단되면 `git checkout main`으로 브랜치를 옮기기 전에
   `git clean -n`(무엇이 지워질지 미리보기, 실제 삭제 안 함)으로
   확인한 뒤 `git clean -fd`로 미추적 파일·폴더를 정리한다.
4. 위 절차를 생략하고 브랜치만 전환했다면, 다음 정식 작업을 시작하기
   전에 `git status --short`로 낯선 `??` 항목이 없는지 반드시 재확인
   한다.

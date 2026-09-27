---
document_version: "1.0"
status: "APPROVED"
last_updated: "2026-09-23"
timezone: "Asia/Seoul"
project: "함께 보는 세계교회"
repository: "kcoc-weekly"
---

# PROJECT CONTEXT

## 1. 프로젝트 정의

- 표시명: **함께 보는 세계교회**
- 영문명: **World Church Weekly**
- 저장소명: `kcoc-weekly`
- 운영: 개인·무료·비영리
- 독자: 여러 교회의 성도와 리더 50∼300명
- 발행: 매주 토요일, 품질 미확보 시 연기 또는 휴간

## 2. 비공식성 고지

`kcoc-weekly`는 기술적 저장소 식별자다. 본 프로젝트는 특정 교회, 교회 연합체, KCOC라는 명칭을 사용하는 기관, International Churches of Christ 또는 Disciples Today가 직접 운영하거나 공식 승인한 매체가 아니다. 공식 번역판, 공식 한국판, 공식 주간지로 표현하지 않는다.

## 3. 목적과 범위

Disciples Today 등 공개 출처의 세계 교회·공동체 소식을 원문을 대체하지 않는 한국어 카드뉴스로 소개한다. 콘텐츠는 종합형, 단일기사형, INB 안내형을 지원하며 기본 8페이지, 허용 범위는 5∼10페이지다.

## 4. 운영 구조

```text
공개 출처 → 저빈도 수집 → 후보 정리 → 운영자 선정 → 한국어 초안
→ 사실·권리·문체·모바일 검수 → 승인 → 웹 생성 → 검증 → 공개 → 수동 공유
```

- 수집 우선순위: RSS → WordPress REST API → 공개 HTML
- 기준 원본: 반응형 웹
- 배포: GitHub Pages
- 카카오톡: 일반 단체방에 운영자가 링크 수동 공유
- 데이터: JSON
- 분석도구: MVP와 4주 시범운영 동안 미사용

## 5. 권리 원칙

원문 전체 번역, 원본 사진 재게시, 공식 제휴로 오인될 표현을 금지한다. 출처명, 원문 제목, 게시일과 원문 링크를 표시한다. 프로젝트 라이선스는 외부 기사·사진·로고·상표에 적용되지 않는다.

## 6. 상태 흐름

```text
COLLECTED → CANDIDATE → SELECTED → DRAFT → IN_REVIEW
→ APPROVED → GENERATED → PUBLISHED → SHARED
```

승인 전 배포는 금지한다. 오류·권리 문제는 CORRECTED 또는 WITHDRAWN으로 처리한다.

## 7. 단계

- Phase 0: 정책 문서 승인
- Phase 1: 저장소·빈 사이트·Actions·기본 검증
- Phase 2: 실제 수집 PoC
- Phase 3: 카드뉴스 MVP
- Phase 4: 배포 차단과 렌더링 검증
- Phase 5: 4주 시범운영

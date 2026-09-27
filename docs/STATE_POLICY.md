---
document_version: "1.0"
status: "APPROVED"
last_updated: "2026-09-23"
timezone: "Asia/Seoul"
project: "함께 보는 세계교회"
repository: "kcoc-weekly"
---

# STATE POLICY

## 기사 상태

`COLLECTED`, `CANDIDATE`, `SELECTED`, `REJECTED`, `ARCHIVED`

## 발행호 상태

`DRAFT`, `IN_REVIEW`, `CHANGES_REQUIRED`, `APPROVED`, `GENERATED`, `PUBLISHED`, `SHARED`, `CORRECTED`, `WITHDRAWN`

## 허용 전이

```text
COLLECTED → CANDIDATE → SELECTED → DRAFT → IN_REVIEW
IN_REVIEW → CHANGES_REQUIRED → DRAFT
IN_REVIEW → APPROVED → GENERATED → PUBLISHED → SHARED
PUBLISHED 또는 SHARED → CORRECTED 또는 WITHDRAWN
```

## 승인 조건

`contentApproved`, `sourceLinksApproved`, `rightsApproved`, `mobileApproved`, `finalApproved`가 모두 `true`여야 한다. 민감 콘텐츠는 `sensitiveContentApproved`가 추가로 필요하다.

## 배포 차단

승인 전 배포, 출처 누락, 5페이지 미만 또는 10페이지 초과, 내부 링크 오류, 금지 이미지, 모바일 넘침, 스키마 오류는 배포 차단이다.

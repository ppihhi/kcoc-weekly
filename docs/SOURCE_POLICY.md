---
document_version: "1.0"
status: "APPROVED"
last_updated: "2026-09-23"
timezone: "Asia/Seoul"
project: "함께 보는 세계교회"
repository: "kcoc-weekly"
---

# SOURCE POLICY

## 기본 출처

- Disciples Today: `https://disciplestoday.org/`

기본 출처 등록은 재사용 허가를 뜻하지 않는다. 원본 이미지와 첨부파일은 재호스팅하지 않는다.

## 수집 원칙

- 매주 월요일 오전 6시 KST 권장
- 최근 10일 범위
- RSS → WordPress REST API → 공개 HTML
- 실패 시 1회 재시도
- 과거 전체 크롤링 금지
- 403, 429, 반복 5xx 시 자동 중단
- robots.txt, 이용조건, 접근 제한 준수

## 저장 필드

제목, 게시일, 작성자, URL, 공개 요약, 카테고리·태그, 수집 시각·방법·해시만 기본 저장한다. 대표 이미지 URL을 저장하더라도 재사용 기본값은 `false`다.

## 링크 및 이미지

출처명, 원문 제목, 게시일, 정식 HTTPS URL을 표시한다. 원본 사진, 워터마크 제거 이미지, 출처 불명 이미지, 공식 제휴처럼 보이는 로고 사용을 금지한다. CSS 도형, 자체 아이콘, 직접 제작 및 명확한 오픈 라이선스 자산만 허용한다.

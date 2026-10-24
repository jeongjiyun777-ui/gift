# DB 스키마

전체 테이블 정의는 `schema.sql` 한 파일에서 관리합니다.

- `gifts`: 받은 금액
- `paid_gifts`: 지출금액
- `driving_records`: 운행기록
- `urea_records`: 요소수 구매기록
- `diesel_records`: 경유 구매기록

`schema.sql`은 신규 DB의 테이블 생성용입니다. `IF NOT EXISTS`는 기존 테이블에 빠진 열을 추가하지 않습니다.
기존 DB에 적용했던 변경 SQL은 `migrations/`에 보관합니다. 이미 적용한 이력을 다시 실행할 필요는 없습니다.
실제 개인정보·영수증·API 키는 SQL 파일에 넣지 않습니다.

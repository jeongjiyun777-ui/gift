# Python 테스트

프로젝트 루트에서 실행합니다.

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -v
```

기존 unittest 테스트도 pytest가 수집합니다. 파일은 `backend/test_*.py`입니다.

- `test_driving_overview.py`: 월 경계, 중복 집계 방지, 빈 달, 지출만 있는 달, 공급가액·세액, 사용자 지정 총액 10%와 프론트 표시용 응답 계약
- `test_repairs.py`: 수리 검증, 수정·삭제, 할부 계산과 반올림 조정
- 나머지 파일: 받은 금액·지출금액·운행·요소수·경유·OCR

운영 DB에 테스트 기록을 넣지 않습니다. 임시 SQLite와 모의 연결을 사용합니다.
간편보기 금액이 `-`로 나오면 서버 응답에 `driving_total_amount`, `income_tax_estimate`, `expense_tax_estimate`가 포함되는지 확인합니다. 프론트는 없는 금액을 0원으로 바꾸지 않습니다.

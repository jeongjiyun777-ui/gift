# 요소수 영수증 OCR

설치: `python -m pip install -r requirements.txt` (Gemini SDK 추가 설치 없음).

`backend/.env` 또는 Render 환경변수:

```dotenv
GEMINI_API_KEY=발급받은_API_키
GEMINI_OCR_MODEL=gemini-3.5-flash-lite
```

키 변경 후 백엔드를 재시작합니다. 실제 .env는 Git에 올리지 않습니다.

1. 카메라 버튼 → 브라우저 촬영/사진 선택 → JPEG 변환 및 크기 축소.
2. `POST /urea-records/ocr` → 서버가 .env의 키로 Gemini를 호출합니다.
3. 모델 결과 JSON을 검증하고 입력폼에 채웁니다. 읽지 못한 필드는 빈칸입니다.
4. 사용자가 확인하고 저장 → `POST /urea-records`가 JSON을 검증합니다.
5. 서버가 단가 × 리터를 계산하고 `with engine.begin()`으로 DB에 저장합니다.
6. 조회 시 공급가액·부가세를 계산합니다.

OCR 자체는 DB에 저장하지 않습니다. iPhone/Android의 촬영 화면은 브라우저에 따라 다를 수 있습니다.

공식 문서: https://ai.google.dev/gemini-api/docs/generate-content/image-understanding

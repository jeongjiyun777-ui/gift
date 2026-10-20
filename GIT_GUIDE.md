# 축의금 프로젝트 Git 업로드 및 배포 설정

프로젝트는 하나의 GitHub 저장소에 다음을 함께 둡니다.

- `fontend/frontend`: Next.js 화면
- `backend`: FastAPI 검색 API
- `db/schema.sql`: PostgreSQL 테이블 정의

실제 `.env`와 `축의금.xlsx`는 `.gitignore`로 제외합니다. DB 데이터는 Neon에 두고, Render와 Vercel의 환경변수 설정 화면에서 연결값을 입력합니다.

## Push 명령

프로젝트 루트에서 GitHub에 만든 빈 저장소의 HTTPS 주소를 넣어 실행합니다.

```powershell
cd "C:\Users\ASUS\Desktop\축의금"
git remote set-url origin https://github.com/계정명/저장소명.git
git add .
git status
git commit -m "Prepare gift lookup deployment"
git push -u origin main
```

`origin`이 아직 없다면 `git remote set-url` 대신 최초 한 번 다음 명령을 사용합니다.

```powershell
git remote add origin https://github.com/계정명/저장소명.git
```

`git status`에서 `backend/.env`와 `축의금.xlsx`가 보이지 않는지 확인한 뒤 Push합니다.

## Render 백엔드

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment Variables:
  - `DATABASE_URL`: Neon의 PostgreSQL 연결 주소
  - `FRONTEND_ORIGINS`: 배포된 Vercel 사이트의 origin 전체 주소, 예: `https://your-app.vercel.app`

`FRONTEND_ORIGINS`는 브라우저에서 Render API를 부르는 Vercel 주소를 CORS에 허용합니다. 로컬 개발 주소는 운영 허용 목록에 넣지 않습니다.

## Vercel 프론트엔드

- Root Directory: `fontend/frontend`
- Environment Variable: `NEXT_PUBLIC_API_URL`에 Render가 제공한 백엔드 URL 입력, 예: `https://your-api.onrender.com`

`NEXT_PUBLIC_API_URL`은 브라우저 번들에 포함되는 공개 API 주소이며 비밀번호가 아닙니다. 값을 바꾼 뒤에는 Vercel에서 다시 배포해야 반영됩니다.

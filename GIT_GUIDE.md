# 축의금 프로젝트 Git 및 Render 안내

## GitHub에 올리기

프로젝트 루트에서 실행합니다.

```powershell
cd "C:\Users\ASUS\Desktop\축의금"
git init -b main
git add .
git status
```

`git status`에서 `backend/.env`와 `축의금.xlsx`가 추가 대상에 없는지 확인한 다음 커밋하고 원격 저장소에 올립니다.

```powershell
git commit -m "Add gift lookup app"
git remote add origin https://github.com/사용자이름/저장소이름.git
git push -u origin main
```

이미 `origin`을 등록했다면 `git remote add origin ...` 대신 다음 명령을 씁니다.

```powershell
git remote set-url origin https://github.com/사용자이름/저장소이름.git
```

## 로컬 환경변수

`backend/.env.example`을 복사해 `backend/.env`를 만들고 실제 Neon 접속 주소를 입력합니다. `.env`는 Git에서 제외됩니다.

## Render 백엔드 설정

GitHub 저장소를 연결한 뒤 Render의 Root Directory를 `backend`로 지정합니다.

- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment Variables: `DATABASE_URL`을 만들고 Neon 연결 주소를 값으로 입력

Render에 값을 직접 입력하므로 `.env` 파일은 올리지 않습니다. 배포 후 프론트엔드의 `API_URL`에는 Render가 제공한 백엔드 주소를 반영해야 합니다.

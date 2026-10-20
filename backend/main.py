import os

from dotenv import load_dotenv
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("backend/.env에 DATABASE_URL을 설정하세요.")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

app = FastAPI(title="축의금 조회 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://100.100.100.33:3000"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/gifts")
def get_gifts(name: str | None = Query(default=None, description="이름 일부 검색")):
    search_name = name.strip() if name and name.strip() else None

    query = text("""
        SELECT id, name, amount
        FROM public.gifts
        WHERE (:search_name IS NULL OR name ILIKE :name_pattern)
        ORDER BY id
    """)
    params = {
        "search_name": search_name,
        "name_pattern": f"%{search_name}%" if search_name else None,
    }

    with engine.connect() as conn:
        rows = conn.execute(query, params).mappings().all()

    return [dict(row) for row in rows]


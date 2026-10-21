import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import bindparam, create_engine, text
from pydantic import BaseModel, ConfigDict, Field

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("backend/.env에 DATABASE_URL을 설정하세요.")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

app = FastAPI(title="축의금 조회 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip().rstrip("/")
        for origin in os.getenv(
            "FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
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


@app.get("/gifts/total", summary="축의금 총액 조회")
def get_gifts_total(
    name: str | None = Query(default=None, description="이름 일부 검색. 비워두면 전체 총액")
) -> dict[str, int]:
    search_name = name.strip() if name and name.strip() else None
    query = text("""
        SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total_amount
        FROM public.gifts
        WHERE (:search_name IS NULL OR name ILIKE :name_pattern)
    """)
    params = {
        "search_name": search_name,
        "name_pattern": f"%{search_name}%" if search_name else None,
    }
    with engine.connect() as conn:
        result = conn.execute(query, params).mappings().one()

    return {"count": int(result["count"]), "total_amount": int(result["total_amount"])}


class GiftCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1)
    amount: int = Field(strict=True, ge=0, le=9223372036854775807)


class GiftResponse(GiftCreate):
    id: int


@app.post("/gifts", status_code=201, response_model=GiftResponse, summary="축의금 입력")
def create_gift(gift: GiftCreate):
    query = text("""
        INSERT INTO public.gifts (name, amount)
        VALUES (:name, :amount)
        RETURNING id, name, amount
    """)
    with engine.begin() as conn:
        row = conn.execute(query, gift.model_dump()).mappings().one()
    return dict(row)


class GiftDelete(BaseModel):
    ids: list[Annotated[int, Field(strict=True, gt=0)]] = Field(min_length=1)


@app.delete("/gifts", summary="선택한 축의금 기록 삭제")
def delete_gifts(selection: GiftDelete) -> dict[str, int]:
    ids = sorted(set(selection.ids))
    query = text("""
        DELETE FROM public.gifts
        WHERE id IN :ids
        RETURNING id
    """).bindparams(bindparam("ids", expanding=True))
    with engine.begin() as conn:
        deleted = conn.execute(query, {"ids": ids}).all()
        if len(deleted) != len(ids):
            raise HTTPException(
                status_code=409,
                detail="선택한 기록 중 이미 삭제된 기록이 있습니다. 새로 조회한 뒤 다시 선택하세요.",
            )
    return {"deleted_count": len(deleted)}

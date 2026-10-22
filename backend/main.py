import os
from datetime import date
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


class DrivingRecordCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    operated_on: date | None = None
    shipper_name: str = Field(min_length=1)
    region_1: str | None = None
    region_2: str | None = None
    category: str | None = None
    shipping_line: str | None = None
    container_spec: str = Field(default="40", pattern=r"^40$")
    container_no: str | None = Field(default=None, pattern=r"^[A-Z]{4}[0-9]{7}$")
    charge_amount: int = Field(strict=True, ge=0, le=9007199254740991)
    tax_amount: int | None = Field(default=None, strict=True, ge=0, le=9007199254740991)
    memo: str | None = None
    vehicle_number: str | None = None
    recipient_name: str | None = None


@app.post("/driving-records", status_code=201, summary="운행기록 저장")
def create_driving_record(record: DrivingRecordCreate):
    query = text("""
        INSERT INTO public.driving_records (
            operated_on, shipper_name, region_1, region_2, category,
            shipping_line, container_spec, container_no, charge_amount,
            tax_amount, memo, vehicle_number, recipient_name
        ) VALUES (
            COALESCE(:operated_on, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date),
            :shipper_name, :region_1, :region_2, :category,
            :shipping_line, :container_spec, :container_no, :charge_amount,
            :tax_amount, :memo, :vehicle_number, :recipient_name
        )
        RETURNING id, operated_on, category, shipper_name,
                  region_1, region_2, shipping_line, container_spec,
                  container_no, charge_amount, tax_amount, memo,
                  vehicle_number, recipient_name, created_at
    """)
    with engine.begin() as conn:
        row = conn.execute(query, record.model_dump()).mappings().one()
    return dict(row)


@app.get("/driving-records", summary="운행기록 조회")
def get_driving_records(
    year: int | None = Query(default=None, ge=1, le=9998),
    month: int | None = Query(default=None, ge=1, le=12),
):
    if month is not None and year is None:
        raise HTTPException(status_code=422, detail="월을 조회하려면 연도도 선택하세요.")
    params = {}
    period_filter = ""
    if year is not None:
        start_month = month or 1
        params["start_date"] = date(year, start_month, 1)
        params["end_date"] = (
            date(year + 1, 1, 1) if month is None or month == 12
            else date(year, month + 1, 1)
        )
        period_filter = "WHERE operated_on >= :start_date AND operated_on < :end_date"
    query = text(f"""
        SELECT id, operated_on, category, shipper_name,
               region_1, region_2, shipping_line, container_spec,
               container_no, charge_amount, tax_amount, memo,
               vehicle_number, recipient_name, created_at
        FROM public.driving_records
        {period_filter}
        ORDER BY id
    """)
    with engine.connect() as conn:
        rows = conn.execute(query, params).mappings().all()

    return [dict(row) for row in rows]

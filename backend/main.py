import os
from datetime import date
from typing import Annotated

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import bindparam, create_engine, text
from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
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


class DrivingRecordUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    operated_on: date | None = None
    category: str | None = None
    shipper_name: str | None = Field(default=None, min_length=1)
    region_1: str | None = None
    region_2: str | None = None
    shipping_line: str | None = None
    km: int | None = Field(default=None, strict=True, ge=1, le=9999)
    container_spec: str | None = Field(default=None, pattern=r"^40$")
    container_no: str | None = Field(default=None, pattern=r"^[A-Z]{4}[0-9]{7}$")
    charge_amount: int | None = Field(default=None, strict=True, ge=0, le=9007199254740991)
    tax_amount: int | None = Field(default=None, strict=True, ge=0, le=9007199254740991)
    memo: str | None = None
    vehicle_number: str | None = None
    recipient_name: str | None = None

    @model_validator(mode="after")
    def validate_changes(self):
        changes = self.model_dump(exclude_unset=True)
        if not changes:
            raise ValueError("수정할 항목을 하나 이상 보내세요.")
        for field in ("operated_on", "shipper_name", "charge_amount", "container_spec", "km"):
            if field in changes and changes[field] is None:
                raise ValueError(f"{field} 항목은 비울 수 없습니다.")
        return self


@app.patch("/driving-records/{record_id}", summary="운행기록 부분 수정")
def update_driving_record(
    record_id: Annotated[int, Path(gt=0)], changes: DrivingRecordUpdate
):
    # 모델에 선언된 열만 사용하고, 값은 SQL 파라미터로 전달합니다.
    values = changes.model_dump(exclude_unset=True)
    assignments = ", ".join(f"{column} = :{column}" for column in values)
    query = text(f"""
        UPDATE public.driving_records SET {assignments}
        WHERE id = :record_id
        RETURNING id, operated_on, category, shipper_name,
                  region_1, region_2, shipping_line, container_spec,
                  container_no, charge_amount, tax_amount, memo,
                  vehicle_number, recipient_name, km, created_at
    """)
    with engine.begin() as conn:
        row = conn.execute(query, {**values, "record_id": record_id}).mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="운행기록이 없습니다.")
    return dict(row)


class DrivingRecordDelete(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[Annotated[int, Field(strict=True, gt=0)]] = Field(min_length=1)


@app.post("/driving-records/delete", summary="선택한 운행기록 삭제")
def delete_driving_records(selection: DrivingRecordDelete):
    ids = sorted(set(selection.ids))
    query = text("""
        DELETE FROM public.driving_records WHERE id IN :ids RETURNING id
    """).bindparams(bindparam("ids", expanding=True))
    with engine.begin() as conn:
        deleted = conn.execute(query, {"ids": ids}).all()
        if len(deleted) != len(ids):
            raise HTTPException(status_code=409, detail="선택한 기록 중 없는 기록이 있습니다. 다시 조회하세요.")
    return {"deleted_count": len(deleted)}


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
    km: int = Field(strict=True, ge=1, le=9999)
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
            tax_amount, memo, vehicle_number, recipient_name, km
        ) VALUES (
            COALESCE(:operated_on, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date),
            :shipper_name, :region_1, :region_2, :category,
            :shipping_line, :container_spec, :container_no, :charge_amount,
            :tax_amount, :memo, :vehicle_number, :recipient_name, :km
        )
        RETURNING id, operated_on, category, shipper_name,
                  region_1, region_2, shipping_line, container_spec,
                  container_no, charge_amount, tax_amount, memo,
                  vehicle_number, recipient_name, km, created_at
    """)
    with engine.begin() as conn:
        row = conn.execute(query, record.model_dump()).mappings().one()
    return dict(row)


@app.get("/driving-records", summary="운행일자 기준 연도·월 조회")
def get_driving_records(
    year: int | None = Query(default=None, ge=1, le=9998, description="운행 연도. 예: 2026. 생략하면 전체 기간"),
    month: int | None = Query(default=None, ge=1, le=12, description="운행 월: 1~12. 연도만 보내면 해당 연도 전체"),
):
    if month is not None and year is None:
        raise HTTPException(status_code=422, detail="월을 조회하려면 연도도 선택하세요.")
    start_date: date | None = None
    end_date: date | None = None
    params: dict[str, date] = {}
    period_filter = ""
    if year is not None:
        start_month = month or 1
        start_date = date(year, start_month, 1)
        end_date = (
            date(year + 1, 1, 1) if month is None or month == 12
            else date(year, month + 1, 1)
        )
        params = {"start_date": start_date, "end_date": end_date}
        period_filter = "WHERE operated_on >= :start_date AND operated_on < :end_date"
    query = text(f"""
        SELECT id, operated_on, category, shipper_name,
               region_1, region_2, shipping_line, container_spec,
               container_no, charge_amount, tax_amount, memo,
               vehicle_number, recipient_name, km, created_at
        FROM public.driving_records
        {period_filter}
        ORDER BY id
    """)
    with engine.connect() as conn:
        rows = conn.execute(query, params).mappings().all()

    return [dict(row) for row in rows]

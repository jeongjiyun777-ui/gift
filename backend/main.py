import os
from datetime import date, datetime
from typing import Annotated, Literal
from decimal import Decimal, ROUND_HALF_UP

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import bindparam, create_engine, text
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from urea_ocr import UreaReceiptImage, UreaReceiptResponse, recognize_urea_receipt

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


def gift_table(direction: str) -> str:
    # SQL 식별자는 사용자 문자열이 아닌 고정된 두 테이블 중에서만 선택합니다.
    return "public.paid_gifts" if direction == "paid" else "public.gifts"


@app.get("/gifts")
def get_gifts(
    name: str | None = Query(default=None, description="이름 일부 검색"),
    direction: Literal["received", "paid"] = "received",
):
    search_name = name.strip() if name and name.strip() else None

    query = text(f"""
        SELECT id, name, amount, direction, category, detail, location,
               {"paid_on" if direction == "paid" else "NULL AS paid_on"}
        FROM {gift_table(direction)}
        WHERE direction = :direction AND (:search_name IS NULL OR name ILIKE :name_pattern)
        ORDER BY id
    """)
    params = {
        "search_name": search_name,
        "direction": direction,
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
    name: str | None = Query(default=None, description="이름 일부 검색. 비워두면 전체 총액"),
    direction: Literal["received", "paid"] = "received",
) -> dict[str, int]:
    search_name = name.strip() if name and name.strip() else None
    query = text(f"""
        SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total_amount
        FROM {gift_table(direction)}
        WHERE direction = :direction AND (:search_name IS NULL OR name ILIKE :name_pattern)
    """)
    params = {
        "search_name": search_name,
        "direction": direction,
        "name_pattern": f"%{search_name}%" if search_name else None,
    }
    with engine.connect() as conn:
        result = conn.execute(query, params).mappings().one()

    return {"count": int(result["count"]), "total_amount": int(result["total_amount"])}


class GiftCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    direction: Literal["received", "paid"] = "received"
    category: str | None = Field(default=None, description="금액 종류. 예: 축의금, 조의금")
    detail: str | None = Field(default=None, description="세부사항. 예: 자녀결혼")
    location: str | None = Field(default=None, description="장소. 예: 예식장, 장례식장")
    paid_on: date | None = Field(default=None, description="지출 날짜: YYYY-MM-DD")
    name: str = Field(min_length=1)
    amount: int = Field(strict=True, ge=0, le=9223372036854775807)


    @field_validator("paid_on", mode="before")
    @classmethod
    def normalize_paid_date(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return None if value in ("", "-") else value
        if value is not None and not isinstance(value, date):
            raise ValueError("날짜는 YYYY-MM-DD 형식으로 입력하세요.")
        return value

    @field_validator("category", "detail", "location", mode="before")
    @classmethod
    def normalize_optional_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return None if value in ("", "-") else value
        return value


class GiftResponse(GiftCreate):
    id: int


@app.post("/gifts", status_code=201, response_model=GiftResponse, summary="축의금 입력")
def create_gift(gift: GiftCreate):
    date_column = ", paid_on" if gift.direction == "paid" else ""
    date_value = ", :paid_on" if gift.direction == "paid" else ""
    returned_date = ", paid_on" if gift.direction == "paid" else ", NULL AS paid_on"
    query = text(f"""
        INSERT INTO {gift_table(gift.direction)} (name, amount, direction, category, detail, location{date_column})
        VALUES (:name, :amount, :direction, :category, :detail, :location{date_value})
        RETURNING id, name, amount, direction, category, detail, location{returned_date}
    """)
    with engine.begin() as conn:
        row = conn.execute(query, gift.model_dump()).mappings().one()
    return dict(row)


class GiftDelete(BaseModel):
    direction: Literal["received", "paid"] = "received"
    ids: list[Annotated[int, Field(strict=True, gt=0)]] = Field(min_length=1)


@app.delete("/gifts", summary="선택한 축의금 기록 삭제")
def delete_gifts(selection: GiftDelete) -> dict[str, int]:
    ids = sorted(set(selection.ids))
    query = text(f"""
        DELETE FROM {gift_table(selection.direction)}
        WHERE id IN :ids AND direction = :direction
        RETURNING id
    """).bindparams(bindparam("ids", expanding=True))
    with engine.begin() as conn:
        deleted = conn.execute(query, {"ids": ids, "direction": selection.direction}).all()
        if len(deleted) != len(ids):
            raise HTTPException(
                status_code=409,
                detail="선택한 기록 중 이미 삭제된 기록이 있습니다. 새로 조회한 뒤 다시 선택하세요.",
            )
    return {"deleted_count": len(deleted)}


class PaidGiftCreate(GiftCreate):
    direction: Literal["paid"] = "paid"


class PaidGiftDelete(GiftDelete):
    direction: Literal["paid"] = "paid"


@app.get("/paid-gifts", summary="지출금액 조회")
def get_paid_gifts(name: str | None = Query(default=None, description="이름 일부 검색")):
    return get_gifts(name, "paid")


@app.get("/paid-gifts/total", summary="지출금액 합계")
def get_paid_gifts_total(name: str | None = Query(default=None)):
    return get_gifts_total(name, "paid")


@app.post("/paid-gifts", status_code=201, response_model=GiftResponse, summary="지출금액 저장")
def create_paid_gift(gift: PaidGiftCreate):
    return create_gift(gift)


@app.delete("/paid-gifts", summary="선택한 지출금액 삭제")
def delete_paid_gifts(selection: PaidGiftDelete):
    return delete_gifts(selection)


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


class UreaRecordCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    purchased_on: date | None = Field(default=None, description="구매 날짜. 생략하면 한국 기준 오늘")
    merchant_name: str = Field(min_length=1, description="상호명/대표자")
    business_number: str | None = None
    card_company: str | None = None
    unit_price: Decimal = Field(ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)
    liters: Decimal = Field(gt=0, max_digits=12, decimal_places=3, allow_inf_nan=False)

    @field_validator("business_number", "card_company", mode="before")
    @classmethod
    def normalize_optional_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return None if value in ("", "-") else value
        return value

    @field_validator("purchased_on", mode="before")
    @classmethod
    def normalize_date(cls, value):
        if isinstance(value, str):
            return value.strip() or None
        if value is not None and not isinstance(value, date):
            raise ValueError("날짜는 YYYY-MM-DD 형식으로 입력하세요.")
        return value


class UreaRecordResponse(UreaRecordCreate):
    total_amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2, allow_inf_nan=False)
    id: int
    purchased_on: date
    created_at: datetime


@app.post("/urea-records", status_code=201, response_model=UreaRecordResponse, summary="요소수 저장")
def create_urea_record(record: UreaRecordCreate):
    total = (record.unit_price * record.liters).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if total > Decimal("999999999999.99"):
        raise HTTPException(status_code=422, detail="단가와 리터를 곱한 총액이 저장 가능한 범위를 초과합니다.")
    values = {**record.model_dump(), "total_amount": total}
    query = text("""
        INSERT INTO public.urea_records (
            purchased_on, merchant_name, business_number, card_company,
            unit_price, liters, total_amount
        ) VALUES (
            COALESCE(:purchased_on, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date),
            :merchant_name, :business_number, :card_company,
            :unit_price, :liters, :total_amount
        )
        RETURNING id, purchased_on, merchant_name, business_number, card_company,
                  unit_price, liters, total_amount, created_at
    """)
    with engine.begin() as conn:
        row = conn.execute(query, values).mappings().one()
    return dict(row)


class UreaQueryResponse(UreaRecordResponse):
    supply_amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    vat_amount: Decimal = Field(ge=0, max_digits=14, decimal_places=2)


def split_urea_total(total: Decimal) -> tuple[Decimal, Decimal]:
    # 총액에 부가세 10%가 포함된 것으로 계산합니다.
    # 원 단위 영수증은 원 단위로, 소수가 있는 총액은 소수 둘째 자리까지 유지합니다.
    quantum = Decimal("1") if total == total.to_integral_value() else Decimal("0.01")
    supply = (total / Decimal("1.1")).quantize(quantum, rounding=ROUND_HALF_UP)
    return supply, total - supply


@app.get("/urea-records", response_model=list[UreaQueryResponse], summary="요소수 구매 연도·월 조회")
def get_urea_records(
    year: Annotated[int, Query(ge=1, le=9998, description="구매 연도")],
    month: Annotated[int, Query(ge=1, le=12, description="구매 월: 1~12")],
):
    start_date = date(year, month, 1)
    end_date = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    query = text("""
        SELECT id, purchased_on, merchant_name, business_number, card_company,
               unit_price, liters, total_amount, created_at
        FROM public.urea_records
        WHERE purchased_on >= :start_date AND purchased_on < :end_date
        ORDER BY purchased_on, id
    """)
    with engine.connect() as conn:
        rows = conn.execute(query, {"start_date": start_date, "end_date": end_date}).mappings().all()
    records = []
    for row in rows:
        record = dict(row)
        supply, vat = split_urea_total(Decimal(str(record["total_amount"])))
        record.update(supply_amount=supply, vat_amount=vat)
        records.append(record)
    return records


@app.get("/urea-records/export", response_model=list[UreaQueryResponse], summary="요소수 엑셀용 월별·전체 데이터")
def export_urea_records(
    year: Annotated[int | None, Query(ge=1, le=9998)] = None,
    month: Annotated[int | None, Query(ge=1, le=12)] = None,
):
    if (year is None) != (month is None):
        raise HTTPException(status_code=422, detail="연도와 월을 함께 선택하세요.")
    if year is not None and month is not None:
        return get_urea_records(year, month)
    query = text("""
        SELECT id, purchased_on, merchant_name, business_number, card_company,
               unit_price, liters, total_amount, created_at
        FROM public.urea_records
        ORDER BY purchased_on, id
    """)
    with engine.connect() as conn:
        rows = conn.execute(query).mappings().all()
    records = []
    for row in rows:
        record = dict(row)
        supply, vat = split_urea_total(Decimal(str(record["total_amount"])))
        record.update(supply_amount=supply, vat_amount=vat)
        records.append(record)
    return records


class UreaRecordUpdate(UreaRecordCreate):
    purchased_on: date | None = None
    merchant_name: str | None = Field(default=None, min_length=1)
    unit_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2, allow_inf_nan=False)
    liters: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=3, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_changes(self):
        changes = self.model_dump(exclude_unset=True)
        if not changes:
            raise ValueError("수정할 항목을 하나 이상 보내세요.")
        for field in ("purchased_on", "merchant_name", "unit_price", "liters"):
            if field in changes and changes[field] is None:
                raise ValueError(f"{field} 항목은 비울 수 없습니다.")
        return self


@app.patch("/urea-records/{record_id}", response_model=UreaQueryResponse, summary="요소수 부분 수정")
def update_urea_record(record_id: Annotated[int, Path(gt=0)], changes: UreaRecordUpdate):
    values = changes.model_dump(exclude_unset=True)
    with engine.begin() as conn:
        lock = " FOR UPDATE" if conn.dialect.name == "postgresql" else ""
        current = conn.execute(text("SELECT unit_price, liters FROM public.urea_records WHERE id=:id" + lock), {"id": record_id}).mappings().one_or_none()
        if current is None:
            raise HTTPException(status_code=404, detail="요소수 기록이 없습니다.")
        if "unit_price" in values or "liters" in values:
            unit_price = Decimal(str(values.get("unit_price", current["unit_price"])))
            liters = Decimal(str(values.get("liters", current["liters"])))
            total = (unit_price * liters).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if total > Decimal("999999999999.99"):
                raise HTTPException(status_code=422, detail="총액이 저장 가능한 범위를 초과합니다.")
            values["total_amount"] = total
        assignments = ", ".join(f"{column} = :{column}" for column in values)
        query = text(f"""
            UPDATE public.urea_records SET {assignments} WHERE id=:record_id
            RETURNING id, purchased_on, merchant_name, business_number, card_company,
                      unit_price, liters, total_amount, created_at
        """)
        row = conn.execute(query, {**values, "record_id": record_id}).mappings().one()
    record = dict(row)
    supply, vat = split_urea_total(Decimal(str(record["total_amount"])))
    record.update(supply_amount=supply, vat_amount=vat)
    return record


class UreaRecordDelete(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[Annotated[int, Field(strict=True, gt=0)]] = Field(min_length=1)


@app.post("/urea-records/delete", summary="선택한 요소수 기록 삭제")
def delete_urea_records(selection: UreaRecordDelete):
    ids = sorted(set(selection.ids))
    query = text("DELETE FROM public.urea_records WHERE id IN :ids RETURNING id").bindparams(bindparam("ids", expanding=True))
    with engine.begin() as conn:
        deleted = conn.execute(query, {"ids": ids}).all()
        if len(deleted) != len(ids):
            raise HTTPException(status_code=409, detail="선택한 기록 중 없는 기록이 있습니다. 다시 조회해 주세요.")
    return {"deleted_count": len(deleted)}



@app.post("/urea-records/ocr", response_model=UreaReceiptResponse, summary="Gemini 요소수 영수증 인식 (저장 안 함)")
def read_urea_receipt(image: UreaReceiptImage):
    return recognize_urea_receipt(image)

"""실제 Neon 대신 메모리 DB로 실행: python -m unittest -v test_main.py"""
import os
import sqlite3
import unittest
from datetime import date, time
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

sqlite3.register_adapter(date, lambda value: value.isoformat())
sqlite3.register_adapter(time, lambda value: value.isoformat())

with patch.dict(os.environ, {"DATABASE_URL": "sqlite://"}):
    import main


class DrivingRecordTests(unittest.TestCase):
    def setUp(self):
        # 각 테스트마다 새로운 메모리 DB와 두 개의 가상 기록을 준비합니다.
        self.engine = create_engine("sqlite://", poolclass=StaticPool)
        self.engine_patch = patch.object(main, "engine", self.engine)
        self.engine_patch.start()
        with self.engine.begin() as conn:
            conn.execute(text("ATTACH DATABASE ':memory:' AS public"))
            conn.execute(text("""
                CREATE TABLE public.driving_records (
                    id INTEGER PRIMARY KEY, operated_on DATE NOT NULL,
                    departure_time TEXT, arrival_time TEXT,
                    start_odometer_km BIGINT, pickup_odometer_km BIGINT, arrival_odometer_km BIGINT, odometer_recorded_at TEXT,
                    category TEXT CHECK (category IN ('MT','FULL')), carrier_name TEXT NOT NULL, shipper_name TEXT,
                    region_1 TEXT, region_2 TEXT, shipping_line TEXT,
                    start_km INTEGER CHECK (start_km BETWEEN 1 AND 999),
                    km INTEGER CHECK (km BETWEEN 1 AND 999),
                    container_spec TEXT, container_no TEXT,
                    charge_amount BIGINT NOT NULL, tax_amount BIGINT,
                    memo TEXT, vehicle_number TEXT, recipient_name TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """))
            for record_id, operated_on in [(1, "2026-09-30"), (2, "2026-10-01")]:
                conn.execute(text("""
                    INSERT INTO public.driving_records
                    (id, operated_on, carrier_name, container_spec, charge_amount, memo, created_at)
                    VALUES (:id, :operated_on, '테스트 화주', '40', 357300, '기존 비고', '2026-10-23T00:00:00Z')
                """), {"id": record_id, "operated_on": operated_on})

    def tearDown(self):
        self.engine_patch.stop()
        self.engine.dispose()

    def test_patch_only_changes_sent_fields(self):
        # 준비: 금액만 변경하겠다는 요청을 만듭니다.
        changes = main.DrivingRecordUpdate(charge_amount=400000)
        # 실행: 실제 UPDATE 함수가 메모리 DB에서 동작합니다.
        result = main.update_driving_record(1, changes)
        # 확인: 금액은 변경되고, 보내지 않은 열과 등록 시각은 유지됩니다.
        self.assertEqual(result["charge_amount"], 400000)
        self.assertEqual(result["carrier_name"], "테스트 화주")
        self.assertEqual(result["memo"], "기존 비고")
        self.assertEqual(result["created_at"], "2026-10-23T00:00:00Z")

    def test_patch_can_clear_optional_memo(self):
        result = main.update_driving_record(1, main.DrivingRecordUpdate(memo=None))
        self.assertIsNone(result["memo"])

    def test_all_business_fields_are_mapped(self):
        payload = dict(operated_on=date(2026, 9, 8), category="MT",
                       carrier_name="검증 화주", region_1="출발", region_2="도착", km=125,
                       shipping_line="라인", container_spec="40", container_no="TEST1234567",
                       charge_amount=100000, tax_amount=10000, memo="확인",
                       vehicle_number="테스트차량", recipient_name="테스트수신인")
        result = main.update_driving_record(1, main.DrivingRecordUpdate(**payload))
        for field, value in payload.items():
            with self.subTest(field=field):
                self.assertEqual(result[field], value.isoformat() if isinstance(value, date) else value)

    def test_patch_missing_record_returns_404(self):
        with self.assertRaises(HTTPException) as caught:
            main.update_driving_record(999, main.DrivingRecordUpdate(memo="수정"))
        self.assertEqual(caught.exception.status_code, 404)

    def test_invalid_patch_is_rejected(self):
        for payload in [{}, {"charge_amount": -1}, {"charge_amount": 1.5},
                        {"carrier_name": " "}, {"operated_on": None},
                        {"charge_amount": None}, {"id": 10},
                        {"container_no": "bad"}, {"container_spec": "20"}]:
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                main.DrivingRecordUpdate(**payload)

    def test_post_delete_selected_records_only(self):
        result = main.delete_driving_records(main.DrivingRecordDelete(ids=[1, 1]))
        self.assertEqual(result, {"deleted_count": 1})
        remaining = main.get_driving_records(None, None)
        self.assertEqual([row["id"] for row in remaining], [2])

    def test_delete_rolls_back_if_any_record_is_missing(self):
        with self.assertRaises(HTTPException) as caught:
            main.delete_driving_records(main.DrivingRecordDelete(ids=[1, 999]))
        self.assertEqual(caught.exception.status_code, 409)
        # 1번 삭제도 함께 롤백되어 두 기록 모두 남아 있어야 합니다.
        self.assertEqual(len(main.get_driving_records(None, None)), 2)

    def test_delete_requires_explicit_ids(self):
        for ids in [[], [0], [-1], ["1"]]:
            with self.subTest(ids=ids), self.assertRaises(ValidationError):
                main.DrivingRecordDelete(ids=ids)

    def test_month_filter_excludes_next_month(self):
        rows = main.get_driving_records(2026, 9)
        self.assertEqual([row["id"] for row in rows], [1])

    def test_changed_date_moves_record_to_another_month(self):
        main.update_driving_record(1, main.DrivingRecordUpdate(operated_on=date(2026, 10, 2)))
        self.assertEqual(main.get_driving_records(2026, 9), [])
        self.assertEqual(len(main.get_driving_records(2026, 10)), 2)

    def test_km_boundaries_and_partial_update(self):
        for km in [1, 999]:
            with self.subTest(km=km):
                result = main.update_driving_record(1, main.DrivingRecordUpdate(km=km))
                self.assertEqual(result["km"], km)
                self.assertEqual(result["charge_amount"], 357300)
        rows = main.get_driving_records(None, None)
        self.assertIsNone(rows[1]["km"])

    def test_km_rejects_invalid_api_values(self):
        for km in [0, -1, 1000, 1.5, "12", True, None]:
            with self.subTest(km=km), self.assertRaises(ValidationError):
                main.DrivingRecordUpdate(km=km)
        for km in [1, 999]:
            self.assertEqual(main.DrivingRecordCreate(carrier_name="테스트", charge_amount=100, start_km=25, km=km).km, km)
        with self.assertRaises(ValidationError):
            main.DrivingRecordCreate(carrier_name="테스트", charge_amount=100)
        for km in [0, -1, 1000, 1.5, "12", True, None]:
            with self.subTest(create_km=km), self.assertRaises(ValidationError):
                main.DrivingRecordCreate(carrier_name="테스트", charge_amount=100, start_km=25, km=km)

    def test_create_passes_km_to_insert_and_response(self):
        fake_engine = MagicMock()
        connection = fake_engine.begin.return_value.__enter__.return_value
        connection.execute.return_value.mappings.return_value.one.return_value = {"id": 3, "km": 125}
        with patch.object(main, "engine", fake_engine):
            result = main.create_driving_record(main.DrivingRecordCreate(carrier_name="테스트", charge_amount=100, start_km=25, km=125))
        query, params = connection.execute.call_args.args
        self.assertEqual(params["km"], 125)
        self.assertIn(":km", str(query))
        self.assertEqual(result["km"], 125)

    def test_database_km_constraint(self):
        from sqlalchemy.exc import IntegrityError
        for km in [0, -1, 1000]:
            with self.subTest(km=km), self.assertRaises(IntegrityError):
                with self.engine.begin() as conn:
                    conn.execute(text("UPDATE public.driving_records SET km=:km WHERE id=1"), {"km": km})

    def test_swagger_exposes_patch_and_post_delete(self):
        paths = main.app.openapi()["paths"]
        self.assertIn("patch", paths["/driving-records/{record_id}"])
        self.assertIn("post", paths["/driving-records/delete"])


    def test_driving_get_calculates_tax_and_total_without_mutating_db(self):
        rows = main.get_driving_records(2026, 9)
        self.assertEqual(rows[0]["calculated_tax_amount"], "35730")
        self.assertEqual(rows[0]["total_amount"], "393030")
        self.assertIsNone(rows[0]["tax_amount"])
        with self.engine.connect() as conn:
            original = conn.execute(text("SELECT charge_amount,tax_amount FROM public.driving_records WHERE id=1")).one()
        self.assertEqual(tuple(original), (357300, None))

    def test_driving_report_matches_month_records_and_empty_month(self):
        report = main.get_driving_report(2026,9)
        self.assertEqual([r["id"] for r in report["records"]], [1])
        self.assertEqual(report["totals"], {"charge_amount":"357300","tax_amount":"35730","total_amount":"393030"})
        empty = main.get_driving_report(2026,8)
        self.assertEqual(empty["records"], [])
        self.assertEqual(empty["totals"], {"charge_amount":"0","tax_amount":"0","total_amount":"0"})

    def test_driving_rounding_and_large_amounts(self):
        for charge, tax in [(0,0),(4,0),(5,1),(15,2),(9007199254740991,900719925474099)]:
            with self.subTest(charge=charge):
                row = main.driving_amounts({"charge_amount":charge,"tax_amount":None})
                self.assertEqual(row["calculated_tax_amount"],str(tax))
                self.assertEqual(int(row["total_amount"]),charge+tax)
        with patch.object(main,"get_driving_records",return_value=[main.driving_amounts({"charge_amount":5}),main.driving_amounts({"charge_amount":5})]):
            report=main.get_driving_report(2026,9)
        self.assertEqual(report["totals"],{"charge_amount":"10","tax_amount":"2","total_amount":"12"})

    def test_driving_report_requires_year_and_month(self):
        route = main.app.openapi()["paths"]["/driving-records/report"]["get"]
        self.assertTrue(all(p["required"] for p in route["parameters"] if p["name"] in ("year","month")))


    def test_separate_carrier_and_optional_shipper(self):
        row=main.update_driving_record(1,main.DrivingRecordUpdate(carrier_name=" 운송사 ",shipper_name=" 화주 "))
        self.assertEqual(row['carrier_name'],'운송사')
        self.assertEqual(row['shipper_name'],'화주')
        cleared=main.update_driving_record(1,main.DrivingRecordUpdate(shipper_name=" - "))
        self.assertIsNone(cleared['shipper_name'])
        self.assertEqual(cleared['carrier_name'],'운송사')


    def test_start_km_separate_validation_and_mapping(self):
        row=main.update_driving_record(1,main.DrivingRecordUpdate(start_km=25,km=999))
        self.assertEqual(row['start_km'],25)
        self.assertEqual(row['km'],999)
        for value in [0,-1,1000,1.5,True,"12",None]:
            with self.subTest(value=value),self.assertRaises(ValidationError):
                main.DrivingRecordCreate(carrier_name="직접입력 운송사",charge_amount=100,start_km=value,km=125)


    def test_departure_and_arrival_times_round_trip_and_clear(self):
        row=main.update_driving_record(1, main.DrivingRecordUpdate(departure_time="23:59",arrival_time="00:05"))
        self.assertEqual(row['departure_time'],'23:59:00')
        self.assertEqual(row['arrival_time'],'00:05:00')
        rows=main.get_driving_records(2026,9)
        self.assertEqual(rows[0]['departure_time'],'23:59:00')
        cleared=main.update_driving_record(1,main.DrivingRecordUpdate(arrival_time=None))
        self.assertIsNone(cleared['arrival_time'])
        self.assertEqual(cleared['departure_time'],'23:59:00')

    def test_time_validation_and_midnight(self):
        record=main.DrivingRecordCreate(carrier_name="운송사",start_km=1,km=2,charge_amount=100,departure_time="00:00",arrival_time="23:59")
        self.assertEqual(record.departure_time,time(0,0))
        for value in ['24:00','12:60','12:30:01','12:30+09:00',1234,True]:
            with self.subTest(value=value),self.assertRaises(ValidationError):
                main.DrivingRecordUpdate(departure_time=value)


    def test_mt_full_category_mapping_and_normalization(self):
        for category in ['MT','FULL']:
            row=main.update_driving_record(1,main.DrivingRecordUpdate(category=category.lower()))
            self.assertEqual(row['category'],category)
            self.assertEqual(main.get_driving_records(2026,9)[0]['category'],category)
        self.assertIsNone(main.update_driving_record(1,main.DrivingRecordUpdate(category=" - "))['category'])
        with self.assertRaises(ValidationError):main.DrivingRecordUpdate(category="OTHER")
        from sqlalchemy.exc import IntegrityError
        with self.assertRaises(IntegrityError):
            with self.engine.begin() as conn:
                conn.execute(text("UPDATE public.driving_records SET category='OTHER' WHERE id=1"))


    def test_odometer_preview_example_and_zero_distance(self):
        trip=main.OdometerTrip(start_odometer_km=664951,pickup_odometer_km=665000,arrival_odometer_km=665100)
        self.assertEqual(main.preview_driving_distance(trip),{"start_km":49,"km":100,"total_distance_km":149})
        self.assertEqual(main.odometer_distances(0,0,0),{"start_km":0,"km":0,"total_distance_km":0})
        self.assertEqual(main.odometer_distances(100,100,2100)['km'],2000)

    def test_odometer_patch_merged_validation_and_timestamp(self):
        row=main.update_driving_record(1,main.DrivingRecordUpdate(start_odometer_km=664951,pickup_odometer_km=665000,arrival_odometer_km=665100))
        self.assertEqual((row['start_km'],row['km'],row['total_distance_km']),(49,100,149))
        self.assertIsNotNone(row['odometer_recorded_at'])
        for changes in [dict(arrival_odometer_km=664999),dict(pickup_odometer_km=None),dict(km=50)]:
            with self.subTest(changes=changes),self.assertRaises(HTTPException) as caught:
                main.update_driving_record(1,main.DrivingRecordUpdate(**changes))
            self.assertEqual(caught.exception.status_code,422)
        self.assertEqual(main.get_driving_records(2026,9)[0]['arrival_odometer_km'],665100)
        row=main.update_driving_record(1,main.DrivingRecordUpdate(arrival_odometer_km=665200))
        self.assertEqual(row['total_distance_km'],249)

    def test_odometer_validation_rejects_decimal_reverse_and_incomplete(self):
        valid=dict(carrier_name="운송사",charge_amount=100,start_odometer_km=664951,pickup_odometer_km=665000,arrival_odometer_km=665100)
        for field,value in [('start_odometer_km',664951.1),('start_odometer_km',-1),('start_odometer_km',True),('arrival_odometer_km',664900),('arrival_odometer_km',None),('pickup_odometer_km','665000')]:
            with self.subTest(field=field,value=value),self.assertRaises(ValidationError):
                main.DrivingRecordCreate(**(valid|{field:value}))
        with self.assertRaises(ValidationError):
            main.DrivingRecordCreate(**valid,start_km=1,km=2)

    def test_odometer_create_real_insert_and_get(self):
        from sqlalchemy import event
        def sqlite_today(conn,cursor,statement,parameters,context,executemany):
            return statement.replace("(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date","date('now')"),parameters
        event.listen(self.engine,'before_cursor_execute',sqlite_today,retval=True)
        try:
            row=main.create_driving_record(main.DrivingRecordCreate(carrier_name="운송사",charge_amount=100,start_odometer_km=664951,pickup_odometer_km=665000,arrival_odometer_km=665100))
        finally:
            event.remove(self.engine,'before_cursor_execute',sqlite_today)
        self.assertEqual(row['total_distance_km'],149)
        self.assertEqual(row['start_km'],49)
        with self.engine.connect() as conn:
            raw=conn.execute(text("SELECT * FROM public.driving_records WHERE id=:id"),{'id':row['id']}).mappings().one()
            self.assertIsNone(raw['km'])
            self.assertEqual(raw['arrival_odometer_km'],665100)
            self.assertIsNotNone(raw['odometer_recorded_at'])


if __name__ == "__main__":
    unittest.main(verbosity=2)

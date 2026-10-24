"""실제 DB를 변경하지 않는 받은/낸 금액 분리 테스트."""
import os
import unittest
from unittest.mock import patch
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, text, event

with patch.dict(os.environ, {"DATABASE_URL": "sqlite://"}):
    import main

class GiftDirectionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        @event.listens_for(self.engine, "before_cursor_execute", retval=True)
        def sqlite_ilike(conn, cursor, statement, parameters, context, executemany):
            return statement.replace("ILIKE", "LIKE"), parameters
        self.patcher = patch.object(main, "engine", self.engine)
        self.patcher.start()
        with self.engine.begin() as conn:
            conn.execute(text("ATTACH DATABASE ':memory:' AS public"))
            conn.execute(text("CREATE TABLE public.gifts (id INTEGER PRIMARY KEY, name TEXT NOT NULL, amount BIGINT NOT NULL, direction TEXT NOT NULL DEFAULT 'received' CHECK(direction IN ('received','paid')), category TEXT, detail TEXT, location TEXT)"))
            conn.execute(text("CREATE TABLE public.paid_gifts (id INTEGER PRIMARY KEY, name TEXT NOT NULL, amount BIGINT NOT NULL, direction TEXT NOT NULL DEFAULT 'paid', category TEXT, detail TEXT, location TEXT, paid_on DATE)"))
            conn.execute(text("INSERT INTO public.gifts (id, name, amount, direction) VALUES (1, '동명이인', 100000, 'received')"))
            conn.execute(text("INSERT INTO public.paid_gifts (id, name, amount) VALUES (1, '동명이인', 50000)"))

    def tearDown(self):
        self.patcher.stop()
        self.engine.dispose()

    def test_list_and_total_are_separate(self):
        for direction, expected_id, amount in [('received', 1, 100000), ('paid', 1, 50000)]:
            self.assertEqual([r['id'] for r in main.get_gifts('동명', direction)], [expected_id])
            self.assertEqual(main.get_gifts_total(None, direction), {'count': 1, 'total_amount': amount})
        self.assertEqual(main.get_gifts_total('없는이름', 'paid')['count'], 0)

    def test_post_maps_direction_and_defaults_to_received(self):
        for payload, direction in [({'name': '새이름', 'amount': 30000}, 'received'), ({'name': '새이름', 'amount': 40000, 'direction': 'paid'}, 'paid')]:
            result = main.create_gift(main.GiftCreate(**payload))
            self.assertEqual(result['direction'], direction)
            self.assertEqual(result['amount'], payload['amount'])

    def test_delete_cannot_cross_direction_and_rolls_back(self):
        with self.assertRaises(HTTPException):
            main.delete_gifts(main.GiftDelete(ids=[1, 999], direction='paid'))
        self.assertEqual(len(main.get_gifts(None, 'paid')), 1)
        self.assertEqual(main.delete_gifts(main.GiftDelete(ids=[1], direction='paid')), {'deleted_count': 1})
        self.assertEqual(len(main.get_gifts(None, 'received')), 1)

    def test_invalid_direction_rejected(self):
        with self.assertRaises(ValidationError):
            main.GiftCreate(name='테스트', amount=1, direction='other')

    def test_paid_details_are_saved_and_returned_by_get(self):
        payload = dict(name="테스트", amount=100000, direction="paid",
                       category=" 축의금 ", detail=" 자녀결혼 ", location=" 예식장 ")
        result = main.create_gift(main.GiftCreate(**payload))
        for field, expected in [("category", "축의금"), ("detail", "자녀결혼"), ("location", "예식장")]:
            self.assertEqual(result[field], expected)
        row = next(row for row in main.get_gifts(None, "paid") if row["id"] == result["id"])
        self.assertEqual(row, result)
        self.assertFalse(any(row["name"] == result["name"] for row in main.get_gifts(None, "received")))

    def test_old_input_can_omit_optional_details(self):
        result = main.create_gift(main.GiftCreate(name="기존입력", amount=50000))
        for field in ("category", "detail", "location"):
            self.assertIsNone(result[field])
        self.assertEqual(result["direction"], "received")

    def test_condolence_category_is_supported(self):
        result = main.create_gift(main.GiftCreate(name="테스트", amount=50000, direction="paid",
                                                category="조의금", detail="부친상", location="장례식장"))
        self.assertEqual(result["category"], "조의금")
        self.assertEqual(result["detail"], "부친상")

    def test_openapi_post_exposes_details(self):
        fields = main.app.openapi()["components"]["schemas"]["GiftCreate"]["properties"]
        self.assertTrue({"category", "detail", "location"}.issubset(fields))

    def test_independent_ids_and_new_paid_routes(self):
        self.assertEqual(main.get_gifts(None, "received")[0]["id"], 1)
        self.assertEqual(main.get_paid_gifts(None)[0]["id"], 1)
        result = main.create_paid_gift(main.PaidGiftCreate(name="  공백확인  ", amount=10000, location="　 "))
        self.assertEqual(result["name"], "공백확인")
        self.assertIsNone(result["location"])
        self.assertEqual(main.get_paid_gifts_total(None)["total_amount"], 60000)
        paths = main.app.openapi()["paths"]
        self.assertTrue({"get", "post", "delete"}.issubset(paths["/paid-gifts"]))

    def test_optional_text_trim_and_dash(self):
        for value in (None, "", "　 ", " - "):
            gift = main.PaidGiftCreate(name="테스트", amount=10000, location=value)
            self.assertIsNone(gift.location)
        with self.assertRaises(ValidationError):
            main.PaidGiftCreate(name="　 ", amount=10000)

    def test_paid_date_saved_and_read(self):
        from datetime import date
        result = main.create_paid_gift(main.PaidGiftCreate(name="날짜확인", amount=10000, paid_on=" 2026-08-26 "))
        self.assertEqual(str(result["paid_on"]), "2026-08-26")
        row = next(r for r in main.get_paid_gifts(None) if r["id"] == result["id"])
        self.assertEqual(str(row["paid_on"]), "2026-08-26")
        self.assertEqual(main.PaidGiftCreate(name="테스트", amount=1, paid_on="2028-02-29").paid_on, date(2028, 2, 29))

    def test_invalid_paid_date_rejected(self):
        for value in ("2026-02-29", "2026-13-01", "2026-04-31", "invalid", 123):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                main.PaidGiftCreate(name="테스트", amount=1, paid_on=value)

    def test_unknown_legacy_date_remains_null(self):
        result = main.create_paid_gift(main.PaidGiftCreate(name="날짜미상", amount=10000))
        self.assertIsNone(result["paid_on"])
        self.assertIsNone(main.get_gifts(None, "received")[0]["paid_on"])

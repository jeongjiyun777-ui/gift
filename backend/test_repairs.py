import os
import unittest
from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch
from pydantic import ValidationError

with patch.dict(os.environ, {"DATABASE_URL": "sqlite://"}):
    import main


class RepairTests(unittest.TestCase):
    def test_date_is_korean_midnight_and_text_trimmed(self):
        record = main.RepairRecordCreate(repaired_at="2026-10-25", merchant_name=" 정비소 ", total_amount="100000", business_number=" 012-34-56789 ", card_company="-", installment_months=0)
        self.assertEqual(record.repaired_at.isoformat(), "2026-10-25T00:00:00+09:00")
        self.assertEqual(record.merchant_name, "정비소")
        self.assertEqual(record.business_number, "012-34-56789")
        self.assertIsNone(record.card_company)

    def test_invalid_fields_are_rejected(self):
        for change in [{"merchant_name":" "}, {"total_amount":"-1"}, {"total_amount":"1.001"}, {"total_amount":"NaN"}, {"installment_months":-1}, {"installment_months":1.5}, {"installment_months":13}, {"repaired_at":"2026-02-30"}, {"repaired_at":1234}]:
            with self.subTest(change=change), self.assertRaises(ValidationError):
                main.RepairRecordCreate(**({"merchant_name":"정비소", "total_amount":"100"} | change))

    def test_insert_uses_transaction_and_bound_values(self):
        engine = MagicMock()
        record = main.RepairRecordCreate(merchant_name="정비소",total_amount="100.50")
        connection = engine.begin.return_value.__enter__.return_value
        connection.execute.return_value.mappings.return_value.one.return_value = {"id":1}
        with patch.object(main, "engine", engine):
            self.assertEqual(main.create_repair_record(record), {"id":1})
        statement, values = connection.execute.call_args.args
        self.assertIn("INSERT INTO public.repair_records", str(statement))
        self.assertEqual(values["total_amount"], Decimal("100.50"))
        self.assertIsNone(values["repaired_at"])
        engine.begin.assert_called_once()

    def test_december_range_uses_korean_timezone(self):
        engine = MagicMock()
        connection = engine.connect.return_value.__enter__.return_value
        connection.execute.return_value.mappings.return_value.all.return_value = []
        with patch.object(main,"engine",engine):
            self.assertEqual(main.get_repair_records(2026,12), [])
        statement, values = connection.execute.call_args.args
        self.assertEqual(values["start"].isoformat(), "2026-12-01T00:00:00+09:00")
        self.assertEqual(values["end"].isoformat(), "2027-01-01T00:00:00+09:00")
        self.assertIn("repaired_at < :end", str(statement))

    def test_swagger_contains_both_operations(self):
        operations = main.app.openapi()["paths"]["/repair-records"]
        self.assertIn("get", operations)
        self.assertIn("post", operations)


class RepairMutationTests(unittest.TestCase):
    def setUp(self):
        import sqlite3
        from sqlalchemy import create_engine, text
        sqlite3.register_adapter(Decimal, str)
        self.engine = create_engine("sqlite://")
        self.patch = patch.object(main, "engine", self.engine)
        self.patch.start()
        with self.engine.begin() as conn:
            conn.execute(text("ATTACH DATABASE ':memory:' AS public"))
            conn.execute(text("CREATE TABLE public.repair_records (id INTEGER PRIMARY KEY, repaired_at TEXT, merchant_name TEXT, business_number TEXT, card_company TEXT, installment_months INTEGER, total_amount NUMERIC, created_at TEXT DEFAULT CURRENT_TIMESTAMP)"))
            conn.execute(text("INSERT INTO public.repair_records (id,repaired_at,merchant_name,total_amount) VALUES (1,'2026-10-25T00:00:00+09:00','original',100),(2,'2026-10-26T00:00:00+09:00','other',200)"))

    def tearDown(self):
        self.patch.stop()
        self.engine.dispose()

    def test_partial_update_preserves_other_values(self):
        row = main.update_repair_record(1, main.RepairRecordUpdate(merchant_name=" changed ", installment_months=0))
        self.assertEqual(row["merchant_name"], "changed")
        self.assertEqual(row["total_amount"], 100)
        self.assertEqual(row["installment_months"], 0)

    def test_missing_update_returns_404(self):
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as caught:
            main.update_repair_record(99, main.RepairRecordUpdate(total_amount="10"))
        self.assertEqual(caught.exception.status_code, 404)

    def test_delete_missing_id_rolls_back_and_deduplicates(self):
        from fastapi import HTTPException
        from sqlalchemy import text
        with self.assertRaises(HTTPException) as caught:
            main.delete_repair_records(main.RepairRecordDelete(ids=[1,99]))
        self.assertEqual(caught.exception.status_code,409)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT count(*) FROM public.repair_records")).scalar_one(),2)
        self.assertEqual(main.delete_repair_records(main.RepairRecordDelete(ids=[1,1])), {"deleted_count":1})

    def test_invalid_mutations_are_rejected(self):
        for values in [{}, {"merchant_name":None}, {"repaired_at":None}, {"total_amount":None}, {"id":1}]:
            with self.subTest(values=values), self.assertRaises(ValidationError):
                main.RepairRecordUpdate(**values)
        for ids in [[], [0], [True], ["1"]]:
            with self.subTest(ids=ids), self.assertRaises(ValidationError):
                main.RepairRecordDelete(ids=ids)

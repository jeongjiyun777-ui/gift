"""실제 DB에 저장하지 않는 요소수 API 테스트."""
import os
import unittest
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
from pydantic import ValidationError

with patch.dict(os.environ, {"DATABASE_URL": "sqlite://"}):
    import main

class UreaTests(unittest.TestCase):
    def payload(self, **changes):
        return dict(merchant_name="  테스트 주유소  ", business_number=" 012-34-56789 ",
                    card_company=" 카드사 ", unit_price="1500.25", liters="10.125", **changes)

    def test_insert_uses_transaction_and_maps_all_columns(self):
        record = main.UreaRecordCreate(**self.payload(purchased_on="2026-10-24"))
        expected = dict(record.model_dump(), total_amount=Decimal("15190.03"), id=1, created_at=datetime.now(timezone.utc))
        engine = MagicMock()
        conn = engine.begin.return_value.__enter__.return_value
        conn.execute.return_value.mappings.return_value.one.return_value = expected
        with patch.object(main, "engine", engine):
            result = main.create_urea_record(record)
        engine.begin.assert_called_once()
        params = conn.execute.call_args.args[1]
        self.assertEqual(params["merchant_name"], "테스트 주유소")
        self.assertEqual(params["business_number"], "012-34-56789")
        self.assertEqual(params["liters"], Decimal("10.125"))
        self.assertEqual(params["total_amount"], Decimal("15190.03"))
        self.assertEqual(params["purchased_on"], date(2026, 10, 24))
        self.assertEqual(result, expected)
        self.assertEqual(main.UreaRecordResponse(**result).total_amount, Decimal("15190.03"))

    def test_missing_date_uses_database_korean_today(self):
        record = main.UreaRecordCreate(**self.payload())
        self.assertIsNone(record.purchased_on)
        engine = MagicMock()
        with patch.object(main, "engine", engine):
            main.create_urea_record(record)
        query = str(engine.begin.return_value.__enter__.return_value.execute.call_args.args[0])
        self.assertIn("Asia/Seoul", query)
        self.assertIn("COALESCE", query)

    def test_invalid_values_rejected(self):
        for changes in [dict(merchant_name=" "), dict(unit_price=-1), dict(liters=0),
                        dict(liters=-1), dict(total_amount=-1), dict(unit_price="1.001"),
                        dict(liters="1.0001"), dict(unit_price="NaN"),
                        dict(total_amount="Infinity"), dict(purchased_on="2026-02-29"),
                        dict(purchased_on=123), dict(unknown="bad")]:
            payload = self.payload()
            payload.update(changes)
            with self.subTest(changes=changes), self.assertRaises(ValidationError):
                main.UreaRecordCreate(**payload)

    def test_optional_fields_trim_to_null(self):
        payload = self.payload()
        payload.update(business_number=" - ", card_company="　 ")
        record = main.UreaRecordCreate(**payload)
        self.assertIsNone(record.business_number)
        self.assertIsNone(record.card_company)

    def test_openapi_has_post_and_created_status(self):
        route = main.app.openapi()["paths"]["/urea-records"]["post"]
        self.assertIn("201", route["responses"])
        self.assertIn("422", route["responses"])


class UreaMonthlyQueryTests(unittest.TestCase):
    def setUp(self):
        import sqlite3
        from sqlalchemy import create_engine, text
        sqlite3.register_adapter(date, lambda value: value.isoformat())
        self.engine = create_engine("sqlite://")
        self.patcher = patch.object(main, "engine", self.engine)
        self.patcher.start()
        with self.engine.begin() as conn:
            conn.execute(text("ATTACH DATABASE ':memory:' AS public"))
            conn.execute(text("CREATE TABLE public.urea_records (id INTEGER PRIMARY KEY, purchased_on DATE, merchant_name TEXT, business_number TEXT, card_company TEXT, unit_price NUMERIC, liters NUMERIC, total_amount NUMERIC, created_at TEXT)"))
            for record_id, day in [(1,'2026-08-31'),(2,'2026-09-01'),(3,'2026-09-30'),(4,'2026-10-01'),(5,'2026-12-31'),(6,'2027-01-01'),(7,'2028-02-29')]:
                conn.execute(text("INSERT INTO public.urea_records VALUES (:id,:day,'테스트',NULL,NULL,1500,10,15000,'2026-10-24T00:00:00Z')"), {'id':record_id,'day':day})

    def tearDown(self):
        self.patcher.stop()
        self.engine.dispose()

    def test_month_boundaries_include_last_day_not_next_month(self):
        self.assertEqual([r['id'] for r in main.get_urea_records(2026,9)], [2,3])

    def test_december_and_leap_year(self):
        self.assertEqual([r['id'] for r in main.get_urea_records(2026,12)], [5])
        self.assertEqual([r['id'] for r in main.get_urea_records(2028,2)], [7])
        self.assertEqual(main.get_urea_records(2026,2), [])

    def test_get_exposes_all_fields_and_nullable_columns(self):
        result = main.get_urea_records(2026,9)[0]
        self.assertIsNone(result['business_number'])
        self.assertIsNone(result['card_company'])
        self.assertEqual(main.UreaQueryResponse(**result).liters, Decimal('10'))

    def test_api_requires_year_and_month_with_bounds(self):
        parameters = main.app.openapi()['paths']['/urea-records']['get']['parameters']
        by_name = {parameter['name']: parameter for parameter in parameters}
        for field, minimum, maximum in [('year',1,9998),('month',1,12)]:
            self.assertTrue(by_name[field]['required'])
            self.assertEqual(by_name[field]['schema']['minimum'],minimum)
            self.assertEqual(by_name[field]['schema']['maximum'],maximum)


    def test_export_all_periods_and_selected_month(self):
        all_rows = main.export_urea_records(None, None)
        self.assertEqual(len(all_rows), 7)
        self.assertEqual([r['id'] for r in main.export_urea_records(2026,9)], [2,3])
        self.assertTrue(all('supply_amount' in row and 'vat_amount' in row for row in all_rows))
        for row in all_rows:
            self.assertEqual(row['supply_amount'] + row['vat_amount'], Decimal(str(row['total_amount'])))

    def test_export_rejects_incomplete_period(self):
        from fastapi import HTTPException
        for year, month in [(2026,None),(None,9)]:
            with self.assertRaises(HTTPException) as caught:
                main.export_urea_records(year,month)
            self.assertEqual(caught.exception.status_code,422)


    def test_patch_recalculates_total_and_preserves_other_fields(self):
        import sqlite3
        sqlite3.register_adapter(Decimal,str)
        result = main.update_urea_record(2, main.UreaRecordUpdate(liters="20"))
        self.assertEqual(Decimal(str(result['total_amount'])),Decimal('30000'))
        self.assertEqual(result['merchant_name'],'테스트')
        self.assertEqual(result['created_at'],'2026-10-24T00:00:00Z')
        self.assertEqual(result['supply_amount']+result['vat_amount'],Decimal('30000'))

    def test_patch_date_moves_record_between_months(self):
        main.update_urea_record(2, main.UreaRecordUpdate(purchased_on='2026-10-02'))
        self.assertEqual([r['id'] for r in main.get_urea_records(2026,9)],[3])
        self.assertEqual([r['id'] for r in main.get_urea_records(2026,10)],[4,2])

    def test_patch_missing_record_and_invalid_fields(self):
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as caught:
            main.update_urea_record(999,main.UreaRecordUpdate(merchant_name='변경'))
        self.assertEqual(caught.exception.status_code,404)
        for payload in [{},{'liters':0},{'unit_price':None},{'merchant_name':' '},
                        {'purchased_on':None},{'total_amount':1},{'id':2},{'liters':'1.0001'}]:
            with self.subTest(payload=payload),self.assertRaises(ValidationError):
                main.UreaRecordUpdate(**payload)

    def test_delete_deduplicates_ids_and_rolls_back_missing(self):
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as caught:
            main.delete_urea_records(main.UreaRecordDelete(ids=[2,999]))
        self.assertEqual(caught.exception.status_code,409)
        self.assertEqual(len(main.get_urea_records(2026,9)),2)
        self.assertEqual(main.delete_urea_records(main.UreaRecordDelete(ids=[2,2])),{'deleted_count':1})
        self.assertEqual([r['id'] for r in main.get_urea_records(2026,9)],[3])
        for ids in [[],[0],[-1],[True],['2']]:
            with self.subTest(ids=ids),self.assertRaises(ValidationError):
                main.UreaRecordDelete(ids=ids)

    def test_patch_overflow_rolls_back(self):
        import sqlite3
        from fastapi import HTTPException
        from sqlalchemy import text
        sqlite3.register_adapter(Decimal,str)
        main.update_urea_record(2,main.UreaRecordUpdate(unit_price='9999999999.99'))
        with self.assertRaises(HTTPException) as caught:
            main.update_urea_record(2,main.UreaRecordUpdate(liters='999999999.999'))
        self.assertEqual(caught.exception.status_code,422)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text('SELECT liters FROM public.urea_records WHERE id=2')).scalar_one(),10)


class UreaVatTests(unittest.TestCase):
    def test_tax_inclusive_total_is_split_and_reconciles(self):
        for total, expected_supply, expected_vat in [
            ("11000", "10000", "1000"), ("15000", "13636", "1364"),
            ("0", "0", "0"), ("1", "1", "0"),
            ("0.56", "0.51", "0.05"), ("11000.55", "10000.50", "1000.05"),
            ("999999999999.99", "909090909090.90", "90909090909.09"),
        ]:
            with self.subTest(total=total):
                supply, vat = main.split_urea_total(Decimal(total))
                self.assertEqual(supply, Decimal(expected_supply))
                self.assertEqual(vat, Decimal(expected_vat))
                self.assertEqual(supply + vat, Decimal(total))

    def test_get_returns_computed_tax_fields_without_storing_them(self):
        engine = MagicMock()
        conn = engine.connect.return_value.__enter__.return_value
        conn.execute.return_value.mappings.return_value.all.return_value = [dict(
            id=1,purchased_on=date(2026,10,24),merchant_name='테스트',business_number=None,
            card_company=None,unit_price=Decimal('1100'),liters=Decimal('10'),
            total_amount=Decimal('11000'),created_at=datetime.now(timezone.utc))]
        with patch.object(main,'engine',engine):
            rows = main.get_urea_records(2026,10)
        response = main.UreaQueryResponse(**rows[0])
        self.assertEqual(response.supply_amount,Decimal('10000'))
        self.assertEqual(response.vat_amount,Decimal('1000'))
        engine.begin.assert_not_called()
        self.assertEqual(conn.execute.call_count,1)


class UreaCalculatedTotalTests(unittest.TestCase):
    def test_post_accepts_inputs_without_total_and_rejects_client_total(self):
        record = main.UreaRecordCreate(merchant_name='테스트', unit_price='1500', liters='10')
        self.assertNotIn('total_amount', record.model_dump())
        with self.assertRaises(ValidationError):
            main.UreaRecordCreate(merchant_name='테스트',unit_price='1500',liters='10',total_amount=1)

    def test_total_overflow_is_rejected_before_insert(self):
        record = main.UreaRecordCreate(merchant_name='테스트',unit_price='9999999999.99',liters='999999999.999')
        engine = MagicMock()
        from fastapi import HTTPException
        with patch.object(main,'engine',engine), self.assertRaises(HTTPException) as caught:
            main.create_urea_record(record)
        self.assertEqual(caught.exception.status_code,422)
        engine.begin.assert_not_called()

    def test_rounding_uses_decimal_and_half_up(self):
        record = main.UreaRecordCreate(merchant_name='테스트',unit_price='1.01',liters='0.5')
        engine = MagicMock()
        with patch.object(main,'engine',engine):
            main.create_urea_record(record)
        params = engine.begin.return_value.__enter__.return_value.execute.call_args.args[1]
        self.assertEqual(params['total_amount'],Decimal('0.51'))

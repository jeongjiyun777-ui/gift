import os
import sqlite3
import unittest
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import patch
from sqlalchemy import create_engine, text

with patch.dict(os.environ, {"DATABASE_URL":"sqlite://"}):
    import main


class DrivingOverviewTests(unittest.TestCase):
    def setUp(self):
        sqlite3.register_adapter(date, lambda value: value.isoformat())
        sqlite3.register_adapter(datetime, lambda value: value.isoformat())
        self.engine=create_engine("sqlite://")
        self.patcher=patch.object(main,"engine",self.engine)
        self.patcher.start()
        with self.engine.begin() as conn:
            conn.execute(text("ATTACH DATABASE ':memory:' AS public"))
            conn.execute(text("CREATE TABLE public.driving_records (operated_on TEXT, charge_amount NUMERIC)"))
            for table in ("urea_records","diesel_records"):
                conn.execute(text(f"CREATE TABLE public.{table} (purchased_on TEXT, total_amount NUMERIC)"))
            conn.execute(text("CREATE TABLE public.repair_records (repaired_at TEXT, total_amount NUMERIC)"))
            conn.execute(text("INSERT INTO public.driving_records VALUES ('2026-10-01',100000),('2026-10-31',200000),('2026-11-01',999999)"))
            conn.execute(text("INSERT INTO public.urea_records VALUES ('2026-10-01',10000),('2026-10-02',20000),('2026-10-03',30000),('2026-11-01',999999)"))
            conn.execute(text("INSERT INTO public.diesel_records VALUES ('2026-10-31',40000)"))
            conn.execute(text("INSERT INTO public.repair_records VALUES ('2026-10-01T00:00:00+09:00',50000),('2026-10-31T23:59:59+09:00',10000),('2026-11-01T00:00:00+09:00',999999)"))

    def tearDown(self):
        self.patcher.stop()
        self.engine.dispose()

    def test_multiple_rows_do_not_multiply_and_month_boundaries(self):
        result=main.get_driving_overview(2026,10)
        self.assertEqual(result['driving_supply_amount'],Decimal('300000'))
        self.assertEqual(result['urea_total_amount'],Decimal('60000'))
        self.assertEqual(result['diesel_total_amount'],Decimal('40000'))
        self.assertEqual(result['repair_total_amount'],Decimal('60000'))
        self.assertEqual(result['expense_total_amount'],Decimal('160000'))
        self.assertEqual(result['balance_amount'],Decimal('154544'))
        self.assertEqual(Decimal(main.DrivingOverviewResponse(**result).model_dump(mode='json')['balance_amount']),Decimal('154544'))

    def test_empty_month_and_year_boundary(self):
        result=main.get_driving_overview(2026,12)
        self.assertTrue(all(value==0 for key,value in result.items() if key not in ('year','month')))

    def test_expenses_without_income_are_negative(self):
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO public.diesel_records VALUES ('2026-09-01',123.45)"))
        result=main.get_driving_overview(2026,9)
        self.assertEqual(result['driving_supply_amount'],0)
        self.assertEqual(result['balance_amount'],Decimal('-112.23'))


    def test_input_output_vat_and_supply_reconcile(self):
        result=main.get_driving_overview(2026,10)
        self.assertEqual(result['expense_supply_amount'],Decimal('145456'))
        self.assertEqual(result['input_vat_amount'],Decimal('14544'))
        self.assertEqual(result['output_vat_amount'],Decimal('30000'))
        self.assertEqual(result['vat_balance_amount'],Decimal('15456'))
        for kind in ('urea','diesel','repair'):
            self.assertEqual(result[f'{kind}_supply_amount']+result[f'{kind}_vat_amount'], result[f'{kind}_total_amount'])

    def test_row_rounding_matches_existing_reports(self):
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO public.driving_records VALUES ('2026-08-01',5),('2026-08-02',5)"))
            conn.execute(text("INSERT INTO public.urea_records VALUES ('2026-08-01',5),('2026-08-02',5)"))
        result=main.get_driving_overview(2026,8)
        self.assertEqual(result['output_vat_amount'],Decimal('2'))
        self.assertEqual(result['urea_supply_amount'],Decimal('10'))
        self.assertEqual(result['urea_vat_amount'],Decimal('0'))

    def test_more_input_vat_preserves_negative_balance(self):
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO public.repair_records VALUES ('2026-07-01T00:00:00+09:00',110000)"))
        result=main.get_driving_overview(2026,7)
        self.assertEqual(result['input_vat_amount'],Decimal('10000'))
        self.assertEqual(result['vat_balance_amount'],Decimal('-10000'))


    def test_custom_ten_percent_uses_gross_totals(self):
        result=main.get_driving_overview(2026,10)
        self.assertEqual(result['driving_total_amount'],Decimal('330000'))
        self.assertEqual(result['income_tax_estimate'],Decimal('33000'))
        self.assertEqual(result['expense_tax_estimate'],Decimal('16000'))
        self.assertEqual(result['output_vat_amount'],Decimal('30000'))
        self.assertEqual(result['input_vat_amount'],Decimal('14544'))

    def test_custom_ten_percent_rounds_half_up(self):
        with self.engine.begin() as conn:
            conn.execute(text("INSERT INTO public.diesel_records VALUES ('2026-06-01',105)"))
        result=main.get_driving_overview(2026,6)
        self.assertEqual(result['expense_tax_estimate'],Decimal('11'))


    def test_frontend_contract_has_decimal_strings_for_all_four_sections(self):
        payload = main.DrivingOverviewResponse(**main.get_driving_overview(2026,10)).model_dump(mode='json')
        expected = {
            'driving_total_amount':Decimal('330000'),
            'expense_total_amount':Decimal('160000'),
            'income_tax_estimate':Decimal('33000'),
            'expense_tax_estimate':Decimal('16000'),
        }
        for field, value in expected.items():
            with self.subTest(field=field):
                self.assertIsInstance(payload[field],str)
                self.assertEqual(Decimal(payload[field]),value)
        self.assertIn('/driving-overview',main.app.openapi()['paths'])

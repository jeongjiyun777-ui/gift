"""경유 기능과 요소수 테이블 분리를 메모리 DB에서 검증합니다."""
import os
import sqlite3
import json
import base64
import unittest
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, text, event
import urea_ocr

with patch.dict(os.environ, {"DATABASE_URL":"sqlite://"}):
    import main

class DieselTests(unittest.TestCase):
    def setUp(self):
        sqlite3.register_adapter(date,lambda value:value.isoformat())
        sqlite3.register_adapter(Decimal,str)
        self.engine=create_engine('sqlite://')
        @event.listens_for(self.engine,'before_cursor_execute',retval=True)
        def sqlite_today(conn,cursor,statement,parameters,context,executemany):
            return statement.replace("(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date", "date('now')"),parameters
        self.patcher=patch.object(main,'engine',self.engine)
        self.patcher.start()
        with self.engine.begin() as conn:
            conn.execute(text("ATTACH DATABASE ':memory:' AS public"))
            for table in ['urea_records','diesel_records']:
                conn.execute(text(f"CREATE TABLE public.{table} (id INTEGER PRIMARY KEY,purchased_on DATE NOT NULL,merchant_name TEXT NOT NULL,business_number TEXT,card_company TEXT,unit_price NUMERIC NOT NULL,liters NUMERIC NOT NULL,total_amount NUMERIC NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)"))
                conn.execute(text(f"INSERT INTO public.{table} (id,purchased_on,merchant_name,unit_price,liters,total_amount) VALUES (1,'2026-09-30',:merchant,1500,10,15000)"),{'merchant':table})
            conn.execute(text("INSERT INTO public.diesel_records (id,purchased_on,merchant_name,unit_price,liters,total_amount) VALUES (2,'2026-10-01','경유다음달',1600,20,32000)"))

    def tearDown(self):
        self.patcher.stop()
        self.engine.dispose()

    def test_create_calculates_total_and_keeps_leading_zero(self):
        row=main.create_diesel_record(main.DieselRecordCreate(purchased_on='2026-10-24',merchant_name=' 테스트주유소 ',business_number='012-34-56789',card_company=' 카드사 ',unit_price='1600.50',liters='40.125'))
        self.assertEqual(row['merchant_name'],'테스트주유소')
        self.assertEqual(row['business_number'],'012-34-56789')
        self.assertEqual(Decimal(str(row['total_amount'])),Decimal('64220.06'))
        self.assertEqual(len(main.get_urea_records(2026,10)),0)
        self.assertEqual(len(main.get_diesel_records(2026,10)),2)

    def test_month_boundaries_and_tax_reconcile(self):
        rows=main.get_diesel_records(2026,9)
        self.assertEqual([r['id'] for r in rows],[1])
        self.assertEqual(rows[0]['merchant_name'],'diesel_records')
        self.assertEqual(rows[0]['supply_amount']+rows[0]['vat_amount'],Decimal('15000'))
        self.assertEqual(main.get_urea_records(2026,9)[0]['merchant_name'],'urea_records')
        self.assertEqual(main.get_diesel_records(2026,8),[])

    def test_patch_only_diesel_recalculates_total(self):
        row=main.update_diesel_record(1,main.DieselRecordUpdate(liters='20'))
        self.assertEqual(Decimal(str(row['total_amount'])),Decimal('30000'))
        self.assertEqual(main.get_urea_records(2026,9)[0]['total_amount'],15000)
        self.assertEqual(row['business_number'],None)

    def test_changed_date_moves_to_other_month(self):
        main.update_diesel_record(1,main.DieselRecordUpdate(purchased_on='2026-10-02'))
        self.assertEqual(main.get_diesel_records(2026,9),[])
        self.assertEqual([r['id'] for r in main.get_diesel_records(2026,10)],[2,1])

    def test_delete_rollback_and_table_isolation(self):
        with self.assertRaises(HTTPException) as caught:
            main.delete_diesel_records(main.DieselRecordDelete(ids=[1,999]))
        self.assertEqual(caught.exception.status_code,409)
        self.assertEqual(len(main.get_diesel_records(2026,9)),1)
        self.assertEqual(main.delete_diesel_records(main.DieselRecordDelete(ids=[1,1])),{'deleted_count':1})
        self.assertEqual(len(main.get_urea_records(2026,9)),1)
        self.assertEqual(main.get_diesel_records(2026,9),[])

    def test_missing_patch_and_overflow_leave_data_unchanged(self):
        with self.assertRaises(HTTPException) as caught:
            main.update_diesel_record(999,main.DieselRecordUpdate(merchant_name='없는기록'))
        self.assertEqual(caught.exception.status_code,404)
        with self.assertRaises(HTTPException) as caught:
            main.create_diesel_record(main.DieselRecordCreate(merchant_name='테스트',unit_price='9999999999.99',liters='999999999.999'))
        self.assertEqual(caught.exception.status_code,422)
        self.assertEqual(len(main.export_diesel_records(None,None)),2)

    def test_validation_and_no_client_total(self):
        for change in [{'merchant_name':' '},{'unit_price':-1},{'liters':0},{'liters':'1.0001'},{'total_amount':1},{'purchased_on':'2026-02-29'}]:
            payload=dict(merchant_name='테스트',unit_price='1500',liters='10')
            payload.update(change)
            with self.subTest(change=change),self.assertRaises(ValidationError):main.DieselRecordCreate(**payload)
        for payload in [{},{'liters':None},{'id':1},{'total_amount':1}]:
            with self.subTest(payload=payload),self.assertRaises(ValidationError):main.DieselRecordUpdate(**payload)
        for ids in [[],[0],[True],['1']]:
            with self.subTest(ids=ids),self.assertRaises(ValidationError):main.DieselRecordDelete(ids=ids)

    def test_export_period_and_schema_routes(self):
        self.assertEqual(len(main.export_diesel_records(None,None)),2)
        self.assertEqual([r['id'] for r in main.export_diesel_records(2026,9)],[1])
        with self.assertRaises(HTTPException):main.export_diesel_records(2026,None)
        paths=main.app.openapi()['paths']
        self.assertIn('post',paths['/diesel-records'])
        self.assertIn('get',paths['/diesel-records'])
        self.assertIn('patch',paths['/diesel-records/{record_id}'])
        self.assertIn('post',paths['/diesel-records/delete'])
        self.assertIn('post',paths['/diesel-records/ocr'])
        self.assertFalse(any(p['name']=='kind' for p in paths['/diesel-records']['get']['parameters']))
        with self.assertRaises(ValueError):main.purchase_table('diesel_records;DROP TABLE')

    def test_ocr_targets_diesel_quantity_without_saving(self):
        fields=dict(purchased_on='2026-10-24',merchant_name='테스트',business_number='0123456789',card_company='카드사',unit_price='1600',liters='40')
        response=MagicMock();response.__enter__.return_value.read.return_value=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(fields)}]}}]}).encode()
        image=main.UreaReceiptImage(mime_type='image/jpeg',image_base64=base64.b64encode(b'\xff\xd8\xfftest').decode())
        with patch.dict(os.environ,{'GEMINI_API_KEY':'test-only'}),patch.object(urea_ocr,'urlopen',return_value=response) as send:
            result=main.read_diesel_receipt(image)
        prompt=json.loads(send.call_args.args[0].data)['contents'][0]['parts'][0]['text']
        self.assertIn('DIESEL item',prompt)
        self.assertIn('수량',prompt)
        self.assertIn('Exclude urea/AdBlue/gasoline',prompt)
        self.assertEqual(result.fields.liters,'40')
        self.assertEqual(len(main.export_diesel_records(None,None)),2)

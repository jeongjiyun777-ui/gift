import base64
import json
import os
import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
import repair_ocr
import urea_ocr
import main

class RepairOcrTests(unittest.TestCase):
    def test_six_fields_normalized_and_unrelated_fields_ignored(self):
        result=repair_ocr.normalize_repair_receipt(dict(repaired_on='2026-10-27', merchant_name=' 가맹점 ',business_number='0123456789',card_company=' 신한 ',installment_months='일시불',total_amount='110,000',unit_price='999',card_number='private'))
        self.assertEqual(set(result.fields.model_dump()),set(repair_ocr.FIELDS))
        self.assertEqual(result.fields.business_number,'012-34-56789')
        self.assertEqual(result.fields.installment_months,0)
        self.assertEqual(result.fields.total_amount,'110000')

    def test_unclear_fields_are_null_and_months_are_not_invented(self):
        result=repair_ocr.normalize_repair_receipt(dict(merchant_name='정비소',repaired_on='2026-02-30',business_number='123',installment_months='13',total_amount='unknown'))
        for field in ('repaired_on','business_number','installment_months','total_amount'):
            self.assertIsNone(getattr(result.fields,field))
        self.assertIsNone(repair_ocr.normalize_repair_receipt({'merchant_name':'정비소'}).fields.installment_months)
        self.assertEqual(repair_ocr.normalize_repair_receipt({'installment_months':'12개월'}).fields.installment_months,12)
        with self.assertRaises(HTTPException): repair_ocr.normalize_repair_receipt({})

    def test_gemini_prompt_schema_and_no_db_write(self):
        image=urea_ocr.UreaReceiptImage(mime_type='image/jpeg',image_base64=base64.b64encode(b'\xff\xd8\xfftest').decode())
        fields=dict(repaired_on='2026-10-27',merchant_name='정비소',business_number='0123456789',card_company='신한',installment_months='5',total_amount='110000')
        response=MagicMock()
        response.__enter__.return_value.read.return_value=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(fields)}]}}]}).encode()
        with patch.dict(os.environ,{'GEMINI_API_KEY':'test-key'}),patch.object(urea_ocr,'urlopen',return_value=response) as send,patch.object(main,'engine') as engine:
            result=main.read_repair_receipt(image)
        body=json.loads(send.call_args.args[0].data)
        self.assertEqual(set(body['generationConfig']['responseSchema']['properties']),set(repair_ocr.FIELDS))
        self.assertEqual(result.fields.installment_months,5)
        self.assertEqual(result.fields.total_amount,'110000')
        engine.begin.assert_not_called()
        engine.connect.assert_not_called()

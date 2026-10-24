"""실제 Gemini 호출·DB 저장 없이 인식 흐름을 검증합니다."""
import base64
import json
import os
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError
from fastapi import HTTPException
from pydantic import ValidationError
import urea_ocr as ocr

class ReceiptOcrTests(unittest.TestCase):
    def image(self):
        return ocr.UreaReceiptImage(mime_type='image/jpeg',image_base64=base64.b64encode(b'\xff\xd8\xfftest-only').decode())

    def test_image_validation(self):
        for mime, value in [('image/jpeg','not base64!'),('image/png',base64.b64encode(b'not-image').decode())]:
            with self.assertRaises(HTTPException) as caught:
                ocr.decode_receipt(ocr.UreaReceiptImage(mime_type=mime,image_base64=value))
            self.assertEqual(caught.exception.status_code,422)
        with self.assertRaises(ValidationError):
            ocr.UreaReceiptImage(mime_type='application/pdf',image_base64='abc')
        with patch.object(ocr,'MAX_IMAGE_BYTES',2),self.assertRaises(HTTPException) as caught:
            ocr.decode_receipt(self.image())
        self.assertEqual(caught.exception.status_code,413)

    def test_key_missing_does_not_call_gemini(self):
        with patch.dict(os.environ,{'GEMINI_API_KEY':''}),patch.object(ocr,'urlopen') as send:
            with self.assertRaises(HTTPException) as caught:
                ocr.recognize_urea_receipt(self.image())
            self.assertEqual(caught.exception.status_code,503)
            send.assert_not_called()

    def test_normalization_preserves_leading_zero_and_decimal_values(self):
        result=ocr.normalize_receipt(dict(purchased_on='2026-10-24',merchant_name=' 테스트 ',business_number='0123456789',card_company='신한',unit_price='1,500.25',liters='10.125'))
        self.assertEqual(result.fields.business_number,'012-34-56789')
        self.assertEqual(result.fields.unit_price,'1500.25')
        self.assertEqual(result.fields.liters,'10.125')
        self.assertEqual(result.fields.merchant_name,'테스트')

    def test_illegible_values_stay_null_not_invented(self):
        result=ocr.normalize_receipt(dict(merchant_name='테스트',purchased_on='2026-02-29',business_number='123',unit_price='unknown',liters='0'))
        self.assertIsNone(result.fields.purchased_on)
        self.assertIsNone(result.fields.business_number)
        self.assertIsNone(result.fields.liters)
        self.assertTrue(any('직접' in warning for warning in result.warnings))
        with self.assertRaises(HTTPException):
            ocr.normalize_receipt({})

    def test_gemini_request_and_response_without_database_write(self):
        import main
        fields=dict(purchased_on='2026-10-24',merchant_name='테스트',business_number='0123456789',card_company='카드사',unit_price='1500',liters='10')
        response=MagicMock()
        response.__enter__.return_value.read.return_value=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(fields)}]}}]}).encode()
        engine=MagicMock()
        with patch.dict(os.environ,{'GEMINI_API_KEY':'test-only-key','GEMINI_OCR_MODEL':'gemini-3.5-flash-lite'}),patch.object(ocr,'urlopen',return_value=response) as send,patch.object(main,'engine',engine):
            result=main.read_urea_receipt(self.image())
        self.assertEqual(result.fields.business_number,'012-34-56789')
        request=send.call_args.args[0]
        self.assertNotIn('test-only-key',request.full_url)
        body=json.loads(request.data)
        self.assertEqual(body['generationConfig']['responseMimeType'],'application/json')
        self.assertEqual(body['contents'][0]['parts'][1]['inline_data']['mime_type'],'image/jpeg')
        engine.begin.assert_not_called()

    def test_upstream_failures_are_safe(self):
        for error,status in [(TimeoutError(),504),(HTTPError('https://example.invalid',429,'busy',{},None),429),(HTTPError('https://example.invalid',403,'private-key-detail',{},None),502)]:
            with patch.dict(os.environ,{'GEMINI_API_KEY':'secret-test'}),patch.object(ocr,'urlopen',side_effect=error):
                with self.assertRaises(HTTPException) as caught:
                    ocr.recognize_urea_receipt(self.image())
                self.assertEqual(caught.exception.status_code,status)
                self.assertNotIn('secret-test',caught.exception.detail)
                self.assertNotIn('private-key-detail',caught.exception.detail)

    def test_malformed_output_rejected(self):
        response=MagicMock()
        response.__enter__.return_value.read.return_value=b'{"candidates":[]}'
        with patch.dict(os.environ,{'GEMINI_API_KEY':'test-only'}),patch.object(ocr,'urlopen',return_value=response),self.assertRaises(HTTPException) as caught:
            ocr.recognize_urea_receipt(self.image())
        self.assertEqual(caught.exception.status_code,502)

    def test_recognized_json_matches_create_input_and_total_calculation(self):
        import main
        from decimal import Decimal
        result=ocr.normalize_receipt(dict(purchased_on='2026-10-24',merchant_name='테스트',business_number='0123456789',card_company='카드사',unit_price='1500',liters='10'))
        record=main.UreaRecordCreate(**result.fields.model_dump())
        engine=MagicMock()
        with patch.object(main,'engine',engine):
            main.create_urea_record(record)
        params=engine.begin.return_value.__enter__.return_value.execute.call_args.args[1]
        self.assertEqual(params['total_amount'],Decimal('15000.00'))
        self.assertEqual(params['business_number'],'012-34-56789')
        self.assertNotIn('image_base64',params)
        self.assertNotIn('GEMINI_API_KEY',params)

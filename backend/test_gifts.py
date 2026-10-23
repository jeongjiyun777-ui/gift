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
            conn.execute(text("CREATE TABLE public.gifts (id INTEGER PRIMARY KEY, name TEXT NOT NULL, amount BIGINT NOT NULL, direction TEXT NOT NULL DEFAULT 'received' CHECK(direction IN ('received','paid')))"))
            conn.execute(text("INSERT INTO public.gifts VALUES (1, '동명이인', 100000, 'received'), (2, '동명이인', 50000, 'paid')"))

    def tearDown(self):
        self.patcher.stop()
        self.engine.dispose()

    def test_list_and_total_are_separate(self):
        for direction, expected_id, amount in [('received', 1, 100000), ('paid', 2, 50000)]:
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
            main.delete_gifts(main.GiftDelete(ids=[1, 2], direction='paid'))
        self.assertEqual(len(main.get_gifts(None, 'paid')), 1)
        self.assertEqual(main.delete_gifts(main.GiftDelete(ids=[2], direction='paid')), {'deleted_count': 1})
        self.assertEqual(len(main.get_gifts(None, 'received')), 1)

    def test_invalid_direction_rejected(self):
        with self.assertRaises(ValidationError):
            main.GiftCreate(name='테스트', amount=1, direction='other')

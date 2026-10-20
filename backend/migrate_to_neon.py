"""Copy local gifts to an empty Neon gifts table. Run once before switching DATABASE_URL."""
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

BASE_DIR = Path(__file__).resolve().parent


def main():
    load_dotenv(BASE_DIR / ".env")
    source_url = (os.getenv("LOCAL_DATABASE_URL") or os.getenv("DATABASE_URL", "")).strip()
    target_url = os.getenv("NEON_DATABASE_URL", "").strip()
    if not source_url or not target_url:
        raise SystemExit("backend/.env에 DATABASE_URL과 NEON_DATABASE_URL을 설정하세요.")
    if source_url == target_url:
        raise SystemExit("원본 DB와 대상 DB가 같습니다. 연결 설정을 확인하세요.")

    source = create_engine(source_url, pool_pre_ping=True, connect_args={"connect_timeout": 10})
    target = create_engine(target_url, pool_pre_ping=True, connect_args={"connect_timeout": 10})
    try:
        with source.connect() as conn:
            rows = [dict(row) for row in conn.execute(
                text("SELECT id, name, amount FROM public.gifts ORDER BY id")
            ).mappings()]
        if not rows:
            raise SystemExit("원본 데이터가 없어 이전을 중단합니다.")

        schema = (BASE_DIR.parent / "db" / "schema.sql").read_text(encoding="utf-8-sig")
        schema = schema.replace("CREATE TABLE gifts", "CREATE TABLE IF NOT EXISTS public.gifts", 1)
        with target.begin() as conn:
            conn.execute(text(schema))
            if conn.execute(text("SELECT count(*) FROM public.gifts")).scalar_one():
                raise SystemExit("대상 gifts 테이블에 데이터가 있습니다. 중복 이전을 중단합니다.")
            conn.execute(text(
                "INSERT INTO public.gifts (id, name, amount) VALUES (:id, :name, :amount)"
            ), rows)
            copied = conn.execute(text(
                "SELECT id, name, amount FROM public.gifts ORDER BY id"
            )).mappings().all()
            if [dict(row) for row in copied] != rows:
                raise RuntimeError("원본과 복사본이 다릅니다. 변경사항을 취소합니다.")
            conn.execute(text(
                "SELECT setval(pg_get_serial_sequence('public.gifts', 'id'), "
                "(SELECT MAX(id) FROM public.gifts), true)"
            ))
        print(f"이전 완료: {len(rows)}건. 번호, 이름, 금액이 원본과 일치합니다.")
    finally:
        source.dispose()
        target.dispose()


if __name__ == "__main__":
    main()

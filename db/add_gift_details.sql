BEGIN;
ALTER TABLE public.gifts
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS detail TEXT,
    ADD COLUMN IF NOT EXISTS location TEXT;
COMMENT ON COLUMN public.gifts.category IS '금액 종류: 축의금, 조의금 등';
COMMENT ON COLUMN public.gifts.detail IS '세부사항: 자녀결혼 등';
COMMENT ON COLUMN public.gifts.location IS '장소: 예식장, 장례식장 등';
COMMIT;

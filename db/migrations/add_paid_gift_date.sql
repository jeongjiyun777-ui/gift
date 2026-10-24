BEGIN;
ALTER TABLE public.paid_gifts ADD COLUMN IF NOT EXISTS paid_on DATE;
COMMENT ON COLUMN public.paid_gifts.paid_on IS '지출 날짜. 원본 날짜가 불명확한 기존 기록은 NULL';
COMMIT;

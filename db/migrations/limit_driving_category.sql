ALTER TABLE public.driving_records DROP CONSTRAINT IF EXISTS driving_records_category_check;
ALTER TABLE public.driving_records ADD CONSTRAINT driving_records_category_check CHECK (category IN ('MT', 'FULL'));
COMMENT ON COLUMN public.driving_records.category IS '운행 구분: MT 또는 FULL. 기존 미입력은 NULL';

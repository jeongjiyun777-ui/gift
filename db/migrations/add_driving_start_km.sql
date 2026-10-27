ALTER TABLE public.driving_records ADD COLUMN IF NOT EXISTS start_km INTEGER;
ALTER TABLE public.driving_records DROP CONSTRAINT IF EXISTS driving_records_km_range;
ALTER TABLE public.driving_records ADD CONSTRAINT driving_records_km_range CHECK (km BETWEEN 1 AND 999);
ALTER TABLE public.driving_records DROP CONSTRAINT IF EXISTS driving_records_start_km_range;
ALTER TABLE public.driving_records ADD CONSTRAINT driving_records_start_km_range CHECK (start_km BETWEEN 1 AND 999);
COMMENT ON COLUMN public.driving_records.start_km IS '시작 지점에서 출발지까지 거리(km). 1~999 정수, 과거 미입력 NULL';
COMMENT ON COLUMN public.driving_records.km IS '출발지에서 도착지까지 거리(km). 1~999 정수, 기존 값 유지';

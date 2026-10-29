ALTER TABLE public.driving_records ADD COLUMN IF NOT EXISTS start_odometer_km BIGINT;
ALTER TABLE public.driving_records ADD COLUMN IF NOT EXISTS pickup_odometer_km BIGINT;
ALTER TABLE public.driving_records ADD COLUMN IF NOT EXISTS arrival_odometer_km BIGINT;
ALTER TABLE public.driving_records ADD COLUMN IF NOT EXISTS odometer_recorded_at TIMESTAMPTZ;
ALTER TABLE public.driving_records DROP CONSTRAINT IF EXISTS driving_records_odometer_check;
ALTER TABLE public.driving_records ADD CONSTRAINT driving_records_odometer_check CHECK (
    (start_odometer_km IS NULL AND pickup_odometer_km IS NULL AND arrival_odometer_km IS NULL)
    OR (start_odometer_km IS NOT NULL AND pickup_odometer_km IS NOT NULL AND arrival_odometer_km IS NOT NULL
        AND start_odometer_km >= 0 AND start_odometer_km <= pickup_odometer_km
        AND pickup_odometer_km <= arrival_odometer_km AND arrival_odometer_km <= 999999999)
);
COMMENT ON COLUMN public.driving_records.start_odometer_km IS '시작 지점 계기판 누적 km (정수)';
COMMENT ON COLUMN public.driving_records.pickup_odometer_km IS '출발지 계기판 누적 km (정수)';
COMMENT ON COLUMN public.driving_records.arrival_odometer_km IS '도착지 계기판 누적 km (정수)';
COMMENT ON COLUMN public.driving_records.odometer_recorded_at IS '누적 km를 입력하거나 수정한 서버 시각';

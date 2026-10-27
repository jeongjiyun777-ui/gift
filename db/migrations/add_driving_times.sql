ALTER TABLE public.driving_records ADD COLUMN IF NOT EXISTS departure_time TIME WITHOUT TIME ZONE;
ALTER TABLE public.driving_records ADD COLUMN IF NOT EXISTS arrival_time TIME WITHOUT TIME ZONE;
COMMENT ON COLUMN public.driving_records.departure_time IS '출발시각 (한국 현지 시·분). 미입력 NULL';
COMMENT ON COLUMN public.driving_records.arrival_time IS '도착시각 (한국 현지 시·분). 미입력 NULL. 자정을 넘는 운행 허용';

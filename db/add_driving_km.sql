BEGIN;
ALTER TABLE public.driving_records ADD COLUMN IF NOT EXISTS km INTEGER;
DO $migration$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.driving_records'::regclass
          AND conname = 'driving_records_km_range'
    ) THEN
        ALTER TABLE public.driving_records
            ADD CONSTRAINT driving_records_km_range CHECK (km BETWEEN 1 AND 9999);
    END IF;
END;
$migration$;
COMMENT ON COLUMN public.driving_records.km IS '운행거리(km), 1~9999 정수. 과거 미상 기록은 NULL';
COMMIT;

ALTER TABLE public.driving_records DROP CONSTRAINT IF EXISTS driving_records_odometer_check;
ALTER TABLE public.driving_records ADD CONSTRAINT driving_records_odometer_check CHECK (
    (start_odometer_km IS NULL AND pickup_odometer_km IS NULL AND arrival_odometer_km IS NULL)
    OR (start_odometer_km IS NOT NULL AND pickup_odometer_km IS NOT NULL AND arrival_odometer_km IS NOT NULL
        AND start_odometer_km >= 0 AND start_odometer_km <= pickup_odometer_km
        AND pickup_odometer_km <= arrival_odometer_km AND arrival_odometer_km <= 9999999)
);

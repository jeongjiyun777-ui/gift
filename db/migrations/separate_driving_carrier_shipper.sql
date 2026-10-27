DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='driving_records' AND column_name='carrier_name') THEN
        ALTER TABLE public.driving_records ADD COLUMN carrier_name TEXT;
        ALTER TABLE public.driving_records DROP CONSTRAINT IF EXISTS driving_records_shipper_name_check;
        ALTER TABLE public.driving_records ALTER COLUMN shipper_name DROP NOT NULL;
        UPDATE public.driving_records SET carrier_name=shipper_name, shipper_name=NULL;
        ALTER TABLE public.driving_records ALTER COLUMN carrier_name SET NOT NULL;
        ALTER TABLE public.driving_records ADD CONSTRAINT driving_records_carrier_name_check CHECK (length(btrim(carrier_name)) > 0);
    END IF;
END $$;
COMMENT ON COLUMN public.driving_records.carrier_name IS '운송사. 분리 이전 화주 열의 기존 값을 보존';
COMMENT ON COLUMN public.driving_records.shipper_name IS '화주. 미입력은 NULL';

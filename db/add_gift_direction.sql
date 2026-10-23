BEGIN;
ALTER TABLE public.gifts ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'received';
DO $migration$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.gifts'::regclass AND conname = 'gifts_direction_check') THEN
        ALTER TABLE public.gifts ADD CONSTRAINT gifts_direction_check CHECK (direction IN ('received', 'paid'));
    END IF;
END;
$migration$;
CREATE INDEX IF NOT EXISTS gifts_direction_id_idx ON public.gifts (direction, id);
COMMIT;

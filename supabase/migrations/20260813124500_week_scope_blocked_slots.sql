-- Make blocked slots week-scoped instead of global weekday-scoped.
ALTER TABLE public.blocked_time_slots
  ADD COLUMN IF NOT EXISTS week_start DATE;

-- Backfill existing rows to their creation week (Sunday-based), fallback to current week.
UPDATE public.blocked_time_slots
SET week_start = COALESCE(
  (created_at::date - EXTRACT(DOW FROM created_at)::int),
  (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::int)
)
WHERE week_start IS NULL;

ALTER TABLE public.blocked_time_slots
  ALTER COLUMN week_start SET NOT NULL;

-- Replace old uniqueness (typically day_of_week + time_slot) with week-aware uniqueness.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.blocked_time_slots'::regclass
      AND contype = 'u'
      AND conname <> 'blocked_time_slots_week_scope_key'
  LOOP
    EXECUTE format('ALTER TABLE public.blocked_time_slots DROP CONSTRAINT IF EXISTS %I', rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.blocked_time_slots
  ADD CONSTRAINT blocked_time_slots_week_scope_key UNIQUE (week_start, day_of_week, time_slot);

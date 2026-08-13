-- Convert week_start semantics from Sunday-based to Monday-based.

-- blocked_time_slots: remove week-scope unique temporarily to allow shifting.
ALTER TABLE public.blocked_time_slots
  DROP CONSTRAINT IF EXISTS blocked_time_slots_week_scope_key;

UPDATE public.blocked_time_slots
SET week_start = week_start + INTERVAL '1 day'
WHERE EXTRACT(DOW FROM week_start) = 0;

-- Remove potential duplicates after shift, keep newest row by created_at/id.
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY week_start, day_of_week, time_slot
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.blocked_time_slots
)
DELETE FROM public.blocked_time_slots b
USING ranked r
WHERE b.ctid = r.ctid
  AND r.rn > 1;

ALTER TABLE public.blocked_time_slots
  ADD CONSTRAINT blocked_time_slots_week_scope_key UNIQUE (week_start, day_of_week, time_slot);

-- working_hours_overrides: adjust to Monday-based weeks.
ALTER TABLE public.working_hours_overrides
  DROP CONSTRAINT IF EXISTS working_hours_overrides_week_start_day_of_week_key;

UPDATE public.working_hours_overrides
SET week_start = week_start + INTERVAL '1 day'
WHERE EXTRACT(DOW FROM week_start) = 0;

-- Remove potential duplicates after shift, keep newest row by created_at/id.
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY week_start, day_of_week
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.working_hours_overrides
)
DELETE FROM public.working_hours_overrides w
USING ranked r
WHERE w.ctid = r.ctid
  AND r.rn > 1;

ALTER TABLE public.working_hours_overrides
  ADD CONSTRAINT working_hours_overrides_week_start_day_of_week_key UNIQUE (week_start, day_of_week);

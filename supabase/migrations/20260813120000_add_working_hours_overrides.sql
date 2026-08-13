-- Week-scoped working hour overrides (current week adjustments)
CREATE TABLE IF NOT EXISTS public.working_hours_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_start, day_of_week)
);

GRANT SELECT ON public.working_hours_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.working_hours_overrides TO authenticated;
GRANT ALL ON public.working_hours_overrides TO service_role;

ALTER TABLE public.working_hours_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "who_public_read" ON public.working_hours_overrides
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "who_admin_write" ON public.working_hours_overrides
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

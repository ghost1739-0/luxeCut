-- Add service_id to reviews so customers can pick which service they're reviewing
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;

-- Ensure grants
GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.working_hours TO authenticated;
GRANT SELECT ON public.working_hours TO anon;
GRANT ALL ON public.working_hours TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT SELECT ON public.holidays TO anon;
GRANT ALL ON public.holidays TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbers TO authenticated;
GRANT ALL ON public.barbers TO service_role;

-- Seed working hours defaults (Mon-Sat open, Sun closed) if empty
INSERT INTO public.working_hours (day_of_week, open_time, close_time, is_closed) VALUES
  (0, '09:00', '20:00', true),
  (1, '09:00', '20:00', false),
  (2, '09:00', '20:00', false),
  (3, '09:00', '20:00', false),
  (4, '09:00', '20:00', false),
  (5, '09:00', '20:00', false),
  (6, '09:00', '20:00', false)
ON CONFLICT (day_of_week) DO NOTHING;
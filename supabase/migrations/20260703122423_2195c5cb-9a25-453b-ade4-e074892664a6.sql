
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- Drop every policy that references public.has_role (so we can move it)
DROP POLICY IF EXISTS "appts_admin_delete" ON public.appointments;
DROP POLICY IF EXISTS "appts_admin_write"  ON public.appointments;
DROP POLICY IF EXISTS "appts_select_own"   ON public.appointments;
DROP POLICY IF EXISTS "appts_insert_anyone" ON public.appointments;
DROP POLICY IF EXISTS "cp_admin_write"     ON public.coupons;
DROP POLICY IF EXISTS "cp_public_read_active" ON public.coupons;
DROP POLICY IF EXISTS "barbers_admin_write" ON public.barbers;
DROP POLICY IF EXISTS "barbers_public_read" ON public.barbers;
DROP POLICY IF EXISTS "services_admin_write" ON public.services;
DROP POLICY IF EXISTS "services_public_read" ON public.services;
DROP POLICY IF EXISTS "hol_admin_write" ON public.holidays;
DROP POLICY IF EXISTS "wh_admin_write" ON public.working_hours;
DROP POLICY IF EXISTS "rev_admin_write" ON public.reviews;
DROP POLICY IF EXISTS "rev_public_read" ON public.reviews;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Move helpers into private schema with locked search_path
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO postgres, service_role;

DROP FUNCTION IF EXISTS public.get_busy_slots(uuid, date) CASCADE;
CREATE OR REPLACE FUNCTION private.get_busy_slots(_barber_id uuid, _date date)
RETURNS TABLE(start_time time without time zone, end_time time without time zone)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT start_time, end_time FROM public.appointments
  WHERE barber_id = _barber_id AND appointment_date = _date
    AND status IN ('pending','approved','completed');
$$;
REVOKE ALL ON FUNCTION private.get_busy_slots(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_busy_slots(uuid, date) TO postgres, service_role;

DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC;

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

-- Recreate updated_at triggers using private.set_updated_at
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
      AND EXISTS (SELECT 1 FROM information_schema.columns col
                   WHERE col.table_schema='public' AND col.table_name=c.relname AND col.column_name='updated_at')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON public.%I', r.tbl, r.tbl);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.set_updated_at()', r.tbl, r.tbl);
  END LOOP;
END $$;

-- Recreate policies using private.has_role
CREATE POLICY "appts_select_own" ON public.appointments
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = appointments.barber_id AND b.user_id = auth.uid()));

CREATE POLICY "appts_admin_write" ON public.appointments
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = appointments.barber_id AND b.user_id = auth.uid()));

CREATE POLICY "appts_admin_delete" ON public.appointments
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "cp_admin_all" ON public.coupons
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "barbers_public_read" ON public.barbers
  FOR SELECT USING (is_active = true OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "barbers_admin_write" ON public.barbers
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "services_public_read" ON public.services
  FOR SELECT USING (is_active = true OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "services_admin_write" ON public.services
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "hol_admin_write" ON public.holidays
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "wh_admin_write" ON public.working_hours
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "rev_public_read" ON public.reviews
  FOR SELECT USING (is_approved = true OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "rev_admin_write" ON public.reviews
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Integrity checks
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_price_nonneg,
  DROP CONSTRAINT IF EXISTS appointments_duration_positive;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_price_nonneg CHECK (total_price >= 0),
  ADD CONSTRAINT appointments_duration_positive CHECK (total_duration > 0);

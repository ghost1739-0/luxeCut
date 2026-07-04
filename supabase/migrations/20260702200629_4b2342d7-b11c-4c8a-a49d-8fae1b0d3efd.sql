
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'barber', 'customer');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'approved', 'completed', 'cancelled', 'no_show');

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========================================
-- USER ROLES (separate table, no privilege escalation)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- =========================================
-- SERVICE CATEGORIES + SERVICES
-- =========================================
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_tr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_tr TEXT,
  description_en TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_public_read" ON public.services FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "services_admin_write" ON public.services FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- BARBERS
-- =========================================
CREATE TABLE public.barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  bio_tr TEXT,
  bio_en TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  years_experience INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.barbers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.barbers TO authenticated;
GRANT ALL ON public.barbers TO service_role;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "barbers_public_read" ON public.barbers FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "barbers_admin_write" ON public.barbers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- APPOINTMENTS
-- =========================================
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  barber_id UUID REFERENCES public.barbers(id) ON DELETE SET NULL,
  service_ids UUID[] NOT NULL DEFAULT '{}',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  notes TEXT,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_duration INTEGER NOT NULL DEFAULT 0,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  qr_code TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  coupon_code TEXT,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_appt_barber_date ON public.appointments(barber_id, appointment_date);
CREATE INDEX idx_appt_customer ON public.appointments(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT SELECT, INSERT ON public.appointments TO anon;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
-- anyone (even anon) can create a booking (guest booking)
CREATE POLICY "appts_insert_anyone" ON public.appointments FOR INSERT TO anon, authenticated WITH CHECK (true);
-- customers see own; admins/barbers see all their own
CREATE POLICY "appts_select_own" ON public.appointments FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = appointments.barber_id AND b.user_id = auth.uid()));
CREATE POLICY "appts_admin_write" ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.barbers b WHERE b.id = appointments.barber_id AND b.user_id = auth.uid()));
CREATE POLICY "appts_admin_delete" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- Public read of *busy slots only* handled via a security-definer function below.

-- =========================================
-- WORKING HOURS / HOLIDAYS
-- =========================================
CREATE TABLE public.working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '20:00',
  is_closed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(day_of_week)
);
GRANT SELECT ON public.working_hours TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.working_hours TO authenticated;
GRANT ALL ON public.working_hours TO service_role;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh_public_read" ON public.working_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "wh_admin_write" ON public.working_hours FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  reason TEXT
);
GRANT SELECT ON public.holidays TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hol_public_read" ON public.holidays FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "hol_admin_write" ON public.holidays FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- REVIEWS
-- =========================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID REFERENCES public.barbers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT ON public.reviews TO authenticated;
GRANT UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rev_public_read" ON public.reviews FOR SELECT TO anon, authenticated USING (is_approved = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "rev_insert_auth" ON public.reviews FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rev_admin_write" ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- COUPONS
-- =========================================
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_public_read_active" ON public.coupons FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "cp_admin_write" ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- Public busy-slots function (so booking widget can hide taken slots without exposing appointments)
-- =========================================
CREATE OR REPLACE FUNCTION public.get_busy_slots(_barber_id UUID, _date DATE)
RETURNS TABLE(start_time TIME, end_time TIME)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT start_time, end_time
  FROM public.appointments
  WHERE barber_id = _barber_id
    AND appointment_date = _date
    AND status IN ('pending','approved','completed');
$$;
GRANT EXECUTE ON FUNCTION public.get_busy_slots(UUID, DATE) TO anon, authenticated;

-- =========================================
-- Auto profile + updated_at triggers
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_appts_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- Seed working hours (Sunday closed)
-- =========================================
INSERT INTO public.working_hours (day_of_week, open_time, close_time, is_closed) VALUES
  (0, '09:00', '20:00', true),
  (1, '09:00', '20:00', false),
  (2, '09:00', '20:00', false),
  (3, '09:00', '20:00', false),
  (4, '09:00', '20:00', false),
  (5, '09:00', '20:00', false),
  (6, '09:00', '20:00', false);

-- Seed sample services
INSERT INTO public.services (name_tr, name_en, description_tr, description_en, category, duration_minutes, price, sort_order) VALUES
  ('Klasik Saç Kesimi', 'Classic Haircut', 'Ustaların elinden geleneksel saç kesimi', 'Traditional cut by our master barbers', 'haircut', 30, 350, 1),
  ('Sakal Tıraşı', 'Beard Shave', 'Sıcak havlu ve jilet ile lüks sakal tıraşı', 'Hot-towel straight razor beard shave', 'beard', 30, 250, 2),
  ('Saç + Sakal Combo', 'Cut + Beard Combo', 'Komple bakım paketi', 'The complete grooming package', 'combo', 60, 550, 3),
  ('Yüz Bakımı', 'Facial Treatment', 'Derin temizlik ve nemlendirme', 'Deep clean and hydration', 'skincare', 45, 450, 4),
  ('Saç Boyama', 'Hair Coloring', 'Premium ürünlerle profesyonel boyama', 'Professional coloring with premium products', 'color', 90, 800, 5),
  ('Çocuk Kesimi', 'Kids Haircut', '12 yaş altı çocuklar için', 'For children under 12', 'haircut', 30, 200, 6);

-- Seed sample barbers
INSERT INTO public.barbers (full_name, bio_tr, bio_en, specialties, years_experience, rating, sort_order) VALUES
  ('Mehmet Usta', 'Klasik tıraş ustası, 20 yıllık tecrübe', 'Master of classic shaves, 20 years experience', ARRAY['Klasik Kesim','Sakal Tıraşı'], 20, 4.95, 1),
  ('Ahmet Bey', 'Modern stil uzmanı', 'Modern style specialist', ARRAY['Fade','Modern Kesim'], 12, 4.90, 2),
  ('Emre Barber', 'Boyama ve stil danışmanı', 'Coloring and style consultant', ARRAY['Boyama','Saç Bakımı'], 8, 4.85, 3),
  ('Kaan Master', 'Yüz bakımı ve sakal tasarımı', 'Facial treatments and beard design', ARRAY['Yüz Bakımı','Sakal'], 10, 4.92, 4);

-- Seed reviews
INSERT INTO public.reviews (customer_name, rating, comment) VALUES
  ('Ali Y.', 5, 'İstanbul''un en iyi berberi. Kesinlikle tavsiye ederim.'),
  ('Can K.', 5, 'Atmosfer harika, hizmet mükemmel. Her ay geliyorum.'),
  ('Burak S.', 5, 'Sakal tıraşı efsane. Ustaların işine hakimiyeti üst düzey.'),
  ('Deniz M.', 5, 'Lüks bir deneyim yaşadım. Fiyatına değer.');

-- Seed sample coupon
INSERT INTO public.coupons (code, discount_percent) VALUES ('WELCOME10', 10);

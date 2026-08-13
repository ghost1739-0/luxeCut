-- Bir ustaya ait onaylı yorumların ortalama puanını otomatik hesaplayıp
-- barbers.rating alanını günceller. Yorum eklendiğinde, güncellendiğinde
-- veya silindiğinde otomatik tetiklenir — elle bir şey yapmaya gerek yok.
--
-- Örnek: Mehmet Usta'ya 2 yorum geldi (2 yıldız + 5 yıldız) → (2+5)/2 = 3.50

CREATE OR REPLACE FUNCTION public.recalc_barber_rating(p_barber_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_barber_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.barbers
  SET rating = COALESCE(
    (SELECT ROUND(AVG(rating)::numeric, 2)
     FROM public.reviews
     WHERE barber_id = p_barber_id AND is_approved = true),
    5.00 -- hiç onaylı yorum yoksa varsayılan puana dön
  )
  WHERE id = p_barber_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reviews_rating_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_barber_rating(OLD.barber_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalc_barber_rating(NEW.barber_id);

  -- Usta değiştirilmişse (UPDATE ile), eski ustanın puanını da güncelle.
  IF TG_OP = 'UPDATE' AND OLD.barber_id IS DISTINCT FROM NEW.barber_id THEN
    PERFORM public.recalc_barber_rating(OLD.barber_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_rating ON public.reviews;
CREATE TRIGGER trg_reviews_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.reviews_rating_trigger();

-- Bu migration çalıştığı anda mevcut tüm ustaların puanını, halihazırda
-- var olan onaylı yorumlara göre bir kerelik yeniden hesaplar.
DO $$
DECLARE
  b RECORD;
BEGIN
  FOR b IN SELECT id FROM public.barbers LOOP
    PERFORM public.recalc_barber_rating(b.id);
  END LOOP;
END $$;

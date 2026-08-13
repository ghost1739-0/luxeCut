-- Yorum bırakmak için artık giriş şartı yok — sitede müşteri hesabı sistemi
-- kaldırıldı, sadece admin girişi kalıyor. anon rolüne INSERT izni veriyoruz.
-- is_approved zaten varsayılan olarak true, yani yorum anında yayınlanır
-- (admin onayı şu an için istenmiyor).

GRANT INSERT ON public.reviews TO anon;

CREATE POLICY "rev_insert_anon" ON public.reviews
  FOR INSERT TO anon
  WITH CHECK (true);

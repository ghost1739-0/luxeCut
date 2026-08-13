import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      console.log("[useIsAdmin] check başladı");
      try {
        console.log("[useIsAdmin] getUser çağrılıyor...");
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        console.log("[useIsAdmin] getUser sonucu:", userRes, "hata:", userErr);
        if (!userRes.user) {
          if (!cancelled) { setIsAdmin(false); setLoading(false); }
          console.log("[useIsAdmin] kullanıcı yok, bitti");
          return;
        }
        console.log("[useIsAdmin] user_roles sorgusu çağrılıyor, user id:", userRes.user.id);
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userRes.user.id)
          .eq("role", "admin")
          .maybeSingle();
        console.log("[useIsAdmin] user_roles sonucu:", data, "hata:", error);
        if (!cancelled) { setIsAdmin(!!data); setLoading(false); }
      } catch (e) {
        console.error("[useIsAdmin] YAKALANAN HATA:", e);
        if (!cancelled) { setIsAdmin(false); setLoading(false); }
      }
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      console.log("[useIsAdmin] auth state değişti:", event);
      check();
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return { isAdmin, loading };
}
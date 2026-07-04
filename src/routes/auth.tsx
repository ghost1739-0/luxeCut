import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// Google OAuth: configure via Cloud → Auth to enable

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Giriş / Kayıt — Maison Barber" },
      { name: "description", content: "Hesabınıza giriş yapın veya yeni hesap oluşturun." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Hoş geldiniz");
        nav({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Hesabınız oluşturuldu");
        nav({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error(e.message ?? "Google girişi henüz yapılandırılmamış");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-panel rounded-3xl p-8 md:p-10 w-full max-w-md">
        <a href="/" className="flex items-center gap-2 justify-center mb-6">
          <Scissors className="h-5 w-5 text-gold" />
          <span className="font-display text-lg"><span className="text-gradient-gold">MAISON</span> BARBER</span>
        </a>
        <h1 className="font-display text-3xl text-center">{mode === "signin" ? "Giriş" : "Hesap Oluştur"}</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">
          {mode === "signin" ? "Randevularınızı yönetin" : "Sadakat puanları kazanın"}
        </p>

        <button onClick={google} className="mt-6 w-full py-3 rounded-full border border-border hover:border-gold hover:text-gold text-sm">
          Google ile devam et
        </button>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> veya <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" className="input-a" />
          )}
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta" className="input-a" />
          <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre" className="input-a" />
          <button disabled={loading} className="btn-gold w-full py-3 rounded-full text-sm uppercase tracking-widest disabled:opacity-50">
            {loading ? "..." : mode === "signin" ? "Giriş Yap" : "Kayıt Ol"}
          </button>
        </form>

        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 text-xs text-muted-foreground hover:text-gold w-full text-center">
          {mode === "signin" ? "Hesabınız yok mu? Kayıt olun" : "Zaten hesabınız var mı? Giriş yapın"}
        </button>
      </div>
      <style>{`
        .input-a { width: 100%; background: color-mix(in oklab, var(--input) 60%, transparent); border: 1px solid var(--border); border-radius: .75rem; padding: .75rem 1rem; color: var(--foreground); }
        .input-a:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px oklch(0.78 0.15 82 / .15); }
      `}</style>
    </div>
  );
}

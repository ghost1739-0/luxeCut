import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Giriş — Maison Barber" },
      { name: "description", content: "Yönetim paneli girişi." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Hoş geldiniz");
      nav({ to: "/admin" });
    } catch (err: any) {
      toast.error(err.message ?? "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-panel rounded-3xl p-8 md:p-10 w-full max-w-md">
        <a href="/" className="flex items-center gap-2 justify-center mb-6">
          <Scissors className="h-5 w-5 text-gold" />
          <span className="font-display text-lg"><span className="text-gradient-gold">MAISON</span> BARBER</span>
        </a>
        <h1 className="font-display text-3xl text-center">Giriş</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">Yönetim paneline giriş yapın</p>

        <form onSubmit={submit} className="space-y-3 mt-6">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta" className="input-a" />
          <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Şifre" className="input-a" />
          <button disabled={loading} className="btn-gold w-full py-3 rounded-full text-sm uppercase tracking-widest disabled:opacity-50">
            {loading ? "..." : "Giriş Yap"}
          </button>
        </form>
      </div>
      <style>{`
        .input-a { width: 100%; background: color-mix(in oklab, var(--input) 60%, transparent); border: 1px solid var(--border); border-radius: .75rem; padding: .75rem 1rem; color: var(--foreground); }
        .input-a:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px oklch(0.78 0.15 82 / .15); }
      `}</style>
    </div>
  );
}

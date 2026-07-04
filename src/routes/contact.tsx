import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Phone, Mail, MapPin, Instagram, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "İletişim — Maison Barber" },
      { name: "description", content: "Nişantaşı, İstanbul. Randevu ve sorularınız için bize ulaşın." },
      { property: "og:title", content: "İletişim — Maison Barber" },
      { property: "og:url", content: "/contact" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "En az 2 karakter").max(100),
  email: z.string().trim().email("Geçersiz e-posta").max(255),
  message: z.string().trim().min(10, "En az 10 karakter").max(1000),
});

function ContactPage() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    // In production would post to a server fn or email service
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Mesajınız alındı. En kısa sürede döneceğiz.");
    reset();
    console.log("contact form", data);
  };

  return (
    <div className="min-h-screen">
      <Header />
      <section className="pt-40 pb-16 container-luxe">
        <div className="text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-gold">İletişim</span>
          <h1 className="font-display text-5xl md:text-6xl mt-4">Bize Ulaşın</h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 mt-16">
          <div className="glass-panel rounded-2xl p-8">
            <h2 className="font-display text-2xl mb-6">Mesaj Gönderin</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Field label="Ad Soyad" error={errors.name?.message}>
                <input {...register("name")} className="input-luxe" />
              </Field>
              <Field label="E-posta" error={errors.email?.message}>
                <input {...register("email")} type="email" className="input-luxe" />
              </Field>
              <Field label="Mesajınız" error={errors.message?.message}>
                <textarea {...register("message")} rows={5} className="input-luxe resize-none" />
              </Field>
              <button disabled={isSubmitting} className="btn-gold w-full py-3 rounded-full text-sm uppercase tracking-widest disabled:opacity-50">
                {isSubmitting ? "Gönderiliyor..." : "Gönder"}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-8 space-y-4">
              <InfoRow icon={<MapPin className="h-5 w-5" />} label="Adres" value="Nişantaşı Mah., Teşvikiye Cad. No:12, İstanbul" />
              <InfoRow icon={<Phone className="h-5 w-5" />} label="Telefon" value="+90 212 000 00 00" />
              <InfoRow icon={<Mail className="h-5 w-5" />} label="E-posta" value="info@maisonbarber.com" />
              <div className="flex gap-3 pt-4 border-t border-border/40">
                <a href="https://instagram.com" target="_blank" rel="noreferrer" className="p-3 rounded-full border border-gold/40 hover:border-gold hover:text-gold"><Instagram className="h-4 w-4" /></a>
                <a href="https://wa.me/902120000000" target="_blank" rel="noreferrer" className="p-3 rounded-full border border-gold/40 hover:border-gold hover:text-gold"><MessageCircle className="h-4 w-4" /></a>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden aspect-video border border-border/60">
              <iframe title="Map" className="w-full h-full grayscale contrast-125" src="https://www.google.com/maps?q=Nisantasi%20Istanbul&output=embed" />
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .input-luxe {
          width: 100%;
          background: color-mix(in oklab, var(--input) 60%, transparent);
          border: 1px solid var(--border);
          border-radius: .75rem;
          padding: .75rem 1rem;
          color: var(--foreground);
          font-size: .95rem;
          transition: border-color .2s, box-shadow .2s;
        }
        .input-luxe:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px oklch(0.78 0.15 82 / .15); }
      `}</style>
      <Footer />
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-foreground/70">{label}</span>
      <div className="mt-2">{children}</div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </label>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gold mt-0.5">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-foreground/90">{value}</p>
      </div>
    </div>
  );
}

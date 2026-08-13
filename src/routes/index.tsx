import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Star, Clock, MapPin, Phone, ArrowRight, Sparkles } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useI18n } from "@/lib/i18n";
import { fetchServices, fetchBarbers } from "@/lib/booking";
import heroImg from "@/assets/hero-barbershop.jpg";
import barber1 from "@/assets/barber-1.jpg";
import barber2 from "@/assets/barber-2.jpg";
import barber3 from "@/assets/barber-3.jpg";
import barber4 from "@/assets/barber-4.jpg";
import serviceShave from "@/assets/service-shave.jpg";
import serviceCut from "@/assets/service-cut.jpg";
import { supabase } from "@/integrations/supabase/client";
import { ReviewForm } from "@/components/reviews/ReviewForm";

const barberAvatars = [barber1, barber2, barber3, barber4];

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { t, lang } = useI18n();
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: fetchServices });
  const { data: barbers = [] } = useQuery({ queryKey: ["barbers"], queryFn: fetchBarbers });
  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("is_approved", true)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen">
      <Header />

      {/* HERO */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={heroImg} alt="Luxury barbershop" className="w-full h-full object-cover opacity-60" width={1920} height={1280} />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
        </div>

        <div className="container-luxe pt-32 pb-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }} className="max-w-2xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="stamp-badge h-14 w-14 shrink-0">
                <div className="stamp-badge-ring absolute inset-1" />
                <span className="font-mono text-[10px] leading-tight text-gold text-center">
                  EST.<br />2014
                </span>
              </div>
              <div className="h-px flex-1 max-w-[6rem] bg-gold/40" />
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold/90">{t("hero.tag")}</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl leading-[1.08] mb-6">
              <span className="text-foreground">Ustalıkla</span>{" "}
              <span className="text-gradient-gold italic font-medium">işlenmiş</span>
              <br />
              <span className="text-foreground">zarafet.</span>
            </h1>
            <p className="text-lg text-foreground/65 leading-relaxed mb-10 max-w-xl">
              {t("hero.sub")}
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <Link to="/book" className="btn-gold hover:[&]:btn-gold-hover px-8 py-4 text-sm uppercase tracking-widest inline-flex items-center gap-2">
                {t("hero.cta")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/services" className="text-sm uppercase tracking-widest text-foreground/70 hover:text-gold transition-colors border-b border-gold/30 hover:border-gold pb-1">
                {t("hero.cta2")}
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Fitting-ticket info card */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="hidden lg:block absolute bottom-16 right-8 glass-panel p-6 max-w-xs"
        >
          <div className="flex items-center justify-between text-gold mb-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em]">No. 01 — Bugün</span>
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <p className="font-display text-3xl italic">09:00 – 20:00</p>
          <div className="gold-divider my-4" />
          <p className="text-sm text-foreground/60 leading-relaxed">Anında online randevu — 30 saniyede tamamla.</p>
        </motion.div>
      </section>

      {/* SERVICES */}
      <section className="py-24 relative">
        <div className="container-luxe">
          <SectionHeader eyebrow="Hizmetler" title={t("sec.services")} sub={t("sec.services.sub")} />
          {/* Fitting ticket: two curated images flank a menu-style order form */}
          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 mt-16 items-start">
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-[3/4] overflow-hidden mt-8">
                <img src={serviceShave} alt="Tıraş" loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="aspect-[3/4] overflow-hidden">
                <img src={serviceCut} alt="Saç kesimi" loading="lazy" className="w-full h-full object-cover" />
              </div>
            </div>

            <div className="glass-panel p-8 md:p-10">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-dashed border-gold/25">
                <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-gold/80">Fitting Ticket</span>
                <span className="font-mono text-[11px] text-muted-foreground">No. 0{services.length || 6}</span>
              </div>
              <ul>
                {services.slice(0, 6).map((s, i) => (
                  <motion.li
                    key={s.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                    className="py-4 border-b border-border/40 last:border-0"
                  >
                    <div className="ticket-line">
                      <h3 className="font-display text-lg shrink-0">{lang === "tr" ? s.name_tr : s.name_en}</h3>
                      <span className="font-mono text-gold text-sm shrink-0">₺{Number(s.price).toFixed(0)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-sm text-muted-foreground line-clamp-1 pr-4">
                        {lang === "tr" ? s.description_tr : s.description_en}
                      </p>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" /> {s.duration_minutes} {t("book.min")}
                      </span>
                    </div>
                  </motion.li>
                ))}
              </ul>
              <Link
                to="/book"
                className="mt-8 btn-gold hover:[&]:btn-gold-hover w-full px-6 py-3.5 text-sm uppercase tracking-widest inline-flex items-center justify-center gap-2"
              >
                {t("hero.cta")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* BARBERS */}
      <section className="py-24 bg-onyx/40 border-y border-border/40">
        <div className="container-luxe">
          <SectionHeader eyebrow="Ekip" title={t("sec.team")} sub={t("sec.team.sub")} />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
            {barbers.map((b, i) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-sm">
                  <img
                    src={barberAvatars[i % barberAvatars.length]}
                    alt={b.full_name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-5">
                    <h3 className="font-display text-2xl text-foreground">{b.full_name}</h3>
                    <p className="text-sm text-gold mt-1">{b.specialties.join(" · ")}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-foreground/70">
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-gold text-gold" /> {b.rating}</span>
                      <span>· {b.years_experience} yıl</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24">
        <div className="container-luxe">
          <SectionHeader eyebrow="Yorumlar" title={t("sec.testimonials")} />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            {reviews.map((r: any, i: number) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-panel rounded-sm p-6"
              >
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: r.rating }).map((_, k) => (
                    <Star key={k} className="h-4 w-4 fill-gold text-gold" />
                  ))}
                </div>
                <p className="text-foreground/85 leading-relaxed italic">"{r.comment}"</p>
                <p className="text-sm text-gold mt-4">— {r.customer_name}</p>
              </motion.div>
            ))}
          </div>
          <ReviewForm />
        </div>
      </section>

      {/* HOURS + CTA */}
      <section className="py-24 bg-onyx/50 border-y border-border/40">
        <div className="container-luxe grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-4xl italic mb-6">{t("sec.hours")}</h2>
            <ul className="space-y-1 text-foreground/80">
              {[
                ["Pazartesi – Cumartesi", "09:00 – 20:00"],
                ["Pazar", t("days.closed")],
              ].map(([d, h]) => (
                <li key={d} className="ticket-line border-b border-border/30 py-3">
                  <span>{d}</span>
                  <span className="font-mono text-gold text-sm">{h}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="tel:+905388749219" className="btn-gold px-6 py-3 rounded-sm text-sm inline-flex items-center gap-2">
                <Phone className="h-4 w-4" /> Ara
              </a>
              <a href="https://wa.me/905388749219" target="_blank" rel="noreferrer" className="px-6 py-3 rounded-sm text-sm border border-gold/40 hover:border-gold hover:text-gold">
                WhatsApp
              </a>
            </div>
          </div>
          <div className="glass-panel rounded-sm overflow-hidden aspect-[4/3]">
            <iframe
              title="Map"
              className="w-full h-full grayscale contrast-125 opacity-90"
              src="https://www.google.com/maps?q=Nisantasi%20Istanbul&output=embed"
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="h-px w-8 bg-gold" />
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold">{eyebrow}</span>
        <div className="h-px w-8 bg-gold" />
      </div>
      <h2 className="font-display text-4xl md:text-5xl italic">{title}</h2>
      {sub && <p className="text-muted-foreground mt-4">{sub}</p>}
    </div>
  );
}

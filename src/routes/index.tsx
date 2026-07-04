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
      const { data } = await supabase.from("reviews").select("*").eq("is_approved", true).limit(6);
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
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-12 bg-gold" />
              <span className="text-xs uppercase tracking-[0.3em] text-gold">{t("hero.tag")}</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl leading-[1.05] mb-6">
              <span className="text-foreground">Ustalıkla</span>
              <br />
              <span className="text-gradient-gold italic">İşlenmiş</span>{" "}
              <span className="text-foreground">Zarafet</span>
            </h1>
            <p className="text-lg text-foreground/70 leading-relaxed mb-10 max-w-xl">
              {t("hero.sub")}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/book" className="btn-gold hover:[&]:btn-gold-hover px-8 py-4 rounded-full text-sm uppercase tracking-widest inline-flex items-center gap-2">
                {t("hero.cta")} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/services" className="px-8 py-4 rounded-full text-sm uppercase tracking-widest border border-gold/40 text-foreground hover:border-gold hover:text-gold transition-colors">
                {t("hero.cta2")}
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Floating info card */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="hidden lg:block absolute bottom-16 right-8 glass-panel rounded-2xl p-6 max-w-xs"
        >
          <div className="flex items-center gap-2 text-gold mb-2">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest">Bugün açığız</span>
          </div>
          <p className="font-display text-2xl">09:00 – 20:00</p>
          <div className="gold-divider my-4" />
          <p className="text-sm text-foreground/70">Anında online randevu — 30 sn'de tamamla.</p>
        </motion.div>
      </section>

      {/* SERVICES */}
      <section className="py-24 relative">
        <div className="container-luxe">
          <SectionHeader eyebrow="Hizmetler" title={t("sec.services")} sub={t("sec.services.sub")} />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
            {services.slice(0, 6).map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-panel rounded-2xl overflow-hidden group hover:border-gold/40 transition-all"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={i % 2 === 0 ? serviceShave : serviceCut}
                    alt={lang === "tr" ? s.name_tr : s.name_en}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-display text-xl">{lang === "tr" ? s.name_tr : s.name_en}</h3>
                    <span className="text-gold font-semibold whitespace-nowrap">₺{Number(s.price).toFixed(0)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {lang === "tr" ? s.description_tr : s.description_en}
                  </p>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {s.duration_minutes} {t("book.min")}</span>
                    <Link to="/book" className="text-xs uppercase tracking-widest text-gold hover:underline">Ekle →</Link>
                  </div>
                </div>
              </motion.div>
            ))}
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
                <div className="relative aspect-[3/4] overflow-hidden rounded-2xl">
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
                className="glass-panel rounded-2xl p-6"
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
            <h2 className="font-display text-4xl mb-6">{t("sec.hours")}</h2>
            <ul className="space-y-2 text-foreground/80">
              {[
                ["Pazartesi – Cumartesi", "09:00 – 20:00"],
                ["Pazar", t("days.closed")],
              ].map(([d, h]) => (
                <li key={d} className="flex justify-between border-b border-border/40 py-3">
                  <span>{d}</span>
                  <span className="text-gold">{h}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-4">
              <a href="tel:+902120000000" className="btn-gold px-6 py-3 rounded-full text-sm inline-flex items-center gap-2">
                <Phone className="h-4 w-4" /> Ara
              </a>
              <a href="https://wa.me/902120000000" target="_blank" rel="noreferrer" className="px-6 py-3 rounded-full text-sm border border-gold/40 hover:border-gold hover:text-gold">
                WhatsApp
              </a>
            </div>
          </div>
          <div className="glass-panel rounded-2xl overflow-hidden aspect-[4/3]">
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
        <span className="text-xs uppercase tracking-[0.3em] text-gold">{eyebrow}</span>
        <div className="h-px w-8 bg-gold" />
      </div>
      <h2 className="font-display text-4xl md:text-5xl">{title}</h2>
      {sub && <p className="text-muted-foreground mt-4">{sub}</p>}
    </div>
  );
}

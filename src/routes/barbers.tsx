import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { fetchBarbers } from "@/lib/booking";
import { useI18n } from "@/lib/i18n";
import barber1 from "@/assets/barber-1.jpg";
import barber2 from "@/assets/barber-2.jpg";
import barber3 from "@/assets/barber-3.jpg";
import barber4 from "@/assets/barber-4.jpg";

const imgs = [barber1, barber2, barber3, barber4];

export const Route = createFileRoute("/barbers")({
  head: () => ({
    meta: [
      { title: "Ustalarımız — Maison Barber" },
      { name: "description", content: "Onlarca yıl tecrübeli usta berberlerimiz ile tanışın." },
      { property: "og:title", content: "Ustalarımız — Maison Barber" },
      { property: "og:url", content: "/barbers" },
    ],
    links: [{ rel: "canonical", href: "/barbers" }],
  }),
  component: BarbersPage,
});

function BarbersPage() {
  const { data: barbers = [] } = useQuery({ queryKey: ["barbers"], queryFn: fetchBarbers });
  const { lang } = useI18n();

  return (
    <div className="min-h-screen">
      <Header />
      <section className="pt-40 pb-16 container-luxe">
        <div className="text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-gold">Ekip</span>
          <h1 className="font-display text-5xl md:text-6xl mt-4">Ustalarımız</h1>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">Zanaatlarına adanmış, detaylara tutkulu ustalar.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-16">
          {barbers.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass-panel rounded-2xl overflow-hidden grid md:grid-cols-2"
            >
              <div className="aspect-[3/4] md:aspect-auto">
                <img src={imgs[i % imgs.length]} alt={b.full_name} loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="p-8 flex flex-col justify-center">
                <span className="text-xs uppercase tracking-widest text-gold">Master Barber</span>
                <h3 className="font-display text-3xl mt-2">{b.full_name}</h3>
                <div className="flex items-center gap-3 mt-3 text-sm text-foreground/70">
                  <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-gold text-gold" /> {b.rating}</span>
                  <span>· {b.years_experience} yıl tecrübe</span>
                </div>
                <p className="mt-4 text-foreground/75 leading-relaxed">{lang === "tr" ? b.bio_tr : b.bio_en}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {b.specialties.map((s) => (
                    <span key={s} className="text-xs px-3 py-1 rounded-full border border-gold/40 text-gold">{s}</span>
                  ))}
                </div>
                <Link to="/book" className="btn-gold mt-6 self-start px-6 py-3 rounded-full text-sm uppercase tracking-widest">
                  Randevu Al
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}

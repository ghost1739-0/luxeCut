import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { Clock } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { fetchServices } from "@/lib/booking";
import { useI18n } from "@/lib/i18n";
import serviceShave from "@/assets/service-shave.jpg";
import serviceCut from "@/assets/service-cut.jpg";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Hizmetler — Maison Barber" },
      { name: "description", content: "Klasik saç kesimi, sıcak havlu sakal tıraşı, yüz bakımı ve daha fazlası." },
      { property: "og:title", content: "Hizmetler — Maison Barber" },
      { property: "og:description", content: "Ustaların elinden lüks berber deneyimi." },
      { property: "og:url", content: "/services" },
    ],
    links: [{ rel: "canonical", href: "/services" }],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: fetchServices });
  const { t, lang } = useI18n();
  const categories = ["all", ...Array.from(new Set(services.map((s) => s.category)))];
  const [cat, setCat] = useState("all");
  const filtered = cat === "all" ? services : services.filter((s) => s.category === cat);

  return (
    <div className="min-h-screen">
      <Header />
      <section className="pt-40 pb-16 container-luxe">
        <div className="text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-gold">Hizmetler</span>
          <h1 className="font-display text-5xl md:text-6xl mt-4">Ritüellerimiz</h1>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">Her hizmet, ustalarımızın onlarca yıllık tecrübesiyle şekillenmiştir.</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-10">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest border transition ${
                cat === c ? "bg-gold text-primary-foreground border-gold" : "border-border text-foreground/70 hover:border-gold hover:text-gold"
              }`}
            >
              {c === "all" ? "Tümü" : c}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {filtered.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass-panel rounded-2xl overflow-hidden group"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img src={i % 2 ? serviceCut : serviceShave} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={s.name_en} />
              </div>
              <div className="p-6">
                <div className="flex justify-between gap-4 items-start">
                  <h3 className="font-display text-xl">{lang === "tr" ? s.name_tr : s.name_en}</h3>
                  <span className="text-gold font-semibold">₺{Number(s.price).toFixed(0)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{lang === "tr" ? s.description_tr : s.description_en}</p>
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-border/40">
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {s.duration_minutes} {t("book.min")}</span>
                  <Link to="/book" className="text-xs uppercase tracking-widest text-gold hover:underline">Randevu Al →</Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}

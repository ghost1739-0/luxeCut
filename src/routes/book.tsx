import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BookingWizard } from "@/components/booking/BookingWizard";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Randevu Al — Maison Barber" },
      { name: "description", content: "Online randevu — hizmet, usta ve saat seç, 30 saniyede tamamla." },
      { property: "og:title", content: "Randevu Al — Maison Barber" },
      { property: "og:url", content: "/book" },
    ],
    links: [{ rel: "canonical", href: "/book" }],
  }),
  component: BookPage,
});

function BookPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <section className="pt-32 pb-24 container-luxe">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-[0.3em] text-gold">Randevu</span>
          <h1 className="font-display text-4xl md:text-5xl mt-4">Deneyiminizi Tasarlayın</h1>
          <p className="mt-3 text-muted-foreground">Adım adım rehberlik ediyoruz. Randevunuz anında onaylanır.</p>
        </div>
        <div className="mt-12 max-w-4xl mx-auto">
          <BookingWizard />
        </div>
      </section>
      <Footer />
    </div>
  );
}

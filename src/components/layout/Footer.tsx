import { Link } from "@tanstack/react-router";
import { Scissors, Instagram, Phone, MapPin, Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-32 border-t border-border/60 bg-onyx/60">
      <div className="container-luxe py-16 grid gap-12 md:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-gold" />
            <span className="font-display text-lg">
              <span className="text-gradient-gold">MAISON</span> BARBER
            </span>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            {t("hero.sub")}
          </p>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-widest text-gold mb-4">Menu</h4>
          <ul className="space-y-2 text-sm text-foreground/70">
            <li><Link to="/services" className="hover:text-gold">{t("nav.services")}</Link></li>
            <li><Link to="/barbers" className="hover:text-gold">{t("nav.barbers")}</Link></li>
            <li><Link to="/book" className="hover:text-gold">{t("nav.book")}</Link></li>
            <li><Link to="/contact" className="hover:text-gold">{t("nav.contact")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-widest text-gold mb-4">İletişim</h4>
          <ul className="space-y-2 text-sm text-foreground/70">
            <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> +90 212 000 00 00</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> info@maisonbarber.com</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Nişantaşı, İstanbul</li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs uppercase tracking-widest text-gold mb-4">Sosyal</h4>
          <a href="https://instagram.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-gold">
            <Instagram className="h-4 w-4" /> @maisonbarber
          </a>
        </div>
      </div>
      <div className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Maison Barber. Tüm hakları saklıdır.
      </div>
    </footer>
  );
}

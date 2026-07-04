import { Link } from "@tanstack/react-router";
import { Scissors, Menu, X, Globe, LogIn, LogOut, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useIsAdmin } from "@/lib/useIsAdmin";

export function Header() {
  const { lang, setLang, t } = useI18n();
  const { isAdmin } = useIsAdmin();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const nav = [
    { to: "/", label: t("nav.home") },
    { to: "/services", label: t("nav.services") },
    { to: "/barbers", label: t("nav.barbers") },
    { to: "/contact", label: t("nav.contact") },
  ] as const;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? "backdrop-blur-xl bg-background/70 border-b border-border/60" : "bg-transparent"
      }`}
    >
      <div className="container-luxe flex items-center justify-between h-20">
        <Link to="/" className="flex items-center gap-2 group">
          <Scissors className="h-6 w-6 text-gold transition-transform group-hover:rotate-12" />
          <span className="font-display text-xl tracking-wide">
            <span className="text-gradient-gold">MAISON</span>
            <span className="text-foreground/90 ml-1">BARBER</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-sm tracking-wide text-foreground/70 hover:text-gold transition-colors relative py-2"
              activeProps={{ className: "text-gold" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setLang(lang === "tr" ? "en" : "tr")}
            className="flex items-center gap-1 text-xs uppercase tracking-widest text-foreground/60 hover:text-gold transition-colors"
            aria-label="Language"
          >
            <Globe className="h-4 w-4" />
            {lang === "tr" ? "TR" : "EN"}
          </button>
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1 text-xs uppercase tracking-widest text-gold hover:text-gold/80 border border-gold/40 px-3 py-1.5 rounded-full"
            >
              <Shield className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
          {user ? (
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-1 text-xs uppercase tracking-widest text-foreground/60 hover:text-gold"
            >
              <LogOut className="h-4 w-4" /> {t("nav.signout")}
            </button>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1 text-xs uppercase tracking-widest text-foreground/60 hover:text-gold"
            >
              <LogIn className="h-4 w-4" /> {t("nav.signin")}
            </Link>
          )}
          <Link
            to="/book"
            className="btn-gold hover:[&]:btn-gold-hover px-5 py-2.5 rounded-full text-xs uppercase tracking-widest"
          >
            {t("nav.book")}
          </Link>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden glass-panel mx-4 mb-4 rounded-2xl p-6 flex flex-col gap-4"
          >
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="text-foreground/80 hover:text-gold">
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" onClick={() => setOpen(false)} className="text-gold flex items-center gap-2">
                <Shield className="h-4 w-4" /> Admin Panel
              </Link>
            )}
            <Link to="/book" onClick={() => setOpen(false)} className="btn-gold text-center px-4 py-3 rounded-full">
              {t("nav.book")}
            </Link>
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <button
                onClick={() => setLang(lang === "tr" ? "en" : "tr")}
                className="text-xs uppercase text-foreground/70"
              >
                🌐 {lang === "tr" ? "TR" : "EN"}
              </button>
              {user ? (
                <button onClick={() => supabase.auth.signOut()} className="text-xs uppercase text-foreground/70">
                  {t("nav.signout")}
                </button>
              ) : (
                <Link to="/auth" onClick={() => setOpen(false)} className="text-xs uppercase text-foreground/70">
                  {t("nav.signin")}
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

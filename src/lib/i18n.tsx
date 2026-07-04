import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "tr" | "en";

const dict = {
  tr: {
    "nav.home": "Ana Sayfa",
    "nav.services": "Hizmetler",
    "nav.barbers": "Ustalar",
    "nav.contact": "İletişim",
    "nav.book": "Randevu Al",
    "nav.admin": "Yönetim",
    "nav.signin": "Giriş",
    "nav.signout": "Çıkış",

    "hero.tag": "İSTANBUL'UN LÜKS BERBERİ",
    "hero.title": "Ustalıkla İşlenmiş Zarafet",
    "hero.sub": "Modern erkeğe adanmış, geleneksel Türk berberliğinin en rafine hali.",
    "hero.cta": "Randevu Al",
    "hero.cta2": "Hizmetleri Gör",

    "sec.services": "Öne Çıkan Hizmetler",
    "sec.services.sub": "Her detayı özenle işlenmiş bakım deneyimleri.",
    "sec.team": "Ustalarımız",
    "sec.team.sub": "Yılların tecrübesi, ellerinizin altında.",
    "sec.testimonials": "Müşterilerimiz Anlatıyor",
    "sec.hours": "Çalışma Saatleri",
    "sec.contact": "Bize Ulaşın",

    "book.step": "Adım",
    "book.of": "/",
    "book.service": "Hizmet Seçin",
    "book.barber": "Usta Seçin",
    "book.date": "Tarih Seçin",
    "book.time": "Saat Seçin",
    "book.info": "Bilgileriniz",
    "book.confirm": "Onay",
    "book.no_pref": "Fark Etmez / İlk Uygun Usta",
    "book.total": "Toplam",
    "book.duration": "Süre",
    "book.min": "dk",
    "book.next": "Devam",
    "book.back": "Geri",
    "book.confirm_btn": "Randevuyu Onayla",
    "book.name": "Ad Soyad",
    "book.phone": "Telefon",
    "book.email": "E-posta",
    "book.notes": "Notlar",
    "book.success": "Randevunuz Alındı!",
    "book.success_sub": "Kısa süre içinde SMS ve e-posta ile onay göndereceğiz.",
    "book.qr": "Doğrulama Kodu",

    "days.sun": "Pazar",
    "days.mon": "Pazartesi",
    "days.tue": "Salı",
    "days.wed": "Çarşamba",
    "days.thu": "Perşembe",
    "days.fri": "Cuma",
    "days.sat": "Cumartesi",
    "days.closed": "Kapalı",
  },
  en: {
    "nav.home": "Home",
    "nav.services": "Services",
    "nav.barbers": "Barbers",
    "nav.contact": "Contact",
    "nav.book": "Book Now",
    "nav.admin": "Admin",
    "nav.signin": "Sign in",
    "nav.signout": "Sign out",

    "hero.tag": "ISTANBUL'S LUXURY BARBER",
    "hero.title": "Craftsmanship Redefined",
    "hero.sub": "The finest expression of traditional Turkish barbering, tailored for the modern gentleman.",
    "hero.cta": "Book Now",
    "hero.cta2": "View Services",

    "sec.services": "Signature Services",
    "sec.services.sub": "Every ritual, refined to the last detail.",
    "sec.team": "Our Masters",
    "sec.team.sub": "Years of craftsmanship, at your service.",
    "sec.testimonials": "What Our Clients Say",
    "sec.hours": "Working Hours",
    "sec.contact": "Get in Touch",

    "book.step": "Step",
    "book.of": "of",
    "book.service": "Select Services",
    "book.barber": "Select Barber",
    "book.date": "Select Date",
    "book.time": "Select Time",
    "book.info": "Your Details",
    "book.confirm": "Confirm",
    "book.no_pref": "No Preference / First Available",
    "book.total": "Total",
    "book.duration": "Duration",
    "book.min": "min",
    "book.next": "Next",
    "book.back": "Back",
    "book.confirm_btn": "Confirm Booking",
    "book.name": "Full Name",
    "book.phone": "Phone",
    "book.email": "Email",
    "book.notes": "Notes",
    "book.success": "Booking Confirmed!",
    "book.success_sub": "We'll send SMS and email confirmations shortly.",
    "book.qr": "Verification Code",

    "days.sun": "Sunday",
    "days.mon": "Monday",
    "days.tue": "Tuesday",
    "days.wed": "Wednesday",
    "days.thu": "Thursday",
    "days.fri": "Friday",
    "days.sat": "Saturday",
    "days.closed": "Closed",
  },
} as const;

type Key = keyof typeof dict["tr"];

const I18nCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "tr",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("tr");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("lang") as Lang | null) : null;
    if (saved === "tr" || saved === "en") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const t = (k: Key) => dict[lang][k] ?? k;
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);

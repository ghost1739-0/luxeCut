/// <reference types="vite-plugin-pwa/client" />
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl text-gradient-gold">404</h1>
        <h2 className="mt-4 font-display text-2xl text-foreground">Sayfa bulunamadı</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Aradığınız sayfa mevcut değil ya da taşınmış olabilir.
        </p>
        <div className="mt-6">
          <Link to="/" className="btn-gold inline-flex px-6 py-3 rounded-full text-sm">
            Ana Sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl text-foreground">Bir sorun oluştu</h1>
        <p className="mt-2 text-sm text-muted-foreground">Lütfen tekrar deneyin.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="btn-gold px-5 py-2.5 rounded-full text-sm"
          >
            Tekrar Dene
          </button>
          <Link to="/" className="px-5 py-2.5 rounded-full text-sm border border-border">Ana Sayfa</Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Maison Barber — İstanbul'un Lüks Berberi" },
      { name: "description", content: "Nişantaşı'nda geleneksel Türk berberliğinin en rafine hali. Ustalar, klasik tıraş, sakal bakımı ve online randevu." },
      { name: "author", content: "Maison Barber" },
      { property: "og:title", content: "Maison Barber — İstanbul'un Lüks Berberi" },
      { property: "og:description", content: "Nişantaşı'nın premium berberi. Online randevu, master ustalar, klasik ritüeller." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Maison Barber" },
      { name: "twitter:card", content: "summary_large_image" },
      // PWA için eklenenler
      { name: "theme-color", content: "#1a1a1a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Maison Barber" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      // PWA için eklenenler (vite-plugin-pwa manifest.webmanifest üretiyor, .json değil)
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "HairSalon",
        name: "Maison Barber",
        image: "/og-image.jpg",
        address: {
          "@type": "PostalAddress",
          streetAddress: "Nişantaşı",
          addressLocality: "İstanbul",
          addressCountry: "TR",
        },
        priceRange: "$$$",
        telephone: "+90 212 000 00 00",
      }),
    }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning={true}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Service worker'ı garantiye almak için manuel kayıt
    // (vite-plugin-pwa'nın otomatik enjeksiyonu SSR'da her zaman tetiklenmeyebilir)
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        registerSW({ immediate: true });
      })
      .catch((err) => {
        console.error("Service worker kaydı başarısız:", err);
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <Outlet />
        <Toaster theme="dark" position="top-center" richColors />
      </I18nProvider>
    </QueryClientProvider>
  );
}

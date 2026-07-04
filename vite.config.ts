import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        outDir: ".output/public",
        includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png"],
        manifest: {
          name: "Maison Barber Admin",
          short_name: "Maison Admin",
          description: "Maison Barber yönetim paneli",
          theme_color: "#0a0a0a",
          background_color: "#0a0a0a",
          display: "standalone",
          scope: "/admin",
          start_url: "/admin",
          icons: [
            {
              src: "/pwa-192x192.png", // Canlı için / işareti şart
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa-512x512.png", // Canlı için / işareti şart
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ],
  },
});
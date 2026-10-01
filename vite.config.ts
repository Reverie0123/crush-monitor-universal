import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // The online version can be added to a phone's home screen and opens
    // like an app. The service worker only caches this site's own files;
    // calls to model services are never cached.
    ...(mode === "web"
      ? [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg", "icons/*.png"],
            manifest: {
              name: "Crush 好感监控器",
              short_name: "好感监控器",
              description:
                "Paste a chat with your crush and see the signals you missed.",
              lang: "zh-CN",
              start_url: "./",
              scope: "./",
              display: "standalone",
              background_color: "#f5f3ed",
              theme_color: "#f5f3ed",
              icons: [
                { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
                { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
                {
                  src: "icons/icon-maskable-512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable",
                },
              ],
            },
            workbox: {
              globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
              navigateFallback: "index.html",
            },
          }),
        ]
      : []),
  ],
  define: {
    // Shown in settings so an adapted build is never mistaken for the original.
    __APP_VERSION__: JSON.stringify(version),
    // `vite build --mode demo` or `--mode web`: static builds with the
    // sample chat; web also analyzes in the browser (see src/demo.ts).
    __DEMO__: JSON.stringify(mode === "demo" || mode === "web"),
    __WEB__: JSON.stringify(mode === "web"),
  },
  server: {
    port: 5178,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3178" },
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
export default defineConfig(({ mode }) => ({
  plugins: [react()],
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

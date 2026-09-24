import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
export default defineConfig({
  plugins: [react()],
  // Shown in settings so an adapted build is never mistaken for the original.
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    port: 5178,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:3178" },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
function offlineShell() {
  return {
    name: "udd-offline-shell",
    closeBundle() {
      const dir = resolve("dist");
      const assets = readdirSync(resolve(dir, "assets")).map(
        (name) => `./assets/${name}`,
      );
      const file = resolve(dir, "sw.js");
      let worker = readFileSync(file, "utf8");
      worker = worker.replace(
        "const PRECACHE = [];",
        `const PRECACHE = ${JSON.stringify(["./", "./manifest.webmanifest", ...assets])};`,
      );
      worker = worker.replace(
        "udd-react-v2-shell",
        `udd-react-${createHash("sha256").update(assets.join("|")).digest("hex").slice(0, 12)}`,
      );
      writeFileSync(file, worker);
    },
  };
}
export default defineConfig({
  plugins: [react(), offlineShell()],
  base: "./",
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4173",
        changeOrigin: true,
        headers: { origin: "http://127.0.0.1:4173" },
      },
    },
  },
  preview: { host: "127.0.0.1" },
  build: { chunkSizeWarningLimit: 700 },
});

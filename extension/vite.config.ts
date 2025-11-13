import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import { resolve } from "path";
import { readFileSync } from "fs";

const manifest = JSON.parse(
  readFileSync(resolve(__dirname, "./src/manifest.json"), "utf-8")
);

export default defineConfig({
  plugins: [
    react(),
    crx({ 
      manifest,
      contentScripts: {
        injectCss: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: resolve(__dirname, "./dist"),
    emptyOutDir: true,
  },
});


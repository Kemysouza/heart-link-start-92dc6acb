import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Versão injetada em build-time para debug visual no app (canto inferior).
const BUILD_VERSION = new Date()
  .toISOString()
  .replace(/[-:T]/g, "")
  .slice(0, 12); // YYYYMMDDHHmm

export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  server: {
    host: true, // binda em 0.0.0.0 e :: (acesso de mobile na rede local)
    port: 8080,
    hmr: { overlay: false },
  },
  build: {
    sourcemap: mode !== "production",
    rollupOptions: {
      output: {
        // Hash em assets já é default; reforçando o nome do entry.
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));

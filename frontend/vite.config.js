import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const BACKEND_URL = "http://127.0.0.1:8765";

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: BACKEND_URL,
        changeOrigin: false,
      },
      "/ws": {
        target: BACKEND_URL,
        ws: true,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,ts}"],
  },
});

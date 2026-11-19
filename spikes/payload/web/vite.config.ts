import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    rollupOptions: {
      input: { h3: "h3.html", geojson: "geojson.html", estado: "estado.html" },
    },
  },
});

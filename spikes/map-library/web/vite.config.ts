import { readFile } from "node:fs/promises";
import { defineConfig, type Plugin } from "vite";

const pastaDados = new URL("../../../data/tmp/", import.meta.url);
const permitidos: Record<string, string> = { "/dados/pontos.json": "pontos-2025.json", "/dados/gi-7.json": "gi-7.json", "/dados/gi-8.json": "gi-8.json", "/dados/gi-9.json": "gi-9.json" };

const servirPontos = (): Plugin => {
  const middleware = async (req: { url?: string }, res: { setHeader(k: string, v: string): void; end(b: Buffer): void }, next: () => void) => {
    const arquivo = permitidos[req.url ?? ""];
    if (!arquivo) return next();
    res.setHeader("content-type", "application/json");
    res.end(await readFile(new URL(arquivo, pastaDados)));
  };
  return {
    name: "servir-pontos-locais",
    configureServer: (s) => void s.middlewares.use(middleware),
    configurePreviewServer: (s) => void s.middlewares.use(middleware),
  };
};

export default defineConfig({
  publicDir: false,
  plugins: [servirPontos()],
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        maplibre: "maplibre.html",
        deckgl: "deckgl.html",
        zonasGi: "zonas-gi.html",
      },
    },
  },
});

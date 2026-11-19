import { readFile } from "node:fs/promises";
import { defineConfig, type Plugin } from "vite";

const arquivoPontos = new URL("../../../data/tmp/pontos-2025.json", import.meta.url);

const servirPontos = (): Plugin => {
  const middleware = async (req: { url?: string }, res: { setHeader(k: string, v: string): void; end(b: Buffer): void }, next: () => void) => {
    if (req.url !== "/dados/pontos.json") return next();
    res.setHeader("content-type", "application/json");
    res.end(await readFile(arquivoPontos));
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
      },
    },
  },
});

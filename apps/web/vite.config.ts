import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { variaveisCss } from "@mapa/core";

const ID_TOKENS = "virtual:tokens.css";

function tokens(): Plugin {
  return {
    name: "tokens-do-core",
    resolveId: (id) => (id === ID_TOKENS ? `\0${ID_TOKENS}` : undefined),
    load: (id) => (id === `\0${ID_TOKENS}` ? variaveisCss() : undefined),
  };
}

export default defineConfig({
  plugins: [react(), tokens()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        rewrite: (caminho) => caminho.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});

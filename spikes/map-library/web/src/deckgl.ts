import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { Map as MapaLibre } from "maplibre-gl";
import { CENTRO, ESCALA, ESTILO, carregarCelulas, marcar, medirAnimacao, publicar, type Celula } from "./comum.ts";

marcar("script");
const mapa = new MapaLibre({ container: "mapa", style: ESTILO, center: CENTRO, zoom: 10.5 });
const [{ pontos, celulas }] = await Promise.all([carregarCelulas(), new Promise((ok) => mapa.once("load", ok))]);
marcar("mapaBase");

let primeiroRender = true;
const overlay = new MapboxOverlay({
  interleaved: new URLSearchParams(location.search).has("intercalado"),
  layers: [
    new H3HexagonLayer<Celula>({
      id: "zonas",
      data: celulas,
      getHexagon: (c) => c.h,
      getFillColor: (c) => [...ESCALA[c.nivel]!, 204],
      getLineColor: [255, 255, 255],
      lineWidthMinPixels: 1,
      extruded: false,
      pickable: true,
    }),
  ],
  onAfterRender: () => {
    if (!primeiroRender) return;
    primeiroRender = false;
    marcar("zonasVisiveis");
    void medirAnimacao(mapa).then((animacao) => publicar(new URLSearchParams(location.search).has("intercalado") ? "deck.gl (intercalado)" : "deck.gl (canvas por cima)", { pontos, celulas: celulas.length, ...animacao }));
  },
});
mapa.addControl(overlay);

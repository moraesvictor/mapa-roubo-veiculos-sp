import { cellToBoundary } from "h3-js";
import { Map as MapaLibre } from "maplibre-gl";
import { CENTRO, ESCALA, ESTILO, carregarCelulas, marcar, medirAnimacao, publicar } from "./comum.ts";

marcar("script");
const mapa = new MapaLibre({ container: "mapa", style: ESTILO, center: CENTRO, zoom: 10.5 });
const [{ pontos, celulas }] = await Promise.all([carregarCelulas(), new Promise((ok) => mapa.once("load", ok))]);
marcar("mapaBase");

const geojson: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: celulas.map((c) => ({
    type: "Feature",
    properties: { n: c.n, nivel: c.nivel },
    geometry: { type: "Polygon", coordinates: [cellToBoundary(c.h, true)] },
  })),
};
marcar("geojson");

const semZonas = new URLSearchParams(location.search).has("sem-zonas");
if (!semZonas) mapa.addSource("zonas", { type: "geojson", data: geojson });
if (!semZonas) mapa.addLayer({
  id: "zonas",
  type: "fill",
  source: "zonas",
  paint: {
    "fill-color": ["match", ["get", "nivel"], ...ESCALA.flatMap((c, i) => [i, `rgb(${c.join(",")})`]), "#ccc"] as unknown as string,
    "fill-opacity": 0.8,
    "fill-outline-color": "#ffffff",
  },
});
mapa.once("idle", async () => {
  marcar("zonasVisiveis");
  const animacao = await medirAnimacao(mapa);
  publicar(semZonas ? "maplibre-gl (só mapa base)" : "maplibre-gl", { pontos, celulas: celulas.length, ...animacao });
});

import { cellToBoundary } from "h3-js";
import { Map as MapaLibre } from "maplibre-gl";
import { CENTRO, ESCALA, ESCALA_SUAVE, ESTILO, carregarCelulas, marcar, medirAnimacao, publicar } from "./comum.ts";

marcar("script");
const mapa = new MapaLibre({ container: "mapa", style: ESTILO, center: CENTRO, zoom: 10.5 });
const [{ pontos, celulas }] = await Promise.all([carregarCelulas(), new Promise((ok) => mapa.once("load", ok))]);
marcar("mapaBase");
(window as unknown as { __mapa: MapaLibre }).__mapa = mapa;

const geojson: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: celulas.map((c) => ({
    type: "Feature",
    properties: { n: c.n, nivel: c.nivel },
    geometry: { type: "Polygon", coordinates: [cellToBoundary(c.h, true)] },
  })),
};
marcar("geojson");

const parametros = new URLSearchParams(location.search);
const semZonas = parametros.has("sem-zonas");
const suave = parametros.has("suave");
const escala = suave ? ESCALA_SUAVE : ESCALA;
const primeiroRotulo = suave ? mapa.getStyle().layers.find((l) => l.type === "symbol")?.id : undefined;
if (!semZonas) mapa.addSource("zonas", { type: "geojson", data: geojson });
if (!semZonas) mapa.addLayer({
  id: "zonas",
  type: "fill",
  source: "zonas",
  paint: {
    "fill-color": ["match", ["get", "nivel"], ...escala.flatMap((c, i) => [i, `rgb(${c.join(",")})`]), "#ccc"] as unknown as string,
    "fill-opacity": suave ? 0.6 : 0.8,
    "fill-outline-color": suave ? "rgba(255,255,255,0.4)" : "#ffffff",
  },
}, primeiroRotulo);
mapa.once("idle", async () => {
  marcar("zonasVisiveis");
  const animacao = await medirAnimacao(mapa);
  publicar(semZonas ? "maplibre-gl (só mapa base)" : "maplibre-gl", { pontos, celulas: celulas.length, ...animacao });
});

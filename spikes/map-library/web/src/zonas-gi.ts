import { cellToBoundary } from "h3-js";
import { Map as MapaLibre } from "maplibre-gl";
import { CENTRO, ESCALA_SUAVE, ESTILO } from "./comum.ts";

const K = 5;
const parametros = new URLSearchParams(location.search);
const resolucao = parametros.get("gi") ?? "8";
const mapa = new MapaLibre({ container: "mapa", style: ESTILO, center: CENTRO, zoom: 10.6 });
(window as unknown as { __mapa: MapaLibre }).__mapa = mapa;

const celulas: { h: string; n: number; z: number; s: number }[] = await (await fetch(`/dados/gi-${resolucao}.json`)).json();
await new Promise((ok) => mapa.once("load", ok));
const visiveis = celulas.filter((c) => c.n >= K);
const valores = visiveis.map((c) => c.n).sort((a, b) => a - b);
const cortes = [0.5, 0.75, 0.9, 0.97].map((q) => valores[Math.floor(q * (valores.length - 1))]!);
const feicao = (c: (typeof celulas)[number]) => ({
  type: "Feature" as const,
  properties: { nivel: cortes.filter((x) => c.n > x).length, zona: c.s === 1 },
  geometry: { type: "Polygon" as const, coordinates: [cellToBoundary(c.h, true)] },
});
const primeiroRotulo = mapa.getStyle().layers.find((l) => l.type === "symbol")?.id;
mapa.addSource("areas", { type: "geojson", data: { type: "FeatureCollection", features: visiveis.map(feicao) } });
mapa.addLayer({
  id: "areas",
  type: "fill",
  source: "areas",
  paint: {
    "fill-color": ["match", ["get", "nivel"], ...ESCALA_SUAVE.flatMap((c, i) => [i, `rgb(${c.join(",")})`]), "#ccc"] as unknown as string,
    "fill-opacity": 0.6,
    "fill-outline-color": "rgba(255,255,255,0.4)",
  },
}, primeiroRotulo);
mapa.addLayer({
  id: "zonas-significativas",
  type: "line",
  source: "areas",
  filter: ["==", ["get", "zona"], true],
  paint: { "line-color": "#212121", "line-width": 2 },
}, primeiroRotulo);
const zonas = visiveis.filter((c) => c.s === 1).length;
const escondidas = celulas.filter((c) => c.n > 0 && c.n < K);
document.getElementById("resultado")!.textContent =
  `Resolução H3 ${resolucao} · k = ${K}\n${visiveis.length} áreas com ${K}+ ocorrências\n${zonas} zonas de concentração significativa (contorno)\n${escondidas.length} áreas escondidas (menos de ${K}), somando ${escondidas.reduce((s, c) => s + c.n, 0)} ocorrências`;

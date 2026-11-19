import { buscaInicial, corPorNivel, criarMapa, marcar, niveis, ocioso, publicar, type Resposta } from "./comum.ts";

const { mapa, carregado, primeiroRotulo } = criarMapa();
let total = 0;
let anteriores: string[] = [];

const geometria = fetch("/api/geometria").then((r) => r.json() as Promise<GeoJSON.FeatureCollection>).then((g) => (marcar("geometria"), g));
const buscar = async (busca: string) => {
  const r: Resposta = await (await fetch(`/api/zonas?${busca}`)).json();
  total = r.total;
  return r;
};
const aplicar = (r: Resposta) => {
  for (const id of anteriores) mapa.setFeatureState({ source: "zonas", id }, { visivel: false, zona: 0 });
  const nivel = niveis(r.celulas.map(([, n]) => ({ n })));
  for (const [h3, n, zona] of r.celulas) mapa.setFeatureState({ source: "zonas", id: h3 }, { visivel: true, nivel: nivel(n), zona });
  anteriores = r.celulas.map(([h3]) => h3);
};

const primeiros = buscar(buscaInicial).then((d) => (marcar("dados"), d));
await carregado;
const antes = primeiroRotulo();
mapa.addSource("zonas", { type: "geojson", data: await geometria, promoteId: "h3" });
mapa.addLayer({
  id: "areas",
  type: "fill",
  source: "zonas",
  paint: { "fill-color": corPorNivel(["coalesce", ["feature-state", "nivel"], 0]), "fill-opacity": ["case", ["boolean", ["feature-state", "visivel"], false], 0.6, 0] },
}, antes);
mapa.addLayer({ id: "contorno", type: "line", source: "zonas", paint: { "line-color": "#212121", "line-width": 2, "line-opacity": ["coalesce", ["feature-state", "zona"], 0] } }, antes);
aplicar(await primeiros);
await ocioso(mapa);
marcar("zonasVisiveis");
publicar("estado", async (busca) => aplicar(await buscar(busca)), mapa, () => total);

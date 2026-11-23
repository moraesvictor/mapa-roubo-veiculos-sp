import { buscaInicial, corPorNivel, criarMapa, fonte, marcar, niveis, ocioso, publicar } from "./comum.ts";

interface Colecao { total: number; features: { properties: { n: number; zona: 0 | 1; nivel?: number } }[] }

const { mapa, carregado, primeiroRotulo } = criarMapa();
let total = 0;

const buscar = async (busca: string) => {
  const r: Colecao = await (await fetch(`/api/zonas.geojson?${busca}`)).json();
  total = r.total;
  const nivel = niveis(r.features.map((f) => f.properties));
  for (const f of r.features) f.properties.nivel = nivel(f.properties.n);
  return r as unknown as GeoJSON.FeatureCollection;
};

const primeiros = buscar(buscaInicial).then((d) => (marcar("dados"), d));
await carregado;
const antes = primeiroRotulo();
mapa.addSource("zonas", { type: "geojson", data: await primeiros });
mapa.addLayer({ id: "areas", type: "fill", source: "zonas", paint: { "fill-color": corPorNivel(["get", "nivel"]), "fill-opacity": 0.6 } }, antes);
mapa.addLayer({ id: "contorno", type: "line", source: "zonas", filter: ["==", ["get", "zona"], 1], paint: { "line-color": "#212121", "line-width": 2 } }, antes);
await ocioso(mapa);
marcar("zonasVisiveis");
publicar("geojson", async (busca) => void fonte(mapa, "zonas").setData(await buscar(busca)), mapa, () => total);

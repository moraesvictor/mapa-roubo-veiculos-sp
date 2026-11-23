import { cellToBoundary } from "h3-js";
import { buscaInicial, corPorNivel, criarMapa, fonte, marcar, niveis, ocioso, publicar, type Resposta } from "./comum.ts";

const { mapa, carregado, primeiroRotulo } = criarMapa();
let total = 0;

const buscar = async (busca: string) => {
  const r: Resposta = await (await fetch(`/api/zonas?${busca}`)).json();
  total = r.total;
  const nivel = niveis(r.celulas.map(([, n]) => ({ n })));
  return {
    type: "FeatureCollection" as const,
    features: r.celulas.map(([h3, n, zona]) => ({
      type: "Feature" as const,
      properties: { nivel: nivel(n), zona },
      geometry: { type: "Polygon" as const, coordinates: [cellToBoundary(h3, true)] },
    })),
  };
};

const primeiros = buscar(buscaInicial).then((d) => (marcar("dados"), d));
await carregado;
const antes = primeiroRotulo();
mapa.addSource("zonas", { type: "geojson", data: await primeiros });
mapa.addLayer({ id: "areas", type: "fill", source: "zonas", paint: { "fill-color": corPorNivel(["get", "nivel"]), "fill-opacity": 0.6 } }, antes);
mapa.addLayer({ id: "contorno", type: "line", source: "zonas", filter: ["==", ["get", "zona"], 1], paint: { "line-color": "#212121", "line-width": 2 } }, antes);
await ocioso(mapa);
marcar("zonasVisiveis");
publicar("h3", async (busca) => void fonte(mapa, "zonas").setData(await buscar(busca)), mapa, () => total);

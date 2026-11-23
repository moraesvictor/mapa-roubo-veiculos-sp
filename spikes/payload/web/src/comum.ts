import { Map as MapaLibre, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import urlDoWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

setWorkerUrl(urlDoWorker);

export type Tupla = [h3: string, n: number, zona: 0 | 1];
export interface Resposta { total: number; poucosRegistros: boolean; celulas: Tupla[] }

export const ESCALA = ["#E6E8F0", "#C5CADC", "#9AA2C2", "#6B759F", "#414A78"];
const marcas: Record<string, number> = {};
export const marcar = (nome: string) => (marcas[nome] = Math.round(performance.now()));

export const buscaInicial = new URLSearchParams(location.search).get("filtro") ?? "";

export function niveis(celulas: { n: number }[]) {
  const valores = celulas.map((c) => c.n).sort((a, b) => a - b);
  const cortes = [0.5, 0.75, 0.9, 0.97].map((q) => valores[Math.floor(q * (valores.length - 1))] ?? 0);
  return (n: number) => cortes.filter((c) => n > c).length;
}

export const corPorNivel = (expressao: unknown) => ["match", expressao, ...ESCALA.flatMap((c, i) => [i, c]), "#ccc"] as unknown as string;

export function criarMapa() {
  const mapa = new MapaLibre({ container: "mapa", style: "https://tiles.openfreemap.org/styles/positron", center: [-46.633, -23.55], zoom: 10.6 });
  const carregado = new Promise<void>((ok) => mapa.once("load", () => ok()));
  void carregado.then(() => marcar("mapaBase"));
  return { mapa, carregado, primeiroRotulo: () => mapa.getStyle().layers.find((l) => l.type === "symbol")?.id };
}

export const ocioso = (mapa: MapaLibre) => new Promise<void>((ok) => mapa.once("idle", () => ok()));

export const fonte = (mapa: MapaLibre, id: string) => mapa.getSource(id) as GeoJSONSource;

export function publicar(variante: string, atualizar: (busca: string) => Promise<void>, mapa: MapaLibre, total: () => number) {
  const janela = window as unknown as { __resultado: unknown; __trocar: (busca: string) => Promise<number> };
  janela.__trocar = async (busca) => {
    const t0 = performance.now();
    await atualizar(busca);
    await ocioso(mapa);
    return Math.round(performance.now() - t0);
  };
  janela.__resultado = { variante, ...marcas };
  document.getElementById("resultado")!.textContent = `${variante}\n${total()} ocorrências\n${JSON.stringify(marcas, null, 1)}`;
}

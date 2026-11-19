import { latLngToCell } from "h3-js";
import { setWorkerUrl, type Map as MapaLibre } from "maplibre-gl";
import urlDoWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

setWorkerUrl(urlDoWorker);

export const RESOLUCAO_H3 = 9;
export const CENTRO: [number, number] = [-46.633, -23.55];
export const ESTILO = "https://tiles.openfreemap.org/styles/positron";
export const ESCALA: [number, number, number][] = [
  [238, 240, 250],
  [201, 206, 238],
  [154, 163, 220],
  [99, 112, 194],
  [47, 59, 148],
];

export const ESCALA_SUAVE: [number, number, number][] = [
  [230, 232, 240],
  [197, 202, 220],
  [154, 162, 194],
  [107, 117, 159],
  [65, 74, 120],
];

export interface Celula {
  h: string;
  n: number;
  nivel: number;
}

const marcas = new Map<string, number>();
export const marcar = (nome: string) => marcas.set(nome, Math.round(performance.now()));

export async function carregarCelulas() {
  const pontos: [number, number, number][] = await (await fetch("/dados/pontos.json")).json();
  marcar("dados");
  const contagem = new Map<string, number>();
  for (const [lon, lat] of pontos) {
    const h = latLngToCell(lat, lon, RESOLUCAO_H3);
    contagem.set(h, (contagem.get(h) ?? 0) + 1);
  }
  const valores = [...contagem.values()].sort((a, b) => a - b);
  const corte = [0.5, 0.75, 0.9, 0.97].map((q) => valores[Math.floor(q * (valores.length - 1))]!);
  const celulas: Celula[] = [...contagem].map(([h, n]) => ({ h, n, nivel: corte.filter((c) => n > c).length }));
  marcar("agregado");
  return { pontos: pontos.length, celulas };
}

export async function medirAnimacao(mapa: MapaLibre) {
  let quadros = 0;
  let longos = 0;
  let anterior = performance.now();
  let pior = 0;
  let ativo = true;
  const contar = (agora: number) => {
    const delta = agora - anterior;
    anterior = agora;
    quadros++;
    if (delta > 50) longos++;
    pior = Math.max(pior, delta);
    if (ativo) requestAnimationFrame(contar);
  };
  const inicio = performance.now();
  requestAnimationFrame(contar);
  await new Promise<void>((ok) => {
    mapa.flyTo({ center: [-46.66, -23.6], zoom: 13.5, duration: 2500 });
    mapa.once("moveend", () => {
      mapa.flyTo({ center: CENTRO, zoom: 10.5, duration: 2500 });
      mapa.once("moveend", () => ok());
    });
  });
  ativo = false;
  const segundos = (performance.now() - inicio) / 1000;
  return { fps: Math.round((quadros / segundos) * 10) / 10, quadrosAcimaDe50ms: longos, piorQuadroMs: Math.round(pior) };
}

export function publicar(lib: string, extra: Record<string, unknown>) {
  const resultado = { lib, ...Object.fromEntries(marcas), ...extra };
  (window as unknown as { __resultado: unknown }).__resultado = resultado;
  document.getElementById("resultado")!.textContent = JSON.stringify(resultado, null, 2);
}

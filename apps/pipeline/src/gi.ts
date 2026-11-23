import { gridDisk } from "h3-js";

export interface Dominio {
  celulas: string[];
  indice: Map<string, number>;
  vizinhos: Int32Array[];
}

export function criarDominio(celulasComDado: Iterable<string>, margem = 2): Dominio {
  const conjunto = new Set<string>();
  for (const c of celulasComDado) for (const v of gridDisk(c, margem)) conjunto.add(v);
  const celulas = [...conjunto].sort();
  const indice = new Map(celulas.map((c, i) => [c, i]));
  const vizinhos = celulas.map((c) => Int32Array.from(gridDisk(c, 1).flatMap((v) => indice.get(v) ?? [])));
  return { celulas, indice, vizinhos };
}

const normalAcumulada = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const cauda = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - cauda : cauda;
};

export function zonasSignificativas(dominio: Dominio, x: Float64Array, q = 0.05): Uint8Array {
  const n = x.length;
  const significativo = new Uint8Array(n);
  let soma = 0;
  let somaQuadrados = 0;
  for (const v of x) {
    soma += v;
    somaQuadrados += v * v;
  }
  const media = soma / n;
  const desvio = Math.sqrt(Math.max(somaQuadrados / n - media * media, 0));
  if (desvio === 0) return significativo;

  const p = new Float64Array(n).fill(1);
  dominio.vizinhos.forEach((viz, i) => {
    const w = viz.length;
    let local = 0;
    for (const j of viz) local += x[j] ?? 0;
    const denominador = desvio * Math.sqrt((n * w - w * w) / (n - 1));
    const z = denominador > 0 ? (local - media * w) / denominador : 0;
    p[i] = 1 - normalAcumulada(z);
  });

  const ordem = Array.from({ length: n }, (_, i) => i).sort((a, b) => (p[a] ?? 1) - (p[b] ?? 1));
  let corte = -1;
  ordem.forEach((i, r) => {
    if ((p[i] ?? 1) <= ((r + 1) / n) * q) corte = r;
  });
  for (let r = 0; r <= corte; r++) significativo[ordem[r] ?? 0] = 1;
  return significativo;
}

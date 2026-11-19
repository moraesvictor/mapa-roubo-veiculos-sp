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
  const vizinhos = celulas.map((c) => Int32Array.from(gridDisk(c, 1).map((v) => indice.get(v)).filter((i): i is number => i !== undefined)));
  return { celulas, indice, vizinhos };
}

export interface ResultadoGi {
  z: Float64Array;
  p: Float64Array;
  significativo95: Uint8Array;
  significativoFdr: Uint8Array;
}

const phi = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const cauda = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - cauda : cauda;
};

export function giEstrela(dominio: Dominio, x: Float64Array, q = 0.05): ResultadoGi {
  const n = x.length;
  let soma = 0;
  let somaQuadrados = 0;
  for (let i = 0; i < n; i++) {
    soma += x[i]!;
    somaQuadrados += x[i]! * x[i]!;
  }
  const media = soma / n;
  const s = Math.sqrt(Math.max(somaQuadrados / n - media * media, 0));
  const z = new Float64Array(n);
  const p = new Float64Array(n).fill(1);
  if (s === 0) return { z, p, significativo95: new Uint8Array(n), significativoFdr: new Uint8Array(n) };
  for (let i = 0; i < n; i++) {
    const viz = dominio.vizinhos[i]!;
    const w = viz.length;
    let local = 0;
    for (let k = 0; k < w; k++) local += x[viz[k]!]!;
    const denominador = s * Math.sqrt((n * w - w * w) / (n - 1));
    z[i] = denominador > 0 ? (local - media * w) / denominador : 0;
    p[i] = 1 - phi(z[i]!);
  }
  const significativo95 = new Uint8Array(n);
  for (let i = 0; i < n; i++) significativo95[i] = z[i]! > 1.959964 ? 1 : 0;
  const ordem = Array.from({ length: n }, (_, i) => i).sort((a, b) => p[a]! - p[b]!);
  let corte = -1;
  for (let r = 0; r < n; r++) if (p[ordem[r]!]! <= ((r + 1) / n) * q) corte = r;
  const significativoFdr = new Uint8Array(n);
  for (let r = 0; r <= corte; r++) significativoFdr[ordem[r]!] = 1;
  return { z, p, significativo95, significativoFdr };
}

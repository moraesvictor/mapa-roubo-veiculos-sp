import { readFile } from "node:fs/promises";
import { cellToBoundary, cellToParent } from "h3-js";
import { criarDominio, giEstrela } from "../../hotspot/node/gi.ts";

interface Registro { tipo: string; veiculo: string; data: string; periodo: string; tipo_dia: string; h3: string | null }

export const RESOLUCAO = 8;
export const K = 5;
export const MINIMO = 200;
export const VEICULOS = ["carro", "moto"];
export const TIPOS = ["furto", "roubo"];
export const DIAS = ["dia-util", "fim-de-semana"];
export const PERIODOS = ["hora-incerta", "madrugada", "manha", "noite", "tarde"];

export type Tupla = [h3: string, n: number, zona: 0 | 1];
export interface Resposta { atualizadoAte: string; desde: string; total: number; poucosRegistros: boolean; celulas: Tupla[] }

const lista = (valor: string | null, todos: string[]) => {
  const itens = valor ? [...new Set(valor.split(","))].filter((v) => todos.includes(v)).sort() : todos;
  return itens.length ? itens : todos;
};

export const chave = (busca: URLSearchParams) =>
  [lista(busca.get("veiculo"), VEICULOS), lista(busca.get("tipo"), TIPOS), lista(busca.get("dia"), DIAS), lista(busca.get("periodo"), PERIODOS)].map((l) => l.join(",")).join("|");

const subconjuntos = <T>(itens: T[]) => Array.from({ length: (1 << itens.length) - 1 }, (_, m) => itens.filter((_, b) => (m + 1) & (1 << b)));

export async function calcularTudo() {
  const raiz = new URL("../../../", import.meta.url);
  const todos: Registro[] = (await readFile(new URL("data/tmp/ocorrencias.ndjson", raiz), "utf8")).trim().split("\n").map((l) => JSON.parse(l));
  const atualizadoAte = todos.reduce((m, r) => (r.data > m ? r.data : m), "");
  const fim = new Date(`${atualizadoAte}T00:00:00Z`);
  const desde = new Date(Date.UTC(fim.getUTCFullYear() - 1, fim.getUTCMonth(), fim.getUTCDate() + 1)).toISOString().slice(0, 10);
  const janela = todos.filter((r) => r.h3 && r.data >= desde && r.data <= atualizadoAte);
  const celulaDe = janela.map((r) => cellToParent(r.h3!, RESOLUCAO));
  const dominio = criarDominio(new Set(celulaDe));
  const indice = Int32Array.from(celulaDe, (c) => dominio.indice.get(c)!);

  const respostas = new Map<string, Resposta>();
  for (const veiculos of subconjuntos(VEICULOS))
    for (const tipos of subconjuntos(TIPOS))
      for (const dias of subconjuntos(DIAS))
        for (const periodos of subconjuntos(PERIODOS)) {
          const x = new Float64Array(dominio.celulas.length);
          let total = 0;
          for (let i = 0; i < janela.length; i++) {
            const r = janela[i]!;
            if (!veiculos.includes(r.veiculo) || !tipos.includes(r.tipo) || !dias.includes(r.tipo_dia) || !periodos.includes(r.periodo)) continue;
            x[indice[i]!]!++;
            total++;
          }
          const poucosRegistros = total < MINIMO;
          const gi = poucosRegistros ? null : giEstrela(dominio, x);
          const celulas: Tupla[] = [];
          for (let i = 0; i < x.length; i++) if (x[i]! >= K) celulas.push([dominio.celulas[i]!, x[i]!, gi?.significativoFdr[i] ? 1 : 0]);
          respostas.set([veiculos, tipos, dias, periodos].map((l) => [...l].sort().join(",")).join("|"), { atualizadoAte, desde, total, poucosRegistros, celulas });
        }
  const base = respostas.get(chave(new URLSearchParams()))!;
  return { respostas, base };
}

const arredondar = (v: number) => Math.round(v * 1e5) / 1e5;
export const contorno = (h3: string) => [cellToBoundary(h3, true).map(([x, y]) => [arredondar(x!), arredondar(y!)])];

export const comoGeoJson = (r: Resposta) => ({
  total: r.total,
  poucosRegistros: r.poucosRegistros,
  type: "FeatureCollection",
  features: r.celulas.map(([h3, n, zona]) => ({ type: "Feature", properties: { h3, n, zona }, geometry: { type: "Polygon", coordinates: contorno(h3) } })),
});

export const geometria = (base: Resposta) => ({
  type: "FeatureCollection",
  features: base.celulas.map(([h3]) => ({ type: "Feature", properties: { h3 }, geometry: { type: "Polygon", coordinates: contorno(h3) } })),
});

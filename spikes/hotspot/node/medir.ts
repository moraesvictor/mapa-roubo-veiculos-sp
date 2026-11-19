import { readFile, writeFile } from "node:fs/promises";
import { cellToParent } from "h3-js";
import { criarDominio, giEstrela } from "./gi.ts";

interface Registro { tipo: string; veiculo: string; familia: string; data: string; periodo: string; tipo_dia: string; h3: string | null }

const raiz = new URL("../../../", import.meta.url);
const todos: Registro[] = (await readFile(new URL("data/tmp/ocorrencias.ndjson", raiz), "utf8")).split("\n").map((l) => JSON.parse(l));
const ATE = todos.reduce((m, r) => (r.data > m ? r.data : m), "");
const fimJanela = new Date(`${ATE}T00:00:00Z`);
const inicio = new Date(Date.UTC(fimJanela.getUTCFullYear() - 1, fimJanela.getUTCMonth(), fimJanela.getUTCDate() + 1));
const DESDE = inicio.toISOString().slice(0, 10);
const janela = todos.filter((r) => r.h3 && r.data >= DESDE && r.data <= ATE);

const PERIODOS = ["madrugada", "manha", "tarde", "noite", "hora-incerta"];
const subconjuntos = Array.from({ length: 31 }, (_, m) => PERIODOS.filter((_, b) => m + 1 & (1 << b)));
const combinacoes = ["carro", "moto", null].flatMap((veiculo) =>
  ["roubo", "furto", null].flatMap((tipo) =>
    ["dia-util", "fim-de-semana", null].flatMap((dia) => subconjuntos.map((periodos) => ({ veiculo, tipo, dia, periodos: new Set(periodos) }))),
  ),
);

const soma = (a: Uint8Array) => a.reduce((s, v) => s + v, 0);
const resultado: Record<string, unknown> = { janela: { desde: DESDE, ate: ATE, ocorrenciasComArea: janela.length }, combinacoes: combinacoes.length };

for (const res of [7, 8, 9]) {
  const celulaDe = (r: Registro) => (res === 9 ? r.h3! : cellToParent(r.h3!, res));
  const dominio = criarDominio(new Set(janela.map(celulaDe)));
  const idx = Int32Array.from(janela, (r) => dominio.indice.get(celulaDe(r))!);
  const contar = (f: (typeof combinacoes)[number]) => {
    const x = new Float64Array(dominio.celulas.length);
    for (let i = 0; i < janela.length; i++) {
      const r = janela[i]!;
      if ((f.veiculo && r.veiculo !== f.veiculo) || (f.tipo && r.tipo !== f.tipo) || (f.dia && r.tipo_dia !== f.dia) || !f.periodos.has(r.periodo)) continue;
      x[idx[i]!]!++;
    }
    return x;
  };

  const base = combinacoes.find((c) => !c.veiculo && !c.tipo && !c.dia && c.periodos.size === 5)!;
  const xb = contar(base);
  const rb = giEstrela(dominio, xb);
  const comDado = xb.filter((v) => v > 0).length;
  const porK = Object.fromEntries([3, 5, 10].map((k) => [`k${k}`, { celulasEscondidas: xb.filter((v) => v > 0 && v < k).length, ocorrenciasEscondidas: xb.reduce((s, v) => s + (v > 0 && v < k ? v : 0), 0) }]));

  const esparso = combinacoes.find((c) => c.veiculo === "moto" && c.tipo === "roubo" && c.dia === "fim-de-semana" && c.periodos.size === 1 && c.periodos.has("madrugada"))!;
  const xe = contar(esparso);
  const re = giEstrela(dominio, xe);

  const zonas = (x: Float64Array, r: ReturnType<typeof giEstrela>, k: number) => r.significativoFdr.reduce((s, v, i) => s + (v && x[i]! >= k ? 1 : 0), 0);
  const totais = combinacoes.map((c) => contar(c).reduce((s, v) => s + v, 0));
  const protecoes = {
    filtroEsparsoComKNaPropriaArea: { k3: zonas(xe, re, 3), k5: zonas(xe, re, 5) },
    filtroTudoComKNaPropriaArea: { k5: zonas(xb, rb, 5) },
    combinacoesPorTotal: { menosDe200: totais.filter((t) => t < 200).length, de200a1000: totais.filter((t) => t >= 200 && t < 1000).length, maisDe1000: totais.filter((t) => t >= 1000).length },
  };

  const t0 = performance.now();
  let celulasSignificativasTotal = 0;
  for (const c of combinacoes) celulasSignificativasTotal += soma(giEstrela(dominio, contar(c)).significativoFdr);
  const ms = performance.now() - t0;

  resultado[`res${res}`] = {
    celulasNoDominio: dominio.celulas.length,
    celulasComDado: comDado,
    filtroTudo: { significativas95: soma(rb.significativo95), significativasFdr: soma(rb.significativoFdr), ocorrenciasNasSignificativas: xb.reduce((s, v, i) => s + (rb.significativoFdr[i] ? v : 0), 0) },
    filtroEsparso_motoRouboFdsMadrugada: { ocorrencias: xe.reduce((s, v) => s + v, 0), significativas95: soma(re.significativo95), significativasFdr: soma(re.significativoFdr) },
    kMinimoNoFiltroTudo: porK,
    protecoes,
    todasAsCombinacoes: { msTotal: Math.round(ms), msPorCombinacao: Math.round((ms / combinacoes.length) * 100) / 100, celulasSignificativasArmazenadas: celulasSignificativasTotal },
  };

  await writeFile(
    new URL(`data/tmp/gi-${res}.json`, raiz),
    JSON.stringify(dominio.celulas.map((h, i) => ({ h, n: xb[i], z: Math.round(rb.z[i]! * 100) / 100, s: rb.significativoFdr[i] })).filter((c) => c.n! > 0 || c.s)),
  );
}

console.log(JSON.stringify(resultado, null, 2));

import { readFile } from "node:fs/promises";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { calcularTudo, comoGeoJson, geometria, type Resposta } from "./dados.ts";

const t0 = performance.now();
const { respostas, base } = await calcularTudo();
const msCalculo = Math.round(performance.now() - t0);

const medir = (texto: string) => {
  const b = Buffer.from(texto);
  return { bruto: b.length, gzip: gzipSync(b, { level: 9 }).length, brotli: brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length };
};
const kb = (n: number) => Math.round(n / 102.4) / 10;
const mostrar = (m: ReturnType<typeof medir>) => `${kb(m.bruto)} KB bruto · ${kb(m.gzip)} KB gzip · ${kb(m.brotli)} KB brotli`;

const objetos = (r: Resposta) => JSON.stringify({ ...r, celulas: r.celulas.map(([h3, n, zona]) => ({ h3, n, zona: zona === 1 })) });
const tuplas = (r: Resposta) => JSON.stringify(r);
const geojson = (r: Resposta) => JSON.stringify(comoGeoJson(r));

const formatos = { objetos, tuplas, geojson };
const pontos = await readFile(new URL("../../../data/tmp/pontos-2025.json", import.meta.url), "utf8").catch(() => null);

const saida: Record<string, unknown> = {
  calculoDas837CombinacoesMs: msCalculo,
  combinacoes: respostas.size,
  filtroTudo: { total: base.total, celulas: base.celulas.length, zonas: base.celulas.filter((c) => c[2]).length },
};
for (const [nome, f] of Object.entries(formatos)) saida[`filtroTudo_${nome}`] = mostrar(medir(f(base)));
saida.geometriaFixa = mostrar(medir(JSON.stringify(geometria(base))));
if (pontos) saida.referencia_pontos2025 = mostrar(medir(pontos));

const gzips = [...respostas.values()].map((r) => medir(tuplas(r)).gzip).sort((a, b) => a - b);
const q = (p: number) => kb(gzips[Math.floor(p * (gzips.length - 1))]!);
saida.tuplasPorCombinacao_gzipKB = { mediana: q(0.5), p90: q(0.9), max: q(1) };
saida.todasAsCombinacoesTuplas_gzipKB = kb(gzips.reduce((s, v) => s + v, 0));
console.log(JSON.stringify(saida, null, 2));

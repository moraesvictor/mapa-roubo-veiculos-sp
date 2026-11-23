import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { carregar } from "./carregar.ts";
import { extrairOcorrencias, type Fonte } from "./extrair.ts";
import { calcularZonas, janelaDe12Meses } from "./zonas.ts";
import { lerPlanilha } from "./xlsx.ts";

const raiz = new URL("../../../", import.meta.url);
const brutos = new URL("data/raw/", raiz);
const saida = new URL("data/tmp/pipeline/", raiz);

const arquivos = (await readdir(brutos)).filter((n) => /^VeiculosSubtraidos_\d{4}\.xlsx$/.test(n)).sort();
if (!arquivos.length) throw new Error(`Nenhum XLSX em ${brutos.pathname}. Baixe os arquivos da SSP primeiro.`);

const fontes: Fonte[] = arquivos.map((nome) => ({
  nome,
  ler: async (aoLer) => ({ linhas: (await lerPlanilha(new URL(nome, brutos).pathname, aoLer)).linhas }),
}));

const inicio = performance.now();
const { ocorrencias, metadados } = await extrairOcorrencias(fontes);
await mkdir(saida, { recursive: true });
await writeFile(new URL("ocorrencias.ndjson", saida), ocorrencias.map((o) => JSON.stringify(o)).join("\n") + "\n");
await writeFile(new URL("metadados.json", saida), JSON.stringify(metadados, null, 2) + "\n");
const extraiuEm = performance.now();
const janela = janelaDe12Meses(ocorrencias);
const zonas = calcularZonas(ocorrencias, janela);
const calculouEm = performance.now();
const { version } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
await carregar(new URL("mapa.duckdb", saida).pathname, saida.pathname, ocorrencias, zonas, {
  fonte: "SSP-SP, Veículos subtraídos (https://www.ssp.sp.gov.br/estatistica/consultas)",
  janela,
  processadoEm: new Date().toISOString(),
  versaoDoPipeline: process.env.GIT_SHA ? `${version}+${process.env.GIT_SHA}` : version,
  extracao: metadados,
});
const segundos = (a: number, b: number) => Math.round((b - a) / 100) / 10;
const completo = zonas.find((z) => z.chave.split("|").every((d, i) => d.split(",").length === [2, 2, 2, 5][i]));
console.log(
  JSON.stringify(
    {
      ...metadados,
      janela,
      zonas: {
        combinacoes: zonas.length,
        semZonasPorPoucosRegistros: zonas.filter((z) => z.poucosRegistros).length,
        filtroCompleto: completo && { total: completo.total, celulas: completo.celulas.length, zonas: completo.celulas.filter((c) => c.zona).length },
      },
      segundos: { extracao: segundos(inicio, extraiuEm), zonas: segundos(extraiuEm, calculouEm), carga: segundos(calculouEm, performance.now()) },
    },
    null,
    2,
  ),
);

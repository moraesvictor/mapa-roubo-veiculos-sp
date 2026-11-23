import { mkdir, readdir, writeFile } from "node:fs/promises";
import { extrairOcorrencias, type Fonte } from "./extrair.ts";
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
console.log(JSON.stringify({ ...metadados, segundos: Math.round((performance.now() - inicio) / 100) / 10 }, null, 2));

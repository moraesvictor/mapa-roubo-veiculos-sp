import { rm, writeFile } from "node:fs/promises";
import { DuckDBInstance } from "@duckdb/node-api";
import type { Ocorrencia } from "@mapa/core";
import type { Metadados } from "./extrair.ts";
import type { Combinacao, Janela } from "./zonas.ts";

export const VERSAO_DO_ESQUEMA = 1;

export interface Release {
  fonte: string;
  janela: Janela;
  processadoEm: string;
  versaoDoPipeline: string;
  extracao: Metadados;
}

const COLUNAS_OCORRENCIAS = {
  tipo: "VARCHAR",
  veiculo: "VARCHAR",
  familia: "VARCHAR",
  data: "DATE",
  tipo_dia: "VARCHAR",
  periodo: "VARCHAR",
  periodo_origem: "VARCHAR",
  hora: "TINYINT",
  h3: "VARCHAR",
  tipo_local: "VARCHAR",
  rua: "VARCHAR",
  local_confiavel: "BOOLEAN",
} satisfies Record<keyof Ocorrencia, string>;

const literal = (texto: string) => `'${texto.replaceAll("'", "''")}'`;
const colunas = (tipos: Record<string, string>) => `{${Object.entries(tipos).map(([k, v]) => `${k}: ${literal(v)}`).join(", ")}}`;
const ndjson = (linhas: readonly object[]) => linhas.map((l) => JSON.stringify(l)).join("\n") + "\n";

export async function carregar(destino: string, temporarios: string, ocorrencias: readonly Ocorrencia[], zonas: readonly Combinacao[], release: Release) {
  await rm(destino, { force: true });
  const arquivos = {
    ocorrencias: `${temporarios}/carga-ocorrencias.ndjson`,
    resumo: `${temporarios}/carga-resumo.ndjson`,
    celulas: `${temporarios}/carga-celulas.ndjson`,
  };
  await writeFile(arquivos.ocorrencias, ndjson(ocorrencias));
  await writeFile(arquivos.resumo, ndjson(zonas.map(({ chave, total, poucosRegistros }) => ({ chave, total, poucos_registros: poucosRegistros }))));
  await writeFile(arquivos.celulas, ndjson(zonas.flatMap(({ chave, celulas }) => celulas.map((c) => ({ chave, h3: c.h3, n: c.n, zona: c.zona })))));

  const instancia = await DuckDBInstance.create(destino);
  const conexao = await instancia.connect();
  try {
    await conexao.run(`CREATE TABLE ocorrencias AS SELECT * FROM read_json(${literal(arquivos.ocorrencias)}, format = 'newline_delimited', columns = ${colunas(COLUNAS_OCORRENCIAS)}) ORDER BY data, familia, h3, periodo`);
    await conexao.run(`CREATE TABLE zonas_resumo AS SELECT * FROM read_json(${literal(arquivos.resumo)}, format = 'newline_delimited', columns = ${colunas({ chave: "VARCHAR", total: "INTEGER", poucos_registros: "BOOLEAN" })}) ORDER BY chave`);
    await conexao.run(`CREATE TABLE zonas_celulas AS SELECT * FROM read_json(${literal(arquivos.celulas)}, format = 'newline_delimited', columns = ${colunas({ chave: "VARCHAR", h3: "VARCHAR", n: "INTEGER", zona: "BOOLEAN" })}) ORDER BY chave, h3`);
    await conexao.run(`CREATE TABLE release AS SELECT ${VERSAO_DO_ESQUEMA} AS versao_do_esquema, ${literal(release.fonte)} AS fonte, DATE ${literal(release.janela.desde)} AS desde, DATE ${literal(release.janela.ate)} AS ate, TIMESTAMPTZ ${literal(release.processadoEm)} AS processado_em, ${literal(release.versaoDoPipeline)} AS versao_do_pipeline, ${literal(JSON.stringify(release.extracao))}::JSON AS extracao`);
    await conexao.run("CHECKPOINT");
  } finally {
    conexao.closeSync();
    instancia.closeSync();
    await Promise.all(Object.values(arquivos).map((a) => rm(a, { force: true })));
  }
}

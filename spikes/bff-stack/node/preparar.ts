import { rm } from "node:fs/promises";
import { DuckDBInstance } from "@duckdb/node-api";

const raiz = new URL("../../../", import.meta.url);
const ndjson = new URL("data/tmp/ocorrencias.ndjson", raiz).pathname;
const destino = new URL("data/tmp/bff.duckdb", raiz).pathname;

await rm(destino, { force: true });
const conexao = await (await DuckDBInstance.create(destino)).connect();
await conexao.run(`CREATE TABLE ocorrencias AS SELECT tipo, veiculo, familia, CAST(data AS DATE) AS data, periodo, tipo_dia, h3 FROM read_json_auto('${ndjson}')`);
await conexao.run("CREATE TABLE metadados AS SELECT max(data) AS atualizado_ate FROM ocorrencias");
await conexao.run("CHECKPOINT");
const linhas = (await conexao.runAndReadAll("SELECT count(*)::INTEGER AS n, max(data)::VARCHAR AS ate FROM ocorrencias")).getRowObjectsJson();
console.log(JSON.stringify({ destino, ...linhas[0] }));

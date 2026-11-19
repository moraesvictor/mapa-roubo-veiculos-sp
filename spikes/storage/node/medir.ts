import { execFileSync } from "node:child_process";
import { readFile, rm, stat } from "node:fs/promises";
import { DuckDBInstance } from "@duckdb/node-api";
import { gridDisk } from "h3-js";
import pg from "pg";
import type { Registro } from "./gerar-base.ts";

const raiz = new URL("../../../", import.meta.url);
const ndjson = new URL("data/tmp/ocorrencias.ndjson", raiz).pathname;
const arquivoDuck = new URL("data/tmp/base.duckdb", raiz).pathname;
const arquivoParquet = new URL("data/tmp/ocorrencias.parquet", raiz).pathname;
const CONTAINER = "spike-mapa-postgis";
const PORTA = 54329;
const RODADAS = 50;
const DESDE = "2025-10-01";

const registros: Registro[] = (await readFile(ndjson, "utf8")).split("\n").map((l) => JSON.parse(l));
const celulas = [...new Set(registros.map((r) => r.h3).filter((h): h is string => !!h))];

let semente = 42;
const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const algunsDe = <T>(lista: readonly T[]) => {
  const escolhidos = lista.filter(() => aleatorio() < 0.6);
  return escolhidos.length ? escolhidos : [lista[Math.floor(aleatorio() * lista.length)]!];
};
interface Filtro { veiculos: string[]; tipos: string[]; periodos: string[]; dias: string[]; area: string[] }
const filtros: Filtro[] = Array.from({ length: RODADAS }, () => ({
  veiculos: algunsDe(["carro", "moto"]),
  tipos: algunsDe(["roubo", "furto"]),
  periodos: algunsDe(["madrugada", "manha", "tarde", "noite", "hora-incerta"]),
  dias: algunsDe(["dia-util", "fim-de-semana"]),
  area: gridDisk(celulas[Math.floor(aleatorio() * celulas.length)]!, 1),
}));

const lista = (v: readonly string[]) => v.map((x) => `'${x.replace(/[^a-z0-9-]/gi, "")}'`).join(",");
const ondeDuck = (f: Filtro) =>
  `data >= DATE '${DESDE}' AND veiculo IN (${lista(f.veiculos)}) AND tipo IN (${lista(f.tipos)}) AND periodo IN (${lista(f.periodos)}) AND tipo_dia IN (${lista(f.dias)})`;
const ondePg = "data >= $1 AND veiculo = ANY($2) AND tipo = ANY($3) AND periodo = ANY($4) AND tipo_dia = ANY($5)";
const paramsPg = (f: Filtro) => [DESDE, f.veiculos, f.tipos, f.periodos, f.dias];

const consultas = {
  zonas: {
    duck: (f: Filtro) => `SELECT h3, count(*) AS n FROM ocorrencias WHERE ${ondeDuck(f)} AND h3 IS NOT NULL GROUP BY h3`,
    pg: (f: Filtro) => ({ text: `SELECT h3, count(*) AS n FROM ocorrencias WHERE ${ondePg} AND h3 IS NOT NULL GROUP BY h3`, values: paramsPg(f) }),
  },
  area: {
    duck: (f: Filtro) => `SELECT periodo, count(*) AS n FROM ocorrencias WHERE ${ondeDuck(f)} AND h3 IN (${lista(f.area)}) GROUP BY periodo`,
    pg: (f: Filtro) => ({ text: `SELECT periodo, count(*) AS n FROM ocorrencias WHERE ${ondePg} AND h3 = ANY($6) GROUP BY periodo`, values: [...paramsPg(f), f.area] }),
  },
  ranking: {
    duck: (f: Filtro) => `SELECT familia, count(*) AS n FROM ocorrencias WHERE data >= DATE '${DESDE}' AND veiculo = ${lista(f.veiculos.slice(0, 1))} GROUP BY familia ORDER BY n DESC, familia LIMIT 20`,
    pg: (f: Filtro) => ({ text: "SELECT familia, count(*) AS n FROM ocorrencias WHERE data >= $1 AND veiculo = $2 GROUP BY familia ORDER BY n DESC, familia LIMIT 20", values: [DESDE, f.veiculos[0]] }),
  },
  serie: {
    duck: (f: Filtro) => `SELECT date_trunc('month', data) AS mes, count(*) AS n FROM ocorrencias WHERE data >= DATE '2025-01-01' AND veiculo IN (${lista(f.veiculos)}) AND tipo IN (${lista(f.tipos)}) GROUP BY mes ORDER BY mes`,
    pg: (f: Filtro) => ({ text: "SELECT date_trunc('month', data) AS mes, count(*) AS n FROM ocorrencias WHERE data >= '2025-01-01' AND veiculo = ANY($1) AND tipo = ANY($2) GROUP BY mes ORDER BY mes", values: [f.veiculos, f.tipos] }),
  },
};

const percentil = (v: number[], p: number) => {
  const o = [...v].sort((a, b) => a - b);
  return Math.round(o[Math.min(o.length - 1, Math.floor(p * o.length))]! * 100) / 100;
};
const somaN = (linhas: { n: unknown }[]) => linhas.reduce((s, l) => s + Number(l.n), 0);
const resultado: Record<string, unknown> = { registros: registros.length, rodadasPorConsulta: RODADAS };

await rm(arquivoDuck, { force: true });
let t = performance.now();
const duck = await (await DuckDBInstance.create(arquivoDuck)).connect();
await duck.run(`CREATE TABLE ocorrencias AS SELECT tipo, veiculo, familia, CAST(data AS DATE) AS data, periodo, tipo_dia, h3 FROM read_json_auto('${ndjson}')`);
await duck.run(`COPY ocorrencias TO '${arquivoParquet}' (FORMAT parquet, COMPRESSION zstd)`);
await duck.run("CHECKPOINT");
resultado.duckdb = {
  cargaMs: Math.round(performance.now() - t),
  arquivoDuckdbKB: Math.round((await stat(arquivoDuck)).size / 1024),
  arquivoParquetKB: Math.round((await stat(arquivoParquet)).size / 1024),
};

execFileSync("docker", ["rm", "-f", CONTAINER], { stdio: "ignore" });
execFileSync("docker", ["run", "-d", "--name", CONTAINER, "-e", "POSTGRES_PASSWORD=spike-local", "-p", `127.0.0.1:${PORTA}:5432`, "postgis/postgis:17-3.5"], { stdio: "ignore" });
async function conectarPg() {
  for (let i = 0; i < 60; i++) {
    const c = new pg.Client({ host: "127.0.0.1", port: PORTA, user: "postgres", password: "spike-local", database: "postgres" });
    try {
      await c.connect();
      await c.query("SELECT 1");
      return c;
    } catch {
      await c.end().catch(() => undefined);
      await new Promise((ok) => setTimeout(ok, 1000));
    }
  }
  throw new Error("PostGIS não subiu em 60 s");
}
const cliente = await conectarPg();
t = performance.now();
await cliente.query("CREATE TABLE ocorrencias (tipo text, veiculo text, familia text, data date, periodo text, tipo_dia text, h3 text)");
for (let i = 0; i < registros.length; i += 5000) {
  const lote = registros.slice(i, i + 5000);
  await cliente.query(
    "INSERT INTO ocorrencias SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::date[], $5::text[], $6::text[], $7::text[])",
    (["tipo", "veiculo", "familia", "data", "periodo", "tipo_dia", "h3"] as const).map((c) => lote.map((r) => r[c])),
  );
}
await cliente.query("CREATE INDEX ON ocorrencias (veiculo, tipo, data)");
await cliente.query("CREATE INDEX ON ocorrencias (h3)");
await cliente.query("VACUUM ANALYZE ocorrencias");
const tamanhoPg = await cliente.query("SELECT pg_total_relation_size('ocorrencias') AS b");
resultado.postgis = { cargaMs: Math.round(performance.now() - t), tabelaComIndicesKB: Math.round(Number(tamanhoPg.rows[0].b) / 1024) };

const divergencias: string[] = [];
for (const [nome, q] of Object.entries(consultas)) {
  const tempos = { duckdb: [] as number[], postgis: [] as number[] };
  for (const f of filtros.slice(0, 3)) {
    await duck.runAndReadAll(q.duck(f));
    await cliente.query(q.pg(f));
  }
  for (const [i, f] of filtros.entries()) {
    let t0 = performance.now();
    const rd = (await duck.runAndReadAll(q.duck(f))).getRowObjectsJson() as { n: unknown }[];
    tempos.duckdb.push(performance.now() - t0);
    t0 = performance.now();
    const rp = (await cliente.query(q.pg(f))).rows as { n: unknown }[];
    tempos.postgis.push(performance.now() - t0);
    if (somaN(rd) !== somaN(rp) || rd.length !== rp.length) divergencias.push(`${nome}#${i}: duck ${somaN(rd)}/${rd.length} x pg ${somaN(rp)}/${rp.length}`);
  }
  resultado[`consulta_${nome}`] = {
    duckdb: { p50Ms: percentil(tempos.duckdb, 0.5), p95Ms: percentil(tempos.duckdb, 0.95) },
    postgis: { p50Ms: percentil(tempos.postgis, 0.5), p95Ms: percentil(tempos.postgis, 0.95) },
  };
}
resultado.divergencias = divergencias.length ? divergencias.slice(0, 5) : "nenhuma: os dois bancos devolvem as mesmas contagens";
resultado.memoriaContainerPostgis = execFileSync("docker", ["stats", "--no-stream", "--format", "{{.MemUsage}}", CONTAINER]).toString().trim();
resultado.memoriaProcessoNodeComDuckdbMB = Math.round(process.memoryUsage.rss() / 1024 / 1024);

await cliente.end();
execFileSync("docker", ["rm", "-f", CONTAINER], { stdio: "ignore" });
console.log(JSON.stringify(resultado, null, 2));

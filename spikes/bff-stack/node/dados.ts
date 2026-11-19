import { createHash } from "node:crypto";
import { DuckDBInstance, listValue } from "@duckdb/node-api";
import type { FiltroNormalizado, RespostaZonas } from "./contrato.ts";

const arquivo = new URL("../../../data/tmp/bff.duckdb", import.meta.url).pathname;

export async function abrirDados() {
  const instancia = await DuckDBInstance.create(arquivo, { access_mode: "READ_ONLY" });
  const conexao = await instancia.connect();
  const [meta] = (await conexao.runAndReadAll("SELECT atualizado_ate::VARCHAR AS ate, (atualizado_ate - INTERVAL 12 MONTH + INTERVAL 1 DAY)::DATE::VARCHAR AS desde FROM metadados")).getRowObjectsJson() as { ate: string; desde: string }[];
  const versao = meta!.ate;

  async function zonas(f: FiltroNormalizado): Promise<RespostaZonas> {
    const leitor = await conexao.runAndReadAll(
      `SELECT h3, count(*)::INTEGER AS n FROM ocorrencias
       WHERE data >= $1::DATE AND h3 IS NOT NULL
         AND list_contains($2, veiculo) AND list_contains($3, tipo)
         AND list_contains($4, periodo) AND list_contains($5, tipo_dia)
       GROUP BY h3 ORDER BY h3`,
      [meta!.desde, listValue(f.veiculos), listValue(f.tipos), listValue(f.periodos), listValue(f.dias)],
    );
    const celulas = leitor.getRowObjectsJson() as { h3: string; n: number }[];
    return { atualizadoAte: meta!.ate, desde: meta!.desde, total: celulas.reduce((s, c) => s + c.n, 0), celulas };
  }

  const etag = (f: FiltroNormalizado) =>
    `"${versao}-${createHash("sha1").update(JSON.stringify(f)).digest("base64url").slice(0, 16)}"`;

  return { zonas, etag, fechar: () => conexao.closeSync() };
}

export type Dados = Awaited<ReturnType<typeof abrirDados>>;

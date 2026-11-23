import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { CAMPOS_PERMITIDOS, chaveDoFiltro, type Ocorrencia } from "@mapa/core";
import { gridDisk, latLngToCell } from "h3-js";
import { describe, expect, it } from "vitest";
import { carregar } from "./carregar.ts";
import type { Metadados } from "./extrair.ts";
import { calcularZonas, janelaDe12Meses } from "./zonas.ts";

const CENTRO = latLngToCell(-23.5614, -46.6558, 8);
const vizinhas = gridDisk(CENTRO, 4).filter((c) => c !== CENTRO);

function ocorrencia(h3: string, extra: Partial<Ocorrencia> = {}): Ocorrencia {
  return {
    tipo: "furto",
    veiculo: "carro",
    familia: "FIAT UNO",
    data: "2026-06-15",
    tipo_dia: "dia-util",
    periodo: "noite",
    periodo_origem: "calculado",
    hora: 20,
    h3,
    tipo_local: "via-publica",
    rua: "RUA TESTE",
    local_confiavel: true,
    ...extra,
  };
}

function cenario(): Ocorrencia[] {
  const fundo = vizinhas.flatMap((c, i) => Array.from({ length: i % 10 === 0 ? 5 : 1 + (i % 3) }, () => ocorrencia(c)));
  const foco = Array.from({ length: 120 }, () => ocorrencia(CENTRO, { veiculo: "moto" }));
  return [...fundo, ...foco, ocorrencia(CENTRO, { data: "2024-01-01" })];
}

describe("janela de 12 meses", () => {
  it("termina na data mais recente e começa no dia seguinte, um ano antes", () => {
    expect(janelaDe12Meses([ocorrencia(CENTRO, { data: "2026-09-30" }), ocorrencia(CENTRO, { data: "2025-01-01" })])).toEqual({ desde: "2025-10-01", ate: "2026-09-30" });
  });
});

describe("zonas (D18)", () => {
  const dados = cenario();
  const zonas = calcularZonas(dados, janelaDe12Meses(dados));
  const porChave = new Map(zonas.map((z) => [z.chave, z]));

  it("calcula as 837 combinações", () => {
    expect(zonas).toHaveLength(837);
  });

  it("acha a concentração no centro e respeita k = 5 nas células publicadas", () => {
    const completo = porChave.get(chaveDoFiltro({}));
    expect(completo?.celulas.find((c) => c.h3 === CENTRO)?.zona).toBe(true);
    expect(completo?.celulas.every((c) => c.n >= 5)).toBe(true);
  });

  it("filtro com menos de 200 ocorrências não tem zonas", () => {
    const carros = porChave.get(chaveDoFiltro({ tiposVeiculo: ["carro"] }));
    expect(carros?.poucosRegistros).toBe(true);
    expect(carros?.celulas.some((c) => c.zona)).toBe(false);
  });

  it("fora da janela, sem célula e lote (D24) não entram", () => {
    const completo = porChave.get(chaveDoFiltro({}));
    const semLote = calcularZonas([...dados, ...Array.from({ length: 50 }, () => ocorrencia(vizinhas[5] ?? "", { local_confiavel: false })), ocorrencia("", { h3: null })], janelaDe12Meses(dados));
    expect(semLote.find((z) => z.chave === chaveDoFiltro({}))?.total).toBe(completo?.total);
    expect(completo?.total).toBe(dados.length - 1);
  });
});

describe("carga no DuckDB", () => {
  it("grava as tabelas com o esquema esperado, só campos permitidos e metadados da release", async () => {
    const pasta = await mkdtemp(join(tmpdir(), "pipeline-"));
    const destino = join(pasta, "mapa.duckdb");
    const dados = cenario();
    const janela = janelaDe12Meses(dados);
    await carregar(destino, pasta, dados, calcularZonas(dados, janela), {
      fonte: "teste",
      janela,
      processadoEm: "2026-11-23T12:00:00Z",
      versaoDoPipeline: "0.0.0",
      extracao: { ocorrencias: dados.length } as unknown as Metadados,
    });
    const instancia = await DuckDBInstance.create(destino, { access_mode: "READ_ONLY" });
    const conexao = await instancia.connect();
    const ler = async (sql: string) => (await conexao.runAndReadAll(sql)).getRowObjectsJson();
    try {
      const colunas = (await ler("SELECT column_name FROM information_schema.columns WHERE table_name = 'ocorrencias'")).map((r) => r.column_name);
      expect([...colunas].sort()).toEqual([...CAMPOS_PERMITIDOS].sort());
      expect(await ler("SELECT count(*)::INTEGER AS n FROM ocorrencias")).toEqual([{ n: dados.length }]);
      expect(await ler("SELECT count(*)::INTEGER AS n FROM zonas_resumo")).toEqual([{ n: 837 }]);
      expect(await ler("SELECT min(n)::INTEGER AS n FROM zonas_celulas")).toEqual([{ n: 5 }]);
      expect(await ler("SELECT desde::VARCHAR AS desde, ate::VARCHAR AS ate, extracao->>'ocorrencias' AS n FROM release")).toEqual([{ desde: janela.desde, ate: janela.ate, n: String(dados.length) }]);
    } finally {
      conexao.closeSync();
      instancia.closeSync();
      await rm(pasta, { recursive: true, force: true });
    }
  });
});

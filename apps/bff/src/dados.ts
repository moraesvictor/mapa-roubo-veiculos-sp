import { createHash } from "node:crypto";
import { DuckDBInstance, listValue, type DuckDBValue } from "@duckdb/node-api";
import {
  chaveDoFiltro,
  DIRECOES,
  K_MINIMO,
  normalizarTexto,
  PERIODOS_DO_DIA,
  TIPOS_DE_LOCAL,
  type Contagem,
  type Direcao,
  type Filtros,
  type RespostaArea,
  type RespostaRua,
  type RespostaSobre,
  type RespostaZonas,
} from "@mapa/core";
import { cellToBoundary, cellToLatLng, gridDisk, gridDistance } from "h3-js";

export const contagem = (n: number): Contagem => (n >= K_MINIMO ? n : null);

interface Release {
  desde: string;
  ate: string;
  fonte: string;
  processado_em: string;
  versao_do_pipeline: string;
  extracao: string;
}

interface Extracao {
  ocorrencias: number;
  foraDoMapa: number;
  coordenada: { vedada: number; "nao-numerica": number; zerada: number; "fora-de-sp": number };
  lotes: { registros: number };
  periodoOrigem: { calculado: number; ssp: number; horaIncerta: number };
  familias?: { modeloNaoIdentificado: number };
}

function direcao(origem: string, destino: string): Direcao {
  const [lat1, lon1] = cellToLatLng(origem);
  const [lat2, lon2] = cellToLatLng(destino);
  const angulo = (Math.atan2((lon2 - lon1) * Math.cos((lat1 * Math.PI) / 180), lat2 - lat1) * 180) / Math.PI;
  const graus = (angulo + 360) % 360;
  return DIRECOES[Math.round(graus / 90) % 4] ?? "norte";
}

export async function abrirDados(arquivo: string) {
  const instancia = await DuckDBInstance.create(arquivo, { access_mode: "READ_ONLY" });
  const conexao = await instancia.connect();
  const ler = async <T>(sql: string, parametros: DuckDBValue[] = []) => (await conexao.runAndReadAll(sql, parametros)).getRowObjectsJson() as T[];

  const [release] = await ler<Release>("SELECT desde::VARCHAR AS desde, ate::VARCHAR AS ate, fonte, strftime(processado_em AT TIME ZONE 'UTC', '%Y-%m-%dT%H:%M:%SZ') AS processado_em, versao_do_pipeline, extracao::VARCHAR AS extracao FROM release");
  if (!release) throw new Error(`${arquivo}: tabela release vazia`);
  const janela = { atualizadoAte: release.ate, desde: release.desde };
  const versao = createHash("sha1").update(`${release.processado_em}|${release.versao_do_pipeline}`).digest("base64url").slice(0, 10);

  const geometria = {
    type: "FeatureCollection" as const,
    features: (await ler<{ h3: string }>("SELECT h3 FROM zonas_celulas WHERE chave = $1 ORDER BY h3", [chaveDoFiltro({})])).map(({ h3 }) => ({
      type: "Feature" as const,
      id: h3,
      properties: { h3 },
      geometry: { type: "Polygon" as const, coordinates: [cellToBoundary(h3, true).map(([lon, lat]): [number, number] => [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5])] },
    })),
  };

  const filtroSql = (f: Filtros, comPeriodo: boolean) => ({
    sql: `local_confiavel AND data BETWEEN $1::DATE AND $2::DATE AND list_contains($3, veiculo) AND list_contains($4, tipo) AND list_contains($5, tipo_dia)${comPeriodo ? " AND list_contains($6, periodo)" : ""}`,
    parametros: [
      janela.desde,
      janela.atualizadoAte,
      listValue([...f.tiposVeiculo]),
      listValue([...f.tiposOcorrencia]),
      listValue([...f.tiposDeDia]),
      ...(comPeriodo ? [listValue([...f.periodos])] : []),
    ] as DuckDBValue[],
  });

  async function zonas(f: Filtros): Promise<RespostaZonas> {
    const chave = chaveDoFiltro(f);
    const [resumo] = await ler<{ total: number; poucos_registros: boolean }>("SELECT total, poucos_registros FROM zonas_resumo WHERE chave = $1", [chave]);
    const celulas = await ler<{ h3: string; n: number; zona: boolean }>("SELECT h3, n, zona FROM zonas_celulas WHERE chave = $1 ORDER BY h3", [chave]);
    return { ...janela, total: resumo?.total ?? 0, poucosRegistros: resumo?.poucos_registros ?? true, celulas: celulas.map((c) => [c.h3, c.n, c.zona]) };
  }

  async function area(h3: string, f: Filtros): Promise<RespostaArea> {
    const comPeriodo = filtroSql(f, true);
    const semPeriodo = filtroSql(f, false);
    const proximo = comPeriodo.parametros.length + 1;
    const [total] = await ler<{ n: number }>(`SELECT count(*)::INTEGER AS n FROM ocorrencias WHERE ${comPeriodo.sql} AND h3 = $${proximo}`, [...comPeriodo.parametros, h3]);
    const periodos = await ler<{ chave: string; n: number }>(`SELECT periodo AS chave, count(*)::INTEGER AS n FROM ocorrencias WHERE ${semPeriodo.sql} AND h3 = $${semPeriodo.parametros.length + 1} GROUP BY periodo`, [...semPeriodo.parametros, h3]);
    const locais = await ler<{ chave: string | null; n: number }>(`SELECT tipo_local AS chave, count(*)::INTEGER AS n FROM ocorrencias WHERE ${comPeriodo.sql} AND h3 = $${proximo} GROUP BY tipo_local`, [...comPeriodo.parametros, h3]);
    const vizinhas = gridDisk(h3, 2).filter((c) => gridDistance(h3, c) > 0);
    const porVizinha = await ler<{ h3: string; n: number }>(`SELECT h3, count(*)::INTEGER AS n FROM ocorrencias WHERE ${comPeriodo.sql} AND list_contains($${proximo}, h3) GROUP BY h3`, [...comPeriodo.parametros, listValue(vizinhas)]);
    const [zona] = await ler<{ zona: boolean }>("SELECT zona FROM zonas_celulas WHERE chave = $1 AND h3 = $2", [chaveDoFiltro(f), h3]);

    const somaPorDirecao = new Map<Direcao, number>(DIRECOES.map((d) => [d, 0]));
    for (const v of porVizinha) somaPorDirecao.set(direcao(h3, v.h3), (somaPorDirecao.get(direcao(h3, v.h3)) ?? 0) + v.n);
    const porChave = <T extends string>(linhas: { chave: string | null; n: number }[], todos: readonly T[]) =>
      Object.fromEntries(todos.map((t) => [t, contagem(linhas.find((l) => l.chave === t)?.n ?? 0)])) as Record<T, Contagem>;

    return {
      ...janela,
      h3,
      zona: zona?.zona ?? false,
      total: contagem(total?.n ?? 0),
      porPeriodo: porChave(periodos, PERIODOS_DO_DIA),
      porTipoDeLocal: porChave(locais, TIPOS_DE_LOCAL),
      arredores: DIRECOES.map((d) => ({ direcao: d, total: contagem(somaPorDirecao.get(d) ?? 0) })),
    };
  }

  async function rua(nome: string, f: Filtros, celulas: readonly string[] = []): Promise<RespostaRua> {
    const filtro = filtroSql(f, true);
    const proximo = filtro.parametros.length + 1;
    const vizinhanca = [...new Set(celulas.flatMap((c) => gridDisk(c, 1)))];
    const [linha] = await ler<{ n: number }>(
      `SELECT count(*)::INTEGER AS n FROM ocorrencias WHERE ${filtro.sql} AND rua = $${proximo}${vizinhanca.length ? ` AND list_contains($${proximo + 1}, h3)` : ""}`,
      [...filtro.parametros, normalizarTexto(nome), ...(vizinhanca.length ? [listValue(vizinhanca)] : [])],
    );
    return { ...janela, nome, total: contagem(linha?.n ?? 0) };
  }

  const extracao = JSON.parse(release.extracao) as Extracao;
  const sobre: RespostaSobre = {
    ...janela,
    fonte: release.fonte,
    processadoEm: release.processado_em,
    versaoDoPipeline: release.versao_do_pipeline,
    ocorrencias: extracao.ocorrencias,
    foraDoMapa: {
      total: extracao.foraDoMapa,
      semCoordenada: extracao.coordenada["nao-numerica"] + extracao.coordenada.zerada + extracao.coordenada["fora-de-sp"],
      vedadas: extracao.coordenada.vedada,
      lotes: extracao.lotes.registros,
    },
    periodo: { calculado: extracao.periodoOrigem.calculado, rotuloDaSsp: extracao.periodoOrigem.ssp, horaIncerta: extracao.periodoOrigem.horaIncerta },
    modeloNaoIdentificado: extracao.familias?.modeloNaoIdentificado ?? 0,
  };

  return {
    versao,
    geometria,
    sobre,
    zonas,
    area,
    rua,
    fechar: () => {
      conexao.closeSync();
      instancia.closeSync();
    },
  };
}

export type Dados = Awaited<ReturnType<typeof abrirDados>>;

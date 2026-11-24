import { createHash } from "node:crypto";
import { DuckDBInstance, listValue, type DuckDBValue } from "@duckdb/node-api";
import {
  chaveDoFiltro,
  DIRECOES,
  K_MINIMO,
  nomeDoModelo,
  normalizarTexto,
  PERIODOS_DO_DIA,
  TIPOS_DE_LOCAL,
  type Contagem,
  type Direcao,
  type Filtros,
  type RespostaArea,
  type RespostaModelo,
  type RespostaModelos,
  type RespostaRanking,
  type TipoOcorrencia,
  type TipoVeiculo,
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

  const deslocar = (data: string, anos: number, dias: number) => {
    const d = new Date(`${data}T00:00:00Z`);
    d.setUTCFullYear(d.getUTCFullYear() + anos);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  };
  const anterior = { desde: deslocar(janela.desde, -1, 0), ate: deslocar(janela.desde, 0, -1) };
  const IDENTIFICADO = "familia NOT LIKE '%NAO IDENTIFICADO%'";
  const variacao = (atual: number, antes: number) => (atual >= K_MINIMO && antes >= K_MINIMO ? Math.round((atual / antes - 1) * 1000) / 1000 : null);

  async function contarPorFamilia(veiculo: TipoVeiculo, tipos: readonly TipoOcorrencia[], periodo: { desde: string; ate: string }) {
    const linhas = await ler<{ familia: string; n: number }>(
      "SELECT familia, count(*)::INTEGER AS n FROM ocorrencias WHERE veiculo = $1 AND list_contains($2, tipo) AND data BETWEEN $3::DATE AND $4::DATE GROUP BY familia",
      [veiculo, listValue([...tipos]), periodo.desde, periodo.ate],
    );
    return new Map(linhas.map((l) => [l.familia, l.n]));
  }

  const naoIdentificada = (familia: string) => familia.includes("NAO IDENTIFICADO");

  async function modelos(veiculo: TipoVeiculo): Promise<RespostaModelos> {
    const linhas = await ler<{ familia: string; n: number }>(
      `SELECT familia, count(*)::INTEGER AS n FROM ocorrencias WHERE veiculo = $1 AND data BETWEEN $2::DATE AND $3::DATE AND ${IDENTIFICADO} GROUP BY familia HAVING count(*) >= ${K_MINIMO} ORDER BY n DESC, familia`,
      [veiculo, janela.desde, janela.atualizadoAte],
    );
    return { ...janela, veiculo, modelos: linhas.map((l) => ({ familia: l.familia, nome: nomeDoModelo(l.familia), total: l.n })) };
  }

  async function ranking(veiculo: TipoVeiculo, tipos: readonly TipoOcorrencia[], limite: number): Promise<RespostaRanking> {
    const atual = await contarPorFamilia(veiculo, tipos, { desde: janela.desde, ate: janela.atualizadoAte });
    const antes = await contarPorFamilia(veiculo, tipos, anterior);
    const identificadas = [...atual].filter(([f]) => !naoIdentificada(f));
    const publicaveis = identificadas.filter(([, n]) => n >= K_MINIMO).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const pequenas = identificadas.filter(([, n]) => n < K_MINIMO);
    return {
      ...janela,
      veiculo,
      itens: publicaveis.slice(0, limite).map(([familia, n], i) => ({ posicao: i + 1, familia, nome: nomeDoModelo(familia), total: n, variacao: variacao(n, antes.get(familia) ?? 0) })),
      outros: { modelos: pequenas.length, ocorrencias: pequenas.reduce((s, [, n]) => s + n, 0) },
      naoIdentificado: [...atual].filter(([f]) => naoIdentificada(f)).reduce((s, [, n]) => s + n, 0),
      total: [...atual.values()].reduce((s, n) => s + n, 0),
    };
  }

  async function modelo(veiculo: TipoVeiculo, familia: string): Promise<RespostaModelo | null> {
    const todos: TipoOcorrencia[] = ["furto", "roubo"];
    const atual = await contarPorFamilia(veiculo, todos, { desde: janela.desde, ate: janela.atualizadoAte });
    const antes = await contarPorFamilia(veiculo, todos, anterior);
    const total = atual.get(familia);
    if (total === undefined && !antes.has(familia)) return null;
    const ordem = [...atual].filter(([f, n]) => !naoIdentificada(f) && n >= K_MINIMO).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const posicao = ordem.findIndex(([f]) => f === familia);
    const periodos = await ler<{ chave: string; n: number }>(
      "SELECT periodo AS chave, count(*)::INTEGER AS n FROM ocorrencias WHERE veiculo = $1 AND familia = $2 AND data BETWEEN $3::DATE AND $4::DATE GROUP BY periodo",
      [veiculo, familia, janela.desde, janela.atualizadoAte],
    );
    const meses = await ler<{ mes: string; n: number }>(
      "SELECT strftime(data, '%Y-%m') AS mes, count(*)::INTEGER AS n FROM ocorrencias WHERE veiculo = $1 AND familia = $2 AND data BETWEEN $3::DATE AND $4::DATE GROUP BY mes",
      [veiculo, familia, janela.desde, janela.atualizadoAte],
    );
    const porMes = new Map(meses.map((m) => [m.mes, m.n]));
    const listaDeMeses: string[] = [];
    for (let d = new Date(`${janela.desde.slice(0, 7)}-01T00:00:00Z`); d.toISOString().slice(0, 7) <= janela.atualizadoAte.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) listaDeMeses.push(d.toISOString().slice(0, 7));
    return {
      ...janela,
      veiculo,
      familia,
      nome: nomeDoModelo(familia),
      total: contagem(total ?? 0),
      posicao: posicao >= 0 ? posicao + 1 : null,
      porPeriodo: Object.fromEntries(PERIODOS_DO_DIA.map((p) => [p, contagem(periodos.find((l) => l.chave === p)?.n ?? 0)])) as RespostaModelo["porPeriodo"],
      mensal: listaDeMeses.map((mes) => ({ mes, total: contagem(porMes.get(mes) ?? 0) })),
      variacao: variacao(total ?? 0, antes.get(familia) ?? 0),
    };
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
    modelos,
    ranking,
    modelo,
    fechar: () => {
      conexao.closeSync();
      instancia.closeSync();
    },
  };
}

export type Dados = Awaited<ReturnType<typeof abrirDados>>;

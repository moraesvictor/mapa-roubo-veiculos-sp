import { createHash } from "node:crypto";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  ConsultaDeFiltros,
  ConsultaDeModelo,
  ConsultaDeModelos,
  ConsultaDeRanking,
  ConsultaDeRua,
  filtrosDaConsulta,
  RESOLUCAO_H3,
  RespostaArea,
  RespostaCep,
  RespostaErro,
  RespostaGeometria,
  RespostaModelo,
  RespostaModelos,
  RespostaRanking,
  RespostaRua,
  RespostaSobre,
  RespostaZonas,
} from "@mapa/core";
import type { Context } from "hono";
import { compress } from "hono/compress";
import { getResolution, isValidCell } from "h3-js";
import type { Dados } from "./dados.ts";

export const CACHE_CURTO = "public, max-age=3600, stale-while-revalidate=86400";
export const CACHE_LONGO = "public, max-age=86400, stale-while-revalidate=604800";

const erro400 = { 400: { description: "Parâmetro inválido", content: { "application/json": { schema: RespostaErro } } } };
const naoMudou = { 304: { description: "Não mudou desde o ETag enviado" } };
const json = <T extends z.ZodType>(schema: T, descricao: string) => ({ 200: { description: descricao, content: { "application/json": { schema } } } });

const rotaZonas = createRoute({
  method: "get",
  path: "/v1/zonas",
  summary: "Ocorrências por área (H3 res 8) e zonas de concentração, nos últimos 12 meses",
  request: { query: ConsultaDeFiltros },
  responses: { ...json(RespostaZonas, "Contagens por célula"), ...naoMudou, ...erro400 },
});

const rotaGeometria = createRoute({
  method: "get",
  path: "/v1/geometria",
  summary: "Contorno de todas as células que podem aparecer no mapa (GeoJSON); muda só a cada release",
  responses: { ...json(RespostaGeometria, "GeoJSON"), ...naoMudou },
});

const rotaArea = createRoute({
  method: "get",
  path: "/v1/area/{h3}",
  summary: "Resumo de uma área: total, períodos, tipo de local e arredores",
  request: { params: z.object({ h3: z.string().describe("Célula H3 resolução 8") }), query: ConsultaDeFiltros },
  responses: { ...json(RespostaArea, "Resumo da área"), ...naoMudou, ...erro400 },
});

const rotaRua = createRoute({
  method: "get",
  path: "/v1/rua",
  summary: "Total de ocorrências da rua pesquisada (sem ranking, D22)",
  request: { query: ConsultaDeRua },
  responses: { ...json(RespostaRua, "Total da rua"), ...naoMudou, ...erro400 },
});

const rotaCep = createRoute({
  method: "get",
  path: "/v1/cep/{cep}",
  summary: "Rua e bairro de um CEP (ViaCEP). O CEP não é guardado nem registrado",
  request: { params: z.object({ cep: z.string().regex(/^\d{8}$/).describe("8 dígitos, sem hífen") }) },
  responses: { ...json(RespostaCep, "Rua e bairro"), ...erro400, 404: { description: "CEP não encontrado", content: { "application/json": { schema: RespostaErro } } }, 502: { description: "ViaCEP fora do ar", content: { "application/json": { schema: RespostaErro } } } },
});

const rotaModelos = createRoute({
  method: "get",
  path: "/v1/modelos",
  summary: "Famílias de modelo com 5 ou mais ocorrências nos últimos 12 meses (pra busca do 'Meu veículo')",
  request: { query: ConsultaDeModelos },
  responses: { ...json(RespostaModelos, "Modelos"), ...naoMudou, ...erro400 },
});

const rotaRanking = createRoute({
  method: "get",
  path: "/v1/ranking",
  summary: "Modelos com mais ocorrências, com variação em relação aos 12 meses anteriores",
  request: { query: ConsultaDeRanking },
  responses: { ...json(RespostaRanking, "Ranking de modelos"), ...naoMudou, ...erro400 },
});

const rotaModelo = createRoute({
  method: "get",
  path: "/v1/modelo",
  summary: "Um modelo: total, posição, períodos do dia e evolução mês a mês",
  request: { query: ConsultaDeModelo },
  responses: { ...json(RespostaModelo, "Modelo"), ...naoMudou, ...erro400, 404: { description: "Modelo sem registros", content: { "application/json": { schema: RespostaErro } } } },
});

const rotaSobre = createRoute({
  method: "get",
  path: "/v1/sobre",
  summary: "Fonte, período e o que ficou fora do mapa nesta release",
  responses: { ...json(RespostaSobre, "Metadados da release"), ...naoMudou },
});

export type ConsultarCep = (cep: string) => Promise<{ logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean | string } | null>;

export const consultarViaCep: ConsultarCep = async (cep) => {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return res.status === 400 ? { erro: true } : null;
  return (await res.json()) as Awaited<ReturnType<ConsultarCep>>;
};

export function criarApp(dados: Dados, consultarCep: ConsultarCep = consultarViaCep) {
  const app = new OpenAPIHono({
    defaultHook: (resultado, c) => {
      if (!resultado.success) return c.json({ erro: "parâmetro inválido", campos: resultado.error.issues.map((i) => i.path.join(".")) }, 400);
    },
  });

  const cache = (c: Context, politica: string) => {
    const etag = `"${dados.versao}-${createHash("sha1").update(c.req.url.replace(/^[^?]*?\/\/[^/]+/, "")).digest("base64url").slice(0, 12)}"`;
    c.header("ETag", etag);
    c.header("Cache-Control", politica);
    return c.req.header("if-none-match") === etag;
  };

  app.use(compress());
  app.get("/health", (c) => c.json({ status: "ok" }));

  const rotas = app
    .openapi(rotaZonas, async (c) => {
      if (cache(c, CACHE_CURTO)) return c.body(null, 304);
      return c.json(await dados.zonas(filtrosDaConsulta(c.req.valid("query"))), 200);
    })
    .openapi(rotaGeometria, (c) => {
      if (cache(c, CACHE_LONGO)) return c.body(null, 304);
      return c.json(dados.geometria, 200);
    })
    .openapi(rotaArea, async (c) => {
      const { h3 } = c.req.valid("param");
      if (!isValidCell(h3) || getResolution(h3) !== RESOLUCAO_H3) return c.json({ erro: "célula inválida", campos: ["h3"] }, 400);
      if (cache(c, CACHE_CURTO)) return c.body(null, 304);
      return c.json(await dados.area(h3, filtrosDaConsulta(c.req.valid("query"))), 200);
    })
    .openapi(rotaRua, async (c) => {
      const { nome, celulas, ...filtro } = c.req.valid("query");
      if (cache(c, CACHE_CURTO)) return c.body(null, 304);
      return c.json(await dados.rua(nome, filtrosDaConsulta(filtro), celulas?.split(",") ?? []), 200);
    })
    .openapi(rotaCep, async (c) => {
      const { cep } = c.req.valid("param");
      const resposta = await consultarCep(cep).catch(() => null);
      if (!resposta) return c.json({ erro: "serviço de CEP indisponível" }, 502);
      if (resposta.erro) return c.json({ erro: "CEP não encontrado" }, 404);
      c.header("Cache-Control", CACHE_LONGO);
      return c.json({ cep, logradouro: resposta.logradouro || null, bairro: resposta.bairro || null, emSaoPaulo: resposta.localidade === "São Paulo" && resposta.uf === "SP" }, 200);
    })
    .openapi(rotaModelos, async (c) => {
      if (cache(c, CACHE_CURTO)) return c.body(null, 304);
      return c.json(await dados.modelos(c.req.valid("query").veiculo), 200);
    })
    .openapi(rotaRanking, async (c) => {
      const { veiculo, tipo, limite } = c.req.valid("query");
      if (cache(c, CACHE_CURTO)) return c.body(null, 304);
      return c.json(await dados.ranking(veiculo, filtrosDaConsulta({ ...(tipo ? { tipo } : {}) }).tiposOcorrencia, limite), 200);
    })
    .openapi(rotaModelo, async (c) => {
      const { veiculo, familia } = c.req.valid("query");
      const resposta = await dados.modelo(veiculo, familia);
      if (!resposta) return c.json({ erro: "modelo sem registros" }, 404);
      if (cache(c, CACHE_CURTO)) return c.body(null, 304);
      return c.json(resposta, 200);
    })
    .openapi(rotaSobre, (c) => {
      if (cache(c, CACHE_CURTO)) return c.body(null, 304);
      return c.json(dados.sobre, 200);
    });

  app.doc31("/openapi.json", { openapi: "3.1.0", info: { title: "BFF · Ocorrências de veículos em SP", version: "1.0.0" } });
  app.notFound((c) => c.json({ erro: "não encontrado" }, 404));
  return rotas;
}

export type App = ReturnType<typeof criarApp>;

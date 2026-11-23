import { createHash } from "node:crypto";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  ConsultaDeFiltros,
  ConsultaDeRua,
  filtrosDaConsulta,
  RESOLUCAO_H3,
  RespostaArea,
  RespostaErro,
  RespostaGeometria,
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

const rotaSobre = createRoute({
  method: "get",
  path: "/v1/sobre",
  summary: "Fonte, período e o que ficou fora do mapa nesta release",
  responses: { ...json(RespostaSobre, "Metadados da release"), ...naoMudou },
});

export function criarApp(dados: Dados) {
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
      const { nome, ...filtro } = c.req.valid("query");
      if (cache(c, CACHE_CURTO)) return c.body(null, 304);
      return c.json(await dados.rua(nome, filtrosDaConsulta(filtro)), 200);
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

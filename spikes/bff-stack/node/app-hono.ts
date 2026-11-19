import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { CACHE_CONTROL, FiltroZonas, RespostaErro, RespostaZonas, normalizar } from "./contrato.ts";
import type { Dados } from "./dados.ts";

const rotaZonas = createRoute({
  method: "get",
  path: "/v1/zonas",
  summary: "Ocorrências registradas por área (H3) nos últimos 12 meses",
  request: { query: FiltroZonas },
  responses: {
    200: { description: "Contagem por célula", content: { "application/json": { schema: RespostaZonas } } },
    304: { description: "Não mudou desde o ETag enviado" },
    400: { description: "Filtro inválido", content: { "application/json": { schema: RespostaErro } } },
  },
});

export function criarAppHono(dados: Dados) {
  const app = new OpenAPIHono({
    defaultHook: (resultado, c) => {
      if (!resultado.success) {
        return c.json({ erro: "filtro inválido", campos: resultado.error.issues.map((i) => i.path.join(".")) }, 400);
      }
    },
  });

  const rotas = app.openapi(rotaZonas, async (c) => {
    const filtro = normalizar(c.req.valid("query"));
    const etag = dados.etag(filtro);
    c.header("ETag", etag);
    c.header("Cache-Control", CACHE_CONTROL);
    if (c.req.header("if-none-match") === etag) return c.body(null, 304);
    return c.json(await dados.zonas(filtro), 200);
  });

  app.doc31("/openapi.json", { openapi: "3.1.0", info: { title: "BFF — mapa de roubo e furto de veículos", version: "0.0.0" } });
  return rotas;
}

export type AppHono = ReturnType<typeof criarAppHono>;

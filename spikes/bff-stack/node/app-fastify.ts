import swagger from "@fastify/swagger";
import Fastify, { type FastifyError } from "fastify";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { CACHE_CONTROL, FiltroZonas, RespostaErro, RespostaZonas, normalizar } from "./contrato.ts";
import type { Dados } from "./dados.ts";

export async function criarAppFastify(dados: Dados) {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.setErrorHandler((erro: FastifyError, _req, reply) => {
    if (erro.validation) {
      return reply.code(400).send({ erro: "filtro inválido", campos: erro.validation.map((v: { instancePath?: string; params: unknown }) => String(v.instancePath ?? "").replace(/^\//, "") || String((v.params as { missingProperty?: string }).missingProperty ?? "")) });
    }
    return reply.code(500).send({ erro: "erro interno", campos: [] });
  });
  await app.register(swagger, {
    openapi: { openapi: "3.1.0", info: { title: "BFF — mapa de roubo e furto de veículos", version: "0.0.0" } },
    transform: jsonSchemaTransform,
  });

  app.get(
    "/v1/zonas",
    {
      schema: {
        summary: "Ocorrências registradas por área (H3) nos últimos 12 meses",
        querystring: FiltroZonas,
        response: { 200: RespostaZonas, 304: z.null().describe("Não mudou desde o ETag enviado"), 400: RespostaErro },
      },
    },
    async (req, reply) => {
      const filtro = normalizar(req.query);
      const etag = dados.etag(filtro);
      reply.header("ETag", etag).header("Cache-Control", CACHE_CONTROL);
      if (req.headers["if-none-match"] === etag) return reply.code(304).removeHeader("content-type").send(undefined as unknown as null);
      return dados.zonas(filtro);
    },
  );
  app.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());
  await app.ready();
  return app;
}

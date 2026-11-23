import { serve } from "@hono/node-server";
import { criarAppHono } from "../../bff-stack/node/app-hono.ts";
import { abrirDados } from "../../bff-stack/node/dados.ts";

const dados = await abrirDados();
const app = criarAppHono(dados);
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8080), hostname: "0.0.0.0" }, () =>
  console.log(JSON.stringify({ pronto: Math.round(performance.now()), rssMB: Math.round(process.memoryUsage().rss / 2 ** 20) })),
);

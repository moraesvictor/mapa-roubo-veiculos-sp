import type { AddressInfo } from "node:net";
import { serve, type ServerType } from "@hono/node-server";
import { criarAppFastify } from "./app-fastify.ts";
import { criarAppHono } from "./app-hono.ts";
import { abrirDados } from "./dados.ts";

export interface Servidor {
  nome: string;
  base: string;
  parar: () => Promise<void>;
}

export async function subirHono(): Promise<Servidor> {
  const dados = await abrirDados();
  const app = criarAppHono(dados);
  const servidor: ServerType = await new Promise((ok) => {
    const s = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, () => ok(s));
  });
  const porta = (servidor.address() as AddressInfo).port;
  return {
    nome: "hono",
    base: `http://127.0.0.1:${porta}`,
    parar: () => new Promise<void>((ok) => servidor.close(() => (dados.fechar(), ok()))),
  };
}

export async function subirFastify(): Promise<Servidor> {
  const dados = await abrirDados();
  const app = await criarAppFastify(dados);
  const base = await app.listen({ port: 0, host: "127.0.0.1" });
  return { nome: "fastify", base, parar: async () => (await app.close(), dados.fechar()) };
}

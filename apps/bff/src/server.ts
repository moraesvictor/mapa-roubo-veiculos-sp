import { serve } from "@hono/node-server";
import { criarApp } from "./app.ts";
import { abrirDados } from "./dados.ts";

const porta = Number(process.env.PORT ?? 3001);
const arquivo = process.env.DADOS ?? new URL("../../../data/tmp/pipeline/mapa.duckdb", import.meta.url).pathname;

const dados = await abrirDados(arquivo);
serve({ fetch: criarApp(dados).fetch, port: porta }, () => {
  console.log(`BFF ouvindo em http://localhost:${porta} (dados: ${dados.sobre.desde} a ${dados.sobre.atualizadoAte})`);
});

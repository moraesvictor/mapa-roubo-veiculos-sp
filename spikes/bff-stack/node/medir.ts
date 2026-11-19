import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import autocannon from "autocannon";
import { subirFastify, subirHono, type Servidor } from "./servidores.ts";

const DURACAO = Number(process.env.DURACAO ?? 10);
const CONEXOES = 50;
const caminho = "/v1/zonas?veiculo=moto&periodo=noite,madrugada&dia=dia-util";

function dependencias(pacotes: string[]) {
  const vistos = new Set<string>();
  const andar = (nome: string, nodeModules: string) => {
    const dir = realpathSync(join(nodeModules, nome));
    const chave = dir;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
    const irmaos = dir.slice(0, dir.lastIndexOf("node_modules") + "node_modules".length);
    for (const dep of Object.keys(pkg.dependencies ?? {})) andar(dep, irmaos);
  };
  const raiz = fileURLToPath(new URL("node_modules", import.meta.url));
  for (const p of pacotes) andar(p, raiz);
  return vistos.size;
}

async function carga(s: Servidor, headers: Record<string, string> = {}) {
  const r = await autocannon({ url: s.base + caminho, connections: CONEXOES, duration: DURACAO, headers });
  return { reqPorSeg: Math.round(r.requests.average), latenciaP50Ms: r.latency.p50, latenciaP99Ms: r.latency.p99, erros: r.errors + r.non2xx - (headers["if-none-match"] ? r.non2xx : 0) };
}

const resultado: Record<string, unknown> = {
  dependenciasDeProducao: {
    hono: dependencias(["hono", "@hono/node-server", "@hono/zod-openapi", "zod"]),
    fastify: dependencias(["fastify", "fastify-type-provider-zod", "@fastify/swagger", "zod"]),
  },
};

for (const subir of [subirHono, subirFastify, subirHono, subirFastify]) {
  const s = await subir();
  await carga(s);
  const semCache = await carga(s);
  const etag = (await fetch(s.base + caminho)).headers.get("etag")!;
  const comEtag = await carga(s, { "if-none-match": etag });
  await s.parar();
  const chave = `${s.nome}`;
  const anteriores = (resultado[chave] as unknown[] | undefined) ?? [];
  resultado[chave] = [...anteriores, { consultaNoDuckdb: semCache, respostaComEtag304: comEtag }];
}

console.log(JSON.stringify(resultado, null, 2));

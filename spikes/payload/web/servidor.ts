import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, normalize } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { calcularTudo, chave, comoGeoJson, geometria } from "./dados.ts";

const PORTA = Number(process.env.PORTA ?? 4180);
const dist = new URL("./dist/", import.meta.url);
const { respostas, base } = await calcularTudo();
const geometriaJson = JSON.stringify(geometria(base));
const tipos: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };
const comprimidos = new Map<string, { br: Buffer; gzip: Buffer }>();

const comprimir = (id: string, corpo: string | Buffer) => {
  let c = comprimidos.get(id);
  if (!c) comprimidos.set(id, (c = { br: brotliCompressSync(corpo), gzip: gzipSync(corpo) }));
  return c;
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const aceita = String(req.headers["accept-encoding"] ?? "");
  const enviar = (id: string, corpo: string | Buffer, tipo: string, cache: string) => {
    const c = comprimir(id, corpo);
    const [codificacao, dados] = aceita.includes("br") ? ["br", c.br] : aceita.includes("gzip") ? ["gzip", c.gzip] : [null, Buffer.from(corpo)];
    res.writeHead(200, { "content-type": tipo, "cache-control": cache, vary: "accept-encoding", ...(codificacao ? { "content-encoding": codificacao } : {}) });
    res.end(dados);
  };
  if (url.pathname === "/api/zonas" || url.pathname === "/api/zonas.geojson") {
    const k = chave(url.searchParams);
    const r = respostas.get(k)!;
    const geo = url.pathname.endsWith(".geojson");
    return enviar(`${url.pathname}?${k}`, JSON.stringify(geo ? comoGeoJson(r) : r), "application/json", "public, max-age=3600");
  }
  if (url.pathname === "/api/geometria") return enviar("geometria", geometriaJson, "application/json", "public, max-age=86400");
  const caminho = normalize(url.pathname === "/" ? "/h3.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
  try {
    const corpo = await readFile(new URL(`.${caminho}`, dist));
    enviar(caminho, corpo, tipos[extname(caminho)] ?? "application/octet-stream", caminho.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORTA, "127.0.0.1", () => console.log(`pronto em http://localhost:${PORTA}`));

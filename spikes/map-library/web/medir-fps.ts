import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:4173";
const RODADAS = Number(process.env.RODADAS ?? 3);
const PAGINAS = ["maplibre.html?sem-zonas", "maplibre.html", "deckgl.html"];
const PORTA = 9333;

const perfil = await mkdtemp(join(tmpdir(), "spike-mapa-"));
const MODO = process.env.MODO ?? "janela";
const flagsModo = MODO === "software" ? ["--headless=new", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"] : ["--new-window", "--start-maximized"];
const chrome = spawn("google-chrome", [
  ...flagsModo,
  `--remote-debugging-port=${PORTA}`,
  `--user-data-dir=${perfil}`,
  "--window-size=1440,900",
  "--ignore-gpu-blocklist",
  "--no-first-run",
  "about:blank",
], { stdio: "ignore" });

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function esperarChrome() {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORTA}/json/version`);
      return;
    } catch {
      await esperar(200);
    }
  }
  throw new Error("Chrome não respondeu");
}

async function novaAba(url: string) {
  const aba = (await (await fetch(`http://127.0.0.1:${PORTA}/json/new?${encodeURIComponent(url)}`, { method: "PUT" })).json()) as { id: string; webSocketDebuggerUrl: string };
  await fetch(`http://127.0.0.1:${PORTA}/json/activate/${aba.id}`);
  return aba;
}

async function conectar(url: string) {
  const ws = new WebSocket(url);
  await new Promise((ok, erro) => {
    ws.addEventListener("open", ok, { once: true });
    ws.addEventListener("error", erro, { once: true });
  });
  let proximoId = 0;
  const pendentes = new Map<number, (r: unknown) => void>();
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(String(e.data)) as { id?: number; result?: unknown };
    if (msg.id && pendentes.has(msg.id)) pendentes.get(msg.id)!(msg.result);
  });
  const cdp = (method: string, params: object = {}) =>
    Promise.race([
      new Promise<{ result?: { value?: unknown } }>((ok) => {
        const id = ++proximoId;
        pendentes.set(id, ok as (r: unknown) => void);
        ws.send(JSON.stringify({ id, method, params }));
      }),
      esperar(5000).then(() => ({}) as { result?: { value?: unknown } }),
    ]);
  const avaliar = async (expr: string) => (await cdp("Runtime.evaluate", { expression: expr, returnByValue: true })).result?.value;
  return { ws, cdp, avaliar };
}

async function abrir(url: string) {
  const aba = await novaAba(url);
  const c = await conectar(aba.webSocketDebuggerUrl);
  return { ...c, fechar: async () => {
    c.ws.close();
    await fetch(`http://127.0.0.1:${PORTA}/json/close/${aba.id}`);
  } };
}

await esperarChrome();
const inicio = await abrir(`${BASE}/index.html`);
await esperar(1500);
const gpu = await inicio.avaliar(`(() => { const gl = document.createElement('canvas').getContext('webgl2'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'sem webgl2'; })()`);
console.log(JSON.stringify({ modo: MODO, gpu }));
await inicio.fechar();

for (let r = 1; r <= RODADAS; r++) {
  for (const p of PAGINAS) {
    const c = await abrir(`${BASE}/${p}${p.includes("?") ? "&" : "?"}r=${r}`);
    let resultado: unknown = null;
    for (let t = 0; t < 60 && !resultado; t++) {
      await esperar(500);
      resultado = await c.avaliar("window.__resultado ?? null");
    }
    await c.fechar();
    console.log(JSON.stringify({ rodada: r, pagina: p, ...((resultado as object) ?? { erro: "sem resultado em 30 s" }) }));
  }
}

chrome.kill();
await new Promise((ok) => chrome.once("exit", ok));
await rm(perfil, { recursive: true, force: true, maxRetries: 5 });

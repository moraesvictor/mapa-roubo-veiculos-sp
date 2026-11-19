import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:4180";
const RODADAS = Number(process.env.RODADAS ?? 3);
const VARIANTES = ["h3", "geojson", "estado"];
const TROCAS = ["veiculo=moto", "veiculo=moto&dia=fim-de-semana&periodo=madrugada,noite"];
const PERFIS = [
  { nome: "4G lento", rede: { latency: 562.5, downloadThroughput: (1.6e6 / 8) * 0.9, uploadThroughput: (750e3 / 8) * 0.9 }, cpu: 4 },
  { nome: "sem limite", rede: null, cpu: 1 },
];
const PORTA = 9334;

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const perfil = await mkdtemp(join(tmpdir(), "spike-payload-"));
const chrome = spawn("google-chrome", ["--new-window", `--remote-debugging-port=${PORTA}`, `--user-data-dir=${perfil}`, "--window-size=1440,900", "--no-first-run", "about:blank"], { stdio: "ignore" });

for (let i = 0; i < 50; i++) {
  try {
    await fetch(`http://127.0.0.1:${PORTA}/json/version`);
    break;
  } catch {
    await esperar(200);
  }
}

type Evento = { method: string; params: Record<string, unknown>; sessionId?: string };
type Perfil = (typeof PERFIS)[number];

async function abrirAba(p: Perfil) {
  const aba = (await (await fetch(`http://127.0.0.1:${PORTA}/json/new?about:blank`, { method: "PUT" })).json()) as { id: string; webSocketDebuggerUrl: string };
  await fetch(`http://127.0.0.1:${PORTA}/json/activate/${aba.id}`);
  const ws = new WebSocket(aba.webSocketDebuggerUrl);
  await new Promise((ok, erro) => {
    ws.addEventListener("open", ok, { once: true });
    ws.addEventListener("error", erro, { once: true });
  });
  let proximo = 0;
  const pendentes = new Map<number, (r: unknown) => void>();
  const eventos: Evento[] = [];
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(String(e.data)) as { id?: number; result?: unknown } & Evento;
    if (msg.id && pendentes.has(msg.id)) pendentes.get(msg.id)!(msg.result);
    else if (msg.method === "Target.attachedToTarget") void prepararWorker(msg.params.sessionId as string);
    else if (msg.method) eventos.push(msg);
  });
  const cdp = (method: string, params: object = {}, sessionId?: string) =>
    Promise.race([
      new Promise<{ result?: { value?: unknown } }>((ok) => {
        const id = ++proximo;
        pendentes.set(id, ok as (r: unknown) => void);
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      }),
      esperar(90_000).then(() => ({}) as { result?: { value?: unknown } }),
    ]);
  const throttling = async (sessionId?: string) => {
    await cdp("Network.enable", {}, sessionId);
    if (p.rede) await cdp("Network.emulateNetworkConditions", { offline: false, ...p.rede }, sessionId);
  };
  const prepararWorker = async (sessionId: string) => {
    await throttling(sessionId);
    await cdp("Runtime.runIfWaitingForDebugger", {}, sessionId);
  };
  await throttling();
  await cdp("Page.enable");
  await cdp("Network.clearBrowserCache");
  await cdp("Emulation.setCPUThrottlingRate", { rate: p.cpu });
  await cdp("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true });
  const avaliar = async (expressao: string) => (await cdp("Runtime.evaluate", { expression: expressao, returnByValue: true, awaitPromise: true })).result?.value;
  const fechar = async () => {
    ws.close();
    await fetch(`http://127.0.0.1:${PORTA}/json/close/${aba.id}`);
  };
  return { cdp, avaliar, eventos, fechar };
}

const categoria = (url: string) =>
  url.includes("/api/") ? "dados" : url.startsWith(BASE) ? (/\.(m?js)$/.test(new URL(url).pathname) ? "js" : "html/css") : url.includes("openfreemap") ? "mapaBase" : "outros";

function bytesPor(eventos: Evento[]) {
  const urls = new Map<string, string>();
  const doCache = new Set<string>();
  const total: Record<string, number> = {};
  for (const e of eventos) {
    const id = `${e.sessionId ?? ""}:${e.params.requestId as string}`;
    if (e.method === "Network.responseReceived") urls.set(id, (e.params.response as { url: string }).url);
    if (e.method === "Network.requestServedFromCache") doCache.add(id);
    if (e.method === "Network.loadingFinished" && urls.has(id) && !doCache.has(id)) {
      const c = categoria(urls.get(id)!);
      total[c] = (total[c] ?? 0) + (e.params.encodedDataLength as number);
    }
  }
  return Object.fromEntries(Object.entries(total).map(([k, v]) => [k, Math.round(v / 1024)]));
}

async function carregar(aba: Awaited<ReturnType<typeof abrirAba>>, url: string) {
  aba.eventos.length = 0;
  await aba.cdp("Page.navigate", { url });
  let resultado: Record<string, unknown> | null = null;
  for (let t = 0; t < 180 && !resultado; t++) {
    await esperar(500);
    resultado = (await aba.avaliar("window.__resultado ?? null")) as Record<string, unknown> | null;
  }
  if (!resultado) return { erro: "sem resultado em 90 s" };
  const trocas = [];
  for (const busca of TROCAS) trocas.push(await aba.avaliar(`window.__trocar(${JSON.stringify(busca)})`));
  await esperar(300);
  return { ...resultado, trocasMs: trocas, kB: bytesPor(aba.eventos) };
}

for (let r = 1; r <= RODADAS; r++)
  for (const p of PERFIS)
    for (const v of VARIANTES) {
      const aba = await abrirAba(p);
      const frio = await carregar(aba, `${BASE}/${v}.html?r=${r}`);
      const quente = await carregar(aba, `${BASE}/${v}.html?r=${r}&visita=2`);
      await aba.fechar();
      console.log(JSON.stringify({ rodada: r, perfil: p.nome, variante: v, frio, quente }));
    }

chrome.kill();
await new Promise((ok) => chrome.once("exit", ok));
await rm(perfil, { recursive: true, force: true, maxRetries: 5 });

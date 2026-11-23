import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buscarZonas, chaveDaCopia } from "./fallback.ts";

type Modo = "ok" | "erro" | "lento";
let modo: Modo = "ok";
const subir = (tratar: Parameters<typeof createServer>[1]) =>
  new Promise<Server>((ok) => {
    const s = createServer(tratar).listen(0, "127.0.0.1", () => ok(s));
  });
const base = (s: Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`;

let bff: Server;
let copia: Server;
let pedidosDaCopia: string[] = [];

beforeAll(async () => {
  bff = await subir((_, res) => {
    if (modo === "erro") return void res.writeHead(503).end();
    if (modo === "lento") return void setTimeout(() => res.end("{}"), 1000);
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ fonte: "bff" }));
  });
  copia = await subir((req, res) => {
    pedidosDaCopia.push(decodeURIComponent(req.url!));
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ fonte: "copia" }));
  });
});
afterAll(() => {
  bff.close();
  copia.close();
});

const opcoes = () => ({ bff: base(bff), copia: base(copia), limiteMs: 200 });
const busca = new URLSearchParams("veiculo=moto&periodo=noite,madrugada");

describe("plano de queda do BFF", () => {
  it("usa o BFF quando ele responde", async () => {
    modo = "ok";
    expect(await buscarZonas(busca, opcoes())).toEqual({ origem: "bff", dados: { fonte: "bff" } });
  });

  it.each<Modo>(["erro", "lento"])("cai pra cópia estática quando o BFF está %s", async (m) => {
    modo = m;
    pedidosDaCopia = [];
    expect(await buscarZonas(busca, opcoes())).toEqual({ origem: "copia", dados: { fonte: "copia" } });
    expect(pedidosDaCopia).toEqual(["/moto_furto,roubo_dia-util,fim-de-semana_madrugada,noite.json"]);
  });

  it("cai pra cópia quando o BFF nem existe", async () => {
    const r = await buscarZonas(busca, { ...opcoes(), bff: "http://127.0.0.1:1" });
    expect(r.origem).toBe("copia");
  });

  it("gera a mesma chave pra filtros equivalentes", () => {
    expect(chaveDaCopia(new URLSearchParams("periodo=noite,madrugada,noite&veiculo=moto,xyz"))).toBe(chaveDaCopia(busca));
    expect(chaveDaCopia(new URLSearchParams())).toBe("carro,moto_furto,roubo_dia-util,fim-de-semana_hora-incerta,madrugada,manha,noite,tarde");
  });
});

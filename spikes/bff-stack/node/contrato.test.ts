import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { subirFastify, subirHono, type Servidor } from "./servidores.ts";

const servidores: Servidor[] = [];

beforeAll(async () => {
  servidores.push(await subirHono(), await subirFastify());
});
afterAll(async () => {
  await Promise.all(servidores.map((s) => s.parar()));
});

const filtro = "/v1/zonas?veiculo=moto&periodo=noite,madrugada&dia=dia-util";

describe.each(["hono", "fastify"])("%s", (nome) => {
  const s = () => servidores.find((x) => x.nome === nome)!;

  it("devolve zonas válidas com cache longo e ETag", async () => {
    const res = await fetch(s().base + filtro);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("max-age=3600");
    expect(res.headers.get("etag")).toMatch(/^"\d{4}-\d{2}-\d{2}-/);
    const corpo = (await res.json()) as { total: number; celulas: unknown[] };
    expect(corpo.total).toBeGreaterThan(0);
    expect(corpo.celulas[0]).toEqual({ h3: expect.any(String), n: expect.any(Number) });
  });

  it("responde 304 quando o ETag não mudou", async () => {
    const etag = (await fetch(s().base + filtro)).headers.get("etag")!;
    const res = await fetch(s().base + filtro, { headers: { "if-none-match": etag } });
    expect(res.status).toBe(304);
    expect(["0", null]).toContain(res.headers.get("content-length"));
  });

  it("recusa filtro fora do contrato com 400 e diz o campo", async () => {
    const res = await fetch(`${s().base}/v1/zonas?veiculo=aviao`);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { campos: string[] }).campos.join()).toContain("veiculo");
  });

  it("publica o OpenAPI gerado do mesmo schema zod", async () => {
    const doc = (await (await fetch(`${s().base}/openapi.json`)).json()) as { paths: Record<string, { get: { parameters: { name: string }[] } }> };
    expect(Object.keys(doc.paths)).toContain("/v1/zonas");
    const params = doc.paths["/v1/zonas"]?.get.parameters.map((p) => p.name).sort();
    expect(params).toEqual(["dia", "periodo", "tipo", "veiculo"]);
  });
});

it("as duas implementações devolvem exatamente o mesmo resultado", async () => {
  const [a, b] = await Promise.all(servidores.map(async (s) => (await fetch(s.base + filtro)).json()));
  expect(a).toEqual(b);
});

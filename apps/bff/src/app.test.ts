import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Filtros } from "@mapa/core";
import { criarServidor } from "./app.ts";

const servidor = criarServidor();
let base = "";

beforeAll(async () => {
  await new Promise<void>((ok) => servidor.listen(0, ok));
  base = `http://localhost:${(servidor.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((ok) => servidor.close(() => ok())));

describe("BFF", () => {
  it("responde o health check", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("expõe os filtros padrão do core", async () => {
    const res = await fetch(`${base}/v1/filtros`);
    const corpo = (await res.json()) as Filtros;
    expect(corpo.tiposVeiculo).toEqual(["carro", "moto"]);
  });

  it("devolve 404 pra rota desconhecida", async () => {
    expect((await fetch(`${base}/nada`)).status).toBe(404);
  });
});

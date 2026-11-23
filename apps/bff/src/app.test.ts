import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RespostaArea, RespostaCep, RespostaRua, RespostaSobre, RespostaZonas, type Ocorrencia } from "@mapa/core";
import { carregar } from "@mapa/pipeline/carregar";
import { calcularZonas, janelaDe12Meses } from "@mapa/pipeline/zonas";
import { cellToLatLng, gridDisk, latLngToCell } from "h3-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp, type App } from "./app.ts";
import { abrirDados, type Dados } from "./dados.ts";

const CENTRO = latLngToCell(-23.5614, -46.6558, 8);
const [lat, lon] = cellToLatLng(CENTRO);
const AO_NORTE = latLngToCell(lat + 0.012, lon, 8);
const vizinhas = gridDisk(CENTRO, 4).filter((c) => c !== CENTRO && c !== AO_NORTE);

function ocorrencia(h3: string, extra: Partial<Ocorrencia> = {}): Ocorrencia {
  return {
    tipo: "furto",
    veiculo: "moto",
    familia: "HONDA CG 160",
    data: "2026-06-15",
    tipo_dia: "dia-util",
    periodo: "noite",
    periodo_origem: "calculado",
    hora: 20,
    h3,
    tipo_local: "via-publica",
    rua: "AVENIDA PAULISTA",
    local_confiavel: true,
    ...extra,
  };
}

const repetir = (n: number, f: () => Ocorrencia) => Array.from({ length: n }, f);
const dados: Ocorrencia[] = [
  ...vizinhas.flatMap((c, i) => repetir(1 + (i % 3), () => ocorrencia(c, { veiculo: "carro", rua: "RUA AUGUSTA" }))),
  ...repetir(150, () => ocorrencia(CENTRO)),
  ...repetir(8, () => ocorrencia(CENTRO, { periodo: "madrugada", tipo_local: "estacionamento" })),
  ...repetir(3, () => ocorrencia(CENTRO, { periodo: "manha" })),
  ...repetir(12, () => ocorrencia(AO_NORTE)),
  ...repetir(40, () => ocorrencia(CENTRO, { local_confiavel: false, rua: "PRACA DO LOTE" })),
  ...repetir(2, () => ocorrencia(CENTRO, { rua: "RUA RARA" })),
];

let pasta = "";
let base: Dados;
let app: App;

beforeAll(async () => {
  pasta = await mkdtemp(join(tmpdir(), "bff-"));
  const arquivo = join(pasta, "mapa.duckdb");
  const janela = janelaDe12Meses(dados);
  await carregar(arquivo, pasta, dados, calcularZonas(dados, janela), {
    fonte: "teste",
    janela,
    processadoEm: "2026-11-23T12:00:00Z",
    versaoDoPipeline: "0.0.0",
    extracao: {
      arquivos: [],
      descartados: { "fora-da-capital": 0, "nao-subtracao": 0, "fora-da-d4": 0, "sem-data": 0, duplicado: 0 },
      ocorrencias: dados.length,
      periodo: { de: "2026-06-15", ate: "2026-06-15" },
      coordenada: { valida: dados.length, zerada: 0, "nao-numerica": 0, "fora-de-sp": 0, vedada: 0 },
      periodoOrigem: { calculado: dados.length, ssp: 0, horaIncerta: 0 },
      lotes: { grupos: 1, registros: 40 },
      foraDoMapa: 40,
      familias: { distintas: 1, modeloNaoIdentificado: 0 },
    },
  });
  base = await abrirDados(arquivo);
  app = criarApp(base, async (cep) => {
    if (cep === "01310200") return { logradouro: "Avenida Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP" };
    if (cep === "13010000") return { logradouro: "Rua X", bairro: "Centro", localidade: "Campinas", uf: "SP" };
    if (cep === "99999999") return { erro: "true" };
    throw new Error("fora do ar");
  });
});

afterAll(async () => {
  base.fechar();
  await rm(pasta, { recursive: true, force: true });
});

const get = (caminho: string, headers: Record<string, string> = {}) => app.request(caminho, { headers });

describe("BFF", () => {
  it("health", async () => {
    expect(await (await get("/health")).json()).toEqual({ status: "ok" });
  });

  it("zonas: contrato válido, centro é zona, lotes fora, k respeitado", async () => {
    const res = await get("/v1/zonas");
    expect(res.status).toBe(200);
    const corpo = RespostaZonas.parse(await res.json());
    expect(corpo.total).toBe(dados.length - 40);
    expect(corpo.celulas.find(([h3]) => h3 === CENTRO)).toEqual([CENTRO, 163, true]);
    expect(corpo.celulas.every(([, n]) => n >= 5)).toBe(true);
  });

  it("zonas: filtro com poucos registros não tem zonas", async () => {
    const corpo = RespostaZonas.parse(await (await get("/v1/zonas?veiculo=carro")).json());
    expect(corpo.poucosRegistros).toBe(true);
    expect(corpo.celulas.some(([, , zona]) => zona)).toBe(false);
  });

  it("zonas: mesma resposta em qualquer ordem dos valores, com ETag e 304", async () => {
    const a = await get("/v1/zonas?periodo=noite,madrugada");
    const b = await get("/v1/zonas?periodo=madrugada,noite");
    expect(await a.json()).toEqual(await b.json());
    expect(a.headers.get("cache-control")).toContain("max-age=3600");
    const etag = a.headers.get("etag") ?? "";
    expect((await get("/v1/zonas?periodo=noite,madrugada", { "if-none-match": etag })).status).toBe(304);
  });

  it("zonas: valor inválido dá 400 com o campo", async () => {
    const res = await get("/v1/zonas?veiculo=bicicleta");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ erro: "parâmetro inválido", campos: ["veiculo"] });
  });

  it("geometria: um polígono por célula do filtro completo, cache longo", async () => {
    const res = await get("/v1/geometria");
    const corpo = (await res.json()) as { features: { id: string; geometry: { coordinates: number[][][] } }[] };
    expect(res.headers.get("cache-control")).toContain("max-age=86400");
    const zonas = RespostaZonas.parse(await (await get("/v1/zonas")).json());
    expect(corpo.features.map((f) => f.id).sort()).toEqual(zonas.celulas.map(([h3]) => h3).sort());
    expect(corpo.features[0]?.geometry.coordinates[0]?.length).toBe(7);
  });

  it("área: total, períodos (sem o filtro de período), tipo de local, arredores e k", async () => {
    const corpo = RespostaArea.parse(await (await get(`/v1/area/${CENTRO}?periodo=noite`)).json());
    expect(corpo.total).toBe(152);
    expect(corpo.zona).toBe(true);
    expect(corpo.porPeriodo).toEqual({ madrugada: 8, manha: null, tarde: null, noite: 152, "hora-incerta": null });
    expect(corpo.porTipoDeLocal).toEqual({ "via-publica": 152, estacionamento: null, outros: null });
    expect(corpo.arredores.find((a) => a.direcao === "norte")?.total).toBeGreaterThanOrEqual(12);
  });

  it("área: célula inválida ou de outra resolução dá 400", async () => {
    expect((await get("/v1/area/nao-e-h3")).status).toBe(400);
    expect((await get(`/v1/area/${latLngToCell(-23.56, -46.65, 9)}`)).status).toBe(400);
  });

  it("rua: total com filtros, sem lote, e menos de 5 vira null", async () => {
    const paulista = RespostaRua.parse(await (await get("/v1/rua?nome=Avenida%20Paulista&veiculo=moto")).json());
    expect(paulista.total).toBe(150 + 8 + 3 + 12);
    expect(RespostaRua.parse(await (await get("/v1/rua?nome=Praça%20do%20Lote")).json()).total).toBeNull();
    expect(RespostaRua.parse(await (await get("/v1/rua?nome=Rua%20Rara")).json()).total).toBeNull();
    expect((await get("/v1/rua?nome=ab")).status).toBe(400);
  });

  it("rua: com as células do trecho, conta só ali e no entorno", async () => {
    const longe = RespostaRua.parse(await (await get(`/v1/rua?nome=Rua%20Augusta&celulas=${latLngToCell(-23.7, -46.75, 8)}`)).json());
    expect(longe.total).toBeNull();
    const perto = RespostaRua.parse(await (await get(`/v1/rua?nome=Rua%20Augusta&celulas=${CENTRO}`)).json());
    expect(perto.total).toBeGreaterThanOrEqual(5);
    expect((await get("/v1/rua?nome=Rua%20Augusta&celulas=xyz")).status).toBe(400);
  });

  it("cep: rua e bairro, se é em SP, 404 e 502", async () => {
    expect(RespostaCep.parse(await (await get("/v1/cep/01310200")).json())).toEqual({ cep: "01310200", logradouro: "Avenida Paulista", bairro: "Bela Vista", emSaoPaulo: true });
    expect(RespostaCep.parse(await (await get("/v1/cep/13010000")).json()).emSaoPaulo).toBe(false);
    expect((await get("/v1/cep/99999999")).status).toBe(404);
    expect((await get("/v1/cep/12345678")).status).toBe(502);
    expect((await get("/v1/cep/0131")).status).toBe(400);
  });

  it("sobre: metadados da release", async () => {
    const corpo = RespostaSobre.parse(await (await get("/v1/sobre")).json());
    expect(corpo.foraDoMapa.lotes).toBe(40);
    expect(corpo.fonte).toBe("teste");
  });

  it("publica o OpenAPI gerado do contrato", async () => {
    const doc = (await (await get("/openapi.json")).json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths).sort()).toEqual(["/v1/area/{h3}", "/v1/cep/{cep}", "/v1/geometria", "/v1/rua", "/v1/sobre", "/v1/zonas"]);
  });

  it("404 em JSON", async () => {
    expect((await get("/nada")).status).toBe(404);
  });
});

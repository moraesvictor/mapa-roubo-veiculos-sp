import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App.tsx";
import { limparCache } from "../../dados/api.ts";
import { violacoesDeAcessibilidade } from "../../test/acessibilidade.ts";

vi.mock("../../mapa/MapaDeZonas.tsx", () => ({ default: () => <div>mapa</div> }));

const paulista = { nome: "Avenida Paulista", tipo: "rua", perto: "Bela Vista", celulas: ["88a8100c6dfffff", "88a8100c69fffff"], celula: "88a8100c6dfffff", centro: [-46.65, -23.56] };
const paulistania = { nome: "Rua Paulistânia", tipo: "rua", perto: "Vila Madalena", celulas: ["88a8100ea1fffff"], celula: "88a8100ea1fffff", centro: [-46.69, -23.55] };
const janela = { atualizadoAte: "2026-09-30", desde: "2025-10-01" };
const respostas: Record<string, unknown> = {
  "/busca/pa.json": [paulista, paulistania],
  "/api/v1/cep/01310200": { cep: "01310200", logradouro: "Avenida Paulista", bairro: "Bela Vista", emSaoPaulo: true },
  "/api/v1/cep/13010000": { cep: "13010000", logradouro: "Rua X", bairro: "Centro", emSaoPaulo: false },
  "/api/v1/geometria": { type: "FeatureCollection", features: [] },
  "/api/v1/zonas?veiculo=moto": { ...janela, total: 10079, poucosRegistros: false, celulas: [] },
  "/api/v1/area/88a8100c6dfffff?veiculo=moto": {
    ...janela,
    h3: "88a8100c6dfffff",
    zona: false,
    total: 11,
    porPeriodo: { madrugada: null, manha: null, tarde: 7, noite: null, "hora-incerta": null },
    porTipoDeLocal: { "via-publica": 11, estacionamento: null, outros: null },
    arredores: [],
  },
  "/api/v1/rua?veiculo=moto&nome=Avenida+Paulista&celulas=88a8100c6dfffff%2C88a8100c69fffff": { ...janela, nome: "Avenida Paulista", total: null },
};

beforeEach(() => {
  limparCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const corpo = respostas[url];
      return corpo ? new Response(JSON.stringify(corpo), { status: 200 }) : new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Busca de endereço", () => {
  it("sugere ruas enquanto digita, com teclado, e leva ao mapa com a área e a rua", async () => {
    const { container } = render(<App caminhoInicial="/lugar/busca?veiculo=moto" />);
    const campo = screen.getByRole("combobox", { name: "Endereço, CEP ou região" });
    await userEvent.type(campo, "av paulis");
    expect(await screen.findByRole("option", { name: /Avenida Paulista.*perto de Bela Vista/ })).toBeTruthy();
    expect(await violacoesDeAcessibilidade(container)).toEqual([]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(await screen.findByText("Perto da Avenida Paulista · área de cerca de 1 km")).toBeTruthy();
    expect(await screen.findByText("Menos de 5 ocorrências registradas, com os mesmos filtros.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Na Avenida Paulista inteira" })).toBeTruthy();
  });

  it("entende CEP via BFF e acha a rua no índice local", async () => {
    render(<App caminhoInicial="/lugar/busca" />);
    await userEvent.type(screen.getByRole("combobox"), "01310-200");
    expect(await screen.findByRole("option", { name: /Avenida Paulista/ })).toBeTruthy();
  });

  it("avisa quando o CEP é de outra cidade ou nada é encontrado", async () => {
    render(<App caminhoInicial="/lugar/busca" />);
    await userEvent.type(screen.getByRole("combobox"), "13010-000");
    expect(await screen.findByText("Esse CEP não é da cidade de São Paulo.")).toBeTruthy();
    await userEvent.clear(screen.getByRole("combobox"));
    await userEvent.type(screen.getByRole("combobox"), "rua que nao existe");
    expect(await screen.findByText(/Nada encontrado/)).toBeTruthy();
  });

  it("explica que o endereço não sai do aparelho", () => {
    render(<App caminhoInicial="/lugar/busca" />);
    expect(screen.getByText(/o endereço não é enviado/)).toBeTruthy();
  });
});

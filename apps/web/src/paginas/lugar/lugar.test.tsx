import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App.tsx";
import { limparCache } from "../../dados/api.ts";
import { violacoesDeAcessibilidade } from "../../test/acessibilidade.ts";

vi.mock("../../mapa/MapaDeZonas.tsx", () => ({
  default: ({ aoSelecionar }: { aoSelecionar: (h3: string) => void }) => (
    <button type="button" onClick={() => aoSelecionar("88a8100cc7fffff")}>
      área de teste no mapa
    </button>
  ),
}));

const janela = { atualizadoAte: "2026-09-30", desde: "2025-10-01" };
const respostas: Record<string, unknown> = {
  "/api/v1/geometria": { type: "FeatureCollection", features: [] },
  "/api/v1/zonas": { ...janela, total: 32389, poucosRegistros: false, modelo: null, celulas: [["88a8100cc7fffff", 59, true]] },
  "/api/v1/zonas?veiculo=moto": { ...janela, total: 10079, poucosRegistros: false, modelo: null, celulas: [] },
  "/api/v1/zonas?veiculo=moto&modelo=HONDA+CG+160": { ...janela, total: 3500, poucosRegistros: false, modelo: "HONDA CG 160", celulas: [["88a8100cc7fffff", 40, false]] },
  "/api/v1/zonas?veiculo=carro&periodo=madrugada": { ...janela, total: 150, poucosRegistros: true, modelo: null, celulas: [] },
  "/api/v1/area/88a8100cc7fffff?veiculo=moto": {
    ...janela,
    h3: "88a8100cc7fffff",
    zona: true,
    total: 59,
    porPeriodo: { madrugada: null, manha: 18, tarde: null, noite: 36, "hora-incerta": null },
    porTipoDeLocal: { "via-publica": 56, estacionamento: null, outros: null },
    arredores: [
      { direcao: "norte", total: 104 },
      { direcao: "leste", total: 76 },
      { direcao: "sul", total: null },
      { direcao: "oeste", total: 92 },
    ],
  },
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

describe("Lugar", () => {
  it("mostra o total da cidade com a descrição do filtro e sem violações do axe", async () => {
    const { container } = render(<App caminhoInicial="/lugar?veiculo=moto" />);
    expect(await screen.findByText("10.079 ocorrências registradas com moto, nos últimos 12 meses.")).toBeTruthy();
    expect(await violacoesDeAcessibilidade(container)).toEqual([]);
  });

  it("avisa quando o filtro tem poucos registros e não marca zonas", async () => {
    render(<App caminhoInicial="/lugar?veiculo=carro&periodo=madrugada" />);
    expect(await screen.findByText(/menos de 200/)).toBeTruthy();
  });

  it("filtro no painel muda a URL e o total", async () => {
    render(<App caminhoInicial="/lugar" />);
    await screen.findByText(/32.389 ocorrências/);
    const filtros = screen.getAllByRole("group", { name: "Veículo" })[0];
    if (!filtros) throw new Error("grupo Veículo não encontrado");
    await userEvent.click(screen.getAllByRole("button", { name: "Carro" })[0] as HTMLElement);
    expect(await screen.findByText(/10.079 ocorrências registradas com moto/)).toBeTruthy();
  });

  it("tocar numa área abre o detalhe com k e os períodos", async () => {
    render(<App caminhoInicial="/lugar?veiculo=moto" />);
    await userEvent.click(await screen.findByRole("button", { name: "área de teste no mapa" }));
    expect(await screen.findByRole("heading", { name: "59 ocorrências registradas" })).toBeTruthy();
    expect(screen.getByText("Zona de concentração com esse filtro")).toBeTruthy();
    expect(screen.getAllByText("menos de 5")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Ver como tabela/ }).getAttribute("href")).toBe("/lugar/tabela?veiculo=moto&area=88a8100cc7fffff");
  });

  it("filtra por modelo: chip removível, descrição e aviso de sem zonas", async () => {
    render(<App caminhoInicial="/lugar?veiculo=moto&modelo=HONDA%20CG%20160" />);
    expect(await screen.findByText("3.500 ocorrências registradas com Honda CG 160, nos últimos 12 meses.")).toBeTruthy();
    expect(screen.getByText(/sem marcar zonas de concentração/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remover filtro de modelo Honda CG 160" }));
    expect(await screen.findByText("10.079 ocorrências registradas com moto, nos últimos 12 meses.")).toBeTruthy();
  });

  it("dá erro amigável com tentar de novo quando a API falha", async () => {
    respostas["/api/v1/zonas?veiculo=carro"] = undefined;
    render(<App caminhoInicial="/lugar?veiculo=carro" />);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

describe("Tabela", () => {
  it("lista a área e os arredores, com menos de 5 escrito, sem violações do axe", async () => {
    const { container } = render(<App caminhoInicial="/lugar/tabela?veiculo=moto&area=88a8100cc7fffff" />);
    await waitFor(() => expect(screen.getByRole("row", { name: /Esta área \(~1 km\) 59/ })).toBeTruthy());
    expect(screen.getByRole("row", { name: /1–2 km ao sul Menos de 5/ })).toBeTruthy();
    expect(await violacoesDeAcessibilidade(container)).toEqual([]);
  });

  it("sem área mostra o total da cidade e leva pra busca, que volta pra tabela", async () => {
    const { container } = render(<App caminhoInicial="/lugar/tabela?veiculo=moto" />);
    expect(await screen.findByText("10,1 mil ocorrências registradas com local na cidade toda, com estes filtros.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Buscar endereço ou CEP/ }).getAttribute("href")).toBe("/lugar/busca?veiculo=moto&para=tabela");
    expect(await violacoesDeAcessibilidade(container)).toEqual([]);
  });
});

describe("filtros na URL", () => {
  it("um parâmetro inválido não apaga os outros filtros", async () => {
    const { lerFiltros } = await import("../../dados/useFiltros.ts");
    expect(lerFiltros(new URLSearchParams("veiculo=moto&tipo=rua")).tiposVeiculo).toEqual(["moto"]);
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App.tsx";
import { limparCache } from "../../dados/api.ts";
import { violacoesDeAcessibilidade } from "../../test/acessibilidade.ts";

const janela = { atualizadoAte: "2026-09-30", desde: "2025-10-01" };
const mensal = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((mes, i) => ({ mes, total: i === 3 ? null : 300 + i }));
const respostas: Record<string, unknown> = {
  "/api/v1/modelos?veiculo=moto": {
    ...janela,
    veiculo: "moto",
    modelos: [
      { familia: "HONDA CG 160", nome: "Honda CG 160", total: 3883 },
      { familia: "HONDA CG 150", nome: "Honda CG 150", total: 410 },
      { familia: "YAMAHA FZ 25", nome: "Yamaha FZ 25", total: 300 },
    ],
  },
  "/api/v1/modelo?veiculo=moto&familia=HONDA%20CG%20160": {
    ...janela,
    veiculo: "moto",
    familia: "HONDA CG 160",
    nome: "Honda CG 160",
    total: 3883,
    posicao: 1,
    porPeriodo: { madrugada: 847, manha: 807, tarde: 842, noite: 1332, "hora-incerta": 55 },
    mensal,
    variacao: -0.188,
  },
  "/api/v1/ranking?veiculo=moto&limite=10": {
    ...janela,
    veiculo: "moto",
    itens: [
      { posicao: 1, familia: "HONDA CG 160", nome: "Honda CG 160", total: 3883, variacao: -0.188 },
      { posicao: 2, familia: "HONDA NXR 160", nome: "Honda NXR 160", total: 386, variacao: 0.03 },
      { posicao: 3, familia: "SUZUKI X", nome: "Suzuki X", total: 7, variacao: null },
    ],
    outros: { modelos: 268, ocorrencias: 472 },
    naoIdentificado: 215,
    total: 11613,
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

describe("Meu veículo", () => {
  it("busca o modelo, sugere famílias e abre o resultado", async () => {
    const { container } = render(<App caminhoInicial="/meu-veiculo" />);
    await userEvent.type(screen.getByRole("combobox", { name: "Modelo" }), "cg 16");
    expect(await screen.findByRole("option", { name: /Honda CG 160.*3,9 mil/ })).toBeTruthy();
    expect(await violacoesDeAcessibilidade(container)).toEqual([]);
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { level: 1, name: "Honda CG 160" })).toBeTruthy();
  });

  it("resultado: destaque, posição, percentuais por período, variação e tabela com k", async () => {
    const { container } = render(<App caminhoInicial="/meu-veiculo/moto/HONDA%20CG%20160" />);
    expect(await screen.findByText("3,9 mil ocorrências registradas")).toBeTruthy();
    expect(screen.getByText("Moto mais registrada em SP")).toBeTruthy();
    expect(screen.getByText(/1º entre as motos/)).toBeTruthy();
    expect(screen.getByText("35%")).toBeTruthy();
    expect(screen.getByText("Caiu 19% em relação aos 12 meses anteriores.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver no mapa onde houve mais registros" }).getAttribute("href")).toBe("/lugar?veiculo=moto&modelo=HONDA%20CG%20160");
    await userEvent.click(screen.getByRole("button", { name: /Ver como tabela/ }));
    expect(screen.getByRole("row", { name: "jan/2026 Menos de 5" })).toBeTruthy();
    expect(await violacoesDeAcessibilidade(container)).toEqual([]);
  });

  it("modelo sem registros mostra aviso", async () => {
    render(<App caminhoInicial="/meu-veiculo/moto/NADA" />);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

describe("Ranking", () => {
  it("lista com variação, marca o seu modelo e mostra outros e não identificados", async () => {
    const { container } = render(<App caminhoInicial="/ranking?veiculo=moto&seu=HONDA%20CG%20160" />);
    expect(await screen.findAllByText("↓ caiu 19% vs. 12 meses anteriores")).toHaveLength(2);
    expect(screen.getAllByText("= estável, +3% vs. 12 meses anteriores")).toHaveLength(2);
    expect(screen.getAllByText("sem comparação com os 12 meses anteriores")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "Posição" }).getAttribute("aria-sort")).toBe("ascending");
    expect(screen.getByRole("row", { name: /1º Honda CG 160 · Seu modelo 3,9 mil/ })).toBeTruthy();
    expect(screen.getAllByText("Seu modelo")).toHaveLength(2);
    expect(screen.getByText(/268 modelos, 472 ocorrências · Modelo não identificado no boletim: 215/)).toBeTruthy();
    for (const link of screen.getAllByRole("link", { name: /Honda CG 160/ })) expect(link.getAttribute("href")).toBe("/meu-veiculo/moto/HONDA%20CG%20160");
    expect(await violacoesDeAcessibilidade(container)).toEqual([]);
  });
});

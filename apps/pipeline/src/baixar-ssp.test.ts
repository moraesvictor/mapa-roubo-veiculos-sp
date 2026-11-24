import { describe, expect, it } from "vitest";
import { arquivosDeVeiculos } from "./baixar-ssp.ts";

const indice = {
  data: [
    { nome: "Celulares subtraídos", lista: [{ periodo: "2026", arquivo: "assets/x/CelularesSubtraidos_2026.xlsx" }] },
    {
      nome: "Veículos subtraídos",
      lista: [
        { periodo: "2024", arquivo: "assets/estatistica/transparencia/baseDados/veiculosSub/VeiculosSubtraidos_2024.xlsx" },
        { periodo: "2026", arquivo: "assets/estatistica/transparencia/baseDados/veiculosSub/VeiculosSubtraidos_2026.xlsx" },
        { periodo: "2025", arquivo: "assets/estatistica/transparencia/baseDados/veiculosSub/VeiculosSubtraidos_2025.xlsx" },
        { periodo: "2023", arquivo: "assets/estatistica/transparencia/baseDados/veiculosSub/VeiculosSubtraidos_2023.xlsx" },
      ],
    },
  ],
};

describe("download pelo índice da SSP", () => {
  it("pega os anos mais recentes do grupo de veículos, com URL absoluta", () => {
    expect(arquivosDeVeiculos(indice, 3)).toEqual([
      { ano: 2026, url: "https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub/VeiculosSubtraidos_2026.xlsx" },
      { ano: 2025, url: "https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub/VeiculosSubtraidos_2025.xlsx" },
      { ano: 2024, url: "https://www.ssp.sp.gov.br/assets/estatistica/transparencia/baseDados/veiculosSub/VeiculosSubtraidos_2024.xlsx" },
    ]);
  });

  it("falha claro se o índice mudar de formato", () => {
    expect(() => arquivosDeVeiculos({ data: [] }, 3)).toThrow(/Veículos subtraídos/);
  });
});

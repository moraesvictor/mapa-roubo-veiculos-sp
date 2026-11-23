import { describe, expect, it } from "vitest";
import { chaveDoFiltro, normalizarFiltros, todasAsCombinacoes } from "./filtros.ts";

describe("chave do filtro", () => {
  it("é a mesma em qualquer ordem e sem repetição", () => {
    expect(chaveDoFiltro({ periodos: ["noite", "madrugada", "noite"], tiposVeiculo: ["moto"] })).toBe(
      chaveDoFiltro({ tiposVeiculo: ["moto"], periodos: ["madrugada", "noite"] }),
    );
  });

  it("dimensão vazia ou inválida vale como todas", () => {
    expect(chaveDoFiltro({})).toBe("carro,moto|furto,roubo|dia-util,fim-de-semana|hora-incerta,madrugada,manha,noite,tarde");
    expect(normalizarFiltros({ tiposVeiculo: ["bicicleta" as "carro"] }).tiposVeiculo).toEqual(["carro", "moto"]);
  });

  it("gera as 837 combinações, todas com chave distinta", () => {
    const combinacoes = todasAsCombinacoes();
    expect(combinacoes).toHaveLength(3 * 3 * 3 * 31);
    expect(new Set(combinacoes.map(chaveDoFiltro)).size).toBe(837);
  });
});

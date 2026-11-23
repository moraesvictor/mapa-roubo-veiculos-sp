import { describe, expect, it } from "vitest";
import { chipsAtivos, descreverFiltros, formatarContagem, niveisDaEscala } from "./texto-dos-filtros.ts";

describe("textos dos filtros", () => {
  it("descreve o filtro como no Figma", () => {
    expect(descreverFiltros({ tiposVeiculo: ["moto"], periodos: ["noite"], tiposDeDia: ["dia-util"] })).toBe("com moto, à noite, em dias úteis, nos últimos 12 meses");
    expect(descreverFiltros({})).toBe("nos últimos 12 meses");
    expect(descreverFiltros({ periodos: ["noite", "madrugada"] })).toBe("de madrugada ou à noite, nos últimos 12 meses");
  });

  it("chips só do que foi restringido", () => {
    expect(chipsAtivos({ tiposVeiculo: ["moto"], periodos: ["noite"], tiposDeDia: ["dia-util"] })).toEqual(["Moto", "Noite", "Dia útil"]);
    expect(chipsAtivos({})).toEqual([]);
  });

  it("contagem com k", () => {
    expect(formatarContagem(1234)).toBe("1.234 ocorrências registradas");
    expect(formatarContagem(null)).toBe("Menos de 5 ocorrências registradas");
  });

  it("níveis da escala por quantil, 0 a 4", () => {
    const nivel = niveisDaEscala(Array.from({ length: 100 }, (_, i) => i + 5));
    expect(nivel(5)).toBe(0);
    expect(nivel(104)).toBe(4);
    expect(nivel(60)).toBe(1);
  });
});

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

describe("modelos", () => {
  it("nome legível da família", async () => {
    const { nomeDoModelo } = await import("./texto-dos-filtros.ts");
    expect(nomeDoModelo("HONDA CG 160")).toBe("Honda CG 160");
    expect(nomeDoModelo("HYUNDAI HB20")).toBe("Hyundai HB20");
    expect(nomeDoModelo("CHEVROLET ONIX PLUS")).toBe("Chevrolet Onix Plus");
    expect(nomeDoModelo("VOLKSWAGEN T-CROSS")).toBe("Volkswagen T-Cross");
    expect(nomeDoModelo("MERCEDES-BENZ C180")).toBe("Mercedes-Benz C180");
  });

  it("variação em texto, estável abaixo de 5%", async () => {
    const { descreverVariacao } = await import("./texto-dos-filtros.ts");
    expect(descreverVariacao(0.03)).toBe("Estável: variação de 3% em relação aos 12 meses anteriores.");
    expect(descreverVariacao(-0.08)).toBe("Caiu 8% em relação aos 12 meses anteriores.");
    expect(descreverVariacao(0.12)).toBe("Subiu 12% em relação aos 12 meses anteriores.");
    expect(descreverVariacao(null)).toMatch(/Sem comparação/);
  });

  it("milhar como no Figma", async () => {
    const { formatarMilhar } = await import("./texto-dos-filtros.ts");
    expect(formatarMilhar(4612)).toBe("4,6 mil");
    expect(formatarMilhar(312)).toBe("312");
  });
});

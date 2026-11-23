import { describe, expect, it } from "vitest";
import { faixaDoPeriodo, periodoDaHora } from "./ocorrencia.ts";

describe("periodoDaHora (D23)", () => {
  it.each([
    [0, "madrugada"],
    [5, "madrugada"],
    [6, "manha"],
    [11, "manha"],
    [12, "tarde"],
    [17, "tarde"],
    [18, "noite"],
    [23, "noite"],
  ] as const)("%ih é %s", (hora, periodo) => {
    expect(periodoDaHora(hora)).toBe(periodo);
  });

  it("recusa hora fora de 0–23", () => {
    expect(() => periodoDaHora(24)).toThrow(RangeError);
    expect(() => periodoDaHora(-1)).toThrow(RangeError);
    expect(() => periodoDaHora(1.5)).toThrow(RangeError);
  });

  it("descreve a faixa pro filtro e pra página Sobre", () => {
    expect(faixaDoPeriodo("madrugada")).toBe("0h–5h59");
    expect(faixaDoPeriodo("noite")).toBe("18h–23h59");
  });
});

import { describe, expect, it } from "vitest";
import { classificarTipoVeiculo, tipoDeDia } from "./dominio.ts";

describe("classificarTipoVeiculo (D4)", () => {
  it.each([
    ["AUTOMOVEL", "carro"],
    ["Automóvel", "carro"],
    ["CAMINHONETE", "carro"],
    ["CAMIONETA", "carro"],
    ["UTILITÁRIO", "carro"],
    ["MOTOCICLO", "moto"],
    [" motoneta ", "moto"],
  ] as const)("%s vira %s", (entrada, esperado) => {
    expect(classificarTipoVeiculo(entrada)).toBe(esperado);
  });

  it.each(["CAMINHAO", "ONIBUS", "BICICLETA", ""])("%s fica de fora", (entrada) => {
    expect(classificarTipoVeiculo(entrada)).toBeNull();
  });
});

describe("tipoDeDia", () => {
  it("separa dia útil de fim de semana", () => {
    expect(tipoDeDia(new Date("2026-11-20T12:00:00Z"))).toBe("dia-util");
    expect(tipoDeDia(new Date("2026-11-21T12:00:00Z"))).toBe("fim-de-semana");
    expect(tipoDeDia(new Date("2026-11-22T12:00:00Z"))).toBe("fim-de-semana");
  });
});

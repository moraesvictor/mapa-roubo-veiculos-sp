import { gridDisk, latLngToCell } from "h3-js";
import { describe, expect, it } from "vitest";
import { criarDominio, giEstrela } from "./gi.ts";

const centro = latLngToCell(-23.55, -46.63, 9);
const area = gridDisk(centro, 12);

let semente = 7;
const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);

describe("Gi*", () => {
  it("acha o foco plantado e nada mais numa grade de ruído uniforme", () => {
    const dominio = criarDominio(area, 0);
    const foco = new Set(gridDisk(gridDisk(centro, 6)[100]!, 1));
    const x = Float64Array.from(dominio.celulas, (c) => (foco.has(c) ? 12 : Math.floor(aleatorio() * 3)));
    const r = giEstrela(dominio, x);
    const achados = dominio.celulas.filter((_, i) => r.significativoFdr[i]);
    expect(achados.length).toBeGreaterThan(0);
    expect(achados.every((c) => gridDisk(c, 1).some((v) => foco.has(v)))).toBe(true);
  });

  it("não acha nada quando tudo é igual", () => {
    const dominio = criarDominio(area, 0);
    const r = giEstrela(dominio, new Float64Array(dominio.celulas.length).fill(3));
    expect(r.significativoFdr.some(Boolean)).toBe(false);
  });

  it("o FDR é mais conservador que o corte simples de 95%", () => {
    const dominio = criarDominio(area, 0);
    const x = Float64Array.from(dominio.celulas, () => Math.floor(aleatorio() * 5));
    const r = giEstrela(dominio, x);
    const soma = (a: Uint8Array) => a.reduce((s, v) => s + v, 0);
    expect(soma(r.significativoFdr)).toBeLessThanOrEqual(soma(r.significativo95));
  });
});

import { describe, expect, it } from "vitest";
import { CORES, ESCALA_DO_MAPA, TEXTOS, variaveisCss } from "./tokens.ts";

const luminancia = (hex: string) => {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
};
const contraste = (a: string, b: string) => {
  const [la, lb] = [luminancia(a), luminancia(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

describe("tokens", () => {
  it("gera uma variável CSS por token", () => {
    const css = variaveisCss();
    for (const nome of Object.keys(CORES)) expect(css).toContain(`--cor-${nome}:`);
    for (const nome of Object.keys(TEXTOS)) expect(css).toContain(`--texto-${nome}:`);
    expect(css).toContain(`--mapa-escala-5: ${ESCALA_DO_MAPA[4]};`);
  });

  it("texto passa AA (4,5:1) nos fundos usados", () => {
    expect(contraste(CORES["texto-principal"], CORES["superficie-padrao"])).toBeGreaterThanOrEqual(4.5);
    expect(contraste(CORES["texto-secundario"], CORES["superficie-padrao"])).toBeGreaterThanOrEqual(4.5);
    expect(contraste(CORES["texto-secundario"], CORES["superficie-fundo"])).toBeGreaterThanOrEqual(4.5);
    expect(contraste(CORES["texto-invertido"], CORES["marca-principal"])).toBeGreaterThanOrEqual(4.5);
    expect(contraste(CORES["texto-principal"], CORES["superficie-nota"])).toBeGreaterThanOrEqual(4.5);
  });

  it("o último degrau da escala do mapa passa 3:1 contra o fundo do mapa (componente gráfico)", () => {
    expect(contraste(ESCALA_DO_MAPA[4], CORES["mapa-terreno"])).toBeGreaterThanOrEqual(3);
  });
});

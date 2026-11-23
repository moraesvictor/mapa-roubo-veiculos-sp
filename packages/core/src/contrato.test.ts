import { describe, expect, it } from "vitest";
import { ConsultaDeFiltros, consultaDosFiltros, filtrosDaConsulta } from "./contrato.ts";
import { chaveDoFiltro } from "./filtros.ts";

describe("contrato", () => {
  it("consulta ↔ filtros ida e volta", () => {
    const consulta = "veiculo=moto&dia=dia-util&periodo=madrugada%2Cnoite";
    const filtros = filtrosDaConsulta(ConsultaDeFiltros.parse(Object.fromEntries(new URLSearchParams(consulta))));
    expect(consultaDosFiltros(filtros)).toBe(consulta);
    expect(chaveDoFiltro(filtros)).toBe("moto|furto,roubo|dia-util|madrugada,noite");
  });

  it("filtro completo vira consulta vazia (melhor pro cache)", () => {
    expect(consultaDosFiltros({})).toBe("");
  });

  it("recusa valor fora da lista", () => {
    expect(ConsultaDeFiltros.safeParse({ veiculo: "bicicleta" }).success).toBe(false);
    expect(ConsultaDeFiltros.safeParse({ periodo: "noite,manha" }).success).toBe(true);
  });
});

import { CAMPOS_PERMITIDOS } from "@mapa/core";
import { describe, expect, it } from "vitest";
import { colunasDesconhecidas, nomeCanonico } from "./colunas.ts";
import { extrairOcorrencias, type Fonte } from "./extrair.ts";
import { dataDoExcel, garantirListaDePermissao, horaDoExcel, ruaSemNumero, tipoDeLocal } from "./transformar.ts";

const SENSIVEIS = {
  PLACA_VEICULO: "QZX9Y87",
  NUM_BO: "7654321",
  CEP: "01310-299",
  NUMERO_LOGRADOURO: "4321",
  LATITUDE: "-23.5614567123",
  LONGITUDE: "-46.6558123456",
  BAIRRO: "BAIRRO SECRETO",
  DESCR_COR_VEICULO: "Furta-cor",
  ANO_MODELO: "2019",
};

let seq = 0;
function linha(sobrescrever: Record<string, string> = {}): Map<string, string> {
  seq++;
  return new Map(
    Object.entries({
      NOME_DELEGACIA: "01º D.P. SE",
      ANO_BO: "2025",
      CONT_VEICULO: "1",
      NOME_MUNICIPIO_CIRC: "S.PAULO",
      DATA_OCORRENCIA_BO: "45659",
      HORA_OCORRENCIA: "0.77083333333333337",
      DESCR_PERIODO: "NULL",
      DESCR_TIPOLOCAL: "Via Pública",
      LOGRADOURO: "AVENIDA PAULISTA",
      DESCR_OCORRENCIA_VEICULO: "Roubado",
      DESCR_TIPO_VEICULO: "Motociclo",
      DESCR_MARCA_VEICULO: "HONDA/CG 160 FAN",
      ...SENSIVEIS,
      NUM_BO: `${SENSIVEIS.NUM_BO}${seq}`,
      ...sobrescrever,
    }),
  );
}

const fonte = (linhas: Map<string, string>[], nome = "teste.xlsx"): Fonte => ({
  nome,
  ler: async (aoLer) => {
    for (const l of linhas) aoLer(l);
    return { linhas: linhas.length };
  },
});

describe("lista de permissão (D5/D22)", () => {
  it("a saída tem exatamente os campos permitidos", async () => {
    const { ocorrencias } = await extrairOcorrencias([fonte([linha()])]);
    expect(Object.keys(ocorrencias[0] ?? {}).sort()).toEqual([...CAMPOS_PERMITIDOS].sort());
  });

  it("nenhum valor sensível aparece em lugar nenhum da saída nem dos metadados", async () => {
    const { ocorrencias, metadados } = await extrairOcorrencias([fonte([linha(), linha({ DESCR_TIPO_VEICULO: "Automovel" })])]);
    const tudo = JSON.stringify({ ocorrencias, metadados });
    for (const [campo, valor] of Object.entries(SENSIVEIS)) expect(tudo, campo).not.toContain(valor);
    expect(tudo).not.toContain("-23.56");
    expect(tudo).not.toContain("-46.65");
  });

  it("recusa registro com campo a mais", () => {
    const registro = Object.fromEntries(CAMPOS_PERMITIDOS.map((c) => [c, null]));
    expect(() => garantirListaDePermissao(registro)).not.toThrow();
    expect(() => garantirListaDePermissao({ ...registro, placa: "X" })).toThrow(/lista de permissão/);
  });
});

describe("filtros (D3, D4) e deduplicação (D2)", () => {
  it("descarta e conta cada motivo", async () => {
    const dup = linha();
    const { ocorrencias, metadados } = await extrairOcorrencias([
      fonte([
        dup,
        new Map(dup),
        linha({ NOME_MUNICIPIO_CIRC: "GUARULHOS" }),
        linha({ DESCR_OCORRENCIA_VEICULO: "Localizado" }),
        linha({ DESCR_TIPO_VEICULO: "Caminhão" }),
        linha({ DATA_OCORRENCIA_BO: "NULL" }),
      ]),
    ]);
    expect(ocorrencias).toHaveLength(1);
    expect(metadados.descartados).toEqual({ "fora-da-capital": 1, "nao-subtracao": 1, "fora-da-d4": 1, "sem-data": 1, duplicado: 1 });
  });

  it("o mesmo BO com dois veículos conta duas vezes", async () => {
    const { ocorrencias } = await extrairOcorrencias([fonte([linha({ NUM_BO: "1" }), linha({ NUM_BO: "1", CONT_VEICULO: "2" })])]);
    expect(ocorrencias).toHaveLength(2);
  });
});

describe("período (D23)", () => {
  it("usa a hora quando existe, inclusive em notação científica", () => {
    expect(horaDoExcel("0.77083333333333337")).toBe(18);
    expect(horaDoExcel("4.1666666666666664E-2")).toBe(1);
    expect(horaDoExcel("0")).toBe(0);
    expect(horaDoExcel("0.99930555555555556")).toBe(23);
    expect(horaDoExcel("NULL")).toBeNull();
  });

  it("sem hora, usa o rótulo da SSP e guarda a origem", async () => {
    const { ocorrencias, metadados } = await extrairOcorrencias([
      fonte([linha(), linha({ HORA_OCORRENCIA: "NULL", DESCR_PERIODO: "Pela manhã" }), linha({ HORA_OCORRENCIA: "NULL", DESCR_PERIODO: "Em hora incerta" })]),
    ]);
    expect(ocorrencias.map((o) => [o.periodo, o.periodo_origem, o.hora])).toEqual([
      ["noite", "calculado", 18],
      ["manha", "ssp", null],
      ["hora-incerta", "ssp", null],
    ]);
    expect(metadados.periodoOrigem).toEqual({ calculado: 1, ssp: 1, horaIncerta: 1 });
  });
});

describe("local (D6, D22)", () => {
  it("vira hexágono H3 res 8 e conta coordenadas ruins", async () => {
    const { ocorrencias, metadados } = await extrairOcorrencias([
      fonte([
        linha(),
        linha({ LATITUDE: "0", LONGITUDE: "0" }),
        linha({ LATITUDE: "NULL" }),
        linha({ LATITUDE: "-22.9", LONGITUDE: "-43.2" }),
        linha({ LOGRADOURO: "VEDAÇÃO DA DIVULGAÇÃO DOS DADOS RELATIVOS", LATITUDE: "0", LONGITUDE: "0" }),
      ]),
    ]);
    expect(ocorrencias[0]?.h3).toMatch(/^88[0-9a-f]{13}$/);
    expect(ocorrencias.slice(1).every((o) => o.h3 === null)).toBe(true);
    expect(metadados.coordenada).toEqual({ valida: 1, zerada: 1, "nao-numerica": 1, "fora-de-sp": 1, vedada: 1 });
    expect(metadados.foraDoMapa).toBe(4);
  });

  it("rua sem número, sem vedação", () => {
    expect(ruaSemNumero("Avenida Paulista, 1578")).toBe("AVENIDA PAULISTA");
    expect(ruaSemNumero("Rua  São   Jorge")).toBe("RUA SAO JORGE");
    expect(ruaSemNumero("VEDAÇÃO DA DIVULGAÇÃO DOS DADOS RELATIVOS")).toBeNull();
    expect(ruaSemNumero("NULL")).toBeNull();
    expect(ruaSemNumero("AV. PAULISTA")).toBe("AVENIDA PAULISTA");
    expect(ruaSemNumero("AV.PAULISTA")).toBe("AVENIDA PAULISTA");
    expect(ruaSemNumero("AV PAULISTA")).toBe("AVENIDA PAULISTA");
    expect(ruaSemNumero("R. AUGUSTA")).toBe("RUA AUGUSTA");
    expect(ruaSemNumero("RUA: AUGUSTA")).toBe("RUA AUGUSTA");
    expect(ruaSemNumero("AVENIDA AVANHANDAVA")).toBe("AVENIDA AVANHANDAVA");
    expect(ruaSemNumero("RUA RIO BRANCO")).toBe("RUA RIO BRANCO");
  });

  it("tipo de local em 3 grupos, residência escondida em outros", () => {
    expect(tipoDeLocal("Via Pública")).toBe("via-publica");
    expect(tipoDeLocal("Estacionamento/Garagem")).toBe("estacionamento");
    expect(tipoDeLocal("Residência")).toBe("outros");
    expect(tipoDeLocal("Favela")).toBe("outros");
    expect(tipoDeLocal("")).toBeNull();
  });
});

describe("lotes com local suspeito (D24)", () => {
  const lote = (n: number, diaInicial: number, passo: number, extra: Record<string, string> = {}) =>
    Array.from({ length: n }, (_, i) => linha({ LOGRADOURO: "PRACA DO LOTE", NUMERO_LOGRADOURO: "1", DATA_OCORRENCIA_BO: String(diaInicial + i * passo), ...extra }));

  it("20+ registros no mesmo endereço e delegacia, 80%+ em 30 dias, saem do mapa mas continuam contando", async () => {
    const { ocorrencias, metadados } = await extrairOcorrencias([fonte([...lote(25, 45659, 1), linha()])]);
    expect(ocorrencias.filter((o) => !o.local_confiavel)).toHaveLength(25);
    expect(metadados.lotes).toEqual({ grupos: 1, registros: 25 });
    expect(ocorrencias).toHaveLength(26);
  });

  it("concentração espalhada no tempo não é lote", async () => {
    const { metadados } = await extrairOcorrencias([fonte(lote(25, 45659, 14))]);
    expect(metadados.lotes.grupos).toBe(0);
  });

  it("menos de 20 registros não é lote", async () => {
    const { metadados } = await extrairOcorrencias([fonte(lote(19, 45659, 0))]);
    expect(metadados.lotes.grupos).toBe(0);
  });

  it("mesmo endereço em delegacias diferentes são grupos diferentes", async () => {
    const { metadados } = await extrairOcorrencias([fonte([...lote(12, 45659, 0), ...lote(12, 45659, 0, { NOME_DELEGACIA: "OUTRA" })])]);
    expect(metadados.lotes.grupos).toBe(0);
  });
});

describe("colunas por ano", () => {
  it("mapeia as renomeações de 2026 e aponta coluna nova", () => {
    expect(nomeCanonico("DESC_COR_VEICULO")).toBe("DESCR_COR_VEICULO");
    expect(nomeCanonico("COD IBGE")).toBe("CD_IBGE");
    expect(colunasDesconhecidas(["LATITUDE", "COLUNA_NOVA"])).toEqual(["COLUNA_NOVA"]);
  });

  it("falha cedo se faltar coluna obrigatória", async () => {
    const sem = linha();
    sem.delete("LATITUDE");
    await expect(extrairOcorrencias([fonte([sem])])).rejects.toThrow(/LATITUDE/);
  });
});

describe("conversões", () => {
  it("data serial do Excel", () => {
    expect(dataDoExcel("45659")).toBe("2025-01-02");
    expect(dataDoExcel("NULL")).toBeNull();
  });

});

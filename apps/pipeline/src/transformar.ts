import {
  CAMPOS_PERMITIDOS,
  classificarTipoVeiculo,
  periodoDaHora,
  RESOLUCAO_H3,
  tipoDeDia,
  type Ocorrencia,
  type PeriodoDoDia,
  type TipoDeLocal,
  type TipoOcorrencia,
} from "@mapa/core";
import { latLngToCell } from "h3-js";
import type { ColunaUsada } from "./colunas.ts";
import { familiaDoModelo } from "./familias.ts";

export type Campos = ReadonlyMap<ColunaUsada, string>;

const SUBTRACAO: Record<string, TipoOcorrencia> = { ROUBADO: "roubo", FURTADO: "furto" };
const PERIODO_SSP: Record<string, PeriodoDoDia> = {
  "DE MADRUGADA": "madrugada",
  "PELA MANHA": "manha",
  "A TARDE": "tarde",
  "A NOITE": "noite",
  "EM HORA INCERTA": "hora-incerta",
};
const EPOCA_EXCEL = Date.UTC(1899, 11, 30);
const DIA_MS = 86_400_000;

export const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const vazio = (v: string | undefined) => !v || v.trim() === "" || v.trim().toUpperCase() === "NULL";

export const dentroDeSaoPaulo = (lat: number, lon: number) => lat > -24.01 && lat < -23.35 && lon > -46.83 && lon < -46.36;

export function dataDoExcel(valor: string | undefined): string | null {
  if (vazio(valor)) return null;
  const serial = Number(valor);
  if (!Number.isFinite(serial) || serial < 1) return null;
  return new Date(EPOCA_EXCEL + Math.floor(serial) * DIA_MS).toISOString().slice(0, 10);
}

export function horaDoExcel(valor: string | undefined): number | null {
  if (vazio(valor)) return null;
  const fracao = Number(valor);
  if (!Number.isFinite(fracao) || fracao < 0 || fracao >= 1) return null;
  return Math.min(23, Math.floor(fracao * 24 + 1e-9));
}

export function tipoDeLocal(descricao: string | undefined): TipoDeLocal | null {
  if (vazio(descricao)) return null;
  const t = normalizar(descricao ?? "");
  if (t === "VIA PUBLICA") return "via-publica";
  if (t.startsWith("ESTACIONAMENTO")) return "estacionamento";
  return "outros";
}

export function ruaSemNumero(logradouro: string | undefined): string | null {
  if (vazio(logradouro)) return null;
  const rua = normalizar(logradouro ?? "").replace(/,.*$/, "").trim();
  if (!rua || rua.startsWith("VEDACAO")) return null;
  return rua;
}

export type Motivo = "fora-da-capital" | "nao-subtracao" | "fora-da-d4" | "sem-data" | "duplicado";

export interface Extraido {
  ocorrencia: Omit<Ocorrencia, "local_confiavel">;
  chaveDoLocal: string | null;
  diaDoFato: number;
  coordenada: "valida" | "zerada" | "nao-numerica" | "fora-de-sp" | "vedada";
}

export type Resultado = { ok: true; extraido: Extraido } | { ok: false; motivo: Motivo };

export function extrair(c: Campos, vistos: Set<string>): Resultado {
  if (normalizar(c.get("NOME_MUNICIPIO_CIRC") ?? "") !== "S.PAULO") return { ok: false, motivo: "fora-da-capital" };
  const tipo = SUBTRACAO[normalizar(c.get("DESCR_OCORRENCIA_VEICULO") ?? "")];
  if (!tipo) return { ok: false, motivo: "nao-subtracao" };
  const veiculo = classificarTipoVeiculo(c.get("DESCR_TIPO_VEICULO") ?? "");
  if (!veiculo) return { ok: false, motivo: "fora-da-d4" };
  const data = dataDoExcel(c.get("DATA_OCORRENCIA_BO"));
  if (!data) return { ok: false, motivo: "sem-data" };

  const chave = (["NOME_DELEGACIA", "ANO_BO", "NUM_BO", "CONT_VEICULO"] as const).map((k) => normalizar(c.get(k) ?? "")).join("|");
  if (vistos.has(chave)) return { ok: false, motivo: "duplicado" };
  vistos.add(chave);

  const hora = horaDoExcel(c.get("HORA_OCORRENCIA"));
  const periodoSsp = PERIODO_SSP[normalizar(c.get("DESCR_PERIODO") ?? "")];
  const periodo = hora !== null ? periodoDaHora(hora) : (periodoSsp ?? "hora-incerta");

  const logradouro = c.get("LOGRADOURO");
  const vedada = normalizar(logradouro ?? "").startsWith("VEDACAO");
  const lat = Number(c.get("LATITUDE"));
  const lon = Number(c.get("LONGITUDE"));
  const coordenada: Extraido["coordenada"] = vedada
    ? "vedada"
    : !Number.isFinite(lat) || !Number.isFinite(lon) || vazio(c.get("LATITUDE"))
      ? "nao-numerica"
      : lat === 0 || lon === 0
        ? "zerada"
        : dentroDeSaoPaulo(lat, lon)
          ? "valida"
          : "fora-de-sp";

  const rua = ruaSemNumero(logradouro);
  return {
    ok: true,
    extraido: {
      ocorrencia: {
        tipo,
        veiculo,
        familia: familiaDoModelo(normalizar(c.get("DESCR_MARCA_VEICULO") ?? ""), veiculo),
        data,
        tipo_dia: tipoDeDia(new Date(`${data}T12:00:00Z`)),
        periodo,
        periodo_origem: hora !== null ? "calculado" : "ssp",
        hora,
        h3: coordenada === "valida" ? latLngToCell(lat, lon, RESOLUCAO_H3) : null,
        tipo_local: tipoDeLocal(c.get("DESCR_TIPOLOCAL")),
        rua,
      },
      chaveDoLocal: rua ? `${rua}|${normalizar(c.get("NUMERO_LOGRADOURO") ?? "")}|${normalizar(c.get("NOME_DELEGACIA") ?? "")}` : null,
      diaDoFato: Date.parse(`${data}T00:00:00Z`) / DIA_MS,
      coordenada,
    },
  };
}

export const LOTE = { minimo: 20, janelaDias: 30, fracao: 0.8 } as const;

function maiorJanela(dias: number[], tamanho: number) {
  const s = [...dias].sort((a, b) => a - b);
  let melhor = 0;
  let inicio = 0;
  for (let fim = 0; fim < s.length; fim++) {
    while ((s[fim] ?? 0) - (s[inicio] ?? 0) >= tamanho) inicio++;
    melhor = Math.max(melhor, fim - inicio + 1);
  }
  return melhor;
}

export function detectarLotes(extraidos: readonly Extraido[]): Map<string, number> {
  const grupos = new Map<string, number[]>();
  for (const e of extraidos) {
    if (!e.chaveDoLocal) continue;
    const dias = grupos.get(e.chaveDoLocal) ?? [];
    dias.push(e.diaDoFato);
    grupos.set(e.chaveDoLocal, dias);
  }
  const lotes = new Map<string, number>();
  for (const [chave, dias] of grupos) {
    if (dias.length >= LOTE.minimo && maiorJanela(dias, LOTE.janelaDias) >= LOTE.fracao * dias.length) lotes.set(chave, dias.length);
  }
  return lotes;
}

export function projetar(e: Extraido, lotes: ReadonlyMap<string, number>): Ocorrencia {
  const o = e.ocorrencia;
  const registro: Ocorrencia = {
    tipo: o.tipo,
    veiculo: o.veiculo,
    familia: o.familia,
    data: o.data,
    tipo_dia: o.tipo_dia,
    periodo: o.periodo,
    periodo_origem: o.periodo_origem,
    hora: o.hora,
    h3: o.h3,
    tipo_local: o.tipo_local,
    rua: o.rua,
    local_confiavel: !(e.chaveDoLocal && lotes.has(e.chaveDoLocal)),
  };
  garantirListaDePermissao(registro);
  return registro;
}

export function garantirListaDePermissao(registro: object): void {
  const chaves = Object.keys(registro).sort();
  const permitidas = [...CAMPOS_PERMITIDOS].sort();
  if (chaves.length !== permitidas.length || chaves.some((c, i) => c !== permitidas[i])) {
    throw new Error(`Registro fora da lista de permissão (D5/D22): ${chaves.join(", ")}`);
  }
}

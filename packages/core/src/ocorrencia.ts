import type { PeriodoDoDia, TipoDeDia, TipoOcorrencia, TipoVeiculo } from "./dominio.ts";

export const RESOLUCAO_H3 = 8;
export const K_MINIMO = 5;

export const TIPOS_DE_LOCAL = ["via-publica", "estacionamento", "outros"] as const;
export type TipoDeLocal = (typeof TIPOS_DE_LOCAL)[number];

export const ORIGENS_DO_PERIODO = ["calculado", "ssp"] as const;
export type OrigemDoPeriodo = (typeof ORIGENS_DO_PERIODO)[number];

export interface Ocorrencia {
  tipo: TipoOcorrencia;
  veiculo: TipoVeiculo;
  familia: string;
  data: string;
  tipo_dia: TipoDeDia;
  periodo: PeriodoDoDia;
  periodo_origem: OrigemDoPeriodo;
  hora: number | null;
  h3: string | null;
  tipo_local: TipoDeLocal | null;
  rua: string | null;
  local_confiavel: boolean;
}

export const CAMPOS_PERMITIDOS = [
  "tipo",
  "veiculo",
  "familia",
  "data",
  "tipo_dia",
  "periodo",
  "periodo_origem",
  "hora",
  "h3",
  "tipo_local",
  "rua",
  "local_confiavel",
] as const satisfies readonly (keyof Ocorrencia)[];

export const LIMITES_DOS_PERIODOS = {
  madrugada: { de: 0, ate: 6 },
  manha: { de: 6, ate: 12 },
  tarde: { de: 12, ate: 18 },
  noite: { de: 18, ate: 24 },
} as const;

export const ROTULOS_DOS_PERIODOS: Record<PeriodoDoDia, string> = {
  madrugada: "Madrugada",
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  "hora-incerta": "Hora incerta",
};

export function periodoDaHora(hora: number): Exclude<PeriodoDoDia, "hora-incerta"> {
  if (!Number.isInteger(hora) || hora < 0 || hora > 23) throw new RangeError(`hora inválida: ${hora}`);
  if (hora < LIMITES_DOS_PERIODOS.madrugada.ate) return "madrugada";
  if (hora < LIMITES_DOS_PERIODOS.manha.ate) return "manha";
  if (hora < LIMITES_DOS_PERIODOS.tarde.ate) return "tarde";
  return "noite";
}

export function faixaDoPeriodo(periodo: Exclude<PeriodoDoDia, "hora-incerta">): string {
  const { de, ate } = LIMITES_DOS_PERIODOS[periodo];
  return `${de}h–${ate - 1}h59`;
}

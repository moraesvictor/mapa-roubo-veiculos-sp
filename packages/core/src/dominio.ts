export const TIPOS_OCORRENCIA = ["roubo", "furto"] as const;
export type TipoOcorrencia = (typeof TIPOS_OCORRENCIA)[number];

export const TIPOS_VEICULO = ["carro", "moto"] as const;
export type TipoVeiculo = (typeof TIPOS_VEICULO)[number];

export const PERIODOS_DO_DIA = ["madrugada", "manha", "tarde", "noite", "hora-incerta"] as const;
export type PeriodoDoDia = (typeof PERIODOS_DO_DIA)[number];

export const TIPOS_DE_DIA = ["dia-util", "fim-de-semana"] as const;
export type TipoDeDia = (typeof TIPOS_DE_DIA)[number];

export interface Filtros {
  tiposOcorrencia: readonly TipoOcorrencia[];
  tiposVeiculo: readonly TipoVeiculo[];
  periodos: readonly PeriodoDoDia[];
  tiposDeDia: readonly TipoDeDia[];
}

export const FILTROS_PADRAO: Filtros = {
  tiposOcorrencia: TIPOS_OCORRENCIA,
  tiposVeiculo: TIPOS_VEICULO,
  periodos: PERIODOS_DO_DIA,
  tiposDeDia: TIPOS_DE_DIA,
};

const CARRO = new Set(["AUTOMOVEL", "CAMINHONETE", "CAMIONETA", "UTILITARIO"]);
const MOTO = new Set(["MOTOCICLO", "MOTONETA"]);

const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();

export function classificarTipoVeiculo(descricao: string): TipoVeiculo | null {
  const tipo = normalizar(descricao);
  if (CARRO.has(tipo)) return "carro";
  if (MOTO.has(tipo)) return "moto";
  return null;
}

export function tipoDeDia(data: Date): TipoDeDia {
  const dia = data.getUTCDay();
  return dia === 0 || dia === 6 ? "fim-de-semana" : "dia-util";
}

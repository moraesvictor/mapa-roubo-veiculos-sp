import { PERIODOS_DO_DIA, TIPOS_DE_DIA, TIPOS_OCORRENCIA, TIPOS_VEICULO, type Filtros } from "./dominio.ts";

export const MINIMO_PARA_ZONAS = 200;

const DIMENSOES = [
  ["tiposVeiculo", TIPOS_VEICULO],
  ["tiposOcorrencia", TIPOS_OCORRENCIA],
  ["tiposDeDia", TIPOS_DE_DIA],
  ["periodos", PERIODOS_DO_DIA],
] as const;

function normalizarLista<T extends string>(valores: readonly T[], todos: readonly T[]): T[] {
  const validos = [...new Set(valores)].filter((v) => todos.includes(v)).sort();
  return validos.length ? validos : [...todos].sort();
}

export function normalizarFiltros(filtros: Partial<Filtros>): Filtros {
  return {
    tiposVeiculo: normalizarLista(filtros.tiposVeiculo ?? [], TIPOS_VEICULO),
    tiposOcorrencia: normalizarLista(filtros.tiposOcorrencia ?? [], TIPOS_OCORRENCIA),
    tiposDeDia: normalizarLista(filtros.tiposDeDia ?? [], TIPOS_DE_DIA),
    periodos: normalizarLista(filtros.periodos ?? [], PERIODOS_DO_DIA),
  };
}

export function chaveDoFiltro(filtros: Partial<Filtros>): string {
  const f = normalizarFiltros(filtros);
  return DIMENSOES.map(([nome]) => f[nome].join(",")).join("|");
}

function subconjuntos<T>(itens: readonly T[]): T[][] {
  return Array.from({ length: (1 << itens.length) - 1 }, (_, m) => itens.filter((_, b) => (m + 1) & (1 << b)));
}

export function todasAsCombinacoes(): Filtros[] {
  const combinacoes: Filtros[] = [];
  for (const tiposVeiculo of subconjuntos(TIPOS_VEICULO))
    for (const tiposOcorrencia of subconjuntos(TIPOS_OCORRENCIA))
      for (const tiposDeDia of subconjuntos(TIPOS_DE_DIA))
        for (const periodos of subconjuntos(PERIODOS_DO_DIA)) combinacoes.push(normalizarFiltros({ tiposVeiculo, tiposOcorrencia, tiposDeDia, periodos }));
  return combinacoes;
}

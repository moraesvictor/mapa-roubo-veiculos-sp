const RENOMEADAS: Record<string, string> = {
  DESC_COR_VEICULO: "DESCR_COR_VEICULO",
  "COD IBGE": "CD_IBGE",
};

export const COLUNAS_CONHECIDAS = new Set([
  "ID_DELEGACIA",
  "NOME_DEPARTAMENTO",
  "NOME_SECCIONAL",
  "NOME_DELEGACIA",
  "NOME_MUNICIPIO",
  "ANO_BO",
  "NUM_BO",
  "VERSAO",
  "NOME_DEPARTAMENTO_CIRC",
  "NOME_SECCIONAL_CIRC",
  "NOME_DELEGACIA_CIRC",
  "NOME_MUNICIPIO_CIRC",
  "DATA_OCORRENCIA_BO",
  "HORA_OCORRENCIA",
  "DESCRICAO_APRESENTACAO",
  "DATAHORA_REGISTRO_BO",
  "DATA_COMUNICACAO_BO",
  "DATAHORA_IMPRESSAO_BO",
  "DESCR_PERIODO",
  "AUTORIA_BO",
  "FLAG_INTOLERANCIA",
  "TIPO_INTOLERANCIA",
  "FLAG_FLAGRANTE",
  "FLAG_STATUS",
  "DESC_LEI",
  "FLAG_ATO_INFRACIONAL",
  "RUBRICA",
  "DESCR_CONDUTA",
  "DESDOBRAMENTO",
  "CIRCUNSTANCIA",
  "DESCR_TIPOLOCAL",
  "DESCR_SUBTIPOLOCAL",
  "CIDADE",
  "BAIRRO",
  "CEP",
  "DESC_NATUREZA_LOCAL",
  "LOGRADOURO_VERSAO",
  "LOGRADOURO",
  "NUMERO_LOGRADOURO",
  "LATITUDE",
  "LONGITUDE",
  "CONT_VEICULO",
  "DESCR_OCORRENCIA_VEICULO",
  "DESCR_TIPO_VEICULO",
  "DESCR_MARCA_VEICULO",
  "ANO_FABRICACAO",
  "ANO_MODELO",
  "PLACA_VEICULO",
  "DESCR_COR_VEICULO",
  "MES_REGISTRO_BO",
  "ANO_REGISTRO_BO",
  "CMD",
  "BTL",
  "CIA",
  "CD_IBGE",
]);

export const COLUNAS_USADAS = [
  "NOME_DELEGACIA",
  "ANO_BO",
  "NUM_BO",
  "CONT_VEICULO",
  "NOME_MUNICIPIO_CIRC",
  "DATA_OCORRENCIA_BO",
  "HORA_OCORRENCIA",
  "DESCR_PERIODO",
  "DESCR_TIPOLOCAL",
  "LOGRADOURO",
  "NUMERO_LOGRADOURO",
  "LATITUDE",
  "LONGITUDE",
  "DESCR_OCORRENCIA_VEICULO",
  "DESCR_TIPO_VEICULO",
  "DESCR_MARCA_VEICULO",
] as const;

export type ColunaUsada = (typeof COLUNAS_USADAS)[number];
export type Linha = ReadonlyMap<string, string>;

export function nomeCanonico(coluna: string): string {
  const limpo = coluna.trim();
  return RENOMEADAS[limpo] ?? limpo;
}

export function colunasDesconhecidas(cabecalho: Iterable<string>): string[] {
  return [...cabecalho].map(nomeCanonico).filter((c) => !COLUNAS_CONHECIDAS.has(c));
}

export function colunasFaltando(cabecalho: Iterable<string>): string[] {
  const presentes = new Set([...cabecalho].map(nomeCanonico));
  return COLUNAS_USADAS.filter((c) => !presentes.has(c));
}

export function canonizar(linha: Linha): Map<ColunaUsada, string> {
  const saida = new Map<ColunaUsada, string>();
  for (const [coluna, valor] of linha) {
    const nome = nomeCanonico(coluna);
    if ((COLUNAS_USADAS as readonly string[]).includes(nome)) saida.set(nome as ColunaUsada, valor);
  }
  return saida;
}

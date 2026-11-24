import { z } from "zod";
import { PERIODOS_DO_DIA, TIPOS_DE_DIA, TIPOS_OCORRENCIA, TIPOS_VEICULO, type Filtros } from "./dominio.ts";
import { normalizarFiltros } from "./filtros.ts";
import { TIPOS_DE_LOCAL } from "./ocorrencia.ts";

const listaSeparadaPorVirgula = <T extends string>(valores: readonly T[], descricao: string) =>
  z
    .string()
    .regex(new RegExp(`^(${valores.join("|")})(,(${valores.join("|")}))*$`))
    .optional()
    .describe(`${descricao}. Valores separados por vírgula: ${valores.join(", ")}. Sem o parâmetro, todos.`);

export const ConsultaDeFiltros = z.object({
  veiculo: listaSeparadaPorVirgula(TIPOS_VEICULO, "Tipo de veículo"),
  tipo: listaSeparadaPorVirgula(TIPOS_OCORRENCIA, "Tipo de ocorrência"),
  dia: listaSeparadaPorVirgula(TIPOS_DE_DIA, "Dia útil ou fim de semana"),
  periodo: listaSeparadaPorVirgula(PERIODOS_DO_DIA, "Período do dia"),
});
export type ConsultaDeFiltros = z.infer<typeof ConsultaDeFiltros>;

const separar = <T extends string>(valor: string | undefined) => (valor ? (valor.split(",") as T[]) : []);

export function filtrosDaConsulta(c: ConsultaDeFiltros): Filtros {
  return normalizarFiltros({
    tiposVeiculo: separar(c.veiculo),
    tiposOcorrencia: separar(c.tipo),
    tiposDeDia: separar(c.dia),
    periodos: separar(c.periodo),
  });
}

export function consultaDosFiltros(filtros: Partial<Filtros>): string {
  const f = normalizarFiltros(filtros);
  const params = new URLSearchParams();
  const incluir = (nome: string, valores: readonly string[], todos: readonly string[]) => {
    if (valores.length < todos.length) params.set(nome, valores.join(","));
  };
  incluir("veiculo", f.tiposVeiculo, TIPOS_VEICULO);
  incluir("tipo", f.tiposOcorrencia, TIPOS_OCORRENCIA);
  incluir("dia", f.tiposDeDia, TIPOS_DE_DIA);
  incluir("periodo", f.periodos, PERIODOS_DO_DIA);
  return params.toString();
}

export const Contagem = z.number().int().min(5).nullable().describe("Número de ocorrências; null quando é menor que 5 (k mínimo, D18)");
export type Contagem = z.infer<typeof Contagem>;

const Janela = {
  atualizadoAte: z.string().describe("Última data com dados (AAAA-MM-DD)"),
  desde: z.string().describe("Início da janela de 12 meses (AAAA-MM-DD)"),
};

export const RespostaZonas = z.object({
  ...Janela,
  total: z.number().int().describe("Ocorrências no mapa com o filtro (sem lotes nem registros sem local)"),
  poucosRegistros: z.boolean().describe("Menos de 200 ocorrências: sem zonas de concentração (D18)"),
  celulas: z.array(z.tuple([z.string(), z.number().int().min(5), z.boolean()])).describe("[h3, ocorrências, zona de concentração]; só células com 5 ou mais"),
});
export type RespostaZonas = z.infer<typeof RespostaZonas>;

export const RespostaGeometria = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      id: z.string(),
      properties: z.object({ h3: z.string() }),
      geometry: z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))) }),
    }),
  ),
});
export type RespostaGeometria = z.infer<typeof RespostaGeometria>;

export const DIRECOES = ["norte", "leste", "sul", "oeste"] as const;
export type Direcao = (typeof DIRECOES)[number];

export const RespostaArea = z.object({
  ...Janela,
  h3: z.string(),
  zona: z.boolean().describe("Faz parte de uma zona de concentração com o filtro atual"),
  total: Contagem,
  porPeriodo: z.object(Object.fromEntries(PERIODOS_DO_DIA.map((p) => [p, Contagem])) as Record<(typeof PERIODOS_DO_DIA)[number], typeof Contagem>).describe("Ignora o filtro de período"),
  porTipoDeLocal: z.object(Object.fromEntries(TIPOS_DE_LOCAL.map((t) => [t, Contagem])) as Record<(typeof TIPOS_DE_LOCAL)[number], typeof Contagem>),
  arredores: z.array(z.object({ direcao: z.enum(DIRECOES), total: Contagem })).describe("Áreas vizinhas (~1–2 km), somadas por direção"),
});
export type RespostaArea = z.infer<typeof RespostaArea>;

export const ConsultaDeRua = ConsultaDeFiltros.extend({
  nome: z.string().min(3).max(120).describe("Nome da rua como aparece na busca, ex.: Avenida Paulista"),
  celulas: z
    .string()
    .regex(/^[0-9a-f]{15}(,[0-9a-f]{15}){0,199}$/)
    .optional()
    .describe("Células H3 do trecho encontrado na busca, separadas por vírgula; conta só ali e no entorno imediato (ruas com o mesmo nome em outro bairro ficam de fora)"),
});

export const RespostaCep = z.object({
  cep: z.string(),
  logradouro: z.string().nullable(),
  bairro: z.string().nullable(),
  emSaoPaulo: z.boolean(),
});
export type RespostaCep = z.infer<typeof RespostaCep>;

export const RespostaRua = z.object({
  ...Janela,
  nome: z.string(),
  total: Contagem,
});
export type RespostaRua = z.infer<typeof RespostaRua>;

export const RespostaSobre = z.object({
  ...Janela,
  fonte: z.string(),
  processadoEm: z.string(),
  versaoDoPipeline: z.string(),
  ocorrencias: z.number().int(),
  foraDoMapa: z.object({
    total: z.number().int(),
    semCoordenada: z.number().int(),
    vedadas: z.number().int(),
    lotes: z.number().int(),
  }),
  periodo: z.object({ calculado: z.number().int(), rotuloDaSsp: z.number().int(), horaIncerta: z.number().int() }),
  modeloNaoIdentificado: z.number().int(),
});
export type RespostaSobre = z.infer<typeof RespostaSobre>;

export const RespostaErro = z.object({ erro: z.string(), campos: z.array(z.string()).optional() });

const Veiculo = z.enum(TIPOS_VEICULO);

export const ConsultaDeModelos = z.object({ veiculo: Veiculo });

export const RespostaModelos = z.object({
  ...Janela,
  veiculo: Veiculo,
  modelos: z.array(z.object({ familia: z.string(), nome: z.string(), total: z.number().int().min(5) })).describe("Famílias com 5 ou mais ocorrências nos últimos 12 meses, da mais registrada pra menos"),
});
export type RespostaModelos = z.infer<typeof RespostaModelos>;

export const Variacao = z.number().nullable().describe("Variação em relação aos 12 meses anteriores (0,03 = +3%); null quando algum dos dois períodos tem menos de 5");

export const ConsultaDeRanking = z.object({
  veiculo: Veiculo,
  tipo: listaSeparadaPorVirgula(TIPOS_OCORRENCIA, "Tipo de ocorrência"),
  limite: z.coerce.number().int().min(1).max(50).default(10),
});

export const RespostaRanking = z.object({
  ...Janela,
  veiculo: Veiculo,
  itens: z.array(z.object({ posicao: z.number().int(), familia: z.string(), nome: z.string(), total: z.number().int().min(5), variacao: Variacao })),
  outros: z.object({ modelos: z.number().int(), ocorrencias: z.number().int() }).describe("Modelos com menos de 5 ocorrências, somados"),
  naoIdentificado: z.number().int().describe("Ocorrências sem modelo identificado no boletim"),
  total: z.number().int(),
});
export type RespostaRanking = z.infer<typeof RespostaRanking>;

export const ConsultaDeModelo = z.object({ veiculo: Veiculo, familia: z.string().min(2).max(80) });

export const RespostaModelo = z.object({
  ...Janela,
  veiculo: Veiculo,
  familia: z.string(),
  nome: z.string(),
  total: Contagem,
  posicao: z.number().int().nullable().describe("Posição entre os modelos do mesmo tipo de veículo"),
  porPeriodo: z.object(Object.fromEntries(PERIODOS_DO_DIA.map((p) => [p, Contagem])) as Record<(typeof PERIODOS_DO_DIA)[number], typeof Contagem>),
  mensal: z.array(z.object({ mes: z.string().describe("AAAA-MM"), total: Contagem })),
  variacao: Variacao,
});
export type RespostaModelo = z.infer<typeof RespostaModelo>;

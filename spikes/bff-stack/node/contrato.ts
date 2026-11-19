import { z } from "zod";

const listaDe = (valores: readonly string[], descricao: string) =>
  z
    .string()
    .regex(new RegExp(`^(${valores.join("|")})(,(${valores.join("|")}))*$`))
    .optional()
    .describe(`${descricao}. Valores separados por vírgula: ${valores.join(", ")}. Sem o parâmetro, todos.`);

export const VEICULOS = ["carro", "moto"] as const;
export const TIPOS = ["roubo", "furto"] as const;
export const PERIODOS = ["madrugada", "manha", "tarde", "noite", "hora-incerta"] as const;
export const DIAS = ["dia-util", "fim-de-semana"] as const;

export const FiltroZonas = z.object({
  veiculo: listaDe(VEICULOS, "Tipo de veículo"),
  tipo: listaDe(TIPOS, "Tipo de ocorrência"),
  periodo: listaDe(PERIODOS, "Período do dia"),
  dia: listaDe(DIAS, "Dia útil ou fim de semana"),
});
export type FiltroZonas = z.infer<typeof FiltroZonas>;

export const RespostaZonas = z.object({
  atualizadoAte: z.string().describe("Última data com dados na fonte (AAAA-MM-DD)"),
  desde: z.string().describe("Início da janela de 12 meses (AAAA-MM-DD)"),
  total: z.number().int(),
  celulas: z.array(z.object({ h3: z.string(), n: z.number().int() })),
});
export type RespostaZonas = z.infer<typeof RespostaZonas>;

export const RespostaErro = z.object({ erro: z.string(), campos: z.array(z.string()) });

export interface FiltroNormalizado {
  veiculos: string[];
  tipos: string[];
  periodos: string[];
  dias: string[];
}

export const normalizar = (f: FiltroZonas): FiltroNormalizado => ({
  veiculos: (f.veiculo?.split(",") ?? [...VEICULOS]).sort(),
  tipos: (f.tipo?.split(",") ?? [...TIPOS]).sort(),
  periodos: (f.periodo?.split(",") ?? [...PERIODOS]).sort(),
  dias: (f.dia?.split(",") ?? [...DIAS]).sort(),
});

export const CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";

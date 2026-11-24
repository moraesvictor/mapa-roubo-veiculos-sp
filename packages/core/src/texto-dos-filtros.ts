import { PERIODOS_DO_DIA, TIPOS_DE_DIA, TIPOS_OCORRENCIA, TIPOS_VEICULO, type Filtros, type PeriodoDoDia } from "./dominio.ts";
import { normalizarFiltros } from "./filtros.ts";

export const ROTULOS = {
  veiculo: { carro: "Carro", moto: "Moto" },
  tipo: { roubo: "Roubo", furto: "Furto" },
  dia: { "dia-util": "Dia útil", "fim-de-semana": "Fim de semana" },
  periodo: { madrugada: "Madrugada", manha: "Manhã", tarde: "Tarde", noite: "Noite", "hora-incerta": "Hora incerta" },
} as const;

const FRASE_DO_PERIODO: Record<PeriodoDoDia, string> = {
  madrugada: "de madrugada",
  manha: "de manhã",
  tarde: "à tarde",
  noite: "à noite",
  "hora-incerta": "em hora incerta",
};

const juntar = (partes: string[]) => (partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} ou ${partes.at(-1) ?? ""}`);

export function descreverFiltros(filtros: Partial<Filtros>): string {
  const f = normalizarFiltros(filtros);
  const partes: string[] = [];
  if (f.tiposVeiculo.length < TIPOS_VEICULO.length) partes.push(f.tiposVeiculo[0] === "moto" ? "com moto" : "com carro");
  if (f.tiposOcorrencia.length < TIPOS_OCORRENCIA.length) partes.push(f.tiposOcorrencia[0] === "roubo" ? "só roubos" : "só furtos");
  if (f.periodos.length < PERIODOS_DO_DIA.length) partes.push(juntar(PERIODOS_DO_DIA.filter((p) => f.periodos.includes(p)).map((p) => FRASE_DO_PERIODO[p])));
  if (f.tiposDeDia.length < TIPOS_DE_DIA.length) partes.push(f.tiposDeDia[0] === "dia-util" ? "em dias úteis" : "nos fins de semana");
  return [...partes, "nos últimos 12 meses"].join(", ");
}

export function chipsAtivos(filtros: Partial<Filtros>): string[] {
  const f = normalizarFiltros(filtros);
  const ativos: string[] = [];
  if (f.tiposVeiculo.length < TIPOS_VEICULO.length) ativos.push(...f.tiposVeiculo.map((v) => ROTULOS.veiculo[v]));
  if (f.tiposOcorrencia.length < TIPOS_OCORRENCIA.length) ativos.push(...f.tiposOcorrencia.map((t) => ROTULOS.tipo[t]));
  if (f.periodos.length < PERIODOS_DO_DIA.length) ativos.push(...PERIODOS_DO_DIA.filter((p) => f.periodos.includes(p)).map((p) => ROTULOS.periodo[p]));
  if (f.tiposDeDia.length < TIPOS_DE_DIA.length) ativos.push(...f.tiposDeDia.map((d) => ROTULOS.dia[d]));
  return ativos;
}

export const formatarNumero = (n: number) => n.toLocaleString("pt-BR");

export function formatarContagem(n: number | null, singular = "ocorrência registrada", plural = "ocorrências registradas"): string {
  if (n === null) return `Menos de 5 ${plural}`;
  return `${formatarNumero(n)} ${n === 1 ? singular : plural}`;
}

export function niveisDaEscala(valores: readonly number[], degraus = 5): (n: number) => number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const quantis = [0.5, 0.75, 0.9, 0.97].slice(0, degraus - 1);
  const cortes = quantis.map((q) => ordenados[Math.floor(q * (ordenados.length - 1))] ?? 0);
  return (n) => cortes.filter((c) => n > c).length;
}

const SIGLAS = /^(?=.*\d)|^[A-Z]{1,3}$/;

export function nomeDoModelo(familia: string): string {
  return familia
    .split(" ")
    .map((parte) => (SIGLAS.test(parte) ? parte : parte.split("-").map((p) => p.charAt(0) + p.slice(1).toLowerCase()).join("-")))
    .join(" ");
}

export function descreverVariacao(variacao: number | null): string {
  if (variacao === null) return "Sem comparação: poucos registros em um dos períodos.";
  const pct = Math.round(Math.abs(variacao) * 100);
  if (pct < 5) return `Estável: variação de ${pct}% em relação aos 12 meses anteriores.`;
  return variacao > 0 ? `Subiu ${pct}% em relação aos 12 meses anteriores.` : `Caiu ${pct}% em relação aos 12 meses anteriores.`;
}

export function formatarMilhar(n: number): string {
  return n >= 1000 ? `${(Math.round(n / 100) / 10).toLocaleString("pt-BR")} mil` : n.toLocaleString("pt-BR");
}

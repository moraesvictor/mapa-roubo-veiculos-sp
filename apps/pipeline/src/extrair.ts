import type { Ocorrencia } from "@mapa/core";
import { canonizar, colunasDesconhecidas, colunasFaltando, type Linha } from "./colunas.ts";
import { detectarLotes, extrair, projetar, type Extraido, type Motivo } from "./transformar.ts";

export interface Metadados {
  arquivos: { nome: string; linhas: number; colunasDesconhecidas: string[] }[];
  descartados: Record<Motivo, number>;
  ocorrencias: number;
  periodo: { de: string | null; ate: string | null };
  coordenada: Record<Extraido["coordenada"], number>;
  periodoOrigem: { calculado: number; ssp: number; horaIncerta: number };
  lotes: { grupos: number; registros: number };
  foraDoMapa: number;
}

export interface Fonte {
  nome: string;
  ler: (aoLer: (linha: Linha) => void) => Promise<{ linhas: number }>;
}

export async function extrairOcorrencias(fontes: readonly Fonte[]): Promise<{ ocorrencias: Ocorrencia[]; metadados: Metadados }> {
  const vistos = new Set<string>();
  const extraidos: Extraido[] = [];
  const descartados: Record<Motivo, number> = { "fora-da-capital": 0, "nao-subtracao": 0, "fora-da-d4": 0, "sem-data": 0, duplicado: 0 };
  const arquivos: Metadados["arquivos"] = [];

  for (const fonte of fontes) {
    let cabecalhoVisto = false;
    let desconhecidas: string[] = [];
    const { linhas } = await fonte.ler((linha) => {
      if (!cabecalhoVisto) {
        cabecalhoVisto = true;
        desconhecidas = colunasDesconhecidas(linha.keys());
        const faltando = colunasFaltando(linha.keys());
        if (faltando.length) throw new Error(`${fonte.nome}: colunas obrigatórias ausentes: ${faltando.join(", ")}`);
      }
      const r = extrair(canonizar(linha), vistos);
      if (r.ok) extraidos.push(r.extraido);
      else descartados[r.motivo]++;
    });
    arquivos.push({ nome: fonte.nome, linhas, colunasDesconhecidas: desconhecidas });
  }

  const lotes = detectarLotes(extraidos);
  const ocorrencias = extraidos.map((e) => projetar(e, lotes)).sort((a, b) => a.data.localeCompare(b.data));

  const coordenada: Metadados["coordenada"] = { valida: 0, zerada: 0, "nao-numerica": 0, "fora-de-sp": 0, vedada: 0 };
  for (const e of extraidos) coordenada[e.coordenada]++;

  return {
    ocorrencias,
    metadados: {
      arquivos,
      descartados,
      ocorrencias: ocorrencias.length,
      periodo: { de: ocorrencias[0]?.data ?? null, ate: ocorrencias.at(-1)?.data ?? null },
      coordenada,
      periodoOrigem: {
        calculado: ocorrencias.filter((o) => o.periodo_origem === "calculado").length,
        ssp: ocorrencias.filter((o) => o.periodo_origem === "ssp" && o.periodo !== "hora-incerta").length,
        horaIncerta: ocorrencias.filter((o) => o.periodo === "hora-incerta").length,
      },
      lotes: { grupos: lotes.size, registros: ocorrencias.filter((o) => !o.local_confiavel).length },
      foraDoMapa: ocorrencias.filter((o) => !o.h3 || !o.local_confiavel).length,
    },
  };
}

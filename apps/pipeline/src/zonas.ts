import { chaveDoFiltro, K_MINIMO, MINIMO_PARA_ZONAS, todasAsCombinacoes, type Ocorrencia } from "@mapa/core";
import { criarDominio, zonasSignificativas } from "./gi.ts";

export interface Janela {
  desde: string;
  ate: string;
}

export interface Celula {
  h3: string;
  n: number;
  zona: boolean;
}

export interface Combinacao {
  chave: string;
  total: number;
  poucosRegistros: boolean;
  celulas: Celula[];
}

export function janelaDe12Meses(ocorrencias: readonly Ocorrencia[]): Janela {
  const ate = ocorrencias.reduce((m, o) => (o.data > m ? o.data : m), "");
  if (!ate) throw new Error("Sem ocorrências pra calcular a janela");
  const fim = new Date(`${ate}T00:00:00Z`);
  const desde = new Date(Date.UTC(fim.getUTCFullYear() - 1, fim.getUTCMonth(), fim.getUTCDate() + 1)).toISOString().slice(0, 10);
  return { desde, ate };
}

export const entraNoMapa = (o: Ocorrencia, j: Janela) => o.local_confiavel && o.h3 !== null && o.data >= j.desde && o.data <= j.ate;

export function calcularZonas(ocorrencias: readonly Ocorrencia[], janela: Janela): Combinacao[] {
  const noMapa = ocorrencias.filter((o) => entraNoMapa(o, janela));
  const dominio = criarDominio(new Set(noMapa.map((o) => o.h3 ?? "")));
  const indice = Int32Array.from(noMapa, (o) => dominio.indice.get(o.h3 ?? "") ?? -1);

  return todasAsCombinacoes().map((filtro) => {
    const veiculos = new Set<string>(filtro.tiposVeiculo);
    const tipos = new Set<string>(filtro.tiposOcorrencia);
    const dias = new Set<string>(filtro.tiposDeDia);
    const periodos = new Set<string>(filtro.periodos);
    const x = new Float64Array(dominio.celulas.length);
    let total = 0;
    noMapa.forEach((o, i) => {
      if (!veiculos.has(o.veiculo) || !tipos.has(o.tipo) || !dias.has(o.tipo_dia) || !periodos.has(o.periodo)) return;
      const c = indice[i] ?? -1;
      if (c < 0) return;
      x[c] = (x[c] ?? 0) + 1;
      total++;
    });
    const poucosRegistros = total < MINIMO_PARA_ZONAS;
    const significativo = poucosRegistros ? null : zonasSignificativas(dominio, x);
    const celulas: Celula[] = [];
    x.forEach((n, i) => {
      if (n >= K_MINIMO) celulas.push({ h3: dominio.celulas[i] ?? "", n, zona: significativo?.[i] === 1 });
    });
    return { chave: chaveDoFiltro(filtro), total, poucosRegistros, celulas };
  });
}

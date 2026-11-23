const LISTAS: Record<string, string[]> = {
  veiculo: ["carro", "moto"],
  tipo: ["furto", "roubo"],
  dia: ["dia-util", "fim-de-semana"],
  periodo: ["hora-incerta", "madrugada", "manha", "noite", "tarde"],
};

export function chaveDaCopia(busca: URLSearchParams) {
  return Object.entries(LISTAS)
    .map(([campo, todos]) => {
      const escolhidos = (busca.get(campo)?.split(",") ?? []).filter((v) => todos.includes(v));
      return (escolhidos.length ? [...new Set(escolhidos)].sort() : todos).join(",");
    })
    .join("_");
}

export interface Opcoes { bff: string; copia: string; limiteMs?: number; buscar?: typeof fetch }
export type Origem = "bff" | "copia";

export async function buscarZonas<T>(busca: URLSearchParams, { bff, copia, limiteMs = 4000, buscar = fetch }: Opcoes): Promise<{ origem: Origem; dados: T }> {
  try {
    const r = await buscar(`${bff}/v1/zonas?${busca}`, { signal: AbortSignal.timeout(limiteMs) });
    if (r.ok) return { origem: "bff", dados: (await r.json()) as T };
  } catch {
    /* cai pra cópia */
  }
  const r = await buscar(`${copia}/${encodeURIComponent(chaveDaCopia(busca))}.json`);
  if (!r.ok) throw new Error(`cópia indisponível: ${r.status}`);
  return { origem: "copia", dados: (await r.json()) as T };
}

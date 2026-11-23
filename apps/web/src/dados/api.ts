import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";

const BASE = (import.meta.env.VITE_API as string | undefined) ?? "/api";

export class ErroDaApi extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

const cache = new Map<string, Promise<unknown>>();

export function carregar<T>(caminho: string, schema: z.ZodType<T>): Promise<T> {
  const emCache = cache.get(caminho);
  if (emCache) return emCache as Promise<T>;
  const promessa = fetch(`${BASE}${caminho}`, { headers: { accept: "application/json" } })
    .then(async (res) => {
      if (!res.ok) throw new ErroDaApi(`Resposta ${res.status} em ${caminho}`, res.status);
      return schema.parse(await res.json());
    })
    .catch((erro: unknown) => {
      cache.delete(caminho);
      throw erro instanceof ErroDaApi ? erro : new ErroDaApi(erro instanceof Error ? erro.message : String(erro), null);
    });
  cache.set(caminho, promessa);
  return promessa;
}

export function limparCache() {
  cache.clear();
}

export type Recurso<T> =
  | { estado: "carregando"; dados: T | undefined; tentarDeNovo: () => void }
  | { estado: "pronto"; dados: T; tentarDeNovo: () => void }
  | { estado: "erro"; dados: T | undefined; erro: ErroDaApi; tentarDeNovo: () => void };

export function useRecurso<T>(caminho: string | null, schema: z.ZodType<T>): Recurso<T> | null {
  const [resultado, setResultado] = useState<{ caminho: string; dados?: T; erro?: ErroDaApi } | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const tentarDeNovo = useCallback(() => setTentativa((t) => t + 1), []);

  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    carregar(caminho, schema).then(
      (dados) => vivo && setResultado({ caminho, dados }),
      (erro: ErroDaApi) => vivo && setResultado((anterior) => ({ caminho, erro, ...(anterior?.dados === undefined ? {} : { dados: anterior.dados }) })),
    );
    return () => {
      vivo = false;
    };
  }, [caminho, schema, tentativa]);

  if (!caminho) return null;
  const atual = resultado?.caminho === caminho ? resultado : null;
  const anteriores = resultado?.dados;
  if (atual?.erro) return { estado: "erro", erro: atual.erro, dados: anteriores, tentarDeNovo };
  if (atual?.dados !== undefined) return { estado: "pronto", dados: atual.dados, tentarDeNovo };
  return { estado: "carregando", dados: anteriores, tentarDeNovo };
}

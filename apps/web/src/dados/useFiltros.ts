import { ConsultaDeFiltros, consultaDosFiltros, filtrosDaConsulta, type Filtros } from "@mapa/core";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

const CHAVES_DE_FILTRO = ["veiculo", "tipo", "dia", "periodo"] as const;

export function lerFiltros(params: URLSearchParams): Filtros {
  const bruto = Object.fromEntries(CHAVES_DE_FILTRO.flatMap((k) => (params.get(k) ? [[k, params.get(k)]] : [])));
  const valido = ConsultaDeFiltros.safeParse(bruto);
  return filtrosDaConsulta(valido.success ? valido.data : {});
}

export function useFiltros() {
  const [params, setParams] = useSearchParams();
  const filtros = useMemo(() => lerFiltros(params), [params]);
  const consulta = consultaDosFiltros(filtros);
  const area = params.get("area");

  const atualizar = useCallback(
    (mudancas: { filtros?: Filtros; area?: string | null }) => {
      setParams(
        (atual) => {
          const novo = new URLSearchParams(mudancas.filtros ? consultaDosFiltros(mudancas.filtros) : consultaDosFiltros(lerFiltros(atual)));
          const proximaArea = mudancas.area === undefined ? atual.get("area") : mudancas.area;
          if (proximaArea) novo.set("area", proximaArea);
          for (const [k, v] of atual) if (!CHAVES_DE_FILTRO.includes(k as (typeof CHAVES_DE_FILTRO)[number]) && k !== "area") novo.set(k, v);
          return novo;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { filtros, consulta, area, atualizar };
}

export const comConsulta = (caminho: string, consulta: string) => (consulta ? `${caminho}?${consulta}` : caminho);

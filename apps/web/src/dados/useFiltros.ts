import { ConsultaDeFiltros, consultaDosFiltros, filtrosDaConsulta, type Filtros } from "@mapa/core";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

const CHAVES_DE_FILTRO = ["veiculo", "tipo", "dia", "periodo"] as const;

export function lerFiltros(params: URLSearchParams): Filtros {
  const validos = CHAVES_DE_FILTRO.flatMap((k) => {
    const valor = params.get(k);
    return valor && ConsultaDeFiltros.shape[k].safeParse(valor).success ? [[k, valor]] : [];
  });
  return filtrosDaConsulta(Object.fromEntries(validos));
}

export function lerModelo(params: URLSearchParams): string | null {
  const valor = params.get("modelo");
  return valor && ConsultaDeFiltros.shape.modelo.safeParse(valor).success ? valor : null;
}

export const comModelo = (consulta: string, modelo: string | null) => {
  if (!modelo) return consulta;
  const params = new URLSearchParams(consulta);
  params.set("modelo", modelo);
  return params.toString();
};

export function useFiltros() {
  const [params, setParams] = useSearchParams();
  const filtros = useMemo(() => lerFiltros(params), [params]);
  const modelo = lerModelo(params);
  const consulta = comModelo(consultaDosFiltros(filtros), modelo);
  const area = params.get("area");

  const atualizar = useCallback(
    (mudancas: { filtros?: Filtros; area?: string | null; modelo?: null }) => {
      setParams(
        (atual) => {
          const novo = new URLSearchParams(mudancas.filtros ? consultaDosFiltros(mudancas.filtros) : consultaDosFiltros(lerFiltros(atual)));
          const proximaArea = mudancas.area === undefined ? atual.get("area") : mudancas.area;
          if (proximaArea) novo.set("area", proximaArea);
          for (const [k, v] of atual) if (!CHAVES_DE_FILTRO.includes(k as (typeof CHAVES_DE_FILTRO)[number]) && k !== "area" && !(k === "modelo" && mudancas.modelo === null)) novo.set(k, v);
          return novo;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { filtros, modelo, consulta, area, atualizar };
}

export const comConsulta = (caminho: string, consulta: string) => (consulta ? `${caminho}?${consulta}` : caminho);

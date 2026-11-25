import type { Lugar } from "@mapa/core";
import { useEffect, useId, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Botao } from "../../componentes/Botao.tsx";
import { useBusca } from "../../dados/busca.ts";
import { useFiltros } from "../../dados/useFiltros.ts";
import { Icone } from "../../icones/Icone.tsx";
import estilos from "./Busca.module.css";

export function destinoDoLugar(lugar: Lugar, consultaDeFiltros: string, rota = "/lugar") {
  const params = new URLSearchParams(consultaDeFiltros);
  params.set("area", lugar.celula);
  params.set("local", lugar.nome);
  params.set("categoria", lugar.tipo);
  if (lugar.tipo === "rua") params.set("celulas", lugar.celulas.join(","));
  return `${rota}?${params.toString()}`;
}

export function Busca() {
  const { consulta } = useFiltros();
  const [params] = useSearchParams();
  const rota = params.get("para") === "tabela" ? "/lugar/tabela" : "/lugar";
  const navegar = useNavigate();
  const [texto, setTexto] = useState("");
  const [ativo, setAtivo] = useState(-1);
  const busca = useBusca(texto);
  const id = useId();
  const resultados = busca.estado === "pronto" ? busca.resultados : [];

  useEffect(() => {
    document.title = "Ver um lugar · Ocorrências de veículos em SP";
  }, []);

  const escolher = (lugar: Lugar) => navegar(destinoDoLugar(lugar, consulta, rota));

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!resultados.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => (a + 1) % resultados.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => (a <= 0 ? resultados.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const escolhido = resultados[Math.max(ativo, 0)];
      if (escolhido) escolher(escolhido.lugar);
    } else if (e.key === "Escape") setTexto("");
  };

  const mensagem =
    busca.estado === "erro"
      ? busca.mensagem
      : busca.estado === "pronto" && busca.cep && !busca.cep.emSaoPaulo
        ? "Esse CEP não é da cidade de São Paulo."
        : busca.estado === "pronto" && !resultados.length
          ? "Nada encontrado. Confira a grafia ou tente só a rua e o bairro. O CEP também funciona."
          : null;

  return (
    <section className={estilos.pagina}>
      <div className={estilos.topo}>
        <Link to={consulta ? `${rota}?${consulta}` : rota} className={estilos.voltar} aria-label={rota === "/lugar" ? "Voltar ao mapa" : "Voltar à tabela"}>
          <Icone nome="voltar" />
        </Link>
        <h1>Ver um lugar</h1>
      </div>

      <div className={estilos.campo}>
        <label htmlFor={`${id}-campo`}>Endereço, CEP ou região</label>
        <div className={estilos.caixa}>
          <Icone nome="busca" />
          <input
            id={`${id}-campo`}
            type="search"
            role="combobox"
            aria-expanded={resultados.length > 0}
            aria-controls={`${id}-lista`}
            aria-autocomplete="list"
            aria-activedescendant={ativo >= 0 ? `${id}-opcao-${ativo}` : undefined}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Ex.: Rua Augusta ou 01310-200"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              setAtivo(-1);
            }}
            onKeyDown={aoTeclar}
          />
          {texto && (
            <button type="button" className={estilos.limpar} onClick={() => setTexto("")} aria-label="Limpar busca">
              <Icone nome="fechar" tamanho={20} />
            </button>
          )}
        </div>
        <div id={`${id}-lista`} role="listbox" aria-label="Sugestões" className={estilos.sugestoes} hidden={!resultados.length}>
          {resultados.map(({ lugar }, i) => (
            <div
              key={`${lugar.nome}-${lugar.celula}`}
              id={`${id}-opcao-${i}`}
              role="option"
              aria-selected={i === ativo}
              className={estilos.sugestao}
              tabIndex={-1}
              onClick={() => escolher(lugar)}
              onKeyDown={(e) => e.key === "Enter" && escolher(lugar)}
            >
              <Icone nome="pino" />
              <span>
                <strong>{lugar.nome}</strong>
                <span>{lugar.tipo === "bairro" ? "Bairro" : `Rua · perto de ${lugar.perto}`}</span>
              </span>
            </div>
          ))}
        </div>
        <p className={estilos.status} role="status">
          {busca.estado === "procurando" ? "Procurando…" : mensagem ?? (resultados.length ? `${resultados.length} sugestões. Use as setas pra escolher.` : "")}
        </p>
      </div>

      <p className={estilos.ou}>ou</p>
      <Botao icone="localizacao" onClick={() => navegar(consulta ? `/lugar?${consulta}&minhaLocalizacao=1` : "/lugar?minhaLocalizacao=1")}>
        Usar minha localização
      </Botao>
      <p className={estilos.nota}>A busca roda no seu aparelho e o endereço não é enviado. Sua localização só centraliza o mapa e também fica no aparelho.</p>
    </section>
  );
}

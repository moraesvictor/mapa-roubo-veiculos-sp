import { chipsAtivos, consultaDosFiltros, descreverFiltros, RespostaArea, RespostaGeometria, RespostaZonas, type Filtros } from "@mapa/core";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Botao } from "../../componentes/Botao.tsx";
import { useRecurso } from "../../dados/api.ts";
import { comConsulta, useFiltros } from "../../dados/useFiltros.ts";
import { Icone } from "../../icones/Icone.tsx";
import estilos from "./Lugar.module.css";
import { PainelDeFiltros } from "./PainelDeFiltros.tsx";
import { DetalheDaArea, Legenda, Resumo } from "./Paineis.tsx";

const MapaDeZonas = lazy(() => import("../../mapa/MapaDeZonas.tsx"));

function DialogoDeFiltros({ aberto, filtros, aoAplicar, aoFechar }: { aberto: boolean; filtros: Filtros; aoAplicar: (f: Filtros) => void; aoFechar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [rascunho, setRascunho] = useState(filtros);
  const previa = useRecurso(aberto ? comConsulta("/v1/zonas", consultaDosFiltros(rascunho)) : null, RespostaZonas);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  const total = previa?.estado === "pronto" ? previa.dados.total.toLocaleString("pt-BR") : "…";
  return (
    <dialog ref={dialogo} className={estilos.dialogo} aria-labelledby="titulo-filtros" onClose={aoFechar}>
      <div className={estilos.cabecalhoDoDetalhe}>
        <h2 id="titulo-filtros">Filtros</h2>
        <button type="button" className={estilos.fechar} onClick={aoFechar} aria-label="Fechar filtros">
          <Icone nome="fechar" />
        </button>
      </div>
      <PainelDeFiltros filtros={rascunho} aoMudar={setRascunho} />
      <div className={estilos.acoes}>
        <Botao onClick={() => setRascunho({ tiposVeiculo: ["carro", "moto"], tiposOcorrencia: ["furto", "roubo"], tiposDeDia: ["dia-util", "fim-de-semana"], periodos: ["hora-incerta", "madrugada", "manha", "noite", "tarde"] })}>Limpar</Botao>
        <Botao variante="principal" className={estilos.expandir} onClick={() => aoAplicar(rascunho)}>
          Ver {total} ocorrências
        </Botao>
      </div>
    </dialog>
  );
}

function useAviso(): [string | null, (texto: string) => void] {
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3000);
    return () => clearTimeout(t);
  }, [aviso]);
  return [aviso, setAviso];
}

export function Lugar() {
  const { filtros, consulta, area, atualizar } = useFiltros();
  const { search } = useLocation();
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [aviso, avisar] = useAviso();
  const geometria = useRecurso("/v1/geometria", RespostaGeometria);
  const zonas = useRecurso(comConsulta("/v1/zonas", consulta), RespostaZonas);
  const detalhe = useRecurso(area ? comConsulta(`/v1/area/${area}`, consulta) : null, RespostaArea);
  const descricao = descreverFiltros(filtros);
  const chips = chipsAtivos(filtros);

  useEffect(() => {
    document.title = "Onde e quando há mais registros · Ocorrências de veículos em SP";
  }, []);

  const compartilhar = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "Ocorrências de veículos em SP", url });
      else {
        await navigator.clipboard.writeText(url);
        avisar("Link copiado");
      }
    } catch {
      return;
    }
  };

  const erro = [geometria, zonas].find((r) => r?.estado === "erro");

  return (
    <div className={estilos.lugar}>
      <h1 className="so-leitor-de-tela">Onde e quando há mais registros</h1>

      <div className={estilos.areaDoMapa}>
        <div className={estilos.topo}>
          <div className={estilos.barraDeBusca}>
            <Icone nome="busca" />
            <span>São Paulo, cidade toda</span>
            <button type="button" className={estilos.botaoFiltros} onClick={() => setFiltrosAbertos(true)} aria-label="Abrir filtros" aria-haspopup="dialog">
              <Icone nome="filtros" />
            </button>
          </div>
          <ul className={estilos.chipsAtivos} aria-label="Filtros ativos">
            {chips.map((c) => (
              <li key={c}>
                <Icone nome="check" tamanho={18} />
                {c}
              </li>
            ))}
            <li>
              <button type="button" onClick={() => setFiltrosAbertos(true)}>
                {chips.length ? "+ Filtros" : "Filtros"}
              </button>
            </li>
          </ul>
        </div>

        {erro?.estado === "erro" ? (
          <div className={estilos.erro} role="alert">
            <p>Não deu pra carregar o mapa agora.</p>
            <Botao onClick={erro.tentarDeNovo}>Tentar de novo</Botao>
          </div>
        ) : geometria?.estado === "pronto" ? (
          <Suspense fallback={<div className={estilos.carregandoMapa}>Carregando mapa…</div>}>
            <MapaDeZonas geometria={geometria.dados} zonas={zonas?.dados} selecionada={area} aoSelecionar={(h3) => atualizar({ area: h3 })} />
          </Suspense>
        ) : (
          <div className={estilos.carregandoMapa}>Carregando mapa…</div>
        )}

        <div className={estilos.legendaFlutuante}>
          <Legenda />
        </div>
      </div>

      <aside className={estilos.coluna} aria-label="Resumo e filtros">
        <h2 className={estilos.tituloDaColuna}>Onde e quando há mais registros</h2>
        <div className={estilos.soDesktop}>
          <PainelDeFiltros filtros={filtros} aoMudar={(f) => atualizar({ filtros: f })} />
        </div>
        {area ? (
          <DetalheDaArea area={detalhe?.dados} carregando={detalhe?.estado === "carregando"} descricao={descricao} aoFechar={() => atualizar({ area: null })} />
        ) : (
          <Resumo zonas={zonas?.dados} descricao={descricao} />
        )}
        <div className={estilos.soCelular}>
          <Legenda />
        </div>
        <div className={estilos.acoes}>
          {area ? (
            <Link className={estilos.botaoLink} to={comConsulta("/lugar/tabela", search.slice(1))}>
              <Icone nome="lista" tamanho={20} />
              Ver como tabela
            </Link>
          ) : null}
          <Botao icone="compartilhar" onClick={() => void compartilhar()}>
            Compartilhar
          </Botao>
        </div>
      </aside>

      <DialogoDeFiltros
        key={String(filtrosAbertos)}
        aberto={filtrosAbertos}
        filtros={filtros}
        aoFechar={() => setFiltrosAbertos(false)}
        aoAplicar={(f) => {
          atualizar({ filtros: f });
          setFiltrosAbertos(false);
        }}
      />
      <div className={estilos.toast} role="status">
        {aviso}
      </div>
    </div>
  );
}

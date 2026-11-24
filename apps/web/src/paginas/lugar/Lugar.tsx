import { chipsAtivos, consultaDosFiltros, descreverFiltros, nomeDoModelo, pertoDe, TIPOS_VEICULO, RespostaArea, RespostaGeometria, RespostaRua, RespostaZonas, type Filtros, type RespostaGeometria as Geometria } from "@mapa/core";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { Botao } from "../../componentes/Botao.tsx";
import { useRecurso } from "../../dados/api.ts";
import { comConsulta, comModelo, useFiltros } from "../../dados/useFiltros.ts";
import { Icone } from "../../icones/Icone.tsx";
import estilos from "./Lugar.module.css";
import { PainelDeFiltros } from "./PainelDeFiltros.tsx";
import { DetalheDaArea, Legenda, Resumo, TotalDaRua } from "./Paineis.tsx";

const MapaDeZonas = lazy(() => import("../../mapa/MapaDeZonas.tsx"));

function DialogoDeFiltros({ aberto, filtros, modelo, aoAplicar, aoFechar }: { aberto: boolean; filtros: Filtros; modelo: string | null; aoAplicar: (f: Filtros) => void; aoFechar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [rascunho, setRascunho] = useState(filtros);
  const previa = useRecurso(aberto ? comConsulta("/v1/zonas", comModelo(consultaDosFiltros(rascunho), modelo)) : null, RespostaZonas);

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

function areaMaisPerto(geometria: Geometria, lon: number, lat: number): string | null {
  let melhor: string | null = null;
  let distancia = Infinity;
  for (const f of geometria.features) {
    const anel = f.geometry.coordinates[0] ?? [];
    const [x, y] = anel.reduce(([a, b], [lo, la]) => [a + lo / anel.length, b + la / anel.length], [0, 0]);
    const d = ((x - lon) * Math.cos((lat * Math.PI) / 180)) ** 2 + (y - lat) ** 2;
    if (d < distancia) [distancia, melhor] = [d, f.id];
  }
  return Math.sqrt(distancia) * 111 <= 2 ? melhor : null;
}

export function Lugar() {
  const { filtros, modelo, consulta, area, atualizar } = useFiltros();
  const { search } = useLocation();
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const local = params.get("local");
  const ehRua = params.get("categoria") === "rua";
  const celulasDaRua = params.get("celulas");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [aviso, avisar] = useAviso();
  const geometria = useRecurso("/v1/geometria", RespostaGeometria);
  const zonas = useRecurso(comConsulta("/v1/zonas", consulta), RespostaZonas);
  const detalhe = useRecurso(area ? comConsulta(`/v1/area/${area}`, consulta) : null, RespostaArea);
  const totalDaRua = useRecurso(
    local && ehRua ? comConsulta("/v1/rua", new URLSearchParams([...new URLSearchParams(consulta), ["nome", local], ...(celulasDaRua ? [["celulas", celulasDaRua]] : [])]).toString()) : null,
    RespostaRua,
  );
  const descricao = modelo ? `com ${nomeDoModelo(modelo)}, ${descreverFiltros({ ...filtros, tiposVeiculo: TIPOS_VEICULO })}` : descreverFiltros(filtros);
  const chips = chipsAtivos(modelo ? { ...filtros, tiposVeiculo: TIPOS_VEICULO } : filtros);

  useEffect(() => {
    document.title = "Onde e quando há mais registros · Ocorrências de veículos em SP";
  }, []);

  const pedirLocalizacao = params.get("minhaLocalizacao") === "1";
  const geometriaPronta = geometria?.estado === "pronto" ? geometria.dados : null;
  useEffect(() => {
    if (!pedirLocalizacao || !geometriaPronta) return;
    const semPedido = new URLSearchParams(search);
    semPedido.delete("minhaLocalizacao");
    const seguir = (area: string | null, mensagem?: string) => {
      if (area) semPedido.set("area", area);
      navegar(`/lugar?${semPedido.toString()}`, { replace: true });
      if (mensagem) avisar(mensagem);
    };
    if (!("geolocation" in navigator)) return seguir(null, "Seu navegador não informa a localização.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const area = areaMaisPerto(geometriaPronta, coords.longitude, coords.latitude);
        seguir(area, area ? undefined : "Não há áreas com registros perto de você, ou você está fora de São Paulo.");
      },
      () => seguir(null, "Não deu pra usar sua localização."),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  }, [pedirLocalizacao, geometriaPronta, search, navegar, avisar]);

  const paraBusca = consulta ? `/lugar/busca?${consulta}` : "/lugar/busca";
  const limparLocal = () => navegar(consulta ? `/lugar?${consulta}` : "/lugar");

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
            {local ? (
              <button type="button" className={estilos.botaoVoltar} onClick={limparLocal} aria-label="Voltar pra cidade toda">
                <Icone nome="voltar" />
              </button>
            ) : (
              <Icone nome="busca" />
            )}
            <Link to={paraBusca} className={estilos.linkDeBusca}>
              {local ?? "Buscar endereço, CEP ou região"}
            </Link>
            <button type="button" className={estilos.botaoFiltros} onClick={() => setFiltrosAbertos(true)} aria-label="Abrir filtros" aria-haspopup="dialog">
              <Icone nome="filtros" />
            </button>
          </div>
          <ul className={estilos.chipsAtivos} aria-label="Filtros ativos">
            {modelo && (
              <li>
                <button type="button" className={estilos.chipRemovivel} onClick={() => atualizar({ modelo: null })} aria-label={`Remover filtro de modelo ${nomeDoModelo(modelo)}`}>
                  {nomeDoModelo(modelo)}
                  <Icone nome="fechar" tamanho={18} />
                </button>
              </li>
            )}
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
            <MapaDeZonas geometria={geometria.dados} zonas={zonas?.dados} selecionada={area} aproximar={Boolean(local) || pedirLocalizacao} aoSelecionar={(h3) => atualizar({ area: h3 })} />
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
          <Link to={paraBusca} className={estilos.buscaDesktop}>
            <Icone nome="busca" />
            {local ?? "Buscar endereço, CEP ou região"}
          </Link>
          {local && (
            <button type="button" className={estilos.textoBotao} onClick={limparLocal}>
              Ver a cidade toda
            </button>
          )}
        </div>
        <div className={estilos.soDesktop}>
          <PainelDeFiltros filtros={filtros} aoMudar={(f) => atualizar({ filtros: f })} />
        </div>
        {area ? (
          <>
            <DetalheDaArea
              titulo={local ? pertoDe(local) : undefined}
              area={detalhe?.dados}
              carregando={detalhe?.estado === "carregando"}
              descricao={descricao}
              aoFechar={() => (local ? limparLocal() : atualizar({ area: null }))}
            />
            {local && ehRua && <TotalDaRua nome={local} total={totalDaRua?.estado === "pronto" ? totalDaRua.dados.total : undefined} />}
          </>
        ) : (
          <Resumo zonas={zonas?.dados} descricao={descricao} modelo={modelo ? nomeDoModelo(modelo) : null} />
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
        modelo={modelo}
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

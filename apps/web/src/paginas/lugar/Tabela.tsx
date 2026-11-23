import { chipsAtivos, RespostaArea, type Contagem } from "@mapa/core";
import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { useRecurso } from "../../dados/api.ts";
import { comConsulta, useFiltros } from "../../dados/useFiltros.ts";
import { Icone } from "../../icones/Icone.tsx";
import estilos from "./Tabela.module.css";
import { ROTULO_DA_DIRECAO } from "./Paineis.tsx";

const celula = (n: Contagem) => (n === null ? "Menos de 5" : n.toLocaleString("pt-BR"));

export function Tabela() {
  const { filtros, consulta, area } = useFiltros();
  const { search } = useLocation();
  const detalhe = useRecurso(area ? comConsulta(`/v1/area/${area}`, consulta) : null, RespostaArea);
  const voltar = comConsulta("/lugar", search.slice(1));
  const resumoDoFiltro = [...chipsAtivos(filtros), "últimos 12 meses"].join(" · ");

  useEffect(() => {
    document.title = "Tabela da área · Ocorrências de veículos em SP";
  }, []);

  return (
    <section className={estilos.pagina}>
      <div className={estilos.topo}>
        <Link to={voltar} className={estilos.voltar} aria-label="Voltar ao mapa">
          <Icone nome="voltar" />
        </Link>
        <h1>Área escolhida no mapa</h1>
      </div>
      <p className={estilos.nota}>{resumoDoFiltro}</p>

      {!area ? (
        <p>Escolha uma área no mapa pra ver a tabela.</p>
      ) : detalhe?.estado === "erro" ? (
        <p role="alert">
          Não deu pra carregar os números. <button onClick={detalhe.tentarDeNovo}>Tentar de novo</button>
        </p>
      ) : (
        <table className={estilos.tabela} aria-busy={detalhe?.estado !== "pronto"}>
          <caption className="so-leitor-de-tela">Ocorrências registradas na área escolhida e nas áreas vizinhas</caption>
          <thead>
            <tr>
              <th scope="col">Área</th>
              <th scope="col">Ocorrências</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Esta área (~1 km)</th>
              <td>{detalhe?.dados ? celula(detalhe.dados.total) : "…"}</td>
            </tr>
            {detalhe?.dados?.arredores.map((a) => (
              <tr key={a.direcao}>
                <th scope="row">{ROTULO_DA_DIRECAO[a.direcao]}</th>
                <td>{celula(a.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className={estilos.info}>
        <Icone nome="info" tamanho={20} />
        Ordenada por distância, não por volume. As mesmas respostas do mapa, sem depender dele.
      </p>
      <Link to={voltar} className={estilos.botao}>
        Ver no mapa
      </Link>
    </section>
  );
}

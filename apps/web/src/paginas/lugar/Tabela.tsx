import { chipsAtivos, formatarMilhar, nomeDoModelo, pertoDe, RespostaArea, RespostaZonas, type Contagem } from "@mapa/core";
import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { useRecurso } from "../../dados/api.ts";
import { comConsulta, useFiltros } from "../../dados/useFiltros.ts";
import { Icone } from "../../icones/Icone.tsx";
import estilos from "./Tabela.module.css";
import { ROTULO_DA_DIRECAO } from "./Paineis.tsx";

const celula = (n: Contagem) => (n === null ? "Menos de 5" : n.toLocaleString("pt-BR"));

export function Tabela() {
  const { filtros, modelo, consulta, area } = useFiltros();
  const { search } = useLocation();
  const local = new URLSearchParams(search).get("local");
  const detalhe = useRecurso(area ? comConsulta(`/v1/area/${area}`, consulta) : null, RespostaArea);
  const cidade = useRecurso(area ? null : comConsulta("/v1/zonas", consulta), RespostaZonas);
  const voltar = comConsulta("/lugar", search.slice(1));
  const buscar = comConsulta("/lugar/busca", new URLSearchParams([...new URLSearchParams(consulta), ["para", "tabela"]]).toString());
  const resumoDoFiltro = [...chipsAtivos(filtros), ...(modelo ? [nomeDoModelo(modelo)] : []), "últimos 12 meses"].join(" · ");
  const titulo = !area ? "Tabela por lugar" : local ? pertoDe(local) : "Área escolhida no mapa";

  useEffect(() => {
    document.title = `${titulo} · Ocorrências de veículos em SP`;
  }, [titulo]);

  return (
    <section className={estilos.pagina}>
      <div className={estilos.topo}>
        <Link to={voltar} className={estilos.voltar} aria-label="Voltar ao mapa">
          <Icone nome="voltar" />
        </Link>
        <h1>{titulo}</h1>
      </div>
      <p className={estilos.nota}>{resumoDoFiltro}</p>

      {!area ? (
        <>
          <p>
            {cidade?.estado === "pronto"
              ? `${formatarMilhar(cidade.dados.total)} ocorrências registradas com local na cidade toda, com estes filtros.`
              : cidade?.estado === "erro"
                ? "Não deu pra carregar o total da cidade agora."
                : "Carregando o total da cidade…"}
          </p>
          <Link to={buscar} className={estilos.botao}>
            <Icone nome="busca" tamanho={20} />
            Buscar endereço ou CEP
          </Link>
        </>
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

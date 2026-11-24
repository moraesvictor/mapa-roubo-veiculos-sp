import { descreverVariacao, formatarMilhar, PERIODOS_DO_DIA, ROTULOS, RespostaModelo, type Contagem, type TipoVeiculo } from "@mapa/core";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useRecurso } from "../../dados/api.ts";
import { Icone } from "../../icones/Icone.tsx";
import estilos from "./Veiculo.module.css";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloDoMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1] ?? ""}/${mes.slice(0, 4)}`;
const ordinal = (n: number) => `${n}º`;

function Linha({ pontos }: { pontos: { mes: string; total: Contagem }[] }) {
  const valores = pontos.map((p) => p.total ?? 0);
  const maior = Math.max(1, ...valores);
  const menor = 0;
  const largura = 480;
  const altura = 120;
  const x = (i: number) => (i / Math.max(1, pontos.length - 1)) * largura;
  const y = (v: number) => altura - 8 - ((v - menor) / Math.max(1, maior - menor)) * (altura - 16);
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className={estilos.grafico} aria-hidden="true" preserveAspectRatio="none">
      <line x1="0" x2={largura} y1={altura - 1} y2={altura - 1} className={estilos.eixo} />
      <polyline points={valores.map((v, i) => `${x(i)},${y(v)}`).join(" ")} className={estilos.serie} />
    </svg>
  );
}

export function ResultadoDoModelo() {
  const { veiculo = "moto", familia = "" } = useParams();
  const tipo: TipoVeiculo = veiculo === "carro" ? "carro" : "moto";
  const modelo = useRecurso(`/v1/modelo?veiculo=${tipo}&familia=${encodeURIComponent(familia)}`, RespostaModelo);
  const [tabela, setTabela] = useState(false);
  const dados = modelo?.estado === "pronto" ? modelo.dados : undefined;

  useEffect(() => {
    document.title = `${dados?.nome ?? "Modelo"} · Ocorrências de veículos em SP`;
  }, [dados?.nome]);

  const conhecidos = PERIODOS_DO_DIA.filter((p) => p !== "hora-incerta");
  const somaConhecidos = dados ? conhecidos.reduce((s, p) => s + (dados.porPeriodo[p] ?? 0), 0) : 0;
  const maiorPeriodo = dados ? Math.max(1, ...conhecidos.map((p) => dados.porPeriodo[p] ?? 0)) : 1;

  return (
    <section className={estilos.pagina}>
      <Link to={`/meu-veiculo?veiculo=${tipo}`} className={estilos.voltar}>
        <Icone nome="voltar" tamanho={20} /> Trocar modelo
      </Link>
      {modelo?.estado === "erro" ? (
        <p role="alert">{modelo.erro.status === 404 ? "Não há registros desse modelo nos últimos 24 meses." : "Não deu pra carregar agora."}</p>
      ) : !dados ? (
        <p aria-busy="true">Carregando…</p>
      ) : (
        <>
          <h1>{dados.nome}</h1>
          <div className={estilos.grade}>
            <div className={estilos.coluna}>
              <div className={estilos.destaque}>
                <p className={estilos.sobretitulo}>{dados.posicao === 1 ? (tipo === "moto" ? "Moto mais registrada em SP" : "Carro mais registrado em SP") : "Últimos 12 meses"}</p>
                <p className={estilos.numero}>{dados.total === null ? "Menos de 5 ocorrências registradas" : `${formatarMilhar(dados.total)} ocorrências registradas`}</p>
                <p>
                  nos últimos 12 meses, roubos e furtos somados{dados.posicao ? ` · ${ordinal(dados.posicao)} entre ${tipo === "moto" ? "as motos" : "os carros"}` : ""}
                </p>
              </div>
              <p className={estilos.info}>
                <Icone nome="info" tamanho={20} />
                Modelos mais comuns nas ruas também aparecem mais nos registros. Posição alta não quer dizer, sozinha, mais risco.
              </p>
              {dados.posicao && (
                <Link to={`/ranking?veiculo=${tipo}&seu=${encodeURIComponent(dados.familia)}`} className={estilos.link}>
                  Ver no ranking de {tipo === "moto" ? "motos" : "carros"} <Icone nome="seta" tamanho={20} />
                </Link>
              )}
              <Link to={`/lugar?veiculo=${tipo}&modelo=${encodeURIComponent(dados.familia)}`} className={estilos.principal}>
                Ver no mapa onde houve mais registros
              </Link>
            </div>

            <div className={estilos.coluna}>
              <section className={estilos.cartao} aria-labelledby="quando">
                <h2 id="quando">Quando mais acontece</h2>
                <dl className={estilos.barras}>
                  {conhecidos.map((p) => {
                    const n = dados.porPeriodo[p] ?? 0;
                    const pct = somaConhecidos ? Math.round((n / somaConhecidos) * 100) : 0;
                    return (
                      <div key={p} className={estilos.barra}>
                        <dt>{ROTULOS.periodo[p]}</dt>
                        <dd>
                          <span className={estilos.trilho} aria-hidden="true">
                            <span style={{ width: `${((dados.porPeriodo[p] ?? 0) / maiorPeriodo) * 100}%` }} />
                          </span>
                          <span>{dados.porPeriodo[p] === null ? "<5" : `${pct}%`}</span>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>

              <section className={estilos.cartao} aria-labelledby="evolucao">
                <h2 id="evolucao">Evolução mês a mês</h2>
                <p className={estilos.nota}>{descreverVariacao(dados.variacao)}</p>
                {tabela ? (
                  <table className={estilos.tabela}>
                    <caption className="so-leitor-de-tela">Ocorrências por mês</caption>
                    <thead>
                      <tr>
                        <th scope="col">Mês</th>
                        <th scope="col">Ocorrências</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.mensal.map((m) => (
                        <tr key={m.mes}>
                          <th scope="row">{rotuloDoMes(m.mes)}</th>
                          <td>{m.total === null ? "Menos de 5" : m.total.toLocaleString("pt-BR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <>
                    <Linha pontos={dados.mensal} />
                    <div className={estilos.eixoX}>
                      <span>{rotuloDoMes(dados.mensal[0]?.mes ?? "")}</span>
                      <span>{rotuloDoMes(dados.mensal.at(-1)?.mes ?? "")}</span>
                    </div>
                  </>
                )}
                <button type="button" className={estilos.link} onClick={() => setTabela((t) => !t)} aria-pressed={tabela}>
                  <Icone nome={tabela ? "grafico" : "lista"} tamanho={20} /> {tabela ? "Ver como gráfico" : "Ver como tabela"}
                </button>
                <p className={estilos.nota}>Os últimos meses podem subir um pouco nas próximas atualizações da SSP, porque parte dos boletins é registrada depois.</p>
              </section>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

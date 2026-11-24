import { formatarMilhar, RespostaRanking, type TipoVeiculo } from "@mapa/core";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Chip } from "../../componentes/Chip.tsx";
import { useRecurso } from "../../dados/api.ts";
import { Icone } from "../../icones/Icone.tsx";
import { caminhoDoModelo } from "./MeuVeiculo.tsx";
import estilos from "./Veiculo.module.css";

function textoDaVariacao(v: number | null) {
  if (v === null) return "sem comparação com os 12 meses anteriores";
  const pct = Math.round(Math.abs(v) * 100);
  if (pct < 5) return `= estável, ${v >= 0 ? "+" : "−"}${pct}% vs. 12 meses anteriores`;
  return v > 0 ? `↑ subiu ${pct}% vs. 12 meses anteriores` : `↓ caiu ${pct}% vs. 12 meses anteriores`;
}

const TIPOS = { todos: "Roubo e furto", roubo: "Só roubo", furto: "Só furto" } as const;

export function Ranking() {
  const [params, setParams] = useSearchParams();
  const veiculo: TipoVeiculo = params.get("veiculo") === "carro" ? "carro" : "moto";
  const tipo = (["roubo", "furto"] as const).find((t) => t === params.get("tipo")) ?? "todos";
  const seu = params.get("seu");
  const ranking = useRecurso(`/v1/ranking?veiculo=${veiculo}${tipo === "todos" ? "" : `&tipo=${tipo}`}&limite=10`, RespostaRanking);
  const dados = ranking?.estado === "pronto" ? ranking.dados : ranking?.dados;
  const maior = dados?.itens[0]?.total ?? 1;

  useEffect(() => {
    document.title = "Modelos com mais registros · Ocorrências de veículos em SP";
  }, []);

  const mudar = (mudancas: Record<string, string | null>) => {
    const novo = new URLSearchParams(params);
    for (const [k, v] of Object.entries(mudancas)) if (v === null) novo.delete(k);
    else novo.set(k, v);
    setParams(novo, { replace: true });
  };

  return (
    <section className={estilos.pagina}>
      <h1>Modelos com mais registros</h1>
      <div className={estilos.tipo}>
        <fieldset className={estilos.grupoEmLinha}>
          <legend className="so-leitor-de-tela">Tipo de veículo</legend>
          {(["carro", "moto"] as const).map((v) => (
            <Chip key={v} rotulo={v === "carro" ? "Carro" : "Moto"} selecionado={veiculo === v} aoAlternar={() => mudar({ veiculo: v })} />
          ))}
        </fieldset>
        <fieldset className={estilos.grupoEmLinha}>
          <legend className="so-leitor-de-tela">Tipo de ocorrência</legend>
          {(Object.keys(TIPOS) as (keyof typeof TIPOS)[]).map((t) => (
            <Chip key={t} rotulo={TIPOS[t]} selecionado={tipo === t} aoAlternar={() => mudar({ tipo: t === "todos" ? null : t })} />
          ))}
        </fieldset>
      </div>
      <p className={estilos.info}>
        <Icone nome="info" tamanho={20} />
        Modelos mais comuns nas ruas também aparecem mais nos registros. Últimos 12 meses{dados ? ` (${dados.desde.split("-").reverse().join("/")} a ${dados.atualizadoAte.split("-").reverse().join("/")})` : ""}.
      </p>

      {ranking?.estado === "erro" ? (
        <p role="alert">Não deu pra carregar o ranking agora.</p>
      ) : (
        <ol className={estilos.ranking} aria-busy={ranking?.estado !== "pronto"}>
          {dados?.itens.map((item) => (
            <li key={item.familia}>
              <Link to={caminhoDoModelo(veiculo, item.familia)} className={estilos.itemDoRanking} aria-current={seu === item.familia ? "true" : undefined}>
                <span className={estilos.posicao}>{item.posicao}</span>
                <span className={estilos.corpoDoItem}>
                  {seu === item.familia && <span className={estilos.seu}>Seu modelo</span>}
                  <strong>{item.nome}</strong>
                  <span className={estilos.trilho} aria-hidden="true">
                    <span style={{ width: `${(item.total / maior) * 100}%` }} />
                  </span>
                  <span className={estilos.nota}>{textoDaVariacao(item.variacao)}</span>
                </span>
                <span className={estilos.total}>{formatarMilhar(item.total)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {dados && (
        <p className={estilos.nota}>
          Outros modelos (menos de 5 registros cada): {dados.outros.modelos.toLocaleString("pt-BR")} modelos, {formatarMilhar(dados.outros.ocorrencias)} ocorrências · Modelo não identificado no boletim:{" "}
          {formatarMilhar(dados.naoIdentificado)}.
        </p>
      )}
    </section>
  );
}

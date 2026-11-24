import { buscarLugares, formatarMilhar, RespostaModelos, type TipoVeiculo } from "@mapa/core";
import { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Chip } from "../../componentes/Chip.tsx";
import { useRecurso } from "../../dados/api.ts";
import { Icone } from "../../icones/Icone.tsx";
import estilos from "./Veiculo.module.css";

export const caminhoDoModelo = (veiculo: TipoVeiculo, familia: string) => `/meu-veiculo/${veiculo}/${encodeURIComponent(familia)}`;

export function MeuVeiculo() {
  const [params, setParams] = useSearchParams();
  const veiculo: TipoVeiculo = params.get("veiculo") === "carro" ? "carro" : "moto";
  const [texto, setTexto] = useState("");
  const [ativo, setAtivo] = useState(-1);
  const navegar = useNavigate();
  const id = useId();
  const modelos = useRecurso(`/v1/modelos?veiculo=${veiculo}`, RespostaModelos);

  useEffect(() => {
    document.title = "Meu veículo · Ocorrências de veículos em SP";
  }, []);

  const sugestoes = useMemo(() => {
    if (modelos?.estado !== "pronto" || texto.trim().length < 2) return [];
    const comoLugares = modelos.dados.modelos.map((m) => ({ nome: m.nome, tipo: "rua" as const, perto: "", celulas: [], celula: m.familia, centro: [0, 0] as [number, number], total: m.total }));
    return buscarLugares(comoLugares, texto, 6).map((r) => modelos.dados.modelos.find((m) => m.familia === r.lugar.celula)).filter((m) => m !== undefined);
  }, [modelos, texto]);

  const abrir = (familia: string) => navegar(caminhoDoModelo(veiculo, familia));

  return (
    <section className={estilos.pagina}>
      <h1>Meu veículo é visado?</h1>
      <p className={estilos.apoio}>Veja quantos roubos e furtos foram registrados com o seu modelo em SP.</p>
      <fieldset className={estilos.tipo}>
        <legend className="so-leitor-de-tela">Tipo de veículo</legend>
        {(["carro", "moto"] as const).map((v) => (
          <Chip key={v} rotulo={v === "carro" ? "Carro" : "Moto"} selecionado={veiculo === v} aoAlternar={() => setParams({ veiculo: v }, { replace: true })} />
        ))}
      </fieldset>

      <label htmlFor={`${id}-modelo`} className={estilos.rotulo}>
        Modelo
      </label>
      <div className={estilos.caixa}>
        <Icone nome="busca" />
        <input
          id={`${id}-modelo`}
          type="text"
          role="combobox"
          aria-expanded={sugestoes.length > 0}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={ativo >= 0 ? `${id}-op-${ativo}` : undefined}
          autoComplete="off"
          placeholder={veiculo === "moto" ? "Ex.: CG 160" : "Ex.: HB20"}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAtivo(-1);
          }}
          onKeyDown={(e) => {
            if (!sugestoes.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAtivo((a) => (a + 1) % sugestoes.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtivo((a) => (a <= 0 ? sugestoes.length - 1 : a - 1));
            } else if (e.key === "Enter") {
              const escolhido = sugestoes[Math.max(ativo, 0)];
              if (escolhido) abrir(escolhido.familia);
            }
          }}
        />
      </div>
      <div id={`${id}-lista`} role="listbox" aria-label="Modelos" className={estilos.sugestoes} hidden={!sugestoes.length}>
        {sugestoes.map((m, i) => (
          <div key={m.familia} id={`${id}-op-${i}`} role="option" aria-selected={i === ativo} tabIndex={-1} className={estilos.sugestao} onClick={() => abrir(m.familia)} onKeyDown={(e) => e.key === "Enter" && abrir(m.familia)}>
            <span>
              <strong>{m.nome}</strong>
              <span>{formatarMilhar(m.total)} ocorrências nos últimos 12 meses</span>
            </span>
            <Icone nome="seta" />
          </div>
        ))}
      </div>
      <p className={estilos.nota} role="status">
        {modelos?.estado === "erro"
          ? "Não deu pra carregar os modelos agora."
          : texto.trim().length >= 2 && modelos?.estado === "pronto" && !sugestoes.length
            ? "Nenhum modelo com 5 ou mais registros com esse nome."
            : "Agrupamos as versões do mesmo modelo (ex.: CG 160 Fan e CG 160 Titan)."}
      </p>
      <Link to={`/ranking?veiculo=${veiculo}`} className={estilos.link}>
        Ver os modelos com mais registros <Icone nome="seta" tamanho={20} />
      </Link>
    </section>
  );
}

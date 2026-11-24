import {
  DIRECOES,
  ESCALA_DO_MAPA,
  formatarContagem,
  PERIODOS_DO_DIA,
  ROTULOS,
  type Contagem,
  type RespostaArea,
  type RespostaZonas,
} from "@mapa/core";
import { Icone } from "../../icones/Icone.tsx";
import estilos from "./Lugar.module.css";

export function Legenda() {
  return (
    <div className={estilos.legenda}>
      <div className={estilos.escala} aria-hidden="true">
        <span>Menos</span>
        <span className={estilos.cores}>
          {ESCALA_DO_MAPA.map((cor, i) => (
            <span key={cor} style={{ background: cor, outline: i === ESCALA_DO_MAPA.length - 1 ? "1px solid var(--cor-borda-forte)" : undefined }} />
          ))}
        </span>
        <span>Mais</span>
      </div>
      <p className={estilos.nota}>Cores relativas ao filtro atual. Contorno escuro: concentração acima do esperado.</p>
    </div>
  );
}

export function Resumo({ zonas, descricao, modelo = null }: { zonas: RespostaZonas | undefined; descricao: string; modelo?: string | null }) {
  return (
    <section className={estilos.resumo} aria-labelledby="titulo-resumo" aria-busy={!zonas}>
      <h2 id="titulo-resumo">São Paulo, cidade toda</h2>
      <p aria-live="polite">{zonas ? `${formatarContagem(zonas.total)} ${descricao}.` : "Carregando…"}</p>
      {modelo ? (
        <p className={estilos.aviso} role="note">
          Com filtro de modelo, o mapa mostra só as áreas com 5 ou mais ocorrências do {modelo}, sem marcar zonas de concentração.
        </p>
      ) : zonas?.poucosRegistros && (
        <p className={estilos.aviso} role="note">
          Poucos registros com esse filtro (menos de 200): o mapa mostra as contagens, mas não marca zonas de concentração.
        </p>
      )}
      <p className={estilos.nota}>Pode refletir mais veículos circulando por aqui. Toque numa área do mapa pra ver o detalhe.</p>
    </section>
  );
}

const valor = (c: Contagem) => (c === null ? "<5" : c.toLocaleString("pt-BR"));

export function TotalDaRua({ nome, total }: { nome: string; total: Contagem | undefined }) {
  return (
    <section className={estilos.totalDaRua} aria-labelledby="titulo-rua" aria-busy={total === undefined}>
      <h3 id="titulo-rua">Na {nome} inteira</h3>
      <p aria-live="polite">{total === undefined ? "Carregando…" : `${formatarContagem(total)}, com os mesmos filtros.`}</p>
      <p className={estilos.nota}>Ruas longas somam mais registros.</p>
    </section>
  );
}

export function DetalheDaArea({ area, descricao, aoFechar, carregando, titulo }: { area: RespostaArea | undefined; descricao: string; aoFechar: () => void; carregando: boolean; titulo?: string | undefined }) {
  const maior = Math.max(1, ...PERIODOS_DO_DIA.map((p) => area?.porPeriodo[p] ?? 0));
  return (
    <section className={estilos.detalhe} aria-labelledby="titulo-detalhe" aria-busy={carregando}>
      <div className={estilos.cabecalhoDoDetalhe}>
        <p className={estilos.nota}>{titulo ? `${titulo} · área de cerca de 1 km` : "Esta área · cerca de 1 km"}</p>
        <button type="button" className={estilos.fechar} onClick={aoFechar} aria-label="Fechar detalhe da área">
          <Icone nome="fechar" />
        </button>
      </div>
      <h2 id="titulo-detalhe" aria-live="polite">
        {area ? formatarContagem(area.total) : "Carregando…"}
      </h2>
      <p className={estilos.nota}>{descricao}</p>
      {area?.zona && <p className={estilos.selo}>Zona de concentração com esse filtro</p>}
      {area && (
        <>
          <h3>Quando mais acontece (todos os períodos)</h3>
          <dl className={estilos.barras}>
            {PERIODOS_DO_DIA.filter((p) => p !== "hora-incerta").map((p) => {
              const n = area.porPeriodo[p];
              return (
                <div key={p} className={estilos.barra}>
                  <dt>{ROTULOS.periodo[p]}</dt>
                  <dd>
                    <span className={estilos.trilho} aria-hidden="true">
                      <span style={{ width: `${((n ?? 2) / maior) * 100}%` }} />
                    </span>
                    <span>{n === null ? "menos de 5" : n.toLocaleString("pt-BR")}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
          <p>
            {valor(area.porTipoDeLocal["via-publica"])} em via pública · {valor(area.porTipoDeLocal.estacionamento)} em estacionamento
          </p>
        </>
      )}
    </section>
  );
}

export const ROTULO_DA_DIRECAO: Record<(typeof DIRECOES)[number], string> = {
  norte: "1–2 km ao norte",
  leste: "1–2 km a leste",
  sul: "1–2 km ao sul",
  oeste: "1–2 km a oeste",
};

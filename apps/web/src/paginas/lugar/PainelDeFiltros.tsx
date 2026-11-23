import {
  faixaDoPeriodo,
  normalizarFiltros,
  PERIODOS_DO_DIA,
  ROTULOS,
  TIPOS_DE_DIA,
  TIPOS_OCORRENCIA,
  TIPOS_VEICULO,
  type Filtros,
} from "@mapa/core";
import { Chip } from "../../componentes/Chip.tsx";
import estilos from "./Lugar.module.css";

type Dimensao = keyof Filtros;

function alternar<T extends string>(lista: readonly T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

function Grupo<T extends string>(props: { titulo: string; dimensao: Dimensao; valores: readonly T[]; rotulos: Record<T, string>; filtros: Filtros; aoMudar: (f: Filtros) => void }) {
  const selecionados = props.filtros[props.dimensao] as readonly string[];
  return (
    <fieldset className={estilos.grupo}>
      <legend>{props.titulo}</legend>
      <div className={estilos.chips}>
        {props.valores.map((v) => (
          <Chip
            key={v}
            rotulo={props.rotulos[v]}
            selecionado={selecionados.includes(v)}
            aoAlternar={() => props.aoMudar(normalizarFiltros({ ...props.filtros, [props.dimensao]: alternar(selecionados, v) }))}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function PainelDeFiltros({ filtros, aoMudar }: { filtros: Filtros; aoMudar: (f: Filtros) => void }) {
  return (
    <div className={estilos.filtros}>
      <Grupo titulo="Veículo" dimensao="tiposVeiculo" valores={TIPOS_VEICULO} rotulos={ROTULOS.veiculo} filtros={filtros} aoMudar={aoMudar} />
      <Grupo titulo="Tipo" dimensao="tiposOcorrencia" valores={TIPOS_OCORRENCIA} rotulos={ROTULOS.tipo} filtros={filtros} aoMudar={aoMudar} />
      <Grupo titulo="Período do dia" dimensao="periodos" valores={PERIODOS_DO_DIA} rotulos={ROTULOS.periodo} filtros={filtros} aoMudar={aoMudar} />
      <Grupo titulo="Dia" dimensao="tiposDeDia" valores={TIPOS_DE_DIA} rotulos={ROTULOS.dia} filtros={filtros} aoMudar={aoMudar} />
      <p className={estilos.nota}>
        Madrugada {faixaDoPeriodo("madrugada")} · Manhã {faixaDoPeriodo("manha")} · Tarde {faixaDoPeriodo("tarde")} · Noite {faixaDoPeriodo("noite")}. &quot;Hora incerta&quot; são
        registros sem horário no boletim (cerca de 2%).
      </p>
    </div>
  );
}

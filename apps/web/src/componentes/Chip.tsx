import { Icone } from "../icones/Icone.tsx";
import estilos from "./Chip.module.css";

interface Props {
  rotulo: string;
  selecionado: boolean;
  aoAlternar: () => void;
}

export function Chip({ rotulo, selecionado, aoAlternar }: Props) {
  return (
    <button type="button" className={estilos.chip} aria-pressed={selecionado} onClick={aoAlternar}>
      {selecionado && <Icone nome="check" tamanho={18} />}
      {rotulo}
    </button>
  );
}

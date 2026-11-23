import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icone, type NomeDeIcone } from "../icones/Icone.tsx";
import estilos from "./Botao.module.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "principal" | "secundario";
  icone?: NomeDeIcone;
  children: ReactNode;
}

export function Botao({ variante = "secundario", icone, children, type = "button", className, ...resto }: Props) {
  return (
    <button type={type} className={[estilos.botao, estilos[variante], className].filter(Boolean).join(" ")} {...resto}>
      {icone && <Icone nome={icone} tamanho={20} />}
      {children}
    </button>
  );
}

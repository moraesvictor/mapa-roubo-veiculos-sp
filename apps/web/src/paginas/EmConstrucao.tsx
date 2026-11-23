import { useEffect } from "react";
import estilos from "./EmConstrucao.module.css";

export function EmConstrucao({ titulo, descricao }: { titulo: string; descricao: string }) {
  useEffect(() => {
    document.title = `${titulo} · Ocorrências de veículos em SP`;
  }, [titulo]);

  return (
    <section className={estilos.pagina}>
      <h1>{titulo}</h1>
      <p>{descricao}</p>
      <p className={estilos.aviso}>Em construção.</p>
    </section>
  );
}

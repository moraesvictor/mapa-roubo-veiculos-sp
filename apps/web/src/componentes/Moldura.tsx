import { NavLink, Outlet } from "react-router";
import { Icone, type NomeDeIcone } from "../icones/Icone.tsx";
import estilos from "./Moldura.module.css";

export const ABAS: { caminho: string; rotulo: string; icone: NomeDeIcone }[] = [
  { caminho: "/", rotulo: "Lugar", icone: "mapa" },
  { caminho: "/meu-veiculo", rotulo: "Meu veículo", icone: "veiculo" },
  { caminho: "/ranking", rotulo: "Ranking", icone: "grafico" },
  { caminho: "/sobre", rotulo: "Sobre", icone: "info" },
];

export function Moldura() {
  return (
    <div className={estilos.moldura}>
      <a className={estilos.pular} href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className={estilos.cabecalho}>
        <NavLink to="/" className={estilos.marca ?? ""}>
          <span className={estilos.selo}>
            <Icone nome="mapa" tamanho={18} />
          </span>
          Ocorrências de veículos · SP
        </NavLink>
        <nav aria-label="Principal" className={estilos.navegacao}>
          <ul>
            {ABAS.map((aba) => (
              <li key={aba.caminho}>
                <NavLink to={aba.caminho} end className={estilos.aba ?? ""}>
                  <Icone nome={aba.icone} />
                  <span>{aba.rotulo}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="conteudo" tabIndex={-1} className={estilos.conteudo}>
        <Outlet />
      </main>
    </div>
  );
}

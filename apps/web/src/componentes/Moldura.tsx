import { NavLink, Outlet, useLocation } from "react-router";
import { Icone, type NomeDeIcone } from "../icones/Icone.tsx";
import estilos from "./Moldura.module.css";

export const ABAS: { caminho: string; rotulo: string; icone: NomeDeIcone; prefixos?: string[] }[] = [
  { caminho: "/lugar", rotulo: "Lugar", icone: "mapa", prefixos: ["/", "/lugar"] },
  { caminho: "/meu-veiculo", rotulo: "Meu veículo", icone: "veiculo" },
  { caminho: "/ranking", rotulo: "Ranking", icone: "grafico" },
  { caminho: "/sobre", rotulo: "Sobre", icone: "info" },
];

export function Moldura() {
  const { pathname } = useLocation();
  const ativa = (aba: (typeof ABAS)[number]) => (aba.prefixos ?? [aba.caminho]).some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(`${p}/`)));
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
                <NavLink to={aba.caminho} className={estilos.aba ?? ""} aria-current={ativa(aba) ? "page" : undefined}>
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

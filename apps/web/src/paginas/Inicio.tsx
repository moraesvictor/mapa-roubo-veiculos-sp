import { RespostaSobre } from "@mapa/core";
import { useEffect } from "react";
import { Link } from "react-router";
import { useRecurso } from "../dados/api.ts";
import { Icone, type NomeDeIcone } from "../icones/Icone.tsx";
import estilos from "./Inicio.module.css";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (data: string) => `${MESES[Number(data.slice(5, 7)) - 1] ?? ""}/${data.slice(0, 4)}`;

function Cartao({ para, icone, titulo, texto }: { para: string; icone: NomeDeIcone; titulo: string; texto: string }) {
  return (
    <Link to={para} className={estilos.cartao}>
      <span className={estilos.selo}>
        <Icone nome={icone} />
      </span>
      <span className={estilos.textoDoCartao}>
        <strong>{titulo}</strong>
        <span>{texto}</span>
      </span>
      <Icone nome="seta" />
    </Link>
  );
}

export function Inicio() {
  const sobre = useRecurso("/v1/sobre", RespostaSobre);
  useEffect(() => {
    document.title = "Ocorrências de veículos em SP";
  }, []);

  return (
    <div className={estilos.inicio}>
      <header className={estilos.destaque}>
        <div className={estilos.conteudo}>
          <p className={estilos.sobretitulo}>
            Dados oficiais da SSP-SP{sobre?.estado === "pronto" ? ` · atualizados até ${mesAno(sobre.dados.atualizadoAte)}` : ""}
          </p>
          <h1>Onde e quando mais acontecem roubos e furtos de carros e motos em São Paulo</h1>
          <p className={estilos.apoio}>Veja as ocorrências registradas perto de um endereço, ou descubra se o seu modelo está entre os mais registrados. Sem rótulos de &quot;lugar perigoso&quot;.</p>
        </div>
      </header>

      <div className={estilos.conteudo}>
        <h2>Por onde você quer começar?</h2>
        <div className={estilos.cartoes}>
          <Cartao para="/lugar" icone="mapa" titulo="Ver um lugar" texto="Veja no mapa onde e quando houve mais registros, filtrando por veículo, horário e dia." />
          <Cartao para="/meu-veiculo" icone="veiculo" titulo="Ver meu veículo" texto="Escolha carro ou moto e o modelo pra ver quantos roubos e furtos foram registrados." />
        </div>
        <ul className={estilos.atalhos}>
          <li>
            <Link to="/ranking">
              Modelos com mais registros <Icone nome="seta" tamanho={20} />
            </Link>
          </li>
          <li>
            <Link to="/sobre">
              Sobre os dados e limitações <Icone nome="seta" tamanho={20} />
            </Link>
          </li>
        </ul>
        <p className={estilos.aviso}>
          <Icone nome="info" tamanho={20} />
          Muito furto não é registrado: os números ficam abaixo da realidade. Mais veículos circulando também gera mais registros, não necessariamente mais risco.
        </p>
      </div>
    </div>
  );
}

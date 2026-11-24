import { useState } from "react";
import { createBrowserRouter, createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { Moldura } from "./componentes/Moldura.tsx";
import { EmConstrucao } from "./paginas/EmConstrucao.tsx";
import { Inicio } from "./paginas/Inicio.tsx";
import { Lugar } from "./paginas/lugar/Lugar.tsx";
import { Tabela } from "./paginas/lugar/Tabela.tsx";
import { Busca } from "./paginas/lugar/Busca.tsx";
import { MeuVeiculo } from "./paginas/veiculo/MeuVeiculo.tsx";
import { Ranking } from "./paginas/veiculo/Ranking.tsx";
import { ResultadoDoModelo } from "./paginas/veiculo/ResultadoDoModelo.tsx";

export const ROTAS: RouteObject[] = [
  {
    element: <Moldura />,
    children: [
      { index: true, element: <Inicio /> },
      { path: "lugar", element: <Lugar /> },
      { path: "lugar/tabela", element: <Tabela /> },
      { path: "lugar/busca", element: <Busca /> },
      { path: "meu-veiculo", element: <MeuVeiculo /> },
      { path: "meu-veiculo/:veiculo/:familia", element: <ResultadoDoModelo /> },
      { path: "ranking", element: <Ranking /> },
      {
        path: "sobre",
        element: <EmConstrucao titulo="Sobre os dados" descricao="De onde vêm os dados, o que fica de fora e quais são os limites." />,
      },
      {
        path: "*",
        element: <EmConstrucao titulo="Página não encontrada" descricao="Use a navegação pra voltar a uma das seções." />,
      },
    ],
  },
];

export function App({ caminhoInicial }: { caminhoInicial?: string }) {
  const [roteador] = useState(() => (caminhoInicial ? createMemoryRouter(ROTAS, { initialEntries: [caminhoInicial] }) : createBrowserRouter(ROTAS)));
  return <RouterProvider router={roteador} />;
}

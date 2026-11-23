import { useState } from "react";
import { createBrowserRouter, createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { Moldura } from "./componentes/Moldura.tsx";
import { EmConstrucao } from "./paginas/EmConstrucao.tsx";

export const ROTAS: RouteObject[] = [
  {
    element: <Moldura />,
    children: [
      {
        index: true,
        element: <EmConstrucao titulo="Onde e quando há mais registros" descricao="Busque um endereço, CEP ou região pra ver as ocorrências registradas por perto." />,
      },
      {
        path: "meu-veiculo",
        element: <EmConstrucao titulo="Meu veículo" descricao="Veja se o seu modelo aparece muito nos registros de roubo e furto." />,
      },
      {
        path: "ranking",
        element: <EmConstrucao titulo="Ranking de modelos" descricao="Modelos com mais roubos e furtos registrados em São Paulo nos últimos 12 meses." />,
      },
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

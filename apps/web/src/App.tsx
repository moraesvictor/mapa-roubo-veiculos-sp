import { TIPOS_VEICULO } from "@mapa/core";

const ROTULOS = { carro: "Carro", moto: "Moto" } as const;

export function App() {
  return (
    <main>
      <h1>Onde e quando mais acontecem roubos e furtos de carros e motos</h1>
      <p>Dados oficiais da SSP-SP.</p>
      <ul aria-label="Tipos de veículo">
        {TIPOS_VEICULO.map((tipo) => (
          <li key={tipo}>{ROTULOS[tipo]}</li>
        ))}
      </ul>
    </main>
  );
}

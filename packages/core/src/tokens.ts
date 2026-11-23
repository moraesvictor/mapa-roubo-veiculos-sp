export const CORES = {
  "texto-principal": "#212121",
  "texto-secundario": "#6B6B6B",
  "texto-invertido": "#FFFFFF",
  "superficie-padrao": "#FFFFFF",
  "superficie-fundo": "#F0F0F0",
  "superficie-destaque": "#212121",
  "superficie-nota": "#FFF2C7",
  "borda-padrao": "#CCCCCC",
  "borda-forte": "#212121",
  foco: "#2F3B94",
  "marca-principal": "#2F3B94",
  "marca-suave": "#EEF0FA",
  "mapa-terreno": "#ECEAE4",
  "mapa-quadra": "#F8F7F4",
  "mapa-parque": "#DCE6D5",
  "mapa-agua": "#D4E1EE",
  "mapa-zona-contorno": "#212121",
} as const;

export const ESCALA_DO_MAPA = ["#E6E8F0", "#C5CADC", "#9AA2C2", "#6B759F", "#414A78"] as const;

export const ESPACOS = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 } as const;

export const RAIOS = { campo: 6, cartao: 8, tela: 24, chip: 999 } as const;

export const ALVO_DE_TOQUE = 44;

export const TEXTOS = {
  "titulo-pagina": { peso: 700, tamanho: 28, altura: 1.25 },
  "titulo-secao": { peso: 600, tamanho: 20, altura: 1.3 },
  "titulo-bloco": { peso: 600, tamanho: 16, altura: 1.35 },
  "titulo-tela": { peso: 700, tamanho: 18, altura: 1.3 },
  "corpo-padrao": { peso: 400, tamanho: 15, altura: 1.45 },
  "corpo-campo": { peso: 400, tamanho: 16, altura: 1.4 },
  "rotulo-campo": { peso: 500, tamanho: 13, altura: 1.3 },
  "rotulo-chip": { peso: 500, tamanho: 14, altura: 1.2 },
  legenda: { peso: 400, tamanho: 12, altura: 1.4 },
} as const;

export function variaveisCss(): string {
  const linhas = [
    ...Object.entries(CORES).map(([nome, valor]) => `--cor-${nome}: ${valor};`),
    ...ESCALA_DO_MAPA.map((valor, i) => `--mapa-escala-${i + 1}: ${valor};`),
    ...Object.entries(ESPACOS).map(([nome, valor]) => `--espaco-${nome}: ${valor}px;`),
    ...Object.entries(RAIOS).map(([nome, valor]) => `--raio-${nome}: ${valor}px;`),
    `--alvo-de-toque: ${ALVO_DE_TOQUE}px;`,
    ...Object.entries(TEXTOS).map(([nome, t]) => `--texto-${nome}: ${t.peso} ${t.tamanho}px/${t.altura} var(--fonte);`),
  ];
  return `:root {\n${linhas.map((l) => `  ${l}`).join("\n")}\n}\n`;
}

const arquivos = import.meta.glob<string>("./svg/*.svg", { query: "?raw", import: "default", eager: true });

const conteudos = Object.fromEntries(
  Object.entries(arquivos).map(([caminho, svg]) => [
    caminho.replace(/^\.\/svg\/|\.svg$/g, ""),
    svg
      .replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, "")
      .replace(/(stroke|fill)="#212121"/g, '$1="currentColor"'),
  ]),
);

export const NOMES_DE_ICONE = [
  "bandeira",
  "busca",
  "check",
  "compartilhar",
  "fechar",
  "filtros",
  "grafico",
  "info",
  "lista",
  "localizacao",
  "mapa",
  "pino",
  "seta",
  "veiculo",
  "voltar",
] as const;

export type NomeDeIcone = (typeof NOMES_DE_ICONE)[number];

export function Icone({ nome, tamanho = 24 }: { nome: NomeDeIcone; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: conteudos[nome] ?? "" }}
    />
  );
}

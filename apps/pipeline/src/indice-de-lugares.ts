import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { brotliCompressSync } from "node:zlib";
import { construirLugares, fatiar, type ElementoOsm } from "./lugares.ts";

const raiz = new URL("../../../", import.meta.url);
const osm = new URL("data/tmp/osm/", raiz);
const destino = new URL("data/tmp/pipeline/publico/busca/", raiz);

const ler = async (nome: string) => {
  try {
    return (JSON.parse(await readFile(new URL(`${nome}.json`, osm), "utf8")) as { elements: ElementoOsm[] }).elements;
  } catch {
    throw new Error(`Falta ${osm.pathname}${nome}.json. Rode antes: pnpm --filter @mapa/pipeline osm:baixar`);
  }
};

const lugares = construirLugares(await ler("ruas"), await ler("lugares"));
const fatias = fatiar(lugares);
await rm(destino, { recursive: true, force: true });
await mkdir(destino, { recursive: true });
const tamanhos: number[] = [];
for (const [chave, itens] of [...fatias].sort(([a], [b]) => a.localeCompare(b))) {
  const json = JSON.stringify(itens);
  tamanhos.push(brotliCompressSync(json).length);
  await writeFile(new URL(`${chave}.json`, destino), json);
}
await writeFile(
  new URL("LICENCA.txt", destino),
  "Índice de ruas e bairros de São Paulo gerado a partir do OpenStreetMap.\n© OpenStreetMap contributors. Dados disponíveis sob a Open Database License (ODbL): https://www.openstreetmap.org/copyright\n",
);
tamanhos.sort((a, b) => a - b);
const kb = (n: number) => Math.round(n / 102.4) / 10;
console.log(
  JSON.stringify({
    lugares: lugares.length,
    ruas: lugares.filter((l) => l.tipo === "rua").length,
    bairros: lugares.filter((l) => l.tipo === "bairro").length,
    fatias: fatias.size,
    brotliKB: { mediana: kb(tamanhos[Math.floor(tamanhos.length / 2)] ?? 0), max: kb(tamanhos.at(-1) ?? 0) },
  }),
);

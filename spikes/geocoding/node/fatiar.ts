import { readFile } from "node:fs/promises";
import { brotliCompressSync } from "node:zlib";
import { tokens, type Indice } from "./busca.ts";

export const GENERICAS = new Set(["rua", "avenida", "travessa", "praca", "alameda", "estrada", "viela", "largo", "rodovia", "viaduto", "ponte", "beco", "passagem", "via", "acesso", "ladeira", "vila", "jardim", "parque", "conjunto", "residencial", "doutor", "professor", "general", "coronel", "sao", "santo", "santa", "nossa", "senhora"]);
export const fatia = (nome: string) => (tokens(nome).find((t) => !GENERICAS.has(t)) ?? tokens(nome)[0] ?? "_").slice(0, 2);

const indice = JSON.parse(await readFile(new URL("../../../data/tmp/osm/indice.json", import.meta.url), "utf8")) as Indice;
const fatias = new Map<string, Indice["entradas"]>();
for (const e of indice.entradas) fatias.set(fatia(e.nome), [...(fatias.get(fatia(e.nome)) ?? []), e]);
const tamanhos = [...fatias.values()].map((f) => brotliCompressSync(JSON.stringify({ entradas: f })).length).sort((a, b) => a - b);
const kb = (n: number) => Math.round(n / 102.4) / 10;
console.log(JSON.stringify({ fatias: fatias.size, brotliKB: { mediana: kb(tamanhos[Math.floor(tamanhos.length / 2)]!), p90: kb(tamanhos[Math.floor(tamanhos.length * 0.9)]!), max: kb(tamanhos.at(-1)!) } }));

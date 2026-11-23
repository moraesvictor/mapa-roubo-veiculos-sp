import { readFile, writeFile } from "node:fs/promises";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { gridDisk, latLngToCell } from "h3-js";
import { normalizar, type Entrada, type Indice } from "./busca.ts";

interface Elemento { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> }
const pasta = new URL("../../../data/tmp/osm/", import.meta.url);
const ler = async (nome: string) => (JSON.parse(await readFile(new URL(`${nome}.json`, pasta), "utf8")) as { elements: Elemento[] }).elements;
const RES = 8;

const ruas = await ler("ruas");
const lugares = await ler("lugares");

const vistos = new Set<string>();
const bairros = lugares
  .map((l) => ({ nome: l.tags.name!, lat: l.center?.lat ?? l.lat!, lon: l.center?.lon ?? l.lon! }))
  .filter((b) => b.lat && !vistos.has(normalizar(b.nome)) && vistos.add(normalizar(b.nome)));
const maisPerto = (lat: number, lon: number) => {
  let melhor = "";
  let d = Infinity;
  for (const b of bairros) {
    const dd = (b.lat - lat) ** 2 + ((b.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (dd < d) [d, melhor] = [dd, b.nome];
  }
  return melhor;
};

const porNome = new Map<string, { nome: string; outros: Set<string>; pontos: { lat: number; lon: number; celula: string }[] }>();
const apelidos = (t: Record<string, string>) => ["alt_name", "official_name", "short_name", "old_name"].flatMap((k) => t[k]?.split(";").map((v) => v.trim()) ?? []).filter((v) => v && normalizar(v) !== normalizar(t.name!));
for (const w of ruas) {
  if (!w.center) continue;
  const chave = normalizar(w.tags.name!);
  const grupo = porNome.get(chave) ?? { nome: w.tags.name!, outros: new Set<string>(), pontos: [] };
  for (const a of apelidos(w.tags)) grupo.outros.add(a);
  grupo.pontos.push({ ...w.center, celula: latLngToCell(w.center.lat, w.center.lon, RES) });
  porNome.set(chave, grupo);
}

const entradas: Entrada[] = [];
for (const { nome, outros, pontos } of porNome.values()) {
  const celulas = new Set(pontos.map((p) => p.celula));
  const visitadas = new Set<string>();
  for (const inicio of celulas) {
    if (visitadas.has(inicio)) continue;
    const componente = new Set<string>();
    const fila = [inicio];
    visitadas.add(inicio);
    while (fila.length) {
      const c = fila.pop()!;
      componente.add(c);
      for (const v of gridDisk(c, 1)) if (celulas.has(v) && !visitadas.has(v)) {
        visitadas.add(v);
        fila.push(v);
      }
    }
    const doComponente = pontos.filter((p) => componente.has(p.celula));
    const lat = doComponente.reduce((s, p) => s + p.lat, 0) / doComponente.length;
    const lon = doComponente.reduce((s, p) => s + p.lon, 0) / doComponente.length;
    entradas.push({ nome, ...(outros.size ? { outros: [...outros] } : {}), tipo: "rua", perto: maisPerto(lat, lon), celulas: [...componente].sort(), centro: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] });
  }
}
for (const b of bairros)
  entradas.push({ nome: b.nome, tipo: "bairro", perto: b.nome, celulas: [latLngToCell(b.lat, b.lon, RES)], centro: [Math.round(b.lon * 1e5) / 1e5, Math.round(b.lat * 1e5) / 1e5] });

const indice: Indice = { entradas };
const json = JSON.stringify(indice);
await writeFile(new URL("indice.json", pasta), json);
const kb = (n: number) => Math.round(n / 1024);
console.log(JSON.stringify({
  trechosDeRua: ruas.length,
  nomesDeRua: porNome.size,
  entradasDeRua: entradas.filter((e) => e.tipo === "rua").length,
  nomesRepetidosEmLugaresDiferentes: (() => {
    const contagem = new Map<string, number>();
    for (const e of entradas) if (e.tipo === "rua") contagem.set(normalizar(e.nome), (contagem.get(normalizar(e.nome)) ?? 0) + 1);
    return [...contagem.values()].filter((n) => n > 1).length;
  })(),
  bairros: bairros.length,
  tamanhoKB: { bruto: kb(json.length), gzip: kb(gzipSync(json).length), brotli: kb(brotliCompressSync(json).length) },
}, null, 1));

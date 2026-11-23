import { readFile } from "node:fs/promises";
import { cellToLatLng } from "h3-js";
import { buscar, type Indice } from "./busca.ts";
const base = new URL("../../../data/tmp/osm/", import.meta.url).pathname;
const indice = JSON.parse(await readFile(base + "indice.json", "utf8")) as Indice;
for (const r of buscar(indice, "Rua 25 de Março")) console.log(r.entrada.nome, "|", r.entrada.perto, "|", r.entrada.celulas.length, "áreas |", r.pontos.toFixed(1));
const ceps = (JSON.parse(await readFile(base + "ceps.json", "utf8")) as { elements: { tags: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }[] }).elements;
const km = (a: number[], b: number[]) => Math.hypot((b[0]! - a[0]!) * 111.2, (b[1]! - a[1]!) * 111.2 * Math.cos((a[0]! * Math.PI) / 180));
const vias: Record<string, string> = { "01310200": "Avenida Paulista, Bela Vista", "01001000": "Praça da Sé, Sé", "04094050": "Avenida Pedro Álvares Cabral, Parque Ibirapuera", "01311000": "Avenida Paulista, Bela Vista", "05407002": "Rua Cardeal Arcoverde, Pinheiros", "03016000": "Rua Oriente, Brás", "08210000": "Rua Campinas do Piauí, Itaquera", "04571010": "Avenida Engenheiro Luiz Carlos Berrini, Cidade Monções" };
for (const [cep, via] of Object.entries(vias)) {
  const pts = ceps.filter((e) => e.tags["addr:postcode"]!.replace(/\D/g, "") === cep).map((e) => e.center ?? { lat: e.lat!, lon: e.lon! });
  const osm = [pts.reduce((s, p) => s + p.lat, 0) / pts.length, pts.reduce((s, p) => s + p.lon, 0) / pts.length];
  const r = buscar(indice, via);
  const melhor = Math.min(...r.flatMap((x) => x.entrada.celulas.map((c) => km(osm, cellToLatLng(c)))));
  const primeiro = Math.min(...r[0]!.entrada.celulas.map((c) => km(osm, cellToLatLng(c))));
  console.log(cep, via, "| 1º resultado a", primeiro.toFixed(1), "km do CEP na OSM | melhor dos 5:", melhor.toFixed(1), "km");
}

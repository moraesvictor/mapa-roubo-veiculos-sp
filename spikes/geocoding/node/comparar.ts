import { readFile, writeFile } from "node:fs/promises";
import { cellToLatLng, gridDisk, latLngToCell } from "h3-js";
import { buscar, normalizar, type Indice } from "./busca.ts";

const pasta = new URL("../../../data/tmp/osm/", import.meta.url);
const indice = JSON.parse(await readFile(new URL("indice.json", pasta), "utf8")) as Indice;
const ceps = (JSON.parse(await readFile(new URL("ceps.json", pasta), "utf8")) as { elements: { tags: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }[] }).elements;
const UA = "geocoding-comparison-spike/0.1";
const VIEWBOX = "-46.83,-23.35,-46.36,-24.01";
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

const CASOS: { grupo: string; consulta: string; referencia?: string }[] = [
  ...["Avenida Paulista, 1578", "Rua Augusta", "Rua Augusta, Consolação", "Rua Oscar Freire", "Avenida Brigadeiro Faria Lima", "Rua 25 de Março", "Estrada do M'Boi Mirim", "Avenida Sapopemba", "Rua Teodoro Sampaio", "Avenida Rebouças", "Rua Domingos de Morais", "Avenida Celso Garcia", "Avenida Inajar de Souza", "Rua Voluntários da Pátria", "Avenida Washington Luís", "Rua da Consolação", "Avenida Ipiranga"].map((consulta) => ({ grupo: "rua", consulta })),
  { grupo: "abreviada ou sem acento", consulta: "av paulista", referencia: "Avenida Paulista" },
  { grupo: "abreviada ou sem acento", consulta: "av brig faria lima", referencia: "Avenida Brigadeiro Faria Lima" },
  { grupo: "abreviada ou sem acento", consulta: "av reboucas", referencia: "Avenida Rebouças" },
  { grupo: "abreviada ou sem acento", consulta: "voluntarios da patria", referencia: "Rua Voluntários da Pátria" },
  { grupo: "erro de digitação", consulta: "avenida paulsta", referencia: "Avenida Paulista" },
  { grupo: "erro de digitação", consulta: "rua teodoro sampaoi", referencia: "Rua Teodoro Sampaio" },
  { grupo: "digitando (autocompletar)", consulta: "rua teodoro samp", referencia: "Rua Teodoro Sampaio" },
  { grupo: "digitando (autocompletar)", consulta: "av rebou", referencia: "Avenida Rebouças" },
  ...["Pinheiros", "Vila Madalena", "Mooca", "Itaquera", "Capão Redondo", "Santana", "Tatuapé", "Lapa", "Brasilândia", "Parelheiros"].map((consulta) => ({ grupo: "bairro", consulta })),
  ...["Mercado Municipal de São Paulo", "MASP", "Estádio do Morumbi"].map((consulta) => ({ grupo: "ponto de interesse", consulta })),
];
const CEPS = ["01310-200", "01001-000", "04094-050", "01311-000", "05407-002", "03016-000", "08210-000", "04571-010"];

async function nominatim(q: string) {
  const t0 = performance.now();
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: "jsonv2", limit: "1", countrycodes: "br", viewbox: VIEWBOX, bounded: "1" })}`;
  const r = (await (await fetch(url, { headers: { "user-agent": UA } })).json()) as { lat: string; lon: string; display_name: string }[];
  await esperar(1100);
  return { ms: Math.round(performance.now() - t0), ponto: r[0] ? { lat: Number(r[0].lat), lon: Number(r[0].lon) } : null, nome: r[0]?.display_name.split(",")[0] };
}

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI * Math.cos((a.lat * Math.PI) / 180)) / 180;
  return Math.round(Math.sqrt(dLat ** 2 + dLon ** 2) * 6371 * 10) / 10;
};

function local(q: string) {
  const t0 = performance.now();
  const [r] = buscar(indice, q);
  return { ms: Math.round((performance.now() - t0) * 10) / 10, entrada: r?.entrada };
}

function concorda(entrada: ReturnType<typeof local>["entrada"], ponto: { lat: number; lon: number } | null) {
  if (!entrada || !ponto) return null;
  const alvo = new Set(gridDisk(latLngToCell(ponto.lat, ponto.lon, 8), 1));
  const distancia = Math.min(...entrada.celulas.map((c) => km(ponto, (([lat, lon]) => ({ lat, lon }))(cellToLatLng(c)))));
  return { mesmaArea: entrada.celulas.some((c) => alvo.has(c)), kmAteAArea: distancia };
}

const linhas: Record<string, unknown>[] = [];
for (const caso of CASOS) {
  const l = local(caso.consulta);
  const comoDigitado = await nominatim(caso.consulta);
  const referencia = caso.referencia ? await nominatim(caso.referencia) : comoDigitado;
  const linha = {
    ...caso,
    local: l.entrada ? `${l.entrada.nome} (${l.entrada.tipo}, perto de ${l.entrada.perto}, ${l.entrada.celulas.length} áreas)` : null,
    localMs: l.ms,
    nominatimComoDigitado: comoDigitado.nome ?? null,
    nominatimMs: comoDigitado.ms,
    comparacao: concorda(l.entrada, referencia.ponto),
  };
  linhas.push(linha);
  console.log(JSON.stringify(linha));
}

const naOsm = new Map<string, { lat: number; lon: number }>();
for (const e of ceps) {
  const p = e.center ?? (e.lat ? { lat: e.lat, lon: e.lon! } : null);
  if (p) naOsm.set(e.tags["addr:postcode"]!.replace(/\D/g, ""), p);
}
for (const cep of CEPS) {
  const so = cep.replace(/\D/g, "");
  const t0 = performance.now();
  const via = (await (await fetch(`https://viacep.com.br/ws/${so}/json/`)).json()) as { logradouro?: string; bairro?: string; erro?: boolean };
  const viaMs = Math.round(performance.now() - t0);
  const t1 = performance.now();
  const brasil = (await (await fetch(`https://brasilapi.com.br/api/cep/v2/${so}`)).json()) as { street?: string; location?: { coordinates?: { latitude?: string; longitude?: string } } };
  const brasilMs = Math.round(performance.now() - t1);
  const coords = brasil.location?.coordinates;
  const pontoBrasil = coords?.latitude ? { lat: Number(coords.latitude), lon: Number(coords.longitude) } : null;
  const l = via.logradouro ? local(`${via.logradouro}, ${via.bairro ?? ""}`) : { ms: 0, entrada: undefined };
  const linha = {
    grupo: "cep",
    consulta: cep,
    viaCep: via.erro ? "não encontrado" : `${via.logradouro}, ${via.bairro}`,
    viaCepMs: viaMs,
    brasilApiTemCoordenada: Boolean(pontoBrasil),
    brasilApiMs: brasilMs,
    ruaNoIndiceLocal: l.entrada ? `${l.entrada.nome} (perto de ${l.entrada.perto})` : null,
    cepNaOsm: naOsm.has(so),
    comparacaoComBrasilApi: concorda(l.entrada, pontoBrasil),
  };
  linhas.push(linha);
  console.log(JSON.stringify(linha));
  await esperar(500);
}

const cepsUnicos = new Set([...naOsm.keys()].filter((c) => c.length === 8));
console.log(JSON.stringify({ cepsDistintosNaOsmEmSp: cepsUnicos.size, normalizadoExemplo: normalizar("Avenida Paulista") }));
await writeFile(new URL("./resultados.ndjson", import.meta.url), linhas.map((l) => JSON.stringify(l)).join("\n") + "\n");

import { fatiaDe, simplificar, type Lugar } from "@mapa/core";
import { cellToLatLng, gridDisk, latLngToCell } from "h3-js";

export interface ElementoOsm {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

const RESOLUCAO = 8;
const arredondar = (v: number) => Math.round(v * 1e5) / 1e5;
const posicao = (e: ElementoOsm) => (e.center ?? (e.lat !== undefined && e.lon !== undefined ? { lat: e.lat, lon: e.lon } : null));

function apelidos(tags: Record<string, string>): string[] {
  const nome = simplificar(tags["name"] ?? "");
  return ["alt_name", "official_name", "short_name", "old_name"]
    .flatMap((k) => tags[k]?.split(";").map((v) => v.trim()) ?? [])
    .filter((v) => v && simplificar(v) !== nome);
}

function celulaMaisPerto(celulas: Iterable<string>, lat: number, lon: number): string {
  let melhor = "";
  let distancia = Infinity;
  for (const c of celulas) {
    const [clat, clon] = cellToLatLng(c);
    const d = (clat - lat) ** 2 + ((clon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < distancia) [distancia, melhor] = [d, c];
  }
  return melhor;
}

export function construirLugares(ruas: readonly ElementoOsm[], areas: readonly ElementoOsm[]): Lugar[] {
  const vistos = new Set<string>();
  const bairros = areas.flatMap((a) => {
    const p = posicao(a);
    const nome = a.tags["name"];
    if (!p || !nome || vistos.has(simplificar(nome))) return [];
    vistos.add(simplificar(nome));
    return [{ nome, ...p }];
  });
  const bairroMaisPerto = (lat: number, lon: number) => {
    let melhor = "";
    let distancia = Infinity;
    for (const b of bairros) {
      const d = (b.lat - lat) ** 2 + ((b.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
      if (d < distancia) [distancia, melhor] = [d, b.nome];
    }
    return melhor;
  };

  const porNome = new Map<string, { nome: string; outros: Set<string>; pontos: { lat: number; lon: number; celula: string }[] }>();
  for (const via of ruas) {
    const p = posicao(via);
    const nome = via.tags["name"];
    if (!p || !nome) continue;
    const chave = simplificar(nome);
    const grupo = porNome.get(chave) ?? { nome, outros: new Set<string>(), pontos: [] };
    for (const a of apelidos(via.tags)) grupo.outros.add(a);
    grupo.pontos.push({ ...p, celula: latLngToCell(p.lat, p.lon, RESOLUCAO) });
    porNome.set(chave, grupo);
  }

  const lugares: Lugar[] = [];
  for (const { nome, outros, pontos } of porNome.values()) {
    const celulas = new Set(pontos.map((p) => p.celula));
    const visitadas = new Set<string>();
    for (const inicio of celulas) {
      if (visitadas.has(inicio)) continue;
      const componente = new Set<string>();
      const fila = [inicio];
      visitadas.add(inicio);
      for (let atual = fila.pop(); atual !== undefined; atual = fila.pop()) {
        componente.add(atual);
        for (const v of gridDisk(atual, 1))
          if (celulas.has(v) && !visitadas.has(v)) {
            visitadas.add(v);
            fila.push(v);
          }
      }
      const doComponente = pontos.filter((p) => componente.has(p.celula));
      const lat = doComponente.reduce((s, p) => s + p.lat, 0) / doComponente.length;
      const lon = doComponente.reduce((s, p) => s + p.lon, 0) / doComponente.length;
      lugares.push({
        nome,
        ...(outros.size ? { outros: [...outros].sort() } : {}),
        tipo: "rua",
        perto: bairroMaisPerto(lat, lon),
        celulas: [...componente].sort(),
        celula: celulaMaisPerto(componente, lat, lon),
        centro: [arredondar(lon), arredondar(lat)],
      });
    }
  }
  for (const b of bairros) {
    const celula = latLngToCell(b.lat, b.lon, RESOLUCAO);
    lugares.push({ nome: b.nome, tipo: "bairro", perto: b.nome, celulas: [celula], celula, centro: [arredondar(b.lon), arredondar(b.lat)] });
  }
  return lugares.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.celula.localeCompare(b.celula));
}

export function fatiar(lugares: readonly Lugar[]): Map<string, Lugar[]> {
  const fatias = new Map<string, Lugar[]>();
  for (const l of lugares) {
    const chaves = new Set([l.nome, ...(l.outros ?? [])].map((n) => fatiaDe(n) ?? "_"));
    for (const chave of chaves) fatias.set(chave, [...(fatias.get(chave) ?? []), l]);
  }
  return fatias;
}

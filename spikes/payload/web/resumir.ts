import { readFile } from "node:fs/promises";

interface Visita { dados: number; mapaBase: number; zonasVisiveis: number; trocasMs: number[]; kB: Record<string, number> }
interface Linha { perfil: string; variante: string; frio: Visita; quente: Visita }

const linhas = (await readFile(process.argv[2]!, "utf8")).trim().split("\n").map((l) => JSON.parse(l) as Linha);
const mediana = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
const grupos = new Map<string, Linha[]>();
for (const l of linhas) grupos.set(`${l.perfil} · ${l.variante}`, [...(grupos.get(`${l.perfil} · ${l.variante}`) ?? []), l]);
for (const [nome, g] of grupos) {
  const m = (f: (l: Linha) => number) => mediana(g.map(f));
  console.log(
    `${nome.padEnd(22)} frio: dados ${m((l) => l.frio.dados)} ms · mapa base ${m((l) => l.frio.mapaBase)} ms · zonas ${m((l) => l.frio.zonasVisiveis)} ms · trocas ${m((l) => l.frio.trocasMs[0]!)}/${m((l) => l.frio.trocasMs[1]!)} ms` +
      ` | quente: zonas ${m((l) => l.quente.zonasVisiveis)} ms | kB ${JSON.stringify(g[0]!.frio.kB)}`,
  );
}

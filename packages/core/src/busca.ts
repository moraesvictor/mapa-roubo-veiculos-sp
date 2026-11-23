export type TipoDeLugar = "rua" | "bairro";

export interface Lugar {
  nome: string;
  outros?: string[];
  tipo: TipoDeLugar;
  perto: string;
  celulas: string[];
  celula: string;
  centro: [lon: number, lat: number];
}

export interface Resultado {
  lugar: Lugar;
  pontos: number;
}

const ABREVIACOES: Record<string, string> = {
  av: "avenida",
  r: "rua",
  al: "alameda",
  pca: "praca",
  pc: "praca",
  est: "estrada",
  estr: "estrada",
  rod: "rodovia",
  tv: "travessa",
  trav: "travessa",
  lgo: "largo",
  lg: "largo",
  vd: "viaduto",
  pq: "parque",
  jd: "jardim",
  vl: "vila",
  dr: "doutor",
  prof: "professor",
  eng: "engenheiro",
  gen: "general",
  cel: "coronel",
  pres: "presidente",
  sto: "santo",
  sta: "santa",
  s: "sao",
  sra: "senhora",
  cap: "capitao",
  mal: "marechal",
  brig: "brigadeiro",
};
const IGNORADAS = new Set(["de", "da", "do", "das", "dos", "e", "n", "no", "numero"]);
const CIDADE = new Set(["sao paulo", "sp", "brasil", "brazil"]);
const GENERICAS = new Set([
  "rua",
  "avenida",
  "travessa",
  "praca",
  "alameda",
  "estrada",
  "viela",
  "largo",
  "rodovia",
  "viaduto",
  "ponte",
  "beco",
  "passagem",
  "via",
  "acesso",
  "ladeira",
  "vila",
  "jardim",
  "parque",
  "conjunto",
  "residencial",
  "doutor",
  "professor",
  "general",
  "coronel",
  "sao",
  "santo",
  "santa",
  "nossa",
  "senhora",
]);

export const simplificar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const palavras = (texto: string) =>
  simplificar(texto)
    .split(" ")
    .filter((t, i, todos) => t && !(/^\d+$/.test(t) && i === todos.length - 1 && i > 0))
    .map((t) => ABREVIACOES[t] ?? t)
    .filter((t) => !IGNORADAS.has(t));

export function separarConsulta(texto: string) {
  const pedacos = texto
    .split(/,|;|\s-\s/)
    .map((p) => p.trim())
    .filter((p) => p && !CIDADE.has(simplificar(p)) && !/^\d+$/.test(simplificar(p)));
  return { principal: pedacos[0] ?? "", contexto: pedacos.slice(1).flatMap(palavras) };
}

export function cepDe(texto: string): string | null {
  const so = texto.replace(/\D/g, "");
  return /^\d{5}-?\d{3}$/.test(texto.trim()) && so.length === 8 ? so : null;
}

export function fatiaDe(texto: string): string | null {
  const todas = palavras(texto);
  const chave = todas.find((t) => !GENERICAS.has(t)) ?? todas[0];
  return chave && chave.length >= 2 ? chave.slice(0, 2) : null;
}

function parecido(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let erros = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++erros > 1) return false;
    if (a[i + 1] === b[j] && a[i] === b[j + 1]) {
      i += 2;
      j += 2;
      continue;
    }
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return erros + (a.length - i) + (b.length - j) <= 1;
}

function casar(consulta: string, palavra: string, ultima: boolean) {
  if (palavra === consulta) return 3;
  if (ultima && palavra.startsWith(consulta)) return 2;
  if (consulta.length >= 4 && parecido(consulta, palavra)) return 1;
  return 0;
}

export function buscarLugares(lugares: readonly Lugar[], texto: string, limite = 5): Resultado[] {
  const { principal, contexto } = separarConsulta(texto);
  const consulta = palavras(principal);
  if (!consulta.length) return [];
  const resultados: Resultado[] = [];
  for (const lugar of lugares) {
    let pontos = -1;
    for (const nome of [lugar.nome, ...(lugar.outros ?? [])]) {
      const doNome = palavras(nome);
      let soma = 0;
      for (let k = 0; k < consulta.length && soma >= 0; k++) {
        const termo = consulta[k] ?? "";
        const melhor = Math.max(0, ...doNome.map((p) => casar(termo, p, k === consulta.length - 1)));
        soma = melhor ? soma + melhor : -1;
      }
      if (soma >= 0 && doNome.length === consulta.length) soma += 2;
      pontos = Math.max(pontos, soma);
    }
    if (pontos < 0) continue;
    pontos += Math.min(lugar.celulas.length, 10) / 10 + (lugar.tipo === "bairro" ? 0.5 : 0);
    if (contexto.length && contexto.every((c) => palavras(lugar.perto).some((p) => casar(c, p, true)))) pontos += 3;
    resultados.push({ lugar, pontos });
  }
  return resultados.sort((a, b) => b.pontos - a.pontos).slice(0, limite);
}

const FEMININOS = /^(rua|avenida|praca|praça|estrada|alameda|travessa|rodovia|marginal|ponte|viela|ladeira|passagem|via|vila)\b/i;
const MASCULINOS = /^(largo|viaduto|parque|jardim|beco|acesso|conjunto|residencial|complexo|terminal)\b/i;

export function pertoDe(nome: string): string {
  if (FEMININOS.test(nome)) return `Perto da ${nome}`;
  if (MASCULINOS.test(nome)) return `Perto do ${nome}`;
  return `Perto de ${nome}`;
}

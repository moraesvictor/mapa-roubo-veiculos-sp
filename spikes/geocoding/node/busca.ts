export type Tipo = "rua" | "bairro";
export interface Entrada { nome: string; outros?: string[]; tipo: Tipo; perto: string; celulas: string[]; centro: [number, number] }
export interface Indice { entradas: Entrada[] }
export interface Resultado { entrada: Entrada; pontos: number }

const ABREVIACOES: Record<string, string> = {
  av: "avenida", r: "rua", al: "alameda", pca: "praca", pc: "praca", est: "estrada", estr: "estrada", rod: "rodovia",
  tv: "travessa", trav: "travessa", lgo: "largo", lg: "largo", vd: "viaduto", pq: "parque", jd: "jardim", vl: "vila",
  dr: "doutor", prof: "professor", eng: "engenheiro", gen: "general", cel: "coronel", pres: "presidente",
  sto: "santo", sta: "santa", s: "sao", sra: "senhora", cap: "capitao", mal: "marechal", brig: "brigadeiro",
};
const IGNORADAS = new Set(["de", "da", "do", "das", "dos", "e", "n", "no", "numero"]);
const CIDADE = new Set(["sao paulo", "sp", "brasil", "brazil"]);

export function partes(texto: string) {
  const pedacos = texto.split(/,|;|\s-\s/).map((p) => p.trim()).filter((p) => p && !CIDADE.has(normalizar(p)) && !/^\d+$/.test(normalizar(p)));
  return { principal: pedacos[0] ?? "", contexto: pedacos.slice(1).flatMap(tokens) };
}

export const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export const tokens = (texto: string) =>
  normalizar(texto)
    .split(" ")
    .filter((t, i, todos) => t && !(/^\d+$/.test(t) && i === todos.length - 1 && i > 0))
    .map((t) => ABREVIACOES[t] ?? t)
    .filter((t) => !IGNORADAS.has(t));

export const cepDe = (texto: string) => {
  const so = texto.replace(/\D/g, "");
  return /^\d{5}-?\d{3}$/.test(texto.trim()) && so.length === 8 ? so : null;
};

function parecido(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let erros = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++erros > 1) return false;
    if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; continue; }
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return erros + (a.length - i) + (b.length - j) <= 1;
}

function casar(consulta: string, palavra: string, ultimo: boolean) {
  if (palavra === consulta) return 3;
  if (ultimo && palavra.startsWith(consulta)) return 2;
  if (consulta.length >= 4 && parecido(consulta, palavra)) return 1;
  return 0;
}

export function buscar(indice: Indice, texto: string, limite = 5): Resultado[] {
  const { principal, contexto } = partes(texto);
  const q = tokens(principal);
  if (!q.length) return [];
  const resultados: Resultado[] = [];
  for (const entrada of indice.entradas) {
    let pontos = -1;
    for (const nome of [entrada.nome, ...(entrada.outros ?? [])]) {
      const palavras = tokens(nome);
      let soma = 0;
      for (let k = 0; k < q.length && soma >= 0; k++) {
        const melhor = Math.max(0, ...palavras.map((p) => casar(q[k]!, p, k === q.length - 1)));
        soma = melhor ? soma + melhor : -1;
      }
      if (soma >= 0 && palavras.length === q.length) soma += 2;
      pontos = Math.max(pontos, soma);
    }
    if (pontos < 0) continue;
    pontos += Math.min(entrada.celulas.length, 10) / 10 + (entrada.tipo === "bairro" ? 0.5 : 0);
    if (contexto.length && contexto.every((c) => tokens(entrada.perto).some((p) => casar(c, p, true)))) pontos += 3;
    resultados.push({ entrada, pontos });
  }
  return resultados.sort((a, b) => b.pontos - a.pontos).slice(0, limite);
}

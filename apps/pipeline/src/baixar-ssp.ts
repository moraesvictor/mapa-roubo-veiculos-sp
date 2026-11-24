import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const SITE = "https://www.ssp.sp.gov.br/";
const INDICE = `${SITE}assets/estatistica/transparencia/baseDadosCelVeiEObjSub.json`;
const CABECALHOS = { "user-agent": "Mozilla/5.0 (compatible; open-data-pipeline/0.1)" };
const ANOS = Number(process.env.ANOS ?? 3);

const brutos = new URL("../../../data/raw/", import.meta.url);
const controle = new URL(".versoes.json", brutos);

interface Indice {
  data: { nome: string; lista: { periodo: string; arquivo: string }[] }[];
}

export function arquivosDeVeiculos(indice: Indice, anos: number): { ano: number; url: string }[] {
  const grupo = indice.data.find((g) => g.nome.toLowerCase().startsWith("veículos subtraídos") || g.nome.toLowerCase().startsWith("veiculos subtraidos"));
  if (!grupo) throw new Error("Índice da SSP sem o grupo 'Veículos subtraídos'");
  return grupo.lista
    .map((l) => ({ ano: Number(l.periodo), url: new URL(l.arquivo, SITE).toString() }))
    .filter((a) => Number.isInteger(a.ano) && /VeiculosSubtraidos_\d{4}\.xlsx$/.test(a.url))
    .sort((a, b) => b.ano - a.ano)
    .slice(0, anos);
}

async function lerVersoes(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(controle, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

async function existe(arquivo: URL) {
  try {
    return (await stat(arquivo)).size > 0;
  } catch {
    return false;
  }
}

async function principal() {
  await mkdir(brutos, { recursive: true });
  const texto = await (await fetch(INDICE, { headers: CABECALHOS })).text();
  const alvos = arquivosDeVeiculos(JSON.parse(texto.replace(/^\uFEFF/, "")) as Indice, ANOS);
  const versoes = await lerVersoes();

  for (const { ano, url } of alvos) {
    const nome = `VeiculosSubtraidos_${ano}.xlsx`;
    const destino = new URL(nome, brutos);
    const cabeca = await fetch(url, { method: "HEAD", headers: CABECALHOS });
    if (!cabeca.ok) throw new Error(`${nome}: HEAD respondeu ${cabeca.status}`);
    const versao = cabeca.headers.get("etag") ?? cabeca.headers.get("last-modified") ?? "";
    if (versao && versoes[nome] === versao && (await existe(destino))) {
      console.log(JSON.stringify({ arquivo: nome, situacao: "sem mudança" }));
      continue;
    }
    const t0 = performance.now();
    const resposta = await fetch(url, { headers: CABECALHOS });
    if (!resposta.ok || !resposta.body) throw new Error(`${nome}: download respondeu ${resposta.status}`);
    const temporario = new URL(`${nome}.parcial`, brutos);
    await pipeline(Readable.fromWeb(resposta.body as import("node:stream/web").ReadableStream), createWriteStream(temporario));
    await rm(destino, { force: true });
    await rename(temporario, destino);
    versoes[nome] = versao;
    await writeFile(controle, JSON.stringify(versoes, null, 2) + "\n");
    console.log(JSON.stringify({ arquivo: nome, situacao: "baixado", MB: Math.round((await stat(destino)).size / 1e5) / 10, segundos: Math.round((performance.now() - t0) / 100) / 10 }));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await principal();

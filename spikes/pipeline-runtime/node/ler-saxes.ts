import type { Readable } from "node:stream";
import { SaxesParser } from "saxes";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { SUBTRACAO, medir } from "./medir.ts";

const arquivo = process.argv[2];
if (!arquivo) throw new Error("uso: node ler-saxes.ts <arquivo.xlsx>");
const fim = medir("yauzl + saxes", arquivo);

const abrir = (caminho: string) =>
  new Promise<ZipFile>((ok, erro) => yauzl.open(caminho, { lazyEntries: true, autoClose: false }, (e, z) => (e ? erro(e) : ok(z))));

const listar = (zip: ZipFile) =>
  new Promise<Map<string, Entry>>((ok, erro) => {
    const entradas = new Map<string, Entry>();
    zip.on("entry", (e: Entry) => {
      entradas.set(e.fileName, e);
      zip.readEntry();
    });
    zip.on("end", () => ok(entradas));
    zip.on("error", erro);
    zip.readEntry();
  });

const fluxo = (zip: ZipFile, entrada: Entry) =>
  new Promise<Readable>((ok, erro) => zip.openReadStream(entrada, (e, s) => (e ? erro(e) : ok(s))));

async function texto(zip: ZipFile, entrada: Entry) {
  let saida = "";
  for await (const pedaco of await fluxo(zip, entrada)) saida += pedaco.toString("utf8");
  return saida;
}

async function percorrer(zip: ZipFile, entrada: Entry, configurar: (p: SaxesParser) => void) {
  const parser = new SaxesParser();
  configurar(parser);
  for await (const pedaco of await fluxo(zip, entrada)) parser.write(pedaco.toString("utf8"));
  parser.close();
}

const zip = await abrir(arquivo);
const entradas = await listar(zip);

const workbook = await texto(zip, entradas.get("xl/workbook.xml")!);
const rels = await texto(zip, entradas.get("xl/_rels/workbook.xml.rels")!);
const alvos = new Map([...rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="([^"]+)"/g)].map((m) => [m[1] ?? m[4]!, m[2] ?? m[3]!]));
const abas = [...workbook.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((m) => {
  const alvo = alvos.get(m[2]!)!.replace(/^\//, "");
  const caminho = alvo.startsWith("xl/") ? alvo : `xl/${alvo}`;
  return { nome: m[1]!, entrada: entradas.get(caminho)! };
});
const aba = abas.reduce((a, b) => (b.entrada.uncompressedSize > a.entrada.uncompressedSize ? b : a));

const compartilhadas: string[] = [];
const ss = entradas.get("xl/sharedStrings.xml");
if (ss) {
  await percorrer(zip, ss, (p) => {
    let atual = "";
    let dentroT = false;
    p.on("opentag", (t) => {
      if (t.name === "si") atual = "";
      else if (t.name === "t") dentroT = true;
    });
    p.on("text", (x) => {
      if (dentroT) atual += x;
    });
    p.on("closetag", (t) => {
      if (t.name === "t") dentroT = false;
      else if (t.name === "si") compartilhadas.push(atual);
    });
  });
}

let total = 0;
let mantidas = 0;
await percorrer(zip, aba.entrada, (p) => {
  let cabecalho: Map<string, string> | null = null;
  let colMun = "";
  let colOc = "";
  let linha = new Map<string, string>();
  let col = "";
  let tipo = "";
  let valor = "";
  let capturando = false;
  p.on("opentag", (t) => {
    if (t.name === "row") linha = new Map();
    else if (t.name === "c") {
      col = String(t.attributes.r ?? "").replace(/\d+$/, "");
      tipo = String(t.attributes.t ?? "");
      valor = "";
    } else if (t.name === "v" || t.name === "t") capturando = true;
  });
  p.on("text", (x) => {
    if (capturando) valor += x;
  });
  p.on("closetag", (t) => {
    if (t.name === "v" || t.name === "t") capturando = false;
    else if (t.name === "c") linha.set(col, tipo === "s" ? compartilhadas[Number(valor)] ?? "" : valor);
    else if (t.name === "row") {
      if (!cabecalho) {
        cabecalho = new Map([...linha].map(([k, v]) => [v.trim(), k]));
        colMun = cabecalho.get("NOME_MUNICIPIO_CIRC")!;
        colOc = cabecalho.get("DESCR_OCORRENCIA_VEICULO")!;
        return;
      }
      total++;
      const mun = (linha.get(colMun) ?? "").trim().toUpperCase();
      const oc = (linha.get(colOc) ?? "").trim().toUpperCase();
      if (mun === "S.PAULO" && SUBTRACAO.has(oc)) mantidas++;
    }
  });
});
zip.close();

fim({ aba: aba.nome, linhas: total, capital_roubo_furto: mantidas, strings_compartilhadas: compartilhadas.length });

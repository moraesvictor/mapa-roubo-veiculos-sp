import ExcelJS from "exceljs";
import { SUBTRACAO, medir } from "./medir.ts";

const arquivo = process.argv[2];
if (!arquivo) throw new Error("uso: node ler-exceljs.ts <arquivo.xlsx>");
const fim = medir("exceljs", arquivo);

const leitor = new ExcelJS.stream.xlsx.WorkbookReader(arquivo, {
  sharedStrings: "cache",
  worksheets: "emit",
  hyperlinks: "ignore",
  styles: "ignore",
  entries: "ignore",
});

let aba = "";
let maiorTotal = 0;
let maiorMantidas = 0;

for await (const planilha of leitor) {
  const nome = (planilha as unknown as { name: string }).name;
  let colMun = -1;
  let colOc = -1;
  let total = 0;
  let mantidas = 0;
  for await (const linha of planilha) {
    const valores = linha.values as unknown[];
    if (colMun < 0) {
      colMun = valores.findIndex((v) => String(v ?? "").trim() === "NOME_MUNICIPIO_CIRC");
      colOc = valores.findIndex((v) => String(v ?? "").trim() === "DESCR_OCORRENCIA_VEICULO");
      continue;
    }
    total++;
    const mun = String(valores[colMun] ?? "").trim().toUpperCase();
    const oc = String(valores[colOc] ?? "").trim().toUpperCase();
    if (mun === "S.PAULO" && SUBTRACAO.has(oc)) mantidas++;
  }
  if (total > maiorTotal) {
    aba = nome;
    maiorTotal = total;
    maiorMantidas = mantidas;
  }
}

fim({ aba, linhas: maiorTotal, capital_roubo_furto: maiorMantidas });

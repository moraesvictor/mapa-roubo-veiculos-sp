import { SUBTRACAO, medir } from "./medir.ts";
import { lerPlanilha } from "./xlsx.ts";

const arquivo = process.argv[2];
if (!arquivo) throw new Error("uso: node ler-saxes.ts <arquivo.xlsx>");
const fim = medir("yauzl + saxes", arquivo);

let mantidas = 0;
const resumo = await lerPlanilha(arquivo, (linha) => {
  const mun = (linha.get("NOME_MUNICIPIO_CIRC") ?? "").trim().toUpperCase();
  const oc = (linha.get("DESCR_OCORRENCIA_VEICULO") ?? "").trim().toUpperCase();
  if (mun === "S.PAULO" && SUBTRACAO.has(oc)) mantidas++;
});

fim({ aba: resumo.aba, linhas: resumo.linhas, capital_roubo_furto: mantidas, strings_compartilhadas: resumo.stringsCompartilhadas });

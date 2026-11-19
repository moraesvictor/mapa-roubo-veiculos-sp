import { mkdir, writeFile } from "node:fs/promises";
import { classificarTipoVeiculo, tipoDeDia } from "@mapa/core";
import { lerPlanilha } from "@mapa/spike-pipeline-runtime/xlsx.ts";
import { latLngToCell } from "h3-js";

const raiz = new URL("../../../", import.meta.url);
const ANOS = [2025, 2026];
const SUBTRACAO = new Map([["ROUBADO", "roubo"], ["FURTADO", "furto"]]);
const PERIODO_SSP = new Map([["DE MADRUGADA", "madrugada"], ["PELA MANHÃ", "manha"], ["A TARDE", "tarde"], ["A NOITE", "noite"], ["EM HORA INCERTA", "hora-incerta"]]);
const DENTRO_DE_SP = (lat: number, lon: number) => lat > -24.01 && lat < -23.35 && lon > -46.83 && lon < -46.36;
const EPOCA_EXCEL = Date.UTC(1899, 11, 30);

export interface Registro {
  tipo: string;
  veiculo: string;
  familia: string;
  data: string;
  periodo: string;
  tipo_dia: string;
  h3: string | null;
}

const dataDoExcel = (serial: string) => {
  const n = Number(serial);
  return Number.isFinite(n) && n > 0 ? new Date(EPOCA_EXCEL + Math.floor(n) * 86_400_000) : null;
};

function periodo(hora: string, descricao: string) {
  const fracao = Number(hora);
  if (hora && Number.isFinite(fracao) && fracao >= 0 && fracao < 1) {
    const h = Math.floor(fracao * 24);
    return h < 6 ? "madrugada" : h < 12 ? "manha" : h < 18 ? "tarde" : "noite";
  }
  return PERIODO_SSP.get(descricao.trim().toUpperCase()) ?? "hora-incerta";
}

function familia(marcaModelo: string) {
  const [marca = "", modelo = ""] = marcaModelo.trim().toUpperCase().split("/");
  const primeiro = modelo.split(/\s+/)[0] ?? "";
  return primeiro ? `${marca.trim()} ${primeiro}` : marca.trim() || "NAO IDENTIFICADO";
}

const registros: Registro[] = [];
const vistos = new Set<string>();

for (const ano of ANOS) {
  await lerPlanilha(new URL(`data/raw/VeiculosSubtraidos_${ano}.xlsx`, raiz).pathname, (l) => {
    if ((l.get("NOME_MUNICIPIO_CIRC") ?? "").trim().toUpperCase() !== "S.PAULO") return;
    const tipo = SUBTRACAO.get((l.get("DESCR_OCORRENCIA_VEICULO") ?? "").trim().toUpperCase());
    const veiculo = classificarTipoVeiculo(l.get("DESCR_TIPO_VEICULO") ?? "");
    const data = dataDoExcel(l.get("DATA_OCORRENCIA_BO") ?? "");
    if (!tipo || !veiculo || !data) return;
    const chave = [l.get("NOME_DELEGACIA"), l.get("ANO_BO"), l.get("NUM_BO"), l.get("CONT_VEICULO")].join("|");
    if (vistos.has(chave)) return;
    vistos.add(chave);
    const lat = Number(l.get("LATITUDE"));
    const lon = Number(l.get("LONGITUDE"));
    registros.push({
      tipo,
      veiculo,
      familia: familia(l.get("DESCR_MARCA_VEICULO") ?? ""),
      data: data.toISOString().slice(0, 10),
      periodo: periodo(l.get("HORA_OCORRENCIA") ?? "", l.get("DESCR_PERIODO") ?? ""),
      tipo_dia: tipoDeDia(data),
      h3: Number.isFinite(lat) && Number.isFinite(lon) && DENTRO_DE_SP(lat, lon) ? latLngToCell(lat, lon, 9) : null,
    });
  });
}

await mkdir(new URL("data/tmp/", raiz), { recursive: true });
const saida = new URL("data/tmp/ocorrencias.ndjson", raiz);
await writeFile(saida, registros.map((r) => JSON.stringify(r)).join("\n"));
const comH3 = registros.filter((r) => r.h3).length;
const datas = registros.map((r) => r.data).sort();
console.log(JSON.stringify({ registros: registros.length, comH3, de: datas[0], ate: datas.at(-1), campos: Object.keys(registros[0] ?? {}), arquivo: saida.pathname }));

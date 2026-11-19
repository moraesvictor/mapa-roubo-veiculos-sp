import { mkdir, writeFile } from "node:fs/promises";
import { classificarTipoVeiculo } from "@mapa/core";
import { lerPlanilha } from "@mapa/spike-pipeline-runtime/xlsx.ts";

const raiz = new URL("../../../", import.meta.url);
const entrada = new URL("data/raw/VeiculosSubtraidos_2025.xlsx", raiz).pathname;
const saida = new URL("data/tmp/pontos-2025.json", raiz);

const SUBTRACAO = new Set(["ROUBADO", "FURTADO"]);
const DENTRO_DE_SP = (lat: number, lon: number) => lat > -24.01 && lat < -23.35 && lon > -46.83 && lon < -46.36;

const vistos = new Set<string>();
const pontos: [number, number, 0 | 1][] = [];
let semCoordenada = 0;

await lerPlanilha(entrada, (l) => {
  if ((l.get("NOME_MUNICIPIO_CIRC") ?? "").trim().toUpperCase() !== "S.PAULO") return;
  if (!SUBTRACAO.has((l.get("DESCR_OCORRENCIA_VEICULO") ?? "").trim().toUpperCase())) return;
  const tipo = classificarTipoVeiculo(l.get("DESCR_TIPO_VEICULO") ?? "");
  if (!tipo) return;
  const chave = [l.get("NOME_DELEGACIA"), l.get("ANO_BO"), l.get("NUM_BO"), l.get("CONT_VEICULO")].join("|");
  if (vistos.has(chave)) return;
  vistos.add(chave);
  const lat = Number(l.get("LATITUDE"));
  const lon = Number(l.get("LONGITUDE"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !DENTRO_DE_SP(lat, lon)) {
    semCoordenada++;
    return;
  }
  pontos.push([Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5, tipo === "moto" ? 1 : 0]);
});

await mkdir(new URL("data/tmp/", raiz), { recursive: true });
await writeFile(saida, JSON.stringify(pontos));
console.log(JSON.stringify({ veiculos: vistos.size, comCoordenada: pontos.length, semCoordenada, arquivo: saida.pathname }));

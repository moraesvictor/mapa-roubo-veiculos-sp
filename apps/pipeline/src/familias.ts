import type { TipoVeiculo } from "@mapa/core";

export const NAO_IDENTIFICADO = "NAO IDENTIFICADO";

const PREFIXOS_DE_IMPORTADO = new Set(["I", "IMP", "H", "Y", "AVA", "JTA"]);

const MARCAS: Record<string, string> = {
  VW: "VOLKSWAGEN",
  VOLKSWAGEM: "VOLKSWAGEN",
  VOLKWAGEN: "VOLKSWAGEN",
  GM: "CHEVROLET",
  CHEV: "CHEVROLET",
  HYUNDAY: "HYUNDAI",
  HYUNDA: "HYUNDAI",
  "M.BENZ": "MERCEDES-BENZ",
  MERCEDES: "MERCEDES-BENZ",
  MMC: "MITSUBISHI",
  LR: "LAND ROVER",
  "JTA-SUZUKI": "SUZUKI",
  JTZ: "HAOJUE",
  RE: "ROYAL ENFIELD",
  CAOACHERY: "CAOA CHERY",
  "HARLEY DAVIDSON": "HARLEY-DAVIDSON",
  MOTTUS: "MOTTU",
};

const MARCAS_COLADAS = ["SUZUKI", "KAWASAKI", "TRIUMPH", "HONDA", "YAMAHA"];
const PALAVRAS_DESCARTADAS = new Set(["NOVO", "NOVA", "NEW"]);
const MODELOS_DE_DUAS_PALAVRAS: Record<string, string> = { "T CROSS": "T-CROSS", "ONIX PLUS": "ONIX PLUS", "KA SEDAN": "KA SEDAN", "UP!": "UP", "CR V": "CR-V", "HR V": "HR-V", "WR V": "WR-V" };

const canonizarMarca = (marca: string) => MARCAS[marca] ?? marca;

function separarMarca(texto: string): { marca: string; resto: string[] } {
  const [antes = "", depois = ""] = texto.split(/\/(.*)/s);
  let marca = antes.trim();
  let resto = depois.trim().split(" ").filter(Boolean);

  if (PREFIXOS_DE_IMPORTADO.has(marca) && resto.length) {
    const primeiro = resto[0] ?? "";
    const colada = MARCAS_COLADAS.find((m) => primeiro.startsWith(m) && primeiro.length > m.length);
    if (colada) {
      marca = colada;
      resto = [primeiro.slice(colada.length), ...resto.slice(1)];
    } else {
      marca = primeiro;
      resto = resto.slice(1);
    }
  }

  marca = canonizarMarca(marca);
  while (resto.length && (canonizarMarca(resto[0] ?? "") === marca || PALAVRAS_DESCARTADAS.has(resto[0] ?? ""))) resto = resto.slice(1);
  return { marca, resto };
}

const CILINDRADA = /^(\d{2,4})([A-Z]{0,2})$/;

function modeloDeMoto(resto: string[]): string | null {
  const [primeiro = "", segundo = ""] = resto;
  if (!primeiro || CILINDRADA.test(primeiro)) return null;
  const colado = /^([A-Z]+)(\d{2,4})([A-Z]*)$/.exec(primeiro);
  if (colado) return `${colado[1]} ${colado[2]}${(colado[3] ?? "").length <= 2 ? (colado[3] ?? "") : ""}`;
  const cc = CILINDRADA.exec(segundo);
  return cc ? `${primeiro} ${cc[1]}${cc[2]}` : primeiro;
}

function modeloDeCarro(marca: string, resto: string[]): string | null {
  const [primeiro = "", segundo = ""] = resto;
  if (!primeiro || /^\d+[.,]\d/.test(primeiro)) return null;
  if (marca === "MERCEDES-BENZ" && /^3\d\dCDI/.test(primeiro)) return "SPRINTER";
  if (/^[A-Z]$/.test(primeiro) && /^\d{2,3}$/.test(segundo)) return `${primeiro}${segundo}`;
  const numerico = /^\d{2,4}/.exec(primeiro);
  if (numerico) return numerico[0];
  if (marca === "MERCEDES-BENZ") return /^[A-Z]{1,3}\d{2,3}/.exec(primeiro)?.[0] ?? primeiro;
  return MODELOS_DE_DUAS_PALAVRAS[`${primeiro} ${segundo}`] ?? primeiro;
}

export function familiaDoModelo(marcaModelo: string, veiculo: TipoVeiculo): string {
  const texto = marcaModelo.trim();
  if (!texto) return NAO_IDENTIFICADO;
  const { marca, resto } = separarMarca(texto);
  if (!marca) return NAO_IDENTIFICADO;
  const modelo = veiculo === "moto" ? modeloDeMoto(resto) : modeloDeCarro(marca, resto);
  return modelo ? `${marca} ${modelo}` : `${marca} (MODELO NAO IDENTIFICADO)`;
}

import json
import resource
import sys
import time
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
SUBTRACAO = {"ROUBADO", "FURTADO"}


def caminho_xl(alvo):
    alvo = alvo.lstrip("/")
    return alvo if alvo.startswith("xl/") else "xl/" + alvo


def aba_de_dados(z):
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    alvos = {r.get("Id"): r.get("Target") for r in rels}
    abas = [(s.get("name"), caminho_xl(alvos[s.get(f"{RNS}id")])) for s in wb.iter(f"{NS}sheet")]
    return max(abas, key=lambda a: z.getinfo(a[1]).file_size)


def strings_compartilhadas(z):
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    saida = []
    with z.open("xl/sharedStrings.xml") as f:
        for _, el in ET.iterparse(f):
            if el.tag == f"{NS}si":
                saida.append("".join(t.text or "" for t in el.iter(f"{NS}t")))
                el.clear()
    return saida


def coluna(ref):
    return ref.rstrip("0123456789")


def valor(c, ss):
    tipo = c.get("t")
    if tipo == "inlineStr":
        return "".join(t.text or "" for t in c.iter(f"{NS}t"))
    v = c.find(f"{NS}v")
    if v is None or v.text is None:
        return ""
    return ss[int(v.text)] if tipo == "s" else v.text


def ler(caminho):
    inicio = time.perf_counter()
    total = mantidas = 0
    with zipfile.ZipFile(caminho) as z:
        nome_aba, arquivo = aba_de_dados(z)
        ss = strings_compartilhadas(z)
        apos_ss = time.perf_counter()
        cabecalho = None
        with z.open(arquivo) as f:
            for _, el in ET.iterparse(f):
                if el.tag != f"{NS}row":
                    continue
                linha = {coluna(c.get("r")): valor(c, ss) for c in el.iter(f"{NS}c")}
                el.clear()
                if cabecalho is None:
                    cabecalho = {v.strip(): k for k, v in linha.items()}
                    col_mun = cabecalho["NOME_MUNICIPIO_CIRC"]
                    col_oc = cabecalho["DESCR_OCORRENCIA_VEICULO"]
                    continue
                total += 1
                if linha.get(col_mun, "").strip().upper() == "S.PAULO" and linha.get(col_oc, "").strip().upper() in SUBTRACAO:
                    mantidas += 1
    fim = time.perf_counter()
    return {
        "runtime": f"python {sys.version.split()[0]}",
        "arquivo": caminho.rsplit("/", 1)[-1],
        "aba": nome_aba,
        "linhas": total,
        "capital_roubo_furto": mantidas,
        "strings_compartilhadas": len(ss),
        "segundos_strings": round(apos_ss - inicio, 2),
        "segundos_total": round(fim - inicio, 2),
        "pico_memoria_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1),
    }


if __name__ == "__main__":
    print(json.dumps(ler(sys.argv[1]), ensure_ascii=False))

# Spike: pipeline runtime (Node or Python)

**Question:** which runtime should the batch pipeline use to read the SSP-SP vehicle theft spreadsheets?

**Decision proposed:** Node + TypeScript, streaming the XLSX with `yauzl` (zip) + `saxes` (XML).

## Setup

- Input: `VeiculosSubtraidos_2025.xlsx` (69 MB, 244,049 rows, whole state) and `VeiculosSubtraidos_2026.xlsx` (45 MB, 154,159 rows, partial year), downloaded on 2026-11-19.
- Each reader streams the largest sheet, resolves shared strings and applies the same filter: `NOME_MUNICIPIO_CIRC = S.PAULO` (D3) and `DESCR_OCORRENCIA_VEICULO` in {Roubado, Furtado}.
- Machine: local Linux laptop, Node 22.23, Python 3.12. Peak memory is process RSS.

## Results (2025 file, median of 3 runs)

| Reader | Time | Peak memory | Rows | Capital, robbery or theft |
|---|---|---|---|---|
| Python, stdlib `zipfile` + `iterparse` | 16.6 s | 62 MB | 244,049 | 46,166 |
| Node, `exceljs` stream reader | 11.6 s | 350 MB | 244,049 | 46,166 |
| **Node, `yauzl` + `saxes`** | **6.6 s** | **194 MB** | 244,049 | 46,166 |

2026 file (single run): Python 10.3 s / 47 MB, exceljs 7.6 s / 318 MB, yauzl + saxes 4.3 s / 140 MB. All three readers return identical counts.

The first run of each reader was slower (cold disk cache) and is not part of the median.

## Why Node

- **Fastest** of the three, about 2.5× Python on the same file.
- **Same language as the BFF and `packages/core`.** The pipeline can import the D4 vehicle classifier, the allow-list (D5) and the shared schema directly, so the rules exist in one place and are tested once.
- **One toolchain and one CI** for the whole repository.
- Memory (~200 MB) is fine for a batch job. Most of it is the shared-strings table (330k strings), which only lives in memory and is never written anywhere.

## Trade-offs

- Python used a third of the memory. If the pipeline ever runs on a very small machine, that matters.
- `yauzl` + `saxes` is lower level than `exceljs`: the pipeline owns the XLSX parsing (shared strings, inline strings, column letters). The code is small and covered by the counts above, but needs its own tests in the real pipeline.
- `exceljs` is discarded: slower and the highest memory, with no benefit for a read-only stream.

## Reproduce

```bash
python3 -I spikes/pipeline-runtime/python/ler.py data/raw/VeiculosSubtraidos_2025.xlsx
cd spikes/pipeline-runtime/node
node ler-exceljs.ts ../../../data/raw/VeiculosSubtraidos_2025.xlsx
node ler-saxes.ts ../../../data/raw/VeiculosSubtraidos_2025.xlsx
```

# Spike: address and CEP search (geocoding)

**Question:** which service turns what the person types (street, neighbourhood or CEP) into a place on the map? The card asks for cost, usage limits, quality in São Paulo and privacy: the searched address must not be stored.

**Proposed:** no third-party geocoder for addresses.

- **Streets and neighbourhoods:** the pipeline builds our own index of São Paulo streets and neighbourhoods from OpenStreetMap.
  - It is split into 320 small static files, keyed by the first two letters of the street's main word: median 0.6 KB, max 51 KB brotli.
  - The front loads only the file it needs as the person types, and **searches in the browser**. The typed address never leaves the device.
  - Autocomplete, abbreviations, missing accents and one typo per word all work.
- **CEP:** the front sends the CEP to the BFF, which asks ViaCEP for the street and neighbourhood and does not log or store it. The street is then found in the same local index. ViaCEP only sees the BFF, never the person.

## Why not the public services

| | Limit | Problem for us |
|---|---|---|
| Nominatim (OSM Foundation) | **1 request/second for the whole app**; identifying User-Agent required | **Autocomplete is forbidden**; ~1.1 s per search; the address goes to a third party |
| Photon (komoot) public API | no published number | Described by the project as **for demo and testing only** |
| ViaCEP | free | CEP → street and neighbourhood only, **no coordinates** |
| BrasilAPI CEP v2 | free | Has coordinates, but **6 of 8 test CEPs were 2.2–18.6 km away** from the CEP's location in OSM |
| Commercial (Google, Stadia, etc.) | paid, API key | Cost and the address goes to a third party; not tested |

## Results

`node/comparar.ts` sends the same queries to our local search and to Nominatim (1 request/s). The local answer counts as **right** when its streets touch the res 8 area where Nominatim put the place, or that area's neighbours. `node/conferir-ceps.ts` checks the CEP path against the CEP's location in OSM.

| Query type | Local | Nominatim |
|---|---|---|
| Full street name (17) | **17/17** (see note) | 17/17 |
| Abbreviated or without accents (4) | 4/4 | 4/4 |
| One typo (2) | **2/2** | 0/2 |
| Typing in progress, "rua teodoro samp" (2) | **2/2** | 0/2, and not allowed by its policy |
| Neighbourhood (10) | 7/10 same area, **10/10 within 2 km** | 10/10 |
| Point of interest: market, stadium, museum (3) | 1/3 (not indexed) | 3/3 |
| CEP via ViaCEP + local index (8) | **8/8 within 0.5 km** of the CEP in OSM | – |
| Time per search (median) | **76 ms**, no network, whole city in Node | 1,109 ms |

Notes:

- **"Rua 25 de Março"**: OSM names it "Rua Vinte e Cinco de Março", with "25" only as `alt_name`. After indexing alternative names (6,584 street segments have one), the famous street in Sé comes first and a homonym in Vila Lurdes second, each with its "near" neighbourhood. In this case it was Nominatim that answered with a different "25 de Março", 14.8 km away; the comparison counts it as a miss for us.
- **Neighbourhoods 1.5–1.8 km off:** a neighbourhood is an area, not a point. Our point is the district's centre, while Nominatim used a place node (for Itaquera, a metro station).
- **1,239 street names exist in more than one place** in the city, so the UI must list results with "near <neighbourhood>" and let the person choose. The search returns up to 5.
- **No house numbers:** the result is the whole street, highlighted. That matches the map's res 8 precision (D6), and long avenues simply cover more areas.

## Index

`node/baixar-osm.ts` fetches the data from Overpass in three queries: named streets, neighbourhoods and districts, and CEPs. `node/construir-indice.ts` then builds the index:

- 101,608 street segments become 46,598 names and 49,312 entries. A name that appears in places more than one area apart becomes separate entries.
- 654 neighbourhoods and districts.
- Every entry keeps its res 8 areas, a centre and the nearest neighbourhood.
- Whole city: 6.7 MB raw, **668 KB brotli**, too much to load up front. Split into 320 files: median 0.6 KB, p90 7.8 KB, max 51 KB.

The search rules live in `node/busca.ts`, with 11 unit tests in `node/busca.test.ts` that run in CI.

## Caveats

- **Overpass's public server was at capacity:** two retries and 7.5 minutes for the street query. The monthly pipeline should read an OSM extract file instead (e.g. Geofabrik's south-east Brazil extract). Not tested here.
- **License:** OpenStreetMap data is ODbL. The published index is a derived database, so it must credit "© OpenStreetMap contributors" and be offered under the ODbL.
- **Points of interest** (stations, parks, stadiums) are not indexed. Adding a few hundred from OSM is cheap, but out of scope here.
- Requests for index files reach our own CDN, which sees only which two-letter file was requested. CDN logging stays off.
- The test set is small (46 queries) and made of well-known places. It shows the approach works, not a full error rate.

## Reproduce

```bash
cd spikes/geocoding/node
node baixar-osm.ts            # ~10 min when Overpass is busy
node construir-indice.ts
node fatiar.ts
node comparar.ts              # ~1.5 min, respects Nominatim's 1 request/s
node conferir-ceps.ts
pnpm test
```

# Spike: map payload on slow 4G

**Question:** the map response was estimated at ~410 KB gzip (points for a year). Does it load well on a slow 4G phone, and do we need to load by region?

**Answer:** no regional loading. With H3 resolution 8 and k = 5 (D6, D18) the zones response is **under 5 KB gzip for any filter**. On slow 4G the page takes ~9 s to show zones on a cold visit, and **the basemap (640 KB of tiles, style and fonts) is what we wait for**, not our data, which arrives at ~3.5 s.

**Proposed:**

- No loading by region or viewport.
- Send the cell **geometry once** as a long-cached static file (34 KB brotli) and the **per-filter counts** separately (0.5 KB median, 4.7 KB max). The map applies counts with MapLibre `feature-state`. No `h3-js` on the client.
- The next performance work is the basemap and the shell, not the data (card "Lazy load do mapa e code splitting por rota").

## Setup

- `dados.ts` computes all 837 filter combinations from the last 12 months (32,588 occurrences), res 8, Gi\* + FDR, k = 5, no zones under 200 occurrences (D18). Reuses `spikes/hotspot/node/gi.ts`.
- `tamanhos.ts` measures each payload format, raw, gzip and brotli.
- `servidor.ts` serves the built pages with brotli/gzip and three endpoints, with cache headers like the BFF behind a CDN.
- Three pages, same map, same colours, same filter switches:
  - **h3**: counts per filter, hexagon outlines computed on the client with `h3-js`;
  - **geojson**: the server sends the polygons for every filter;
  - **estado**: polygons once (`/api/geometria`), counts per filter applied as `feature-state`.
- `medir.ts` drives a real Chrome over CDP. The DevTools "Slow 4G" preset is 562.5 ms latency, 1.44 Mbps down and 675 kbps up, with the CPU throttled 4×. Throttling is also attached to MapLibre's workers, which download the tiles. Each page has a cold visit with an empty cache, a warm visit, and two filter switches (all motorcycles, then motorcycles on weekend nights). 3 rounds, medians below.

## Payload sizes (all filters)

| Format | Raw | gzip | brotli |
|---|---|---|---|
| Counts as objects `{h3, n, zona}` | 51.5 KB | 5.0 KB | 3.4 KB |
| Counts as tuples `[h3, n, zona]` | 28.7 KB | 4.7 KB | 3.0 KB |
| GeoJSON with polygons | 314.7 KB | 39.4 KB | 30.6 KB |
| Geometry of all cells (once) | 296.4 KB | 37.3 KB | 28.0 KB |
| *Reference: 2025 points (old estimate)* | *811.5 KB* | *204 KB* | *149 KB* |

Per filter (tuples, gzip): median 0.5 KB, p90 3.3 KB, max 4.7 KB. Objects and tuples differ by 0.3 KB gzip, so the readable object shape in the D17 contract can stay.

## Load times (median of 3)

| | Data arrives | Basemap ready | **Zones visible** | Switch filter | Warm visit |
|---|---|---|---|---|---|
| Slow 4G · h3 | 3.7 s | 8.8 s | **9.1 s** | 712 / 620 ms | 1.6 s |
| Slow 4G · geojson | 3.7 s | 8.7 s | **8.9 s** | 763 / 608 ms | 1.5 s |
| Slow 4G · estado | 3.4 s | 8.6 s | **8.9 s** | 681 / 621 ms | 1.6 s |
| No throttling · h3 | 0.2 s | 0.9 s | 1.1 s | 88 / 31 ms | 0.7 s |
| No throttling · geojson | 0.2 s | 0.8 s | 0.9 s | 93 / 30 ms | 0.6 s |
| No throttling · estado | 0.2 s | 0.8 s | 1.0 s | **31 / 23 ms** | 0.7 s |

Bytes on a cold visit (compressed, as transferred):

| | Our JS | h3-js | Data | Basemap |
|---|---|---|---|---|
| h3 | 232 KB | +50 KB | 6 KB | 641 KB |
| geojson | 232 KB | – | 52 KB | 641 KB |
| estado | 232 KB | – | 34 KB | 641 KB |

The MapLibre worker script (127 KB brotli) is loaded by the worker before CDP attaches, so it is not in the "Our JS" column. Add it to all three.

## What the numbers say

- **Our data is no longer the problem.** Moving from points to res 8 cells cut the map response from ~200 KB to ~5 KB gzip. Loading by region would add complexity and save nothing.
- **The basemap is the critical path:** 641 KB and ~5 s of the ~9 s on slow 4G. Our data is ready 5 seconds before the map can draw it.
- **The three variants tie on first load.** The difference shows when switching filters: `estado` only changes colours (~30 ms) instead of rebuilding polygons (~90 ms). It also keeps `h3-js` (50 KB) out of the bundle and makes each filter response tiny, so it is cheap to cache at the CDN.
- **Warm visits are fast (~1.6 s on slow 4G)** because the JS, geometry and tiles are cached. Filter switches cost about one round trip (~600–700 ms on slow 4G), which is mostly the 562 ms latency.

## Next steps (outside this spike)

- Show the shell (filters, summary, accessible table) first and lazy-load the map. The table can render the moment data arrives, at ~3.5 s on slow 4G.
- Look at a lighter basemap: fewer layers, fewer label fonts, self-hosted style, or a smaller maximum zoom at city view.
- Prefetch the most likely next filter (for example the same filter with the other vehicle) after the first render.

## Reproduce

```bash
cd spikes/storage/node && node gerar-base.ts
cd ../../payload/web
node tamanhos.ts
pnpm build && node servidor.ts &
node medir.ts > resultados.ndjson && node resumir.ts resultados.ndjson
```

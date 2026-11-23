# Spike: hosting

**Question:** where do the front and the BFF run, what does it cost per month, and how does the demo stay up if the BFF goes down?

**Proposed:**

| Piece | Where | Cost |
|---|---|---|
| Front (static SPA) + **static copy of every map response** | Cloudflare Workers static assets | $0: static asset requests are free and unlimited |
| BFF (Hono + DuckDB, D16/D17) | Fly.io `shared-cpu-1x` 256 MB, always on (`min_machines_running = 1`, no auto stop), DuckDB file baked into the image for each monthly release | ~**US$ 2.19/month** |
| Custom domain | optional | ~US$ 10/year |

**If the BFF goes down:** the front asks the BFF with a 4 s timeout. On any error, timeout or refused connection it reads the same answer from the static copy published with the front by the same monthly pipeline run. The copy is 837 files, ~1 MB gzip in total (D18, D19), so the map and filters keep working with the same data. The UI shows a discreet notice.

## What was measured

### The BFF in the smallest machine

`Dockerfile` packages the Hono + DuckDB BFF from `spikes/bff-stack` with the allow-listed DuckDB file. `node/medir.ts` runs it with a hard 256 MB limit (no swap), at 1 CPU and at 1/4 CPU. For each run it measures:

- the time from `docker run` to the first `200`;
- memory at rest and after load (cgroup `memory.current` / `memory.peak`);
- 2,000 requests with random, uncached filters at concurrency 20.

| | Start → first 200 | Memory at rest | Peak after load | Uncached load | Errors / OOM |
|---|---|---|---|---|---|
| 256 MB, 1 CPU (3 runs) | 1.1–1.2 s | ~57 MB | **~110 MB** | ~30 req/s, p95 ~860 ms | 0 / no |
| 256 MB, 1/4 CPU (2 runs) | 3.4–4.0 s | ~61 MB | ~110 MB | ~7 req/s, p95 ~3.9 s | 0 / no |

The image is 475 MB, mostly Node and the DuckDB native binary.

- **256 MB is enough.** The peak is under half of it, even under load.
- **CPU is the weak point when there is no cache**, because every filter runs a DuckDB query. Two decisions make this a non-issue:
  - with D18, the zones are precomputed, so the BFF reads rows instead of aggregating;
  - every response carries `Cache-Control` and an `ETag` (D11/D17), so repeated filters never reach DuckDB.
- **A sleeping BFF is a bad fit.** Even on 1 CPU, our own start-up takes over a second, before the platform's own wake-up time.

### The fallback

`node/fallback.ts` is the front's fetch function. `node/fallback.test.ts` spins up a fake BFF and a fake static copy. It checks that the front:

- uses the BFF when it answers;
- falls back to the copy on 503, on a slow BFF and on a refused connection;
- maps equivalent filters to the same copy file.

5/5 pass and run in CI.

## Options compared (prices checked on 2026-11-23)

| | Sleeps? | Monthly | Notes |
|---|---|---|---|
| **Fly.io shared-cpu-1x 256 MB** | no, if configured always on | ~US$ 2.19 | No free allowance for new accounts; RAM price went up on 2026-10-01 |
| Render Starter | no | US$ 7 | The free plan sleeps after 15 min and takes ~1 min to wake |
| Railway Hobby | no | US$ 5 (includes US$ 5 of usage) | The free plan sleeps when idle |
| Google Cloud Run, scale to zero | **yes** | ~US$ 0 (free tier) | Cold start plus our 1–4 s start-up on the first visit |
| Google Cloud Run, 1 min instance | no | ~US$ 7–10 (third-party estimates) | Most expensive "always on" |
| Koyeb free | **yes**, after 1 h idle | – | New accounts reported to require a paid plan since Feb 2026 |

Prices come from provider pages and recent third-party write-ups; check them again before creating accounts.

## Observations

- With D18 and D19, the static copy alone could serve the whole map. The BFF stays because of D11: a stable contract, room for new sources, and the back-end learning goal. The copy makes it safe to run the BFF on the cheapest machine.
- Putting Cloudflare's proxy in front of the BFF, with `stale-if-error`, would add a second layer. It needs a custom domain, so it is optional.
- Creating the Cloudflare and Fly.io accounts, and adding a card on Fly.io, is for Victor to do; nothing was deployed in this spike.

## Reproduce

```bash
cd spikes/bff-stack/node && node preparar.ts && cd ../../..
docker build -f spikes/hosting/Dockerfile -t mapa-bff-spike .
cd spikes/hosting/node && node medir.ts
pnpm test
```

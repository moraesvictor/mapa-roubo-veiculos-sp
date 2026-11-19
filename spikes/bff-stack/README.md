# Spike: BFF stack (Fastify or Hono, zod or OpenAPI)

**Question:** which framework should serve the BFF, and how do we define the API contract shared with the front-end?

**Decision proposed:** Hono + `@hono/zod-openapi`. The contract is written once in zod (validation + TypeScript types), the OpenAPI document is generated from it, and the web app gets a typed client through Hono RPC with no code generation.

"zod or OpenAPI" turned out not to be a choice: zod is the source of truth, OpenAPI is generated from it (both frameworks can do this).

## Setup

- Same endpoint in both frameworks: `GET /v1/zonas` (count per H3 cell for the last 12 months, filtered by vehicle, incident type, period and weekday/weekend), reading the DuckDB file from D16 (65,925 real, allow-listed records).
- Shared pieces: `contrato.ts` (zod schemas), `dados.ts` (DuckDB access, parameterised query, ETag = data version + filter hash, `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`).
- Same integration tests for both (`contrato.test.ts`): 200 with cache headers, 304 with matching ETag and no body length, 400 naming the invalid field, OpenAPI generated from the zod schema, and identical bodies from both implementations.
- Load: `autocannon`, 50 connections, 10 s, two rounds per framework, against an uncached request (hits DuckDB) and a request with `If-None-Match` (304).

## Results

| | Hono 4.13 + @hono/zod-openapi | Fastify 5.12 + fastify-type-provider-zod + @fastify/swagger |
|---|---|---|
| Production dependencies (transitive, incl. zod) | **8** | 57 |
| Uncached (DuckDB query) | 175–180 req/s, p99 444–572 ms | 161–180 req/s, p99 458–627 ms |
| 304 (ETag hit) | 35–40k req/s, p99 3 ms | **46–53k req/s**, p99 2–3 ms |
| Typed client for the web app | built in (`hc<AppType>`) | needs OpenAPI codegen (e.g. openapi-typescript + a fetch wrapper) |
| Type friction found | none | error handler `unknown`, 304 must be declared in the response schema |
| Tests | 9/9 | 9/9 |

### Typed client, proven

`cliente-tipado.ts` calls the BFF through `hc<AppHono>`. Two deliberately wrong calls are marked `@ts-expect-error`; removing the markers makes `tsc` fail on both: a wrong route (`api.v1.zona`) and a wrong query field (`veiculos`). Contract drift between BFF and web becomes a compile error, not a production bug (D10/D11).

### Bug found on the way (Fastify)

Answering a 304 with `reply.code(304).send(null)` makes the zod serializer write `"null"` and Fastify sends `content-length: 4` with no body. Keep-alive clients then wait for 4 bytes that never come: under load every request timed out. Fixed by removing the content type and sending no payload; the 304 test now also asserts the content length so this can't come back.

## Why Hono

- **Typed contract end to end without codegen**, which is the core of D10/D11.
- **8 vs 57 dependencies**: smaller attack surface and less to keep updated.
- Built-in middleware (ETag, CORS, cache, secure headers) covers what the BFF needs.
- Fastify is ~35% faster on cached 304s, but both handle tens of thousands of requests per second; with a CDN in front, the BFF sees a small fraction of traffic.

## Caveats and follow-ups

- **DuckDB is the bottleneck when uncached** (~175 req/s, same for both): one connection runs one query at a time (~6 ms each). Options for the BFF card: precompute the most common filter combinations in the pipeline, keep a small in-memory LRU of responses, or open a few read-only connections. With monthly data and HTTP caching this is not urgent.
- Hono runs on edge runtimes, but **D16 uses DuckDB's native Node binding**, so the BFF runs on Node anyway. Edge portability is a bonus only if storage changes later (e.g. DuckDB-WASM or precomputed files).
- Query lists are comma-separated strings validated by regex so they are representable in OpenAPI; the BFF card can revisit repeated params (`?veiculo=carro&veiculo=moto`).

## Reproduce

```bash
cd spikes/storage/node && node gerar-base.ts
cd ../../bff-stack/node
node preparar.ts
pnpm test
pnpm typecheck
node medir.ts
```

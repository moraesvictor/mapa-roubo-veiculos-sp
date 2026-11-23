# Vehicle theft map — São Paulo

Interactive map of car and motorcycle robberies and thefts in the city of São Paulo, built from the public SSP-SP open data. It answers three questions: where and when do more incidents get reported, is my vehicle model targeted, and is it getting better or worse.

> Work in progress. Product decisions live in the project's Notion (Briefing, Discovery and decision log D1–D13).

## Structure

| Path | What it is |
|---|---|
| `apps/web` | Front-end: Vite + React + TypeScript (D9) |
| `apps/bff` | Backend for frontend: typed API consumed only by the web app (D11) |
| `apps/pipeline` | Monthly batch: reads the SSP-SP spreadsheets and writes allow-listed records (D5, D14) |
| `packages/core` | Shared domain types, filters and rules (D10) |

## Getting started

```bash
nvm use
corepack enable
pnpm install
pnpm dev
```

- Web: http://localhost:5173
- BFF: http://localhost:3001/health

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Runs web and BFF in watch mode |
| `pnpm lint` | ESLint with TypeScript, React Hooks and jsx-a11y (strict) rules |
| `pnpm test` | Runs every package's tests, including axe accessibility checks on the web app |
| `pnpm typecheck` | Type-checks every package |
| `pnpm build` | Builds every package |
| `pnpm --filter @mapa/pipeline extrair` | Reads `data/raw/*.xlsx` and writes `data/tmp/pipeline/` (records + metadata) |

## Data and privacy

Raw SSP-SP spreadsheets are never committed (`data/raw/` and `*.xlsx` are git-ignored). The pipeline keeps only an allow-list of fields and drops plates, street numbers, ZIP codes, police report numbers and exact coordinates before writing anything (D5).

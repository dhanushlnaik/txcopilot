# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev        # Development server → http://localhost:3000
pnpm build      # Production build
pnpm lint       # ESLint
pnpm test       # Run all tests (Vitest)

# Run a single test file
pnpm test src/__tests__/analyzer.test.ts
```

## Architecture

SolTrac is a Solana transaction intelligence platform built with Next.js App Router. It diagnoses transaction failures, runs pre-flight simulations, streams AI explanations, and manages webhook-based wallet alerts.

### Request lifecycle

1. **`/api/analyze`** — receives a tx signature → validates format (base58, 86–88 chars) → fetches raw tx from Solana RPC + enriched parse from Helius in parallel → calls `analyzeTransaction()` → returns `AnalysisResult`.
2. **`/api/simulate`** — accepts a base64-encoded serialized transaction → runs `simulateTransaction` via RPC → pipes the simulation output through the same analyzer engine.
3. **`/api/explain`** — streams plain-language explanation from Gemini; only surfaced in the UI when the heuristic analysis is inconclusive. Falls back through multiple Gemini models.
4. **`/api/webhooks/check`** — polling endpoint that iterates stored subscriptions, calls Helius per wallet, runs analysis, and delivers Discord-formatted alerts on failure or HIGH risk.

### Core library files

- **[src/lib/analyzer.ts](src/lib/analyzer.ts)** — the entire heuristics engine (724 lines). Contains 22+ protocol-specific error code mappings (Jupiter v6, Raydium, Orca, Pump.fun, Anchor), 17 log-pattern scanners, program-ID inference, and a scoring function that adjusts for real-time network congestion.
- **[src/lib/solana.ts](src/lib/solana.ts)** — RPC helpers: signature validation, raw fetch, Helius enhanced fetch, simulation, and network status (TPS, fees, congestion).
- **[src/lib/types.ts](src/lib/types.ts)** — canonical interfaces: `RiskLevel`, `TransactionBreakdown`, `AnalysisResult`, `NetworkStatus`, `WebhookSubscription`.
- **[src/lib/webhook-store.ts](src/lib/webhook-store.ts)** — file-persisted webhook subscription store.
- **[src/lib/webhook-auth.ts](src/lib/webhook-auth.ts)** — admin key middleware used by webhook write endpoints.

### Key design decisions

- **Server-only boundary**: lib files that call Solana/Helius/Gemini import `server-only`; the test harness mocks this via `src/__tests__/mocks/server-only.ts` and the Vitest alias in `vitest.config.ts`.
- **Analyze vs. Simulate toggle**: the UI switches between green (analyze) and purple (simulate) visual modes; both flow through the same `AnalysisResult` type but hit different API routes.
- **Webhook admin auth**: `WEBHOOK_ADMIN_KEY` env var gates POST/DELETE on `/api/webhooks`. Without it the endpoints are open.
- **Helius dependency**: without `HELIUS_API_KEY`/`HELIUS_RPC_URL`, enriched parsing is skipped and only raw RPC data is used, reducing analysis quality.

### Environment variables

| Variable | Purpose |
|---|---|
| `HELIUS_API_KEY` | Enriched transaction parsing (recommended) |
| `HELIUS_RPC_URL` | Custom Helius RPC endpoint |
| `SOLANA_RPC_URL` | Fallback public RPC |
| `GEMINI_API_KEY` | AI explanation streaming |
| `GEMINI_EXPLAIN_MODEL` | Model override (default: `gemini-1.5-flash`) |
| `WEBHOOK_ADMIN_KEY` | Admin auth for webhook write endpoints |

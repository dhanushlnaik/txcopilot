# SolTrac — Solana Transaction Intelligence

> **Know before you send. Fix before you fail.**

SolTrac is a full-stack Solana transaction intelligence platform — an SDK, a web app, and a CLI that predict transaction failures, explain root causes, and surface actionable fixes before a transaction ever hits the chain.

Built for the **Colosseum hackathon** — targeting both the **Infrastructure/Tooling** and **DeFi/Consumer** tracks.

---

## The Problem

~30% of Solana DeFi transactions fail silently. Users see a generic error. Developers get raw logs. Nobody knows why — slippage? stale blockhash? compute budget? account conflict? — and nothing tells you what to do next.

## The Solution

```
Transaction (unsigned) → soltrac-sdk → Risk Score 0–100 + Root Cause + Fix
```

SolTrac runs a **dual-pass simulation** (baseline + optimistic), scores **8 weighted risk signals** from live RPC data, matches against a **100+ entry error taxonomy** across 26 DeFi protocols, and returns a structured `SEND / REVIEW / DO_NOT_SEND` recommendation — all before the transaction is signed.

---

## Monorepo Structure

```
soltrac/
├── packages/
│   └── soltrac-sdk/          # Core SDK — npm-publishable
│       ├── src/
│       │   ├── index.ts       # preflight(), simulateTx(), analyzeTx(), explain()
│       │   ├── simulator.ts   # Dual-pass simulation engine
│       │   ├── scorer.ts      # 8-signal weighted risk scorer
│       │   ├── taxonomy.ts    # 100+ entry error taxonomy (3 layers)
│       │   ├── fingerprint.ts # 26-protocol fingerprinter
│       │   ├── explainer.ts   # 3-tier explainer (deterministic → log-pattern → AI)
│       │   ├── analyzer.ts    # SimResult heuristics engine
│       │   └── react/         # React hooks + SoltracBanner component
│       └── dist/              # Built output (CJS + ESM + .d.ts)
│
├── apps/
│   ├── web/                   # Next.js web app — soltrac.dev
│   │   ├── src/app/
│   │   │   ├── page.tsx       # Home — tx analyzer + simulate
│   │   │   ├── check/         # /check — pre-flight playground
│   │   │   └── network/       # /network — live network pulse
│   │   └── src/app/api/
│   │       ├── analyze/       # POST — post-mortem on confirmed tx
│   │       ├── simulate/      # POST — single-pass simulation
│   │       ├── preflight/     # POST — full risk assessment
│   │       ├── explain/       # POST — streaming AI explanation
│   │       └── network/       # GET  — live TPS, fees, congestion
│   │
│   ├── demo/                  # Swap demo app demonstrating the SDK
│   └── cli/                   # soltrac CLI — 4 commands
```

---

## Quick Start

### Run the web app

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # add your SOLANA_RPC_URL
pnpm dev                                         # → http://localhost:3000
```

### Use the CLI

```bash
# Network status
pnpm network

# Pre-flight check (base64 tx) or post-mortem (signature)
pnpm check 56YU2EU1AkRuZjDg2PQ8b4G2GK4iyrFq8mD6RzNhtD21pQXC7Hdb6VJqPdqv2MjqbKDVTmfoyYhtrKgHRNNuwbo

# Explain a confirmed transaction
pnpm explain 56YU2EU1AkRuZjDg2PQ8b4G2GK4iyrFq8mD6RzNhtD21pQXC7Hdb6VJqPdqv2MjqbKDVTmfoyYhtrKgHRNNuwbo

# Look up any program ID
pnpm program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
```

### Install the SDK

```bash
npm install soltrac-sdk
```

```ts
import { preflight } from "soltrac-sdk";

const result = await preflight(base64Tx, { rpcUrl: process.env.SOLANA_RPC_URL });

console.log(result.recommendation);  // "SEND" | "REVIEW" | "DO_NOT_SEND"
console.log(result.riskScore.score); // 0–100
console.log(result.reason);          // "Slippage tolerance exceeded on Jupiter v6"
console.log(result.fix);             // "Increase slippage tolerance to 1.5%"
```

```tsx
// React — one hook blocks all failed sends
import { useSafeTransaction } from "soltrac-sdk/react";

const { send, simResult } = useSafeTransaction(wallet);
// send() auto-simulates before submitting — blocks if risk === "fail"
```

---

## Web App — Pages

| Route | Description |
|---|---|
| `/` | Analyze a confirmed tx or simulate a base64 tx |
| `/check` | Full pre-flight playground — risk gauge, 8 signal bars, instruction trace, fee tiers |
| `/network` | Live Solana network pulse — TPS, congestion, fee tiers, send recommendation |

### Environment Variables

```env
SOLANA_RPC_URL=        # Solana RPC (Helius recommended)
HELIUS_API_KEY=        # Enriched transaction parsing
HELIUS_RPC_URL=        # Helius RPC endpoint
GEMINI_API_KEY=        # AI explanation tier (optional)
WEBHOOK_ADMIN_KEY=     # Admin auth for wallet alert webhooks (optional)
```

---

## SDK — Core Functions

### `preflight(tx, options?)` — Full pre-flight check

Runs dual-pass simulation + 8 risk signals + protocol fingerprint + taxonomy match.

```ts
const result = await preflight(base64Tx, { rpcUrl });

result.recommendation   // "DO_NOT_SEND"
result.riskScore.score  // 87
result.riskScore.signals.forEach(s => console.log(s.name, s.score, s.reason))
result.protocols.names  // ["Jupiter v6", "Raydium CLMM"]
result.taxonomyMatch    // { name: "SlippageToleranceExceeded", summary, fixes }
result.simulation.isStaleBlockhash  // true/false
result.simulation.feeTiers          // [economy, standard, fast]
result.simulation.cuProbe           // { consumed, recommended, headroomPct }
```

### `explain(signature, options?)` — Post-mortem on confirmed tx

```ts
const ex = await explain(signature, { rpcUrl, enableAI: true, geminiApiKey });

ex.rootCause          // "SLIPPAGE_EXCEEDED"
ex.summary            // "Your Jupiter swap failed because the pool price moved..."
ex.failedAt           // "Jupiter v6 → Raydium CLMM (instruction 3 of 5)"
ex.fixes              // [{ action, codeHint, estimatedSuccessLift }]
ex.instructionTrace   // full CPI call tree with pass/fail per instruction
ex.tier               // "deterministic" | "log-pattern" | "ai"
```

### `simulateTx(tx, options?)` — Lightweight single-pass

```ts
const result = await simulateTx(tx, { rpcUrl });
// result.risk: "safe" | "warning" | "fail"
// result.category: "slippage" | "compute_exceeded" | "stale_blockhash" | ...
```

### `lookupError(errValue, programIds?)` — Taxonomy lookup

```ts
import { lookupError } from "soltrac-sdk";

lookupError({ Custom: 6001 }, ["JUP6Lkb..."])
// { name: "SlippageToleranceExceeded", summary, causes, fixes, retryable }

lookupError("InsufficientFundsForFee")
// { name: "InsufficientFundsForFee", severity: "fatal", ... }
```

### `fingerprint(accountKeys)` — Protocol detection

```ts
import { fingerprint } from "soltrac-sdk";

const result = fingerprint(accountKeys);
result.names              // ["Jupiter v6", "Raydium CLMM"]
result.risks              // ["multi-hop-slippage", "tick-range"]
result.isAggregatedSwap   // true
result.categories         // ["dex-aggregator", "clmm"]
```

---

## SDK — React

```tsx
import { useTxSimulate, useSafeTransaction, SoltracBanner } from "soltrac-sdk/react";

// Read-only: debounced live simulation as user builds a tx
const { result, loading } = useTxSimulate(transaction, wallet);

// Safe send: auto-simulates, blocks on fail
const { send, simResult, isPending, error } = useSafeTransaction(wallet);

// Drop-in risk banner
<SoltracBanner result={simResult} />
```

---

## Risk Signals (8 total)

| Signal | Weight | Live? | Source |
|---|---|---|---|
| `cu_pressure` | 22% | ✅ | CU consumed vs budget |
| `slippage_risk` | 22% | ✅ | Simulation error category |
| `network_congestion` | 18% | ✅ | `getRecentPerformanceSamples` |
| `blockhash_age` | 14% | ✅ | Dual-pass staleness detection |
| `account_conflicts` | 10% | ✅ | Simulation account state |
| `instruction_complexity` | 6% | ✅ | CPI depth + invocation count |
| `program_error_history` | 4% | ✅ | `getSignaturesForAddress` (program) |
| `wallet_failure_rate` | 4% | ✅ | `getSignaturesForAddress` (fee payer) |

All 8 signals are live. Confidence reported as fraction of available signal weight.

---

## Protocol Coverage (26)

| Category | Protocols |
|---|---|
| DEX Aggregators | Jupiter v6, Jupiter v4 |
| AMMs | Raydium AMM v4, Raydium AMM v3, Orca v1, Orca v2, Meteora DLMM, Meteora AMM Pools, Pump.fun |
| CLMMs | Raydium CLMM, Orca Whirlpools |
| Orderbooks | Phoenix DEX, OpenBook v2 |
| Liquid Staking | Marinade Finance, Lido for Solana, Sanctum Router |
| MEV | Jito Tip Program, Jito Tip Payment |
| System | System Program, Compute Budget, SPL Token, SPL Token-2022, ATA |

---

## Error Taxonomy (100+ entries, 3 layers)

- **Layer 1 — Native Solana runtime**: `InsufficientFundsForFee`, `BlockhashNotFound`, `ComputationalBudgetExceeded`, `MissingRequiredSignature`, `CallDepthExceeded`, `AccountAlreadyInitialized`, and 5 more
- **Layer 2 — SPL Token program**: Error codes 0–17, each with structured causes and ranked fixes
- **Layer 3 — Protocol-specific**: Jupiter v6 (6001–6016), Raydium AMM/CLMM, Orca Whirlpools, Pump.fun, Marinade — custom codes disambiguated by program ID when the same code appears in multiple programs

---

## CLI

```bash
# All commands via pnpm scripts at root:
pnpm network                          # Live network stats
pnpm check <signature-or-base64>      # Pre-flight or post-mortem
pnpm explain <signature>              # Full explanation
pnpm program <program-id>             # Protocol info + error codes

# Or directly:
cd apps/cli && pnpm dev network
cd apps/cli && pnpm dev check <input>
```

See [apps/cli/README.md](apps/cli/README.md) for full CLI documentation.

---

## Hackathon Tracks

**Infrastructure/Tooling** — `soltrac-sdk` is the first structured pre-flight simulation library for Solana. It gives every developer a typed API to predict, explain, and fix transaction failures across 26 protocols without reading raw logs.

**DeFi/Consumer** — The web app and demo show how `useSafeTransaction` + `SoltracBanner` makes zero-failed-swap UX achievable in 3 lines of React. The `/check` and `/network` pages are standalone tools developers will bookmark.

---

## License

MIT — © 2025 Dhanush Naik

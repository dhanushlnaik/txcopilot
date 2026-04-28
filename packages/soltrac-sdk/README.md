# soltrac-sdk

**Solana transaction intelligence.** Predict failures before they hit the chain.

Pre-flight simulation · Risk scoring · Error taxonomy · Protocol fingerprinting · AI explanations

---

## Install

```bash
npm install soltrac-sdk
# or
pnpm add soltrac-sdk
```

---

## Quickstart

### 1 — Check a base64 transaction before sending

```ts
import { preflight } from "soltrac-sdk";

const result = await preflight(base64Tx, { rpcUrl: process.env.SOLANA_RPC_URL });

console.log(result.recommendation);   // "SEND" | "REVIEW" | "DO_NOT_SEND"
console.log(result.riskScore.score);  // 0–100
console.log(result.reason);           // "Slippage tolerance exceeded on Jupiter v6"
console.log(result.fix);              // "Increase slippage tolerance to 1.5%"
```

### 2 — Explain a confirmed transaction by signature

```ts
import { explain } from "soltrac-sdk";

const ex = await explain("56YU2EU1...", {
  rpcUrl: process.env.SOLANA_RPC_URL,
  enableAI: true,
  geminiApiKey: process.env.GEMINI_API_KEY,
});

console.log(ex.rootCause);     // "SLIPPAGE_EXCEEDED"
console.log(ex.summary);       // Plain-English one-liner
console.log(ex.failedAt);      // "Jupiter v6 → instruction 3 of 5"
console.log(ex.fixes[0]);      // { action, codeHint, estimatedSuccessLift }
```

### 3 — Block failed transactions in React (wallet-safe send)

```tsx
import { useSafeTransaction } from "soltrac-sdk/react";

function SwapButton({ transaction, wallet }) {
  const { send, simResult, isPending } = useSafeTransaction(wallet);

  // send() auto-simulates first — blocks if result.risk === "fail"
  return <button onClick={() => send(transaction)}>Swap</button>;
}
```

### 4 — Lightweight single-pass simulation (non-blocking)

```ts
import { simulateTx } from "soltrac-sdk";

const result = await simulateTx(transaction, { rpcUrl });
// result.risk: "safe" | "warning" | "fail"
// result.category: "slippage" | "compute_exceeded" | "insufficient_funds" | ...
// result.fix: actionable string
```

### 5 — Live network status for fee recommendations

```ts
import { Connection } from "@solana/web3.js";
import { scoreRisk, runMultiPass } from "soltrac-sdk";

// Or just hit the /api/network endpoint from soltrac's web app
```

---

## React Hooks

```tsx
import { useTxSimulate, useSafeTransaction, SoltracBanner } from "soltrac-sdk/react";

// Read-only simulation (debounced, no send)
const { result, loading } = useTxSimulate(transaction, wallet);

// Safe send with pre-flight gate
const { send, simResult, isPending, error } = useSafeTransaction(wallet);

// Drop-in risk banner
<SoltracBanner result={simResult} />
```

---

## API Reference

### `preflight(tx, options?)`

Full pre-flight check with 8 weighted risk signals.

| Field | Type | Description |
|---|---|---|
| `riskScore.score` | `number` | Weighted risk 0–100 |
| `riskScore.signals` | `ScorerSignal[]` | All 8 signals with individual scores |
| `recommendation` | `"SEND" \| "REVIEW" \| "DO_NOT_SEND"` | Go/no-go decision |
| `simulation` | `MultiPassReport` | Baseline + optimistic pass results |
| `protocols` | `FingerprintResult` | Detected protocols + risk flags |
| `taxonomyMatch` | `ErrorEntry \| null` | Matched error from 100+ entry taxonomy |
| `reason` | `string` | Human-readable root cause |
| `fix` | `string \| null` | Top recommended action |

### `explain(signature, options?)`

Post-mortem analysis on a confirmed transaction.

| Field | Type | Description |
|---|---|---|
| `rootCause` | `string` | Machine-readable label (e.g. `SLIPPAGE_EXCEEDED`) |
| `summary` | `string` | One sentence, plain English |
| `failedAt` | `string` | Which instruction in which program failed |
| `fixes` | `ExplanationFix[]` | Ranked fixes with code hints and success lift estimates |
| `tier` | `"deterministic" \| "log-pattern" \| "ai"` | Which analysis tier fired |
| `instructionTrace` | `InstructionTraceEntry[]` | Full CPI call tree with pass/fail |

### `explainFromSimulation(input)`

Synchronous explanation from simulation data (no network calls, tiers 1+2 only).

```ts
import { explainFromSimulation } from "soltrac-sdk";

const ex = explainFromSimulation({ err, logs, accountKeys });
```

### `lookupError(errValue, programIds?)`

Look up any Solana error in the 100+ entry taxonomy.

```ts
import { lookupError } from "soltrac-sdk";

const entry = lookupError({ Custom: 6001 }, ["JUP6Lkb..."]);
// entry.name: "SlippageToleranceExceeded"
// entry.fixes[0].action: "Increase slippage tolerance"
```

### `fingerprint(accountKeys)`

Detect which protocols are involved in a transaction.

```ts
import { fingerprint } from "soltrac-sdk";

const result = fingerprint(accountKeys);
// result.names: ["Jupiter v6", "Raydium CLMM"]
// result.risks: ["multi-hop-slippage", "tick-range"]
// result.isAggregatedSwap: true
```

---

## Protocol Coverage

26 protocols across all major Solana DeFi categories:

| Category | Protocols |
|---|---|
| DEX Aggregators | Jupiter v4, Jupiter v6 |
| AMMs | Raydium AMM v4, Raydium CLMM, Orca v1/v2, Meteora DLMM/AMM, Pump.fun |
| Orderbooks | Phoenix, OpenBook v2 |
| Liquid Staking | Marinade, Lido, Sanctum |
| MEV | Jito TipRouter, Jito FastLane |
| System | System Program, ComputeBudget, SPL Token, Token-2022, ATA |

---

## Error Taxonomy

100+ entries across 3 layers:

- **Layer 1 — Native Solana**: `InsufficientFundsForFee`, `BlockhashNotFound`, `ComputationalBudgetExceeded`, `MissingRequiredSignature`, `CallDepthExceeded`, and more
- **Layer 2 — SPL Token**: Error codes 0–17 from `TokenkegQfe...` with structured causes and fixes
- **Layer 3 — Protocol-specific**: Jupiter v6 (6001–6016), Raydium AMM/CLMM, Orca Whirlpools, Pump.fun, Marinade — disambiguated by program ID

---

## Risk Signals

`preflight()` scores 8 signals weighted by their contribution to failure probability:

| Signal | Weight | Source |
|---|---|---|
| `cu_pressure` | 22% | Compute unit consumption vs budget |
| `slippage_risk` | 22% | Simulation error category |
| `network_congestion` | 18% | Live TPS from `getRecentPerformanceSamples` |
| `blockhash_age` | 14% | Dual-pass staleness detection |
| `account_conflicts` | 10% | Account state in simulation |
| `instruction_complexity` | 6% | CPI depth and invocation count |
| `program_error_history` | 4% | *(indexer pending)* |
| `wallet_failure_rate` | 4% | *(indexer pending)* |

---

## License

MIT

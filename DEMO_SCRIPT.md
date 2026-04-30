# SolTrac Demo Script — Colosseum Hackathon
**Target length**: 2:30 · **Tracks**: Infrastructure/Tooling + DeFi/Consumer

---

## Setup (before recording)

```bash
# Terminal 1 — web app
pnpm dev                          # → http://localhost:3000

# Terminal 2 — demo app
cd apps/demo && pnpm dev          # → http://localhost:3001

# Terminal 3 — ready for CLI commands
export SOLANA_RPC_URL=<your-helius-rpc>
```

Open in advance, do NOT show loading:
- `localhost:3000` on `/check` page — zero state visible
- `localhost:3001` — swap demo loaded
- VS Code with `packages/soltrac-sdk/src/react/useSafeTransaction.ts` open

---

## [0:00 – 0:20] The Problem

**Screen**: blank / title card or Solana explorer showing a failed tx

> "About 30% of Solana DeFi transactions fail silently.
> Users see a generic error. Developers get raw logs.
> Nobody knows if it was slippage, a stale blockhash, or a compute budget issue —
> and nothing tells you what to fix.
> SolTrac changes that."

---

## [0:20 – 0:45] SDK — 6 lines of code

**Screen**: VS Code, blank `index.ts`

Type this live (or reveal line by line):

```ts
import { preflight } from "soltrac-sdk";

const result = await preflight(base64Tx, { rpcUrl: process.env.SOLANA_RPC_URL });

console.log(result.recommendation);   // "DO_NOT_SEND"
console.log(result.riskScore.score);  // 87
console.log(result.reason);           // "Slippage tolerance exceeded on Jupiter v6"
console.log(result.fix);              // "Increase slippage tolerance to 1.5%"
```

> "One function. Dual-pass simulation, 8 live risk signals scored in parallel,
> 100-entry error taxonomy across 26 DeFi protocols.
> It runs before the transaction is signed."

---

## [0:45 – 1:10] /check page — pre-flight playground

**Screen**: `localhost:3000/check`

Paste this signature into the input and hit Analyze:
```
56YU2EU1AkRuZjDg2PQ8b4G2GK4iyrFq8mD6RzNhtD21pQXC7Hdb6VJqPdqv2MjqbKDVTmfoyYhtrKgHRNNuwbo
```

While results animate in, narrate:

> "This is a real Jupiter swap that failed on mainnet.
> Watch the risk score count up — 87 out of 100 — DO NOT SEND.
> Root cause: slippage exceeded on Raydium CLMM, instruction 3 of 5."

Point to the signal bars:

> "8 live signals — compute pressure, slippage risk, network congestion,
> blockhash age, account conflicts — all scored in real time from RPC data."

Point to the fix list:

> "Ranked fixes with estimated success lift.
> Copy-paste code hints. No more guessing."

---

## [1:10 – 1:30] Demo app — useSafeTransaction in action

**Screen**: `localhost:3001`

Click **"Show Fail Scenario"** button.

> "Here's the SDK integrated into a real swap UI.
> The moment the transaction is built, SolTrac simulates it silently in the background."

Point to the red SoltracBanner:

> "Red banner — DO NOT SEND — before the user ever hits confirm.
> The 'Fix It' button auto-generates a Jupiter deep link
> with the corrected slippage pre-filled."

Click Fix It to show the Jupiter link opening.

---

## [1:30 – 1:50] React hook — 3 lines

**Screen**: VS Code with `useSafeTransaction.ts` open

> "This is all it takes to protect any wallet in your app."

Highlight these 3 lines:

```tsx
import { useSafeTransaction, SoltracBanner } from "soltrac-sdk/react";

const { send, simResult } = useSafeTransaction(wallet);
// send() auto-simulates before submitting — blocks if risk === "fail"

<SoltracBanner result={simResult} />
```

> "One hook. One banner. No failed swaps."

---

## [1:50 – 2:20] CLI — developer tool

**Screen**: terminal (large font, dark theme)

```bash
pnpm check 56YU2EU1AkRuZjDg2PQ8b4G2GK4iyrFq8mD6RzNhtD21pQXC7Hdb6VJqPdqv2MjqbKDVTmfoyYhtrKgHRNNuwbo
```

While output renders:

> "Same intelligence, in your terminal.
> Every CI pipeline, every script, every developer workflow."

Then quickly show network:

```bash
pnpm network
```

> "Live network pulse — TPS, congestion score, fee tiers.
> GOOD TO SEND or WAIT — before you even build the transaction."

---

## [2:20 – 2:30] Close

**Screen**: back to `/check` zero state or README

> "SolTrac — pre-flight simulation for Solana.
> 26 protocols, 100-entry error taxonomy, 8 live risk signals.
> Know before you send. Fix before you fail."

Pause 2 seconds. Cut.

---

## Contingency

| If... | Then... |
|---|---|
| RPC slow / no result | Use the other demo sig: `CYQd7an8JWYRcJwfXs3iwa3fAq3HWggkWQUcjRotyS3CBzQc8zut9fLgXx4gR5BAmsw6M1Utb1PwXztyndJFSsi` |
| Jupiter down on demo app | "Show Fail Scenario" button works offline — uses a local mock result |
| CLI output too long | Pre-run once so it's cached, scroll slowly |

---

## Key numbers to mention (pick 2–3)

- **~30%** of Solana DeFi txs fail silently
- **26** DeFi protocols recognized (Jupiter, Raydium, Orca, Pump.fun…)
- **100+** error taxonomy entries across 3 layers
- **8** risk signals, all live from RPC data
- **3 lines** of React to protect any wallet

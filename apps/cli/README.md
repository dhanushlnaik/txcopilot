# soltrac CLI

Command-line interface for Solana transaction intelligence. Four commands — check, explain, network, program.

## Setup

```bash
# From monorepo root
pnpm install

# Set your RPC (or export in shell)
export SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

## Commands

### `check` — Pre-flight or post-mortem

Accepts either a **base64-encoded unsigned transaction** (pre-flight) or a **confirmed tx signature** (post-mortem).

```bash
# From repo root:
pnpm check <input>

# Or directly:
cd apps/cli && pnpm dev check <input>

# With custom RPC:
cd apps/cli && pnpm dev check <input> --rpc https://api.mainnet-beta.solana.com
```

**Pre-flight (base64 tx):**
```
✦ SolTrac — Solana Transaction Intelligence

┌─────────────────────────────────────────────────────────┐
│   DO NOT SEND  Score:  87                               │
│   Risk: FAIL  ·  Tier: deterministic  ·  Non-retryable  │
└─────────────────────────────────────────────────────────┘

ROOT CAUSE
  Root Cause   SLIPPAGE_EXCEEDED
  Failed At    Jupiter v6 → Raydium CLMM (instruction 3 of 5)
  Confidence   94%

SUMMARY
  Your Jupiter swap failed because the pool price moved beyond your slippage
  tolerance during route execution.

RECOMMENDED FIXES
  1  Increase slippage tolerance to 1.5%   +95%
     $ connection.getLatestBlockhash()

RISK SIGNALS
  Compute Pressure          ▓▓░░░░░░░░  22   Using 22% of compute limit
  Slippage Risk             ▓▓▓▓▓▓▓▓▓▓ 100   Slippage tolerance exceeded
  Network Congestion        ▓▓▓▓░░░░░░  42   ~1,680 TPS moderate
  Blockhash Age             ▓░░░░░░░░░  10   Blockhash appears fresh
  Account Conflicts         ▓░░░░░░░░░   5   No conflicts
  Instruction Complexity    ▓▓░░░░░░░░  20   4 invocations
  Program Error History     ▓░░░░░░░░░   8   2/100 recent txs failed
  Wallet Failure Rate       ▓░░░░░░░░░  12   4/50 recent wallet txs failed
```

**Post-mortem (signature):**
```bash
pnpm check 56YU2EU1AkRuZjDg2PQ8b4G2GK4iyrFq8mD6RzNhtD21pQXC7Hdb6VJqPdqv2MjqbKDVTmfoyYhtrKgHRNNuwbo
```

---

### `network` — Live Solana network pulse

```bash
pnpm network

# Output:
┌─────────────────────────────────────────────────────────────┐
│   GOOD TO SEND  Congestion: LOW (22/100)                    │
│   1,840 TPS  ·  98% success rate  ·  Slot 415,892,104       │
└─────────────────────────────────────────────────────────────┘

NETWORK STATS
  TPS                     1,840 tx/s
  Success Rate            98%
  Congestion              22/100 — LOW
  Slot Height             415,892,104
  Samples                 20 performance windows

PRIORITY FEE TIERS
  economy    1,000 μL      75% success
  standard   5,000 μL      90% success
  fast       25,000 μL     99% success

RECOMMENDATION
  ✓ Network conditions are healthy. Economy fee should land reliably.
```

---

### `explain` — Full explanation of a confirmed tx

```bash
pnpm explain <signature>
pnpm explain <signature> --ai    # Enable Gemini AI tier (requires GEMINI_API_KEY)
```

Fetches the transaction from RPC, runs all 3 explanation tiers (deterministic → log-pattern → AI), and prints:
- Root cause label + plain English summary
- Which instruction failed and where in the call chain
- Ranked fixes with copy-paste code hints
- Full instruction trace (CPI call tree)
- Protocol risks

---

### `program` — Protocol + error code lookup

```bash
pnpm program <program-id>

# Examples:
pnpm program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4   # Jupiter v6
pnpm program 675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8   # Raydium AMM v4
pnpm program 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P    # Pump.fun

# Output:
PROTOCOL
  Name        Jupiter Aggregator v6
  Category    dex-aggregator
  Program ID  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
  Aggregator  Yes — multi-hop routing
  Docs        https://station.jup.ag/docs

KNOWN RISKS
  · multi hop slippage
  · route staleness
  · front run

ERROR CODES
    6001  SlippageToleranceExceeded
          Pool price moved beyond your slippage tolerance during Jupiter routing.
          recoverable · retryable
```

---

## Options

| Flag | Commands | Description |
|---|---|---|
| `--rpc <url>` | `check`, `explain`, `network` | Override RPC URL (default: `SOLANA_RPC_URL` env var) |
| `--ai` | `explain` | Enable Gemini AI explanation tier |

---

## Environment Variables

```env
SOLANA_RPC_URL=    # Solana RPC endpoint (Helius recommended for best results)
GEMINI_API_KEY=    # Required only for --ai flag on the explain command
```

---

## Build

```bash
cd apps/cli
pnpm build          # → dist/index.js (CommonJS bundle)
node dist/index.js network
```

After building, the `soltrac` binary is available at `dist/index.js` and can be linked globally:

```bash
npm link            # makes `soltrac` available globally
soltrac network
soltrac check <sig>
```

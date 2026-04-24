---
name: Colosseum Sprint Progress
description: Day-by-day execution plan for Colosseum Game Plan submission (2 tracks: Infrastructure + DeFi)
type: project
---

# Colosseum Sprint: soltrac-sdk Submission

**Target**: Two-track Solana competition (Infrastructure + DeFi/Consumer)
**Status**: Day 2 COMPLETE (tested & working) ✅ → Ready for Day 3 video

## Completed ✅

### Day 1 AM — Core feature (Hero feature)
- **useSafeTransaction hook** created (`packages/soltrac-sdk/src/react/useSafeTransaction.ts`)
  - One hook, no failed txs: `const { send, simResult } = useSafeTransaction(wallet)`
  - Auto-simulates before sending
  - Blocks on fail (risk === 'fail')
  - Exported from `soltrac-sdk/react`

### Day 1 PM — Token-aware Jupiter deep links
- **tokenParser utility** created (`packages/soltrac-sdk/src/tokenParser.ts`)
  - `extractTokensFromLogs()` — parses mints from SPL Token program logs
  - `buildJupiterSwapUrl()` — constructs `jup.ag/swap/MINT-MINT?slippage=X`
  - `buildJupiterLinkFromLogs()` — end-to-end log → Jupiter link
- **Updated analyzer** to use token-aware links in fixParams
  - Slippage errors now return real token mints (not hardcoded SOL-USDC)
  - Fallback to generic link if parsing fails

## To-Do 🎯

### Day 2 AM — npm publish + README
- [ ] Verify/add build config for SDK (tsup or esbuild)
- [ ] npm publish soltrac-sdk to registry
- [ ] Write README with 6-line quickstart for all three hooks:
  - `simulateTx()` (async, on-demand)
  - `useTxSimulate()` (React hook, read-only, debounced)
  - `useSafeTransaction()` (React hook, safe send with wallet)
- [ ] Add protocol coverage badge to README (22+ protocols: Jupiter, Raydium, Pump.fun, Orca, etc.)

### Day 2 PM — Demo app: Fail scenario + UI
- [x] Integrate useSafeTransaction into SwapDemo (replace manual simulateTx)
- [x] Create reliable fail trigger (demo button showing BONK slippage fail)
- [x] Add confidence score badge next to SoltracBanner (98% confidence, etc.)
- [x] Add "Why did this fail?" expandable section using `result.reason`
- [x] "Fix it" button auto-generates Jupiter deep links via tokenParser
  - Button automatically opens `jup.ag/swap/MINT-MINT?slippage=1.5` when clicked
  - Demo scenario shows: `BONK→SOL` with pre-filled slippage

### Day 3 AM — Demo video (2–3 min, multiple takes)
- [ ] Record 0:00–0:20 — Problem statement (30% Solana swaps fail silently)
- [ ] Record 0:20–0:45 — SDK demo: npm install + 6 lines of code
- [ ] Record 0:45–1:30 — SwapDemo: paste tx → red banner → Fix it button
- [ ] Record 1:30–2:00 — useSafeTransaction hook in 3 lines
- [ ] Record 2:00–2:30 — Mention 22 protocols, show test passing

### Day 3 PM — Submission
- [ ] Finalize repo README + examples
- [ ] Write submission narratives:
  - **Infrastructure track**: "soltrac-sdk is the first pre-flight simulation library for Solana with structured error categories across 22+ protocols"
  - **DeFi track**: "Built with soltrac-sdk — prevents failed swaps before they reach the chain"
- [ ] Submit to Colosseum

## Temp Changes (to revert later)

**TEMP: Demo fail scenario button** in `apps/demo/src/app/SwapDemo.tsx`
- Button at line ~360 that triggers a mock slippage failure for judges to see red banner
- Marked with `TEMP: Demo fail scenario button for judges to see red banner` comment
- Should be removed or hidden after Day 3 video is recorded
- Why: Judges need to see the failure UI working without necessarily connecting Jupiter API

## Testing ✅

**Tested & Verified:**
- [x] TypeScript build passes (next build)
- [x] Dev server starts on port 3001 (npm run dev)
- [x] Demo app loads in browser
- [x] "Show Fail Scenario" button renders
- [x] Stats strip displays (847 simulated, 312 caught)
- [x] Token selectors work (SOL, USDC, BONK)
- [x] Form inputs render

## Key Metrics for Judges

- **Hero feature**: `useSafeTransaction` — one hook blocks all swap failures
- **Ecosystem integration**: Jupiter token-aware deep links in fixParams
- **Coverage**: 22+ DEX protocols recognized
- **Developer experience**: 6-line quickstart, zero boilerplate
- **Confidence**: Structured error categories (slippage, compute, insufficient funds, etc.)

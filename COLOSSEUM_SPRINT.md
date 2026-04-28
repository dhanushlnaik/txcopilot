---
name: Colosseum Sprint Progress
description: Day-by-day execution plan for Colosseum Game Plan submission (2 tracks: Infrastructure + DeFi)
type: project
---

# Colosseum Sprint: soltrac-sdk Submission

**Target**: Two-track Solana competition (Infrastructure + DeFi/Consumer)
**Status**: Day 3 PREP COMPLETE ✅ → Ready for video + submission

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

### Day 2 AM — npm publish + README
- [x] tsup build config (dual CJS+ESM, separate browser/node esbuildOptions)
- [x] package.json exports map with "types" first (TS5 moduleResolution: bundler)
- [x] SDK README — 5 quickstart examples, full API reference, 26 protocols, 3-layer taxonomy
- [x] SDK bumped to 0.2.0, private: true removed

### Day 2 PM — Demo app + web app + CLI
- [x] Integrate useSafeTransaction into SwapDemo
- [x] Create reliable fail trigger (BONK slippage fail scenario)
- [x] Add confidence score badge next to SoltracBanner
- [x] "Why did this fail?" expandable section using result.reason
- [x] "Fix it" button → Jupiter deep links via tokenParser
- [x] /check page — full pre-flight playground (8 signal bars, CU probe, instruction trace, fee tiers, taxonomy card)
- [x] /network page — live Solana pulse auto-refresh every 15s
- [x] CLI — 4 commands: check, explain, network, program
- [x] Both scorer signals live (program_error_history, wallet_failure_rate via getSignaturesForAddress)

### Day 3 Prep — Documentation
- [x] Root monorepo README (submission doc — problem, solution, SDK API, CLI, protocol table)
- [x] apps/cli/README.md — 4 commands with example output
- [x] apps/web/README.md — pages, API routes, project structure

## To-Do 🎯

### Day 3 AM — Demo video (2–3 min, multiple takes)
- [ ] Record 0:00–0:20 — Problem statement (30% Solana swaps fail silently)
- [ ] Record 0:20–0:45 — SDK demo: npm install + 6 lines of code
- [ ] Record 0:45–1:30 — SwapDemo: paste tx → red banner → Fix it button
- [ ] Record 1:30–2:00 — useSafeTransaction hook in 3 lines
- [ ] Record 2:00–2:30 — /check page + CLI check command

### Day 3 PM — Submission
- [ ] Write submission narratives:
  - **Infrastructure track**: "soltrac-sdk is the first pre-flight simulation library for Solana with structured error categories across 26 protocols"
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

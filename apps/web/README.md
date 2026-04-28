# SolTrac Web App

> **Know before you send. Fix before you fail.**

Next.js App Router frontend for [SolTrac](../../README.md) — the Solana transaction intelligence platform. Three pages, five API routes, backed by `soltrac-sdk`.

🔗 **[Live Demo →](https://soltrac.vercel.app)** · [Root README →](../../README.md) · [SDK →](../../packages/soltrac-sdk/README.md)

---

## Pages

### `/` — Transaction Analyzer

Two modes on the same card:
- **Analyze** — paste a confirmed signature, get post-mortem analysis (risk level, root cause, fix list)
- **Simulate** — paste a base64 tx, predict failure before sending

### `/check` — Pre-flight Playground

Full risk assessment for an unsigned transaction. Shows:
- Animated risk score (0–100) with `DO NOT SEND / REVIEW / SEND` recommendation
- Root cause + failed-at location + retryable badge
- 8 animated risk signal bars with live scores and reasons
- Ranked fix list with copy-paste code hints
- Instruction trace (depth-indented CPI call tree, failed nodes pulse red)
- Compute unit probe (consumed / limit / recommended / headroom bar)
- Priority fee tiers (economy / standard / fast with success rate bars)
- Detected protocol badges + protocol risk tags
- Taxonomy match card when a known error pattern is found

### `/network` — Network Pulse

Live Solana network stats, auto-refreshes every 15 seconds:
- TPS, success rate, current slot
- Congestion score (0–100) with animated bar and LOW/MODERATE/HIGH/CRITICAL label
- `GOOD TO SEND / CAUTION / WAIT` recommendation with reason
- Priority fee tiers from `getRecentPrioritizationFees()` with μL and SOL denomination

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/preflight` | POST | Full risk assessment — accepts base64 tx or signature |
| `/api/analyze` | POST | Post-mortem on confirmed tx by signature |
| `/api/simulate` | POST | Single-pass simulation on base64 tx |
| `/api/explain` | POST | Streaming AI explanation via Gemini |
| `/api/network` | GET | Live TPS, congestion score, fee tiers |
| `/api/webhooks` | GET/POST | Wallet alert subscriptions |
| `/api/webhooks/check` | POST | Poll subscribed wallets, deliver Discord alerts |

### `/api/preflight` — request/response

```ts
// POST body
{ input: string }   // base64-encoded tx OR 86–88 char signature

// Response — base64 tx input
{
  success: true,
  inputType: "transaction",
  explanation: Explanation,   // deterministic root cause + fixes + trace
  preflight: {
    risk: "safe" | "warning" | "fail",
    recommendation: "SEND" | "REVIEW" | "DO_NOT_SEND",
    riskScore: RiskScore,      // score + 8 signals + confidence
    simulation: MultiPassReport, // baseline + optimistic + cuProbe + feeTiers
    protocols: FingerprintResult,
    taxonomyMatch: ErrorEntry | null
  }
}

// Response — signature input (post-mortem)
{ success: true, inputType: "signature", explanation: Explanation, preflight: null }
```

---

## Setup

```bash
# From repo root
pnpm install

# Copy and fill env
cp apps/web/.env.example apps/web/.env.local

# Start dev server
pnpm dev   # → http://localhost:3000
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SOLANA_RPC_URL` | Yes | Solana RPC endpoint |
| `HELIUS_API_KEY` | Recommended | Enriched tx parsing — better analysis quality |
| `HELIUS_RPC_URL` | Recommended | Helius RPC URL |
| `GEMINI_API_KEY` | Optional | Enables AI explanation tier |
| `GEMINI_EXPLAIN_MODEL` | Optional | Override model (default: `gemini-1.5-flash`) |
| `WEBHOOK_ADMIN_KEY` | Optional | Admin auth for webhook write endpoints |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── preflight/route.ts      # Full pre-flight — routes by input type
│   │   ├── analyze/route.ts        # Post-mortem on confirmed tx
│   │   ├── simulate/route.ts       # Single-pass simulation
│   │   ├── explain/route.ts        # Streaming AI via Gemini
│   │   ├── network/route.ts        # Live TPS, congestion, fees
│   │   └── webhooks/               # Wallet alert CRUD + polling
│   ├── check/
│   │   ├── page.tsx                # Server component + metadata
│   │   └── CheckPage.tsx           # Pre-flight playground (client)
│   ├── network/
│   │   ├── page.tsx                # Server component + metadata
│   │   └── NetworkPage.tsx         # Live network pulse (client)
│   ├── page.tsx                    # Home — analyzer + simulate
│   └── globals.css                 # Design tokens + animations
├── components/
│   ├── analyzer-card.tsx           # Mode toggle + input + result
│   ├── result-card.tsx             # AnalysisResult display + AI explain
│   ├── hero.tsx                    # Hero with Pre-flight + Network CTAs
│   ├── network-strip.tsx           # Live network bar
│   ├── how-it-works.tsx            # 3-step animated guide
│   ├── webhook-manager.tsx         # Wallet alerts dashboard
│   └── ui/                        # shadcn/ui primitives
└── lib/
    ├── solana.ts                   # RPC helpers (getNetworkStatus, simulateRawTx)
    ├── types.ts                    # Re-exports from soltrac-sdk
    ├── webhook-store.ts            # File-persisted webhook store
    └── webhook-auth.ts             # Admin key middleware
```

---

## Commands

```bash
pnpm dev      # Development server → http://localhost:3000
pnpm build    # Production build
pnpm start    # Serve production build
pnpm lint     # ESLint
pnpm test     # Vitest test suite
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router + React 19 + TypeScript |
| Styling | Tailwind CSS, shadcn/ui, Framer Motion |
| Fonts | Space Grotesk (headings), Geist Mono (code) |
| Intelligence | soltrac-sdk (simulator, scorer, taxonomy, fingerprint, explainer) |
| AI | Google Gemini streaming |
| Solana | @solana/web3.js + Helius |

---

## License

MIT

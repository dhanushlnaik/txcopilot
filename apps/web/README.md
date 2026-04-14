# SolTrac

> **Know before you send. Fix before you fail.**

SolTrac is a Solana transaction intelligence platform that predicts whether a transaction will fail, explains why, and tells you how to fix it. Built for developers and advanced traders to reduce guesswork, save time, and navigate network congestion.

🔗 **[Live Demo →](https://soltrac.vercel.app)**

---

## ✨ Features

### 🔍 Transaction Analyzer
A rule-based heuristics engine that diagnoses Solana transactions with high confidence:
- **22+ Protocol-Specific Error Codes** — Jupiter v6, Raydium AMM/CLMM, Orca Whirlpool, Pump.fun, Anchor
- **17 Log Pattern Scanners** — slippage, compute exhaustion, Token-2022, bonding curves, privilege escalation
- **Smart Risk Scoring** — confirmed txs score LOW; genuine failures surface as MEDIUM/HIGH
- **Program ID Inference** — identifies SWAP, MEV_TIP, NFT_TRADE, STAKE from major protocol program IDs
- **Network-Aware Analysis** — cross-references priority fees against real-time congestion

### ⚡ Pre-flight Simulation
Simulate transactions **before sending them on-chain**:
- Accepts base64-encoded transaction payloads
- Runs `simulateTransaction` via RPC
- Pipes simulation results through the full analyzer engine
- Predicts success/failure with actionable diagnostics

### 🔔 Webhook Alerts
Monitor wallets and receive real-time failure alerts:
- Subscribe to wallet addresses with custom webhook URLs
- Alert on `failed` transactions or `high_risk` analysis results
- Discord webhook formatting with rich embeds
- Admin key auth, retry with exponential backoff, signature dedup
- File-persisted storage with force-test mode

### 🤖 AI-Powered Explanations
Get plain-language breakdowns of complex failures:
- Powered by Google Gemini with multi-model fallback
- Quality validation ensures complete, structured responses
- Streaming text response for real-time display
- Only offered when heuristic analysis is inconclusive

### 🎨 UI / UX
- **Dark-first Solana Palette** — `#050816` background with mint/purple/magenta gradients
- **Analyze / Simulate Mode Toggle** — green (analyze) vs purple (simulate) visual modes
- **"How it Works"** — 3-step animated guide (Paste → Analyze → Fix)
- **Result Sharing** — one-click "Copy as Markdown" for team collaboration
- **Animated Gradient Border** — rotating conic gradient on the analyzer card
- **Live Network Strip** — real-time TPS, congestion, and fee tier
- **Fully Mobile Responsive** — tested at 390px viewport

---

## 🛠 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/analyze` | POST | Analyze a transaction by signature |
| `/api/simulate` | POST | Simulate a base64-encoded transaction |
| `/api/network` | GET | Get current network status (TPS, congestion, fees) |
| `/api/webhooks` | GET/POST | List or create webhook subscriptions |
| `/api/webhooks/[id]` | DELETE | Remove a webhook subscription |
| `/api/webhooks/check` | POST | Poll wallets and deliver alerts |
| `/api/explain` | POST | Stream AI explanation via Gemini |

---

## 🧪 Testing

```bash
pnpm test
```

**35 tests** across 4 suites:
- `analyzer.test.ts` — 15 tests (error codes, log patterns, false positives, risk scoring, type inference)
- `api.test.ts` — 12 tests (input validation, webhook CRUD, admin auth, polling)
- `explain.test.ts` — 4 tests (payload validation, streaming, model fallback)
- `solana.test.ts` — 4 tests (signature validation)

---

## 🏗 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui, Framer Motion |
| Solana | @solana/web3.js + Helius API (with public RPC fallback) |
| AI | Google Gemini (multi-model fallback) |
| Testing | Vitest |
| Deployment | Vercel |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- pnpm

### Installation

```bash
# Clone and install
git clone https://github.com/dhanushlnaik/soltrac.git
cd soltrac
pnpm install

# Configure environment
cp .env.example .env.local
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `HELIUS_API_KEY` | Recommended | Helius API key for enriched transaction parsing |
| `HELIUS_RPC_URL` | Recommended | Custom Helius RPC endpoint |
| `SOLANA_RPC_URL` | Fallback | Public RPC URL (auto-configured if empty) |
| `GEMINI_API_KEY` | Optional | Enables AI-powered explanations |
| `GEMINI_EXPLAIN_MODEL` | Optional | Model override (default: `gemini-1.5-flash`) |
| `WEBHOOK_ADMIN_KEY` | Optional | Protects webhook API with admin auth |

### Run

```bash
pnpm dev        # Development server → http://localhost:3000
pnpm test       # Run test suite
pnpm build      # Production build
```

---

## 📂 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts        # Transaction analysis
│   │   ├── simulate/route.ts       # Pre-flight simulation
│   │   ├── explain/route.ts        # AI explanation (Gemini)
│   │   ├── network/route.ts        # Network status
│   │   ├── webhooks/route.ts       # Webhook CRUD
│   │   ├── webhooks/[id]/route.ts  # Webhook delete
│   │   └── webhooks/check/route.ts # Webhook polling
│   ├── page.tsx                    # Main page
│   ├── layout.tsx                  # Root layout
│   └── globals.css                 # Design system
├── components/
│   ├── analyzer-card.tsx           # Input card (Analyze/Simulate)
│   ├── result-card.tsx             # Results + Share + AI Explain
│   ├── webhook-manager.tsx         # Alerts dashboard
│   ├── how-it-works.tsx            # 3-step guide
│   ├── hero.tsx                    # Hero section
│   ├── network-strip.tsx           # Live network bar
│   └── ui/                        # shadcn/ui primitives
├── lib/
│   ├── analyzer.ts                 # Heuristics engine
│   ├── solana.ts                   # RPC helpers + simulation
│   ├── webhook-store.ts            # Webhook persistence
│   ├── webhook-auth.ts             # Admin auth middleware
│   └── types.ts                    # Type definitions
└── __tests__/                      # Vitest test suites
```

---

## 📄 License

MIT

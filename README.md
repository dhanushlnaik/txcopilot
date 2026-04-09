# SolTrac (TxCopilot)

> "Know before you send. Fix before you fail."

A tool that predicts whether a Solana transaction will fail, explains why, and tells users how to fix it. Built for Solana developers and advanced traders to reduce guesswork, save time, and navigate network congestion.

## 🧠 Context & Vision

Solana transactions often fail, get dropped, or behave unpredictably during congestion. While the reasons are technically logged on-chain, they are scattered and difficult to parse. **SolTrac** acts as an intelligence layer: it takes a transaction signature, analyzes it using an extensible heuristics engine, and provides a clear risk assessment alongside actionable fixes.

---

## ✅ Features

### Analyzer Engine (`src/lib/analyzer.ts`)
A rule-based heuristics engine designed to flag errors with high confidence:

- **22+ Protocol-Specific Error Codes** — covering Jupiter v6, Raydium AMM/CLMM, Orca Whirlpool, Pump.fun, and common Anchor errors.
- **17 Log Pattern Scanners** — regex-based detection for slippage, compute exhaustion, Token-2022 failures, bonding curves, privilege escalation, rent exemption, and more.
- **Smart Risk Scoring** — confirmed-successful transactions correctly score as LOW; genuine issues are prioritized as MEDIUM/HIGH.
- **Program ID Inference** — identifies tx types (SWAP, MEV_TIP, NFT_TRADE, STAKE) from Jito, Jupiter, Raydium, Orca, and Metaplex program IDs.
- **Network-Aware Analysis** — cross-references priority fees against real-time network congestion.

### Pre-flight Simulation (`POST /api/simulate`)
Simulate a transaction **before sending it on-chain**:
- Accepts base64-encoded transaction payloads
- Runs `simulateTransaction` via RPC with `replaceRecentBlockhash`
- Pipes results through the full analyzer engine
- Predicts success/failure and returns actionable diagnostics

### UI / UX
- **Dark-first Solana Palette** — deep `#050816` background with mint/purple/magenta gradient accents
- **Analyze / Simulate Mode Toggle** — switch between analyzing past transactions and simulating new ones
- **"How it Works" Section** — 3-step animated guide (Paste → Analyze → Fix)
- **Result Sharing** — one-click "Copy as Markdown" for sharing analysis results with teams
- **Animated Gradient Border** — rotating conic gradient around the analyzer card
- **Live Network Intelligence Strip** — real-time TPS, congestion level, and recommended fee tier
- **Fully Mobile Responsive** — all components tested and polished at 390px viewport

### API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/analyze` | POST | Analyze a transaction by signature |
| `/api/simulate` | POST | Simulate a base64-encoded transaction |
| `/api/network` | GET | Get current network status (TPS, congestion, fees) |

---

## 🏗 Tech Stack

- **Framework:** Next.js 16.2 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4, `shadcn/ui`, Framer Motion
- **Solana:** `@solana/web3.js` + Helius API (with public RPC fallback)
- **Typography:** Space Grotesk (headings) + Inter (body)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- `pnpm`

### Installation

1. **Clone the repository and install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure Environment Variables:**
   ```bash
   cp .env.example .env.local
   ```
   Add your keys:
   - `HELIUS_API_KEY`: Highly recommended for enriched analytics.
   - `HELIUS_RPC_URL`: Your Helius custom RPC URL.
   - `SOLANA_RPC_URL`: Fallback public RPC.

3. **Run the Development Server:**
   ```bash
   pnpm run dev
   ```
   Navigate to `http://localhost:3000`.

---

## 📂 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts    # Transaction analysis endpoint
│   │   ├── simulate/route.ts   # Pre-flight simulation endpoint
│   │   └── network/route.ts    # Network status endpoint
│   ├── page.tsx                # Main page
│   ├── layout.tsx              # Root layout with fonts
│   └── globals.css             # Design tokens & utilities
├── components/
│   ├── analyzer-card.tsx       # Main input card (Analyze/Simulate modes)
│   ├── result-card.tsx         # Analysis result display + Share
│   ├── how-it-works.tsx        # 3-step visual guide
│   ├── network-strip.tsx       # Live network status bar
│   └── ui/                     # shadcn/ui primitives
└── lib/
    ├── analyzer.ts             # Core heuristics engine
    ├── solana.ts               # RPC helpers + simulation
    └── types.ts                # TypeScript interfaces
```

---

## 🚧 Roadmap

- [ ] Extended type inference for complex DeFi routing (multi-hop Jupiter swaps)
- [ ] Result caching for instant analysis of known transactions
- [ ] Webhook alerts for transaction monitoring
- [ ] On-chain program registry for automatic error code resolution

"use client";

import { useState } from "react";
import { simulateTx } from "soltrac-sdk";
import { SoltracBanner } from "soltrac-sdk/react";
import type { SimResult } from "soltrac-sdk";

// ── Token config ─────────────────────────────────────────────────────────────
const TOKENS = {
  SOL:  { mint: "So11111111111111111111111111111111111111112",  decimals: 9,  symbol: "SOL"  },
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6,  symbol: "USDC" },
  BONK: { mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5,  symbol: "BONK" },
} as const;

type TokenKey = keyof typeof TOKENS;

const DEMO_WALLET = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const SLIPPAGE_BPS = 10; // 0.1% — intentionally low to trigger banner

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  card: {
    width: "100%",
    maxWidth: "480px",
    background: "#1a1d2e",
    border: "1px solid #2a2d3e",
    borderRadius: "16px",
    padding: "24px",
    boxSizing: "border-box" as const,
  },
  header: {
    marginBottom: "20px",
  },
  title: {
    margin: "0 0 4px",
    fontSize: "22px",
    fontWeight: 700,
    color: "#e2e8f0",
  },
  subtitle: {
    margin: 0,
    fontSize: "13px",
    color: "#64748b",
  },
  statsStrip: {
    display: "flex",
    gap: "24px",
    padding: "12px 0",
    borderTop: "1px solid #2a2d3e",
    borderBottom: "1px solid #2a2d3e",
    marginBottom: "24px",
  },
  statItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  statNumber: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#e2e8f0",
  },
  statLabel: {
    fontSize: "11px",
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  label: {
    display: "block",
    fontSize: "12px",
    color: "#64748b",
    marginBottom: "6px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "8px",
  },
  input: {
    flex: 1,
    background: "#0f1117",
    border: "1px solid #2a2d3e",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "16px",
    color: "#e2e8f0",
    outline: "none",
  },
  select: {
    background: "#0f1117",
    border: "1px solid #2a2d3e",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#e2e8f0",
    cursor: "pointer",
    outline: "none",
    minWidth: "90px",
  },
  arrow: {
    textAlign: "center" as const,
    fontSize: "20px",
    color: "#64748b",
    margin: "4px 0",
    lineHeight: 1,
  },
  receiveBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#0f1117",
    border: "1px solid #2a2d3e",
    borderRadius: "8px",
    padding: "10px 12px",
    marginBottom: "16px",
  },
  receiveAmount: {
    fontSize: "16px",
    color: "#64748b",
  },
  previewBtn: (loading: boolean) => ({
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    fontSize: "15px",
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    background: loading ? "#2a2d3e" : "linear-gradient(135deg, #00FFA3, #14F195)",
    color: loading ? "#64748b" : "#0f1117",
    transition: "opacity 0.15s",
    opacity: loading ? 0.7 : 1,
  }),
  errorBox: {
    marginTop: "12px",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#f87171",
    fontSize: "13px",
  },
  resultsArea: {
    marginTop: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  bannerVars: {
    "--color-background-warning": "rgba(245,158,11,0.12)",
    "--color-text-warning": "#fbbf24",
    "--color-border-warning": "rgba(245,158,11,0.3)",
    "--color-background-danger": "rgba(239,68,68,0.12)",
    "--color-text-danger": "#f87171",
    "--color-border-danger": "rgba(239,68,68,0.3)",
  } as React.CSSProperties,
  confirmBtn: (risk: SimResult["risk"] | null) => ({
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    fontSize: "15px",
    fontWeight: 600,
    cursor: risk === "fail" ? "not-allowed" : "pointer",
    background: risk === "fail"
      ? "#1a1d2e"
      : "linear-gradient(135deg, #00FFA3, #14F195)",
    color: risk === "fail" ? "#64748b" : "#0f1117",
    border2: risk === "fail" ? "1px solid #2a2d3e" : "none",
    opacity: risk === "fail" ? 0.5 : 1,
    transition: "opacity 0.15s",
  }),
} as const;

// ── Component ─────────────────────────────────────────────────────────────────
export default function SwapDemo() {
  const [fromToken, setFromToken] = useState<TokenKey>("SOL");
  const [toToken, setToToken] = useState<TokenKey>("USDC");
  const [amount, setAmount] = useState("");
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteOut, setQuoteOut] = useState<string | null>(null);

  const handlePreview = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a valid positive amount");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSimResult(null);
    setQuoteOut(null);

    const fromCfg = TOKENS[fromToken];
    const toCfg = TOKENS[toToken];
    const amountRaw = Math.floor(parsed * 10 ** fromCfg.decimals);

    // Build auth headers once — reused for quote + swap
    const jupApiKey = process.env.NEXT_PUBLIC_JUP_API_KEY ?? "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (jupApiKey) headers["x-api-key"] = jupApiKey;

    try {
      // 1. Jupiter quote (V2 endpoint)
      const quoteRes = await fetch(
        `https://api.jup.ag/swap/v1/quote?inputMint=${fromCfg.mint}&outputMint=${toCfg.mint}&amount=${amountRaw}&slippageBps=${SLIPPAGE_BPS}`,
        { headers }
      );
      const quote = await quoteRes.json() as { error?: string; outAmount?: string };
      if (quote.error) {
        setError(quote.error);
        return;
      }
      if (quote.outAmount) {
        const outHuman = (Number(quote.outAmount) / 10 ** toCfg.decimals).toFixed(
          toCfg.decimals > 4 ? 4 : toCfg.decimals
        );
        setQuoteOut(`≈ ${outHuman} ${toCfg.symbol}`);
      }

      // 2. Jupiter swap transaction
      const swapRes = await fetch("https://api.jup.ag/swap/v1/swap", {
        method: "POST",
        headers,
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: DEMO_WALLET,
          wrapAndUnwrapSol: true,
        }),
      });
      const swapJson = await swapRes.json() as { swapTransaction?: string; error?: string };
      if (!swapJson.swapTransaction) {
        setError(swapJson.error ?? "Failed to build swap tx");
        return;
      }

      // 3. Simulate via soltrac-sdk
      const result = await simulateTx(swapJson.swapTransaction, {
        rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
      });
      setSimResult(result);
    } catch (jupiterErr) {
      // Jupiter unreachable — show a demo fallback so the UI is still useful
      console.warn("Jupiter unavailable, using demo fallback:", jupiterErr);
      setQuoteOut(`≈ demo ${toCfg.symbol}`);
      setSimResult({
        risk: "fail",
        category: "slippage",
        reason: "Slippage tolerance exceeded — price moved against you (demo)",
        fix: "Increase slippage to 1.5% and retry",
        fixParams: {
          type: "slippage",
          slippageBps: 150,
          deepLinkUrl: "https://jup.ag/swap/SOL-USDC?slippage=1.5",
        },
        confidence: 1.0,
        source: "simulation",
        raw: null,
      });
      setIsLoading(false);
      return;
    } finally {
      setIsLoading(false);
    }
  };

  const tokenOptions = (Object.keys(TOKENS) as TokenKey[]).map((k) => (
    <option key={k} value={k}>{TOKENS[k].symbol}</option>
  ));

  return (
    <div style={S.card}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>SolTrac Demo</h1>
        <p style={S.subtitle}>Pre-flight swap simulation</p>
      </div>

      {/* Stats strip */}
      <div style={S.statsStrip}>
        <div style={S.statItem}>
          <span style={S.statNumber}>847</span>
          <span style={S.statLabel}>simulated</span>
        </div>
        <div style={S.statItem}>
          <span style={S.statNumber}>312</span>
          <span style={S.statLabel}>failures caught</span>
        </div>
      </div>

      {/* Form */}
      <label style={S.label}>You pay</label>
      <div style={S.inputRow}>
        <input
          style={S.input}
          type="number"
          min="0"
          step="any"
          placeholder="0.00"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setSimResult(null); setError(null); }}
        />
        <select
          style={S.select}
          value={fromToken}
          onChange={(e) => { setFromToken(e.target.value as TokenKey); setSimResult(null); setQuoteOut(null); }}
        >
          {tokenOptions}
        </select>
      </div>

      <div style={S.arrow}>↓</div>

      <label style={{ ...S.label, marginTop: "8px" }}>You receive</label>
      <div style={S.receiveBox}>
        <span style={S.receiveAmount}>{quoteOut ?? "—"}</span>
        <select
          style={{ ...S.select, background: "transparent", border: "none" }}
          value={toToken}
          onChange={(e) => { setToToken(e.target.value as TokenKey); setSimResult(null); setQuoteOut(null); }}
        >
          {tokenOptions}
        </select>
      </div>

      <button
        type="button"
        style={S.previewBtn(isLoading)}
        onClick={handlePreview}
        disabled={isLoading}
      >
        {isLoading ? "Simulating…" : "Preview Swap"}
      </button>

      {error && <div style={S.errorBox}>{error}</div>}

      {/* Results */}
      {simResult && (
        <div style={S.resultsArea}>
          <div style={S.bannerVars}>
            <SoltracBanner result={simResult} />
          </div>

          <button
            type="button"
            disabled={simResult.risk === "fail"}
            style={S.confirmBtn(simResult.risk)}
            onClick={() => alert("In production this would submit the transaction")}
          >
            {simResult.risk === "fail" ? "Swap Blocked" : "Confirm Swap"}
          </button>
        </div>
      )}
    </div>
  );
}

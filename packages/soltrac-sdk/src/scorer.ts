import { Connection } from "@solana/web3.js";
import type { MultiPassReport } from "./simulator";
import type { SimResult } from "./types";

const DEFAULT_RPC =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScorerSignal {
  name: string;
  /** 0 = no risk, 100 = maximum risk */
  score: number;
  /** Contribution weight (all weights sum to 1.0) */
  weight: number;
  /** False for deferred signals backed by indexer data */
  available: boolean;
  reason: string;
}

export type Recommendation = "SEND" | "REVIEW" | "DO_NOT_SEND";

export interface RiskScore {
  /** Weighted aggregate 0–100 */
  score: number;
  risk: "safe" | "warning" | "fail";
  /** 0–1: fraction of weight contributed by available signals */
  confidence: number;
  recommendation: Recommendation;
  signals: ScorerSignal[];
}

// ── Signal weights (must sum to 1.0) ─────────────────────────────────────────

const WEIGHTS = {
  cu_pressure:          0.22,
  slippage_risk:        0.22,
  network_congestion:   0.18,
  blockhash_age:        0.14,
  account_conflicts:    0.10,
  instruction_complexity: 0.06,
  program_error_history:  0.04, // deferred — indexer not yet available
  wallet_failure_rate:    0.04, // deferred — indexer not yet available
} as const;

// ── Individual signal scorers ─────────────────────────────────────────────────

function scoreCuPressure(report: MultiPassReport): ScorerSignal {
  const { consumed, currentLimit, headroomPct } = report.cuProbe;
  const effectiveLimit = currentLimit ?? 1_400_000;
  const usagePct = effectiveLimit > 0 ? (consumed / effectiveLimit) * 100 : 0;

  let score: number;
  let reason: string;

  if (usagePct >= 95) {
    score = 95;
    reason = `Using ${usagePct.toFixed(0)}% of compute limit — almost certain to fail`;
  } else if (usagePct >= 85) {
    score = 75;
    reason = `Using ${usagePct.toFixed(0)}% of compute limit — high risk of CU overflow`;
  } else if (usagePct >= 70) {
    score = 40;
    reason = `Using ${usagePct.toFixed(0)}% of compute limit — moderate pressure`;
  } else if (consumed === 0) {
    score = 20;
    reason = "No compute units consumed — simulation may have failed early";
  } else {
    score = 10;
    reason = `Using ${usagePct.toFixed(0)}% of compute limit — healthy headroom (${headroomPct}% remaining)`;
  }

  return { name: "cu_pressure", score, weight: WEIGHTS.cu_pressure, available: true, reason };
}

function scoreSlippageRisk(simResult: SimResult): ScorerSignal {
  let score: number;
  let reason: string;

  if (simResult.category === "slippage") {
    score = 100;
    reason = "Slippage tolerance exceeded in simulation";
  } else if (simResult.risk === "fail") {
    score = 70;
    reason = "Transaction fails for non-slippage reason — still a risk signal";
  } else if (simResult.risk === "warning") {
    score = 35;
    reason = "Simulation returned warning — possible edge-case slippage";
  } else {
    score = 5;
    reason = "No slippage risk detected in simulation";
  }

  return { name: "slippage_risk", score, weight: WEIGHTS.slippage_risk, available: true, reason };
}

async function scoreNetworkCongestion(rpcUrl?: string): Promise<ScorerSignal> {
  try {
    const conn = new Connection(rpcUrl ?? DEFAULT_RPC, "confirmed");
    const samples = await conn.getRecentPerformanceSamples(10);

    if (samples.length === 0) throw new Error("no samples");

    const avgTps = samples.reduce((sum, s) => {
      return sum + s.numTransactions / Math.max(s.samplePeriodSecs, 1);
    }, 0) / samples.length;

    let score: number;
    let reason: string;

    if (avgTps > 3_000) {
      score = 80;
      reason = `Network congested — ~${Math.round(avgTps)} TPS (high)`;
    } else if (avgTps > 2_000) {
      score = 55;
      reason = `Moderate network activity — ~${Math.round(avgTps)} TPS`;
    } else {
      score = 20;
      reason = `Network healthy — ~${Math.round(avgTps)} TPS`;
    }

    return { name: "network_congestion", score, weight: WEIGHTS.network_congestion, available: true, reason };
  } catch {
    return {
      name: "network_congestion",
      score: 50,
      weight: WEIGHTS.network_congestion,
      available: false,
      reason: "Network congestion data unavailable — using neutral score",
    };
  }
}

function scoreBlockhashAge(report: MultiPassReport): ScorerSignal {
  if (report.isStaleBlockhash) {
    return {
      name: "blockhash_age",
      score: 90,
      weight: WEIGHTS.blockhash_age,
      available: true,
      reason: "Stale blockhash confirmed — baseline failed, optimistic simulation succeeded",
    };
  }

  const baselineCategory = report.baseline.analysis.category;
  if (baselineCategory === "stale_blockhash") {
    return {
      name: "blockhash_age",
      score: 80,
      weight: WEIGHTS.blockhash_age,
      available: true,
      reason: "Blockhash-related error detected in simulation logs",
    };
  }

  return {
    name: "blockhash_age",
    score: 10,
    weight: WEIGHTS.blockhash_age,
    available: true,
    reason: "Blockhash appears fresh — no staleness signal",
  };
}

function scoreAccountConflicts(simResult: SimResult): ScorerSignal {
  if (simResult.category === "account_not_found") {
    return {
      name: "account_conflicts",
      score: 85,
      weight: WEIGHTS.account_conflicts,
      available: true,
      reason: "Account not found or write conflict detected in simulation",
    };
  }

  const logHint = typeof simResult.raw === "object" &&
    simResult.raw !== null &&
    "value" in (simResult.raw as Record<string, unknown>);

  if (logHint && simResult.category === "program_error") {
    return {
      name: "account_conflicts",
      score: 40,
      weight: WEIGHTS.account_conflicts,
      available: true,
      reason: "Program error may involve account state conflict",
    };
  }

  return {
    name: "account_conflicts",
    score: 5,
    weight: WEIGHTS.account_conflicts,
    available: true,
    reason: "No account conflict signals detected",
  };
}

function scoreInstructionComplexity(report: MultiPassReport): ScorerSignal {
  const logCount = report.optimistic.logs.length;
  const invokeCount = report.optimistic.logs.filter((l) =>
    l.includes("invoke [1]")
  ).length;

  let score: number;
  let reason: string;

  if (invokeCount >= 7) {
    score = 60;
    reason = `${invokeCount} top-level program invocations — complex multi-hop route`;
  } else if (invokeCount >= 4) {
    score = 30;
    reason = `${invokeCount} program invocations — moderate complexity`;
  } else {
    score = 10;
    reason = `${invokeCount} program invocations — simple transaction`;
  }

  void logCount; // available for future tuning
  return { name: "instruction_complexity", score, weight: WEIGHTS.instruction_complexity, available: true, reason };
}

// Known system-level programs to skip when picking a "primary" program
const SKIP_PROGRAMS = new Set([
  "11111111111111111111111111111111",           // System
  "ComputeBudget111111111111111111111111111111", // ComputeBudget
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bSo", // ATA
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",  // Token-2022
  "SysvarC1ock11111111111111111111111111111111",
  "SysvarRent111111111111111111111111111111111",
]);

function failureScore(failRate: number): number {
  if (failRate >= 0.30) return 85;
  if (failRate >= 0.20) return 65;
  if (failRate >= 0.10) return 40;
  if (failRate >= 0.05) return 20;
  return 5;
}

async function scoreProgramErrorHistory(
  accountKeys: string[],
  rpcUrl?: string
): Promise<ScorerSignal> {
  // Pick the first non-system account key as the primary program proxy.
  // Program IDs are typically non-signers near the end of the account list,
  // but any account key not in the skip set is a reasonable proxy.
  const primaryProgram = accountKeys.find((k) => !SKIP_PROGRAMS.has(k));

  if (!primaryProgram) {
    return {
      name: "program_error_history",
      score: 50,
      weight: WEIGHTS.program_error_history,
      available: false,
      reason: "No known program found in account keys",
    };
  }

  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const conn = new Connection(rpcUrl ?? DEFAULT_RPC, { commitment: "confirmed" });
    const sigs = await conn.getSignaturesForAddress(new PublicKey(primaryProgram), { limit: 100 });

    if (sigs.length === 0) {
      return {
        name: "program_error_history",
        score: 10,
        weight: WEIGHTS.program_error_history,
        available: true,
        reason: `No recent transactions found for this program`,
      };
    }

    const failed = sigs.filter((s) => s.err !== null).length;
    const failRate = failed / sigs.length;
    const score = failureScore(failRate);

    return {
      name: "program_error_history",
      score,
      weight: WEIGHTS.program_error_history,
      available: true,
      reason: `${failed}/${sigs.length} recent txs failed (${Math.round(failRate * 100)}% error rate)`,
    };
  } catch {
    return {
      name: "program_error_history",
      score: 50,
      weight: WEIGHTS.program_error_history,
      available: false,
      reason: "Program error history unavailable — RPC lookup failed",
    };
  }
}

async function scoreWalletFailureRate(
  accountKeys: string[],
  rpcUrl?: string
): Promise<ScorerSignal> {
  // Account key [0] is always the fee payer in Solana
  const feePayer = accountKeys[0];

  if (!feePayer) {
    return {
      name: "wallet_failure_rate",
      score: 50,
      weight: WEIGHTS.wallet_failure_rate,
      available: false,
      reason: "Fee payer not found in account keys",
    };
  }

  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const conn = new Connection(rpcUrl ?? DEFAULT_RPC, { commitment: "confirmed" });
    const sigs = await conn.getSignaturesForAddress(new PublicKey(feePayer), { limit: 50 });

    if (sigs.length === 0) {
      return {
        name: "wallet_failure_rate",
        score: 5,
        weight: WEIGHTS.wallet_failure_rate,
        available: true,
        reason: "New wallet — no recent transaction history",
      };
    }

    const failed = sigs.filter((s) => s.err !== null).length;
    const failRate = failed / sigs.length;
    const score = failureScore(failRate);

    return {
      name: "wallet_failure_rate",
      score,
      weight: WEIGHTS.wallet_failure_rate,
      available: true,
      reason: `${failed}/${sigs.length} recent wallet txs failed (${Math.round(failRate * 100)}% error rate)`,
    };
  } catch {
    return {
      name: "wallet_failure_rate",
      score: 50,
      weight: WEIGHTS.wallet_failure_rate,
      available: false,
      reason: "Wallet failure rate unavailable — RPC lookup failed",
    };
  }
}

// ── Aggregator ────────────────────────────────────────────────────────────────

function aggregate(signals: ScorerSignal[]): RiskScore {
  // Only include available signals in the weighted sum;
  // unavailable stubs contribute their full weight at neutral (50) to keep
  // the denominator stable, but we report a lower confidence.
  let weightedSum = 0;
  let availableWeight = 0;
  let totalWeight = 0;

  for (const s of signals) {
    weightedSum += s.score * s.weight;
    totalWeight += s.weight;
    if (s.available) availableWeight += s.weight;
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
  const confidence = totalWeight > 0 ? parseFloat((availableWeight / totalWeight).toFixed(2)) : 0;

  let risk: RiskScore["risk"];
  let recommendation: Recommendation;

  if (score >= 70) {
    risk = "fail";
    recommendation = "DO_NOT_SEND";
  } else if (score >= 40) {
    risk = "warning";
    recommendation = "REVIEW";
  } else {
    risk = "safe";
    recommendation = "SEND";
  }

  return { score, risk, confidence, recommendation, signals };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ScoreOptions {
  rpcUrl?: string;
  /** Account keys from the transaction — enables live program/wallet signals */
  accountKeys?: string[];
}

export async function scoreRisk(
  report: MultiPassReport,
  simResult: SimResult,
  options?: ScoreOptions
): Promise<RiskScore> {
  const rpcUrl = options?.rpcUrl;
  const accountKeys = options?.accountKeys ?? [];

  // Run all async signals in parallel
  const [networkSignal, programSignal, walletSignal] = await Promise.all([
    scoreNetworkCongestion(rpcUrl),
    scoreProgramErrorHistory(accountKeys, rpcUrl),
    scoreWalletFailureRate(accountKeys, rpcUrl),
  ]);

  const signals: ScorerSignal[] = [
    scoreCuPressure(report),
    scoreSlippageRisk(simResult),
    networkSignal,
    scoreBlockhashAge(report),
    scoreAccountConflicts(simResult),
    scoreInstructionComplexity(report),
    programSignal,
    walletSignal,
  ];

  return aggregate(signals);
}

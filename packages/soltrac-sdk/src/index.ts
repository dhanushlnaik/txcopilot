export { analyzeSimulation, analyzeTransaction } from "./analyzer";
export type { SimulateTransactionResponse } from "./analyzer";
export { simulateTransaction, getTransaction, getRecentSignatures, isValidSignature } from "./solana";
export type {
  SimResult,
  ErrorCategory,
  FixParams,
  RiskLevel,
  AnalysisResult,
  NetworkStatus,
  WebhookSubscription,
  TransactionBreakdown,
  PreflightResult,
} from "./types";
export { buildJupiterLinkFromLogs, buildJupiterSwapUrl, extractTokensFromLogs, withJupiterLink } from "./tokenParser";
export type { TokenInfo, JupiterSwapParams } from "./tokenParser";
export { runMultiPass } from "./simulator";
export type { MultiPassReport, PassResult, CuProbeResult, FeeTier, SimPass } from "./simulator";
export { scoreRisk } from "./scorer";
export type { RiskScore, ScorerSignal, Recommendation } from "./scorer";
export { lookupError, entriesForProgram } from "./taxonomy";
export type { ErrorEntry, TaxonomyFix } from "./taxonomy";
export { fingerprint, lookupProtocol, extractAccountKeys } from "./fingerprint";
export type { FingerprintResult, ProtocolInfo, ProtocolCategory, ProtocolRisk } from "./fingerprint";
export { explain, explainFromSimulation } from "./explainer";
export type { Explanation, ExplanationFix, InstructionTraceEntry, ExplainTier, ExplainOptions } from "./explainer";

import { simulateTransaction } from "./solana";
import { analyzeSimulation } from "./analyzer";
import { runMultiPass } from "./simulator";
import { scoreRisk } from "./scorer";
import { lookupError } from "./taxonomy";
import { fingerprint, extractAccountKeys } from "./fingerprint";
import type { SimResult, PreflightResult } from "./types";
import type { Transaction, VersionedTransaction } from "@solana/web3.js";

// ── Internal helper: base64 string → VersionedTransaction ────────────────────

async function deserializeTx(tx: Transaction | VersionedTransaction | string) {
  if (typeof tx === "string") {
    const { VersionedTransaction: VT } = await import("@solana/web3.js");
    const bytes = Uint8Array.from(Buffer.from(tx, "base64"));
    return VT.deserialize(bytes);
  }
  return tx;
}

// ── simulateTx — fast single-pass (backward compat) ──────────────────────────

/**
 * Simulate a transaction and return a SimResult.
 * Accepts Transaction, VersionedTransaction, or a base64-encoded string.
 */
export async function simulateTx(
  tx: Transaction | VersionedTransaction | string,
  options?: { rpcUrl?: string; commitment?: string }
): Promise<SimResult> {
  const txObj = await deserializeTx(tx);
  const simResult = await simulateTransaction(txObj, options);
  return analyzeSimulation(simResult);
}

// ── preflight — full multi-pass + weighted risk scorer ────────────────────────

/**
 * Full pre-flight check: runs baseline + optimistic simulation passes,
 * probes compute units, fetches fee tiers, and scores 8 risk signals.
 *
 * Use this for the richest output. `simulateTx` remains available for
 * lightweight, single-pass use cases.
 */
export async function preflight(
  tx: Transaction | VersionedTransaction | string,
  options?: { rpcUrl?: string }
): Promise<PreflightResult> {
  const txObj = await deserializeTx(tx);

  // Fingerprint protocols from account keys
  const accountKeys = extractAccountKeys(txObj as Parameters<typeof extractAccountKeys>[0]);
  const protocols = fingerprint(accountKeys);

  // Run multi-pass simulation and fast analysis in parallel
  const [report, fastSim] = await Promise.all([
    runMultiPass(txObj, options),
    simulateTransaction(txObj, options).then(analyzeSimulation),
  ]);

  // Score using the richer multi-pass report
  const riskScore = await scoreRisk(report, fastSim, options);

  // Primary SimResult: stale blockhash gets its own category override
  const simResult: SimResult = report.isStaleBlockhash
    ? { ...fastSim, category: "stale_blockhash", risk: "warning" }
    : fastSim;

  // Taxonomy lookup — use optimistic pass error (real tx logic error, not blockhash)
  const rawErr = report.optimistic.err ?? report.baseline.err;
  const taxonomyMatch = lookupError(rawErr, accountKeys);

  return {
    riskScore,
    simResult,
    simulation: report,
    protocols,
    taxonomyMatch,
    // Convenience top-level accessors
    risk: riskScore.risk,
    recommendation: riskScore.recommendation,
    reason: taxonomyMatch?.summary ?? simResult.reason,
    fix: taxonomyMatch?.fixes[0]?.action ?? simResult.fix,
    fixParams: simResult.fixParams,
  };
}

// ── analyzeTx — post-mortem on a confirmed signature ─────────────────────────

/**
 * Fetch a confirmed transaction by signature and return a SimResult.
 */
export async function analyzeTx(
  signature: string,
  options?: { rpcUrl?: string }
): Promise<SimResult> {
  const { Connection } = await import("@solana/web3.js");
  const rpcUrl =
    options?.rpcUrl ||
    process.env.SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com";
  const connection = new Connection(rpcUrl, { commitment: "confirmed" });

  const rawTx = await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  if (!rawTx) {
    return {
      risk: "fail",
      category: "unknown",
      reason: "Transaction not found",
      fix: null,
      fixParams: null,
      confidence: 0,
      source: "heuristic",
      raw: null,
    };
  }

  const fakeSimResult = {
    context: { slot: rawTx.slot },
    value: {
      err: rawTx.meta?.err ?? null,
      logs: rawTx.meta?.logMessages ?? [],
      accounts: null,
      returnData: null,
      unitsConsumed: rawTx.meta?.computeUnitsConsumed ?? undefined,
      innerInstructions: null,
      replacementBlockhash: null,
    },
  };

  return analyzeSimulation(fakeSimResult as import("./analyzer").SimulateTransactionResponse);
}

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
} from "./types";

import { simulateTransaction } from "./solana";
import { analyzeSimulation } from "./analyzer";
import type { SimResult } from "./types";
import type { Transaction, VersionedTransaction } from "@solana/web3.js";

/**
 * High-level helper: simulate a transaction and return a SimResult.
 * Accepts a pre-built Transaction/VersionedTransaction or a base64-encoded string.
 */
export async function simulateTx(
  tx: Transaction | VersionedTransaction | string,
  options?: { rpcUrl?: string; commitment?: string }
): Promise<SimResult> {
  let txObj: Transaction | VersionedTransaction;

  if (typeof tx === "string") {
    // Decode base64 → Uint8Array → VersionedTransaction
    const { VersionedTransaction: VT } = await import("@solana/web3.js");
    const bytes = Uint8Array.from(Buffer.from(tx, "base64"));
    txObj = VT.deserialize(bytes);
  } else {
    txObj = tx;
  }

  const simResult = await simulateTransaction(txObj, options);
  return analyzeSimulation(simResult);
}

/**
 * High-level helper: fetch a confirmed transaction by signature and return a SimResult.
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

  // Wrap the on-chain result into a SimulateTransactionResponse shape
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

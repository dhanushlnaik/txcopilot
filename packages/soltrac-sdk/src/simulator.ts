import { Connection } from "@solana/web3.js";
import type { Transaction, VersionedTransaction } from "@solana/web3.js";
import { analyzeSimulation } from "./analyzer";
import type { SimResult } from "./types";

const DEFAULT_RPC =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

function makeConn(rpcUrl?: string) {
  return new Connection(rpcUrl ?? DEFAULT_RPC, { commitment: "confirmed" });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type SimPass = "baseline" | "optimistic" | "cu-probe" | "fee-sensitivity";

export interface PassResult {
  pass: SimPass;
  success: boolean;
  /** Raw RPC error value */
  err: unknown;
  logs: string[];
  unitsConsumed: number;
  /** Derived SimResult for this pass */
  analysis: SimResult;
}

export interface CuProbeResult {
  /** Units consumed in the baseline simulation */
  consumed: number;
  /** ComputeBudgetProgram limit set in the tx, null if not present */
  currentLimit: number | null;
  /** consumed × 1.15, rounded up to nearest 1 000 */
  recommended: number;
  /** Percentage of the current limit consumed (0–100) */
  headroomPct: number;
}

export interface FeeTier {
  label: "economy" | "standard" | "fast";
  priorityFeeMicroLamports: number;
  /** Estimated landing success rate based on network percentile */
  estimatedSuccessRatePct: number;
}

export interface MultiPassReport {
  /** Simulate as-is (replaceRecentBlockhash: false) */
  baseline: PassResult;
  /** Simulate with fresh blockhash (replaceRecentBlockhash: true) */
  optimistic: PassResult;
  /**
   * True when baseline fails but optimistic succeeds —
   * the ONLY problem is a stale blockhash, not the tx logic.
   */
  isStaleBlockhash: boolean;
  /** Compute unit analysis */
  cuProbe: CuProbeResult;
  /** Three priority-fee tiers from recent network data */
  feeTiers: FeeTier[];
}

export interface MultiPassOptions {
  rpcUrl?: string;
}

// ── ComputeBudget instruction parser ─────────────────────────────────────────

const COMPUTE_BUDGET_PROGRAM =
  "ComputeBudget111111111111111111111111111111";

/**
 * Attempt to extract the SetComputeUnitLimit value from a transaction's
 * instructions. Returns null when the tx doesn't set one.
 *
 * Instruction format:
 *   byte 0: discriminator (0x02 = SetComputeUnitLimit)
 *   bytes 1–4: uint32 LE limit
 */
function extractComputeUnitLimit(
  tx: Transaction | VersionedTransaction
): number | null {
  try {
    let instructions: Array<{ programId: { toBase58(): string }; data: Uint8Array | Buffer }> = [];

    if ("message" in tx && "staticAccountKeys" in tx.message) {
      // VersionedTransaction
      const msg = tx.message;
      const keys = msg.staticAccountKeys;
      instructions = msg.compiledInstructions.map((ix) => ({
        programId: keys[ix.programIdIndex],
        data: ix.data,
      }));
    } else if ("instructions" in tx) {
      // Legacy Transaction
      instructions = (tx as Transaction).instructions.map((ix) => ({
        programId: ix.programId,
        data: ix.data,
      }));
    }

    for (const ix of instructions) {
      if (ix.programId.toBase58() !== COMPUTE_BUDGET_PROGRAM) continue;
      const data = ix.data instanceof Uint8Array ? ix.data : new Uint8Array(ix.data);
      if (data[0] === 0x02 && data.length >= 5) {
        // uint32 LE at bytes 1–4
        const limit =
          data[1] |
          (data[2] << 8) |
          (data[3] << 16) |
          (data[4] << 24);
        return limit >>> 0; // unsigned
      }
    }
  } catch {
    // Parsing failure is non-fatal
  }
  return null;
}

// ── Core multi-pass runner ────────────────────────────────────────────────────

export async function runMultiPass(
  tx: Transaction | VersionedTransaction,
  options?: MultiPassOptions
): Promise<MultiPassReport> {
  const conn = makeConn(options?.rpcUrl);

  // Common sim options
  const commonOpts = { sigVerify: false, commitment: "confirmed" as const };

  // Run both passes concurrently
  const [baselineRaw, optimisticRaw] = await Promise.all([
    conn.simulateTransaction(tx as Parameters<Connection["simulateTransaction"]>[0], {
      ...commonOpts,
      replaceRecentBlockhash: false,
    }).catch((e) => ({ value: { err: e, logs: [], unitsConsumed: 0 }, context: { slot: 0 } })),
    conn.simulateTransaction(tx as Parameters<Connection["simulateTransaction"]>[0], {
      ...commonOpts,
      replaceRecentBlockhash: true,
    }).catch((e) => ({ value: { err: e, logs: [], unitsConsumed: 0 }, context: { slot: 0 } })),
  ]);

  const toPassResult = (
    pass: SimPass,
    raw: typeof baselineRaw
  ): PassResult => {
    const analysis = analyzeSimulation(raw);
    return {
      pass,
      success: raw.value.err === null,
      err: raw.value.err,
      logs: raw.value.logs ?? [],
      unitsConsumed: raw.value.unitsConsumed ?? 0,
      analysis,
    };
  };

  const baseline = toPassResult("baseline", baselineRaw);
  const optimistic = toPassResult("optimistic", optimisticRaw);

  // Stale blockhash: baseline fails, optimistic succeeds
  const isStaleBlockhash = !baseline.success && optimistic.success;

  // CU probe — use optimistic (fresh blockhash) consumed units as ground truth
  const consumed = optimistic.unitsConsumed || baseline.unitsConsumed;
  const currentLimit = extractComputeUnitLimit(tx);
  const DEFAULT_CU_LIMIT = 1_400_000;
  const effectiveLimit = currentLimit ?? DEFAULT_CU_LIMIT;
  const recommended = Math.ceil((consumed * 1.15) / 1000) * 1000;
  const headroomPct = effectiveLimit > 0
    ? Math.round(((effectiveLimit - consumed) / effectiveLimit) * 100)
    : 0;

  const cuProbe: CuProbeResult = { consumed, currentLimit, recommended, headroomPct };

  // Fee tiers from recent network data
  const feeTiers = await buildFeeTiers(conn);

  return { baseline, optimistic, isStaleBlockhash, cuProbe, feeTiers };
}

// ── Fee tier builder ──────────────────────────────────────────────────────────

async function buildFeeTiers(conn: Connection): Promise<FeeTier[]> {
  try {
    const fees = await conn.getRecentPrioritizationFees();
    const nonZero = fees.map((f) => f.prioritizationFee).filter((f) => f > 0).sort((a, b) => a - b);

    if (nonZero.length === 0) {
      return defaultFeeTiers();
    }

    const p25 = nonZero[Math.floor(nonZero.length * 0.25)] ?? 1_000;
    const p50 = nonZero[Math.floor(nonZero.length * 0.50)] ?? 5_000;
    const p75 = nonZero[Math.floor(nonZero.length * 0.75)] ?? 50_000;

    return [
      { label: "economy", priorityFeeMicroLamports: p25, estimatedSuccessRatePct: 60 },
      { label: "standard", priorityFeeMicroLamports: p50, estimatedSuccessRatePct: 80 },
      { label: "fast",     priorityFeeMicroLamports: p75, estimatedSuccessRatePct: 95 },
    ];
  } catch {
    return defaultFeeTiers();
  }
}

function defaultFeeTiers(): FeeTier[] {
  return [
    { label: "economy", priorityFeeMicroLamports: 1_000,  estimatedSuccessRatePct: 60 },
    { label: "standard", priorityFeeMicroLamports: 10_000, estimatedSuccessRatePct: 80 },
    { label: "fast",     priorityFeeMicroLamports: 50_000, estimatedSuccessRatePct: 95 },
  ];
}

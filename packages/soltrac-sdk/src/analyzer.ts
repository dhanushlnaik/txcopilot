import type { RpcResponseAndContext, SimulatedTransactionResponse } from "@solana/web3.js";
import type {
  AnalysisResult,
  ErrorCategory,
  FixParams,
  FixSuggestion,
  RiskLevel,
  RiskReason,
  SimResult,
  TransactionBreakdown,
} from "./types";
import { inferTransactionType } from "./inferType";
import { buildJupiterLinkFromLogs } from "./tokenParser";

// ===========================
// Simulation-first Transaction Analyzer
// ===========================

/** The full RPC response shape returned by connection.simulateTransaction() */
export type SimulateTransactionResponse = RpcResponseAndContext<SimulatedTransactionResponse>;

// ===========================
// LAYER 2 — Structured error maps (decimal codes, no hex ambiguity)
// ===========================

const TOP_LEVEL_ERROR_MAP: Record<
  string,
  { category: ErrorCategory; reason: string; fix: string }
> = {
  BlockhashNotFound: {
    category: "stale_blockhash",
    reason: "Blockhash expired — the transaction was not submitted within the validity window (~60 seconds)",
    fix: "Retry with a fresh blockhash",
  },
  AccountNotFound: {
    category: "account_not_found",
    reason: "A required account does not exist on-chain",
    fix: "Ensure the destination account exists, or include a create-account instruction",
  },
  InsufficientFunds: {
    category: "insufficient_funds",
    reason: "Insufficient funds to complete the transaction",
    fix: "Add more SOL to your wallet to cover fees and rent",
  },
};

/** Custom program error codes → category + human text. Keys are decimal ints. */
const CUSTOM_ERROR_MAP: Record<
  number,
  { category: ErrorCategory; reason: string; fix: string }
> = {
  // Jupiter v6
  6001: {
    category: "slippage",
    reason: "Jupiter: SlippageToleranceExceeded — price moved beyond your configured limit",
    fix: "Increase slippage tolerance to 3–5%, or retry when volatility is lower",
  },
  6021: {
    category: "insufficient_funds",
    reason: "Jupiter: InsufficientFundsForTransaction — SOL or token balance too low",
    fix: "Check both your token balance and SOL balance. SOL is needed for fees in all swaps",
  },
  6022: {
    category: "account_not_found",
    reason: "Jupiter: InvalidTokenAccount — account uninitialized or doesn't match expected",
    fix: "Ensure all Associated Token Accounts exist before retrying the swap",
  },
  // Orca Whirlpool
  6008: {
    category: "slippage",
    reason: "Orca: TokenMinSubceeded — output amount is below your minimum (slippage limit hit)",
    fix: "Increase slippage tolerance or wait for better liquidity",
  },
  6011: {
    category: "account_not_found",
    reason: "Orca: ZeroLiquidity — pool has no liquidity in the current price range",
    fix: "Try a different pool or wait for liquidity providers to add funds",
  },
  6012: {
    category: "slippage",
    reason: "Orca: TokenMaxExceeded — input amount exceeds your maximum (slippage limit hit)",
    fix: "Increase slippage tolerance or reduce the swap amount",
  },
  6016: {
    category: "program_error",
    reason: "Orca: InvalidTickArray — tick array sequence is invalid for current price range",
    fix: "Refresh the swap quote and retry — the pool price may have moved",
  },
  // Raydium
  1790: {
    category: "slippage",
    reason: "Raydium: AmountTooSmall — output too small due to low liquidity or unfavorable rate",
    fix: "Try a larger input amount or a different liquidity pool",
  },
  // Pump.fun
  1814: {
    category: "program_error",
    reason: "Pump.fun: PDA seeds don't match the mint address being used",
    fix: "Verify the bonding curve PDA is derived from the correct mint address",
  },
  // Anchor
  3007: {
    category: "program_error",
    reason: "Anchor: Account discriminator mismatch — account belongs to a different program",
    fix: "Verify you're interacting with the correct program and account",
  },
  3008: {
    category: "program_error",
    reason: "Anchor: Account not initialized",
    fix: "Initialize the account before using it in this transaction",
  },
};

/** InstructionError string type → category */
const INSTRUCTION_ERROR_STR_MAP: Record<
  string,
  { category: ErrorCategory; reason: string; fix: string; confidence: number }
> = {
  InsufficientFunds: {
    category: "insufficient_funds",
    reason: "Account balance is too low to cover this transaction",
    fix: "Add more SOL to your wallet",
    confidence: 1.0,
  },
  InvalidAccountData: {
    category: "program_error",
    reason: "Account data does not match expected program type — account may belong to a different program",
    fix: "Verify you're interacting with the correct program and account",
    confidence: 0.9,
  },
  AccountNotFound: {
    category: "account_not_found",
    reason: "A required account does not exist on-chain",
    fix: "Ensure the destination account exists before sending",
    confidence: 1.0,
  },
  ComputationalBudgetExceeded: {
    category: "compute_exceeded",
    reason: "Transaction ran out of compute units before completing",
    fix: "Add a ComputeBudgetProgram.setComputeUnitLimit instruction with a higher CU limit",
    confidence: 1.0,
  },
};

// ===========================
// LAYER 3 — Log pattern fallback (only used when layers 1+2 produce no category)
// ===========================

/**
 * Log-pattern scanners. Used as a last resort — always yields confidence 0.5.
 * Order matters: first match wins.
 */
const INSTRUCTION_ERROR_PATTERNS: Array<{
  pattern: RegExp;
  label: string;
  description: string;
  fix: string;
}> = [
  {
    pattern: /insufficient funds/i,
    label: "Insufficient Funds",
    description: "The account balance is too low to cover this transaction.",
    fix: "Add more SOL to your wallet.",
  },
  {
    pattern: /account not found/i,
    label: "Account Not Found",
    description: "A required account doesn't exist on-chain. It may have been closed or never created.",
    fix: "Ensure the destination account exists, or include a create-account instruction.",
  },
  {
    pattern: /blockhash not found/i,
    label: "Expired Blockhash",
    description: "The transaction's blockhash expired before it was processed. Blockhashes are valid for about 60 seconds.",
    fix: "Retry the transaction with a fresh blockhash.",
  },
  {
    pattern: /already processed/i,
    label: "Duplicate Transaction",
    description: "This exact transaction was already processed.",
    fix: "No action needed — the original transaction was successful.",
  },
  {
    pattern: /Program failed to complete/i,
    label: "Program Execution Failed",
    description: "The on-chain program ran out of compute units or encountered an internal error.",
    fix: "Increase the compute budget or simplify the transaction.",
  },
  {
    pattern: /owner does not match/i,
    label: "Account Owner Mismatch",
    description: "An account is owned by a different program than expected.",
    fix: "Verify you're interacting with the correct program and accounts.",
  },
  {
    pattern: /exceeded CUs meter/i,
    label: "Compute Units Exceeded",
    description: "The transaction ran out of compute units before completing.",
    fix: "Add a ComputeBudget instruction requesting more CUs (e.g., 400,000 or higher).",
  },
  {
    pattern: /Swap failed/i,
    label: "Swap Failed",
    description: "The DEX swap instruction failed. This can be caused by stale quotes, price movement, or pool state changes.",
    fix: "Refresh the swap quote and retry with higher slippage tolerance.",
  },
  {
    pattern: /exceeds desired slippage limit/i,
    label: "Slippage Limit Hit",
    description: "The actual execution price exceeded your configured slippage limit.",
    fix: "Increase slippage to 3–5% for volatile tokens or retry during calmer markets.",
  },
  {
    pattern: /insufficient lamports/i,
    label: "Insufficient SOL (Lamports)",
    description: "Not enough lamports (SOL) to cover rent-exempt minimums for new accounts or transaction fees.",
    fix: "Add at least 0.01 SOL to your wallet. New token accounts require ~0.002 SOL rent.",
  },
  {
    pattern: /account already in use/i,
    label: "Account Already In Use",
    description: "The account you're trying to create or initialize already exists on-chain.",
    fix: "Use the existing account or use CreateIdempotent to avoid this error.",
  },
  {
    pattern: /Token(?:2022|zQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb).*failed/i,
    label: "Token-2022 Error",
    description: "A Token-2022 (token extensions) instruction failed. The program may not support this token type.",
    fix: "Ensure the DEX and all instructions support Token-2022 tokens.",
  },
  {
    pattern: /privilege escalation/i,
    label: "Privilege Escalation",
    description: "A program tried to perform an action it doesn't have permission for.",
    fix: "Check that the transaction is signed by the correct wallet and all required signers are present.",
  },
  {
    pattern: /immutable.*(failed|error|violat)/i,
    label: "Immutable Account Violation",
    description: "Attempted to modify an immutable account or account owner.",
    fix: "This account cannot be changed. Verify you're using the correct target account.",
  },
  {
    pattern: /bonding.?curve/i,
    label: "Bonding Curve Interaction",
    description: "This transaction interacts with a bonding curve (e.g., Pump.fun). The token may not have graduated to a DEX yet.",
    fix: "Check if the token has migrated to Raydium. If still on the curve, verify the bonding curve PDA and parameters.",
  },
  {
    pattern: /not rent exempt/i,
    label: "Account Not Rent Exempt",
    description: "An account doesn't have enough SOL to be rent-exempt.",
    fix: "Fund the account with at least 0.00203 SOL for standard token accounts.",
  },
];

/** Maps log-pattern labels → ErrorCategory for layer 3 */
const LOG_LABEL_TO_CATEGORY: Record<string, ErrorCategory> = {
  "Insufficient Funds": "insufficient_funds",
  "Account Not Found": "account_not_found",
  "Expired Blockhash": "stale_blockhash",
  "Duplicate Transaction": "unknown",
  "Program Execution Failed": "compute_exceeded",
  "Account Owner Mismatch": "program_error",
  "Compute Units Exceeded": "compute_exceeded",
  "Swap Failed": "program_error",
  "Slippage Limit Hit": "slippage",
  "Insufficient SOL (Lamports)": "insufficient_funds",
  "Account Already In Use": "program_error",
  "Token-2022 Error": "program_error",
  "Privilege Escalation": "program_error",
  "Immutable Account Violation": "program_error",
  "Bonding Curve Interaction": "program_error",
  "Account Not Rent Exempt": "insufficient_funds",
};

// ===========================
// Main export: analyzeSimulation
// ===========================

/**
 * Analyze the result of a simulateTransaction call.
 *
 * Three-layer cascade:
 *   Layer 1 — err === null: success, check compute ratio for warnings (confidence 1.0)
 *   Layer 2 — structured err parsing: top-level strings, Custom codes, string InstructionError types
 *   Layer 2b — compute ratio check when no category identified after layer 2
 *   Layer 3 — log pattern scan: last resort (confidence 0.5, source: 'logs')
 */
export function analyzeSimulation(
  simResult: SimulateTransactionResponse,
  options?: { computeBudget?: number }
): SimResult {
  const logs = simResult.value.logs ?? [];
  const err = simResult.value.err;
  const unitsConsumed = simResult.value.unitsConsumed ?? 0;
  const budget = options?.computeBudget ?? 200_000;
  const ratio = budget > 0 ? unitsConsumed / budget : 0;

  // === LAYER 1: No error — success path ===
  if (err === null) {
    if (ratio > 0.95) {
      return buildComputeResult(simResult, unitsConsumed, budget, ratio, "warning", 1.0);
    }
    if (ratio > 0.85) {
      // Nearing limit — warn but don't assign compute_exceeded category yet
      return {
        risk: "warning",
        category: null,
        reason: `Using ${Math.round(ratio * 100)}% of compute budget (${unitsConsumed}/${budget} CUs) — nearing limit`,
        fix: `Consider requesting at least ${Math.ceil(unitsConsumed * 1.3)} CUs via ComputeBudgetProgram.setComputeUnitLimit`,
        fixParams: { type: "priority_fee", priorityFeeMicroLamports: 50_000 },
        confidence: 0.9,
        source: "simulation",
        raw: simResult,
      };
    }
    return {
      risk: "safe",
      category: null,
      reason: "Transaction simulation succeeded with no errors",
      fix: null,
      fixParams: null,
      confidence: 1.0,
      source: "simulation",
      raw: simResult,
    };
  }

  // === LAYER 2: Parse structured error ===

  // Step 3 — top-level string errors (e.g., "BlockhashNotFound")
  if (typeof err === "string") {
    const mapped = TOP_LEVEL_ERROR_MAP[err];
    if (mapped) {
      return {
        risk: "fail",
        category: mapped.category,
        reason: mapped.reason,
        fix: mapped.fix,
        fixParams: buildFixParams(mapped.category, logs),
        confidence: 1.0,
        source: "simulation",
        raw: simResult,
      };
    }
    return {
      risk: "fail",
      category: "unknown",
      reason: `Transaction failed with error: ${err}`,
      fix: null,
      fixParams: null,
      confidence: 0.6,
      source: "simulation",
      raw: simResult,
    };
  }

  // Step 4 — InstructionError with Custom code
  // Runtime shape: { InstructionError: [instructionIndex, { Custom: number } | string] }
  const instrErr = (err as Record<string, unknown>).InstructionError as
    | [number, unknown]
    | undefined;

  if (Array.isArray(instrErr)) {
    const errDetail = instrErr[1];

    if (typeof errDetail === "object" && errDetail !== null && "Custom" in errDetail) {
      const customCode = (errDetail as { Custom?: number }).Custom;
      if (customCode !== undefined) {
        const known = CUSTOM_ERROR_MAP[customCode];
        if (known) {
          return {
            risk: "fail",
            category: known.category,
            reason: known.reason,
            fix: known.fix,
            fixParams: buildFixParams(known.category, logs),
            confidence: 1.0,
            source: "simulation",
            raw: simResult,
          };
        }
        return {
          risk: "fail",
          category: "program_error",
          reason: `Program returned custom error code ${customCode}`,
          fix: `Check the program documentation for error code ${customCode}`,
          fixParams: null,
          confidence: 0.7,
          source: "simulation",
          raw: simResult,
        };
      }
    }

    // Step 5 — InstructionError with string type (e.g., "InsufficientFunds")
    if (typeof errDetail === "string") {
      const known = INSTRUCTION_ERROR_STR_MAP[errDetail];
      if (known) {
        return {
          risk: "fail",
          category: known.category,
          reason: known.reason,
          fix: known.fix,
          fixParams: buildFixParams(known.category, logs),
          confidence: known.confidence,
          source: "simulation",
          raw: simResult,
        };
      }
      return {
        risk: "fail",
        category: "unknown",
        reason: `Instruction error: ${errDetail}`,
        fix: null,
        fixParams: null,
        confidence: 0.6,
        source: "simulation",
        raw: simResult,
      };
    }
  }

  // === LAYER 2b: Compute check when no category was identified above ===
  if (ratio > 0.95) {
    return buildComputeResult(simResult, unitsConsumed, budget, ratio, "fail", 1.0);
  }

  // === LAYER 3: Log pattern fallback — first match wins, confidence 0.5 ===
  for (const logLine of logs) {
    for (const pattern of INSTRUCTION_ERROR_PATTERNS) {
      if (pattern.pattern.test(logLine)) {
        const category: ErrorCategory = LOG_LABEL_TO_CATEGORY[pattern.label] ?? "unknown";
        return {
          risk: "fail",
          category,
          reason: pattern.description,
          fix: pattern.fix,
          fixParams: buildFixParams(category, logs),
          confidence: 0.5,
          source: "logs",
          raw: simResult,
        };
      }
    }
  }

  // === Unknown fallback ===
  return {
    risk: "fail",
    category: "unknown",
    reason: `Transaction failed: ${JSON.stringify(err)}`,
    fix: null,
    fixParams: null,
    confidence: 0.3,
    source: "heuristic",
    raw: simResult,
  };
}

// ===========================
// Helpers
// ===========================

function buildFixParams(category: ErrorCategory, logs: string[]): FixParams | null {
  switch (category) {
    case "slippage": {
      // Try to build a token-aware deep link from logs
      const jupiterLink = buildJupiterLinkFromLogs(logs, { slippageBps: 150 });
      return {
        type: "slippage",
        slippageBps: 150,
        // Fallback to generic link if token extraction fails
        deepLinkUrl: jupiterLink || "https://jup.ag/swap/SOL-USDC?slippage=1.5",
      };
    }
    case "compute_exceeded":
      return { type: "priority_fee", priorityFeeMicroLamports: 50_000 };
    case "stale_blockhash":
      return { type: "retry" };
    default:
      return null;
  }
}

function buildComputeResult(
  simResult: SimulateTransactionResponse,
  unitsConsumed: number,
  budget: number,
  ratio: number,
  risk: "warning" | "fail",
  confidence: number
): SimResult {
  return {
    risk,
    category: "compute_exceeded",
    reason: `Used ${Math.round(ratio * 100)}% of compute budget (${unitsConsumed}/${budget} CUs)`,
    fix: `Add a ComputeBudgetProgram.setComputeUnitLimit instruction with at least ${Math.ceil(unitsConsumed * 1.3)} CUs`,
    fixParams: { type: "priority_fee", priorityFeeMicroLamports: 50_000 },
    confidence,
    source: "simulation",
    raw: simResult,
  };
}

function categoryLabel(category: ErrorCategory | null): string {
  if (!category) return "Transaction Successful";
  const labels: Record<ErrorCategory, string> = {
    slippage: "Slippage Exceeded",
    compute_exceeded: "Compute Budget Exceeded",
    insufficient_funds: "Insufficient Funds",
    account_not_found: "Account Not Found",
    stale_blockhash: "Stale Blockhash",
    program_error: "Program Error",
    mev_suspected: "MEV Suspected",
    unknown: "Unknown Error",
  };
  return labels[category];
}

// ===========================
// Backward-compat wrapper — keeps existing API routes working
// ===========================

/**
 * Thin wrapper around analyzeSimulation that accepts the old raw-tx shape
 * and returns the AnalysisResult the existing routes and UI expect.
 *
 * Both /api/analyze (real tx from getTransactionDetails) and /api/simulate
 * (custom-shaped result from simulateRawTransaction) share the same
 * meta.err / meta.logMessages / meta.computeUnitsConsumed structure,
 * so a single adapter covers both call sites.
 */
export function analyzeTransaction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawTx: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enhancedTx: any | null,
  signature: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _networkStatus?: any
): AnalysisResult {
  const breakdown = parseBreakdown(rawTx, enhancedTx, signature);

  if (!rawTx) {
    return {
      risk: "HIGH",
      confidence: 90,
      reasons: [
        {
          label: "Transaction Not Found",
          description:
            "This transaction was not found on-chain. It may have been dropped by validators, expired, or never submitted.",
          severity: "HIGH",
        },
      ],
      fixes: [
        {
          action: "Retry Transaction",
          description:
            "Submit the transaction again with a fresh blockhash and adequate priority fee.",
          priority: "critical",
        },
      ],
      breakdown,
    };
  }

  // Adapt old rawTx meta shape → SimulateTransactionResponse
  const fakeSimResult: SimulateTransactionResponse = {
    context: { slot: rawTx.slot ?? 0 },
    value: {
      err: rawTx.meta?.err ?? null,
      logs: rawTx.meta?.logMessages ?? [],
      accounts: null,
      unitsConsumed: rawTx.meta?.computeUnitsConsumed ?? 0,
      returnData: null,
    },
  };

  const simResult = analyzeSimulation(fakeSimResult);

  const riskMap = { safe: "LOW", warning: "MEDIUM", fail: "HIGH" } as const;
  const risk: RiskLevel = riskMap[simResult.risk];
  const confidence = Math.round(simResult.confidence * 100);

  const reasons: RiskReason[] = [
    {
      label: categoryLabel(simResult.category),
      description: simResult.reason,
      severity: risk,
      code: simResult.category ?? undefined,
    },
  ];

  const fixes: FixSuggestion[] = simResult.fix
    ? [
        {
          action: categoryLabel(simResult.category),
          description: simResult.fix,
          priority:
            risk === "HIGH" ? "critical" : risk === "MEDIUM" ? "recommended" : "optional",
        },
      ]
    : [];

  return { risk, confidence, reasons, fixes, breakdown };
}

// ===========================
// parseBreakdown — private helper for the wrapper
// ===========================

function parseBreakdown(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawTx: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enhancedTx: any | null,
  signature: string
): TransactionBreakdown {
  if (!rawTx) {
    return {
      signature,
      type: "UNKNOWN",
      status: "dropped",
      fee: 0,
      signers: [],
      instructionCount: 0,
      logs: [],
    };
  }

  let status: "confirmed" | "failed" | "dropped" | "unknown" = "unknown";
  if (rawTx.meta?.err) {
    status = "failed";
  } else if (rawTx.slot) {
    status = "confirmed";
  }

  const fee = (rawTx.meta?.fee ?? 0) / 1e9;

  const signers: string[] = [];
  const message = rawTx.transaction?.message;
  if (message) {
    const accountKeys = message.accountKeys ?? message.staticAccountKeys ?? [];
    const numSigners = message.header?.numRequiredSignatures ?? 1;
    for (let i = 0; i < Math.min(numSigners, accountKeys.length); i++) {
      const key = accountKeys[i];
      signers.push(typeof key === "string" ? key : (key.toBase58?.() ?? String(key)));
    }
  }

  const instructions = message?.instructions ?? [];
  const innerInstructions = rawTx.meta?.innerInstructions ?? [];
  const totalInstructions =
    instructions.length +
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    innerInstructions.reduce((sum: number, inner: any) => sum + (inner.instructions?.length ?? 0), 0);

  const type = enhancedTx?.type ?? inferTransactionType(rawTx);
  const blockTime = rawTx.blockTime
    ? new Date(rawTx.blockTime * 1000).toISOString()
    : undefined;

  return {
    signature,
    type,
    status,
    fee,
    slot: rawTx.slot,
    blockTime,
    signers,
    instructionCount: totalInstructions,
    logs: rawTx.meta?.logMessages ?? [],
  };
}

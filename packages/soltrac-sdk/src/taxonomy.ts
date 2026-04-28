import type { ErrorCategory } from "./types";

// ── Core types ────────────────────────────────────────────────────────────────

export interface TaxonomyFix {
  priority: number;
  action: string;
  /** Copy-paste code snippet */
  codeHint?: string;
  /** Estimated lift in success probability after applying this fix (0–1) */
  estimatedSuccessLift?: number;
}

export interface ErrorEntry {
  /** String name (native) or decimal custom code */
  code: string | number;
  /** Program ID this error belongs to — undefined for native Solana errors */
  programId?: string;
  /** Human-readable program name */
  programName?: string;
  /** Machine-readable error name */
  name: string;
  /** One sentence, plain English */
  summary: string;
  /** Ordered by likelihood */
  causes: string[];
  /** Ordered by impact */
  fixes: TaxonomyFix[];
  severity: "fatal" | "recoverable" | "transient";
  retryable: boolean;
  /** Maps to existing SimResult category */
  category: ErrorCategory;
}

// ── Layer 1 — Native Solana runtime errors ───────────────────────────────────

const NATIVE_ERRORS: ErrorEntry[] = [
  {
    code: "InsufficientFundsForFee",
    name: "InsufficientFundsForFee",
    summary: "Wallet does not have enough SOL to cover the transaction fee.",
    causes: ["Account balance too low", "Priority fee raised total cost above balance"],
    fixes: [
      { priority: 1, action: "Top up wallet with at least 0.001 SOL for base fee", estimatedSuccessLift: 1.0 },
      { priority: 2, action: "Reduce priority fee if manually set", codeHint: "computeUnitPrice: 0" },
    ],
    severity: "fatal",
    retryable: false,
    category: "insufficient_funds",
  },
  {
    code: "BlockhashNotFound",
    name: "BlockhashNotFound",
    summary: "Transaction blockhash expired before it landed on-chain.",
    causes: ["Transaction waited too long in mempool", "Network congestion caused delays", "Blockhash was >150 slots old"],
    fixes: [
      { priority: 1, action: "Re-fetch blockhash and re-sign transaction", codeHint: "connection.getLatestBlockhash()", estimatedSuccessLift: 0.95 },
      { priority: 2, action: "Add priority fee to land faster", codeHint: "computeUnitPrice: 50000", estimatedSuccessLift: 0.6 },
      { priority: 3, action: "Use durable nonce for long-lived transactions", codeHint: "NonceAccount.fromAccountData()" },
    ],
    severity: "transient",
    retryable: true,
    category: "stale_blockhash",
  },
  {
    code: "AccountNotFound",
    name: "AccountNotFound",
    summary: "A required account does not exist on-chain.",
    causes: ["Associated token account not created yet", "Account was closed", "Wrong public key passed"],
    fixes: [
      { priority: 1, action: "Create the associated token account first", codeHint: "createAssociatedTokenAccountInstruction()", estimatedSuccessLift: 0.9 },
      { priority: 2, action: "Verify account addresses are correct" },
    ],
    severity: "recoverable",
    retryable: false,
    category: "account_not_found",
  },
  {
    code: "InvalidAccountOwner",
    name: "InvalidAccountOwner",
    summary: "An account is owned by a different program than expected.",
    causes: ["Wrong account passed for the instruction", "Account was re-initialized by a different program"],
    fixes: [
      { priority: 1, action: "Verify all account addresses match the expected program" },
      { priority: 2, action: "Check that associated token accounts are for the correct mint" },
    ],
    severity: "fatal",
    retryable: false,
    category: "program_error",
  },
  {
    code: "AccountAlreadyInitialized",
    name: "AccountAlreadyInitialized",
    summary: "Attempting to initialize an account that already exists.",
    causes: ["Duplicate initialization instruction", "Account was previously created"],
    fixes: [
      { priority: 1, action: "Skip initialization — account already exists", estimatedSuccessLift: 1.0 },
      { priority: 2, action: "Check if account exists before calling init", codeHint: "connection.getAccountInfo(pubkey)" },
    ],
    severity: "recoverable",
    retryable: false,
    category: "program_error",
  },
  {
    code: "InvalidInstructionData",
    name: "InvalidInstructionData",
    summary: "Instruction data is malformed or cannot be deserialized.",
    causes: ["SDK version mismatch with on-chain program", "Manual instruction encoding error", "Wrong discriminator"],
    fixes: [
      { priority: 1, action: "Update SDK to match the on-chain program version" },
      { priority: 2, action: "Verify instruction data encoding" },
    ],
    severity: "fatal",
    retryable: false,
    category: "program_error",
  },
  {
    code: "ComputationalBudgetExceeded",
    name: "ComputationalBudgetExceeded",
    summary: "Transaction consumed more compute units than its limit.",
    causes: ["CU limit set too low", "Transaction is more complex than expected", "Program regression increased CU usage"],
    fixes: [
      { priority: 1, action: "Increase compute unit limit", codeHint: "ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 })", estimatedSuccessLift: 0.9 },
      { priority: 2, action: "Add priority fee so the transaction lands before network gets congested", codeHint: "ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })" },
    ],
    severity: "recoverable",
    retryable: true,
    category: "compute_exceeded",
  },
  {
    code: "MissingRequiredSignature",
    name: "MissingRequiredSignature",
    summary: "Transaction is missing a required signer signature.",
    causes: ["Wallet did not sign", "Multi-sig threshold not met", "Signer list mismatch"],
    fixes: [
      { priority: 1, action: "Ensure all required wallets have signed the transaction" },
      { priority: 2, action: "Verify the signers array in the transaction message" },
    ],
    severity: "fatal",
    retryable: false,
    category: "program_error",
  },
  {
    code: "CallDepthExceeded",
    name: "CallDepthExceeded",
    summary: "Cross-program invocation depth exceeded the Solana limit (4).",
    causes: ["Too many nested CPI calls", "Recursive CPI pattern", "Aggregator routing through too many protocols"],
    fixes: [
      { priority: 1, action: "Reduce the number of nested CPI calls" },
      { priority: 2, action: "Split the transaction into multiple transactions" },
    ],
    severity: "fatal",
    retryable: false,
    category: "program_error",
  },
  {
    code: "ProgramFailedToComplete",
    name: "ProgramFailedToComplete",
    summary: "The program panicked or ran out of compute budget mid-execution.",
    causes: ["Arithmetic overflow/underflow", "Unexpected state in account data", "CU exhausted mid-instruction"],
    fixes: [
      { priority: 1, action: "Increase compute unit limit significantly", codeHint: "ComputeBudgetProgram.setComputeUnitLimit({ units: 1400000 })" },
      { priority: 2, action: "Check program logs for the specific panic message" },
    ],
    severity: "fatal",
    retryable: false,
    category: "program_error",
  },
  {
    code: "InvalidRentPayingAccount",
    name: "InvalidRentPayingAccount",
    summary: "Account does not have enough SOL to be rent-exempt.",
    causes: ["New account creation without enough lamports for rent", "Account balance too low after fee deduction"],
    fixes: [
      { priority: 1, action: "Fund the new account with at least the rent-exempt minimum", codeHint: "connection.getMinimumBalanceForRentExemption(dataSize)" },
    ],
    severity: "recoverable",
    retryable: false,
    category: "insufficient_funds",
  },
];

// ── Layer 2 — SPL Token Program errors ───────────────────────────────────────

const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SPL_TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const TOKEN_ERRORS: ErrorEntry[] = [
  {
    code: 0,
    programId: SPL_TOKEN_PROGRAM_ID,
    programName: "SPL Token",
    name: "NotRentExempt",
    summary: "Token account does not have enough SOL to be rent-exempt.",
    causes: ["Account created with insufficient lamports"],
    fixes: [
      { priority: 1, action: "Fund token account with rent-exempt minimum", codeHint: "connection.getMinimumBalanceForRentExemption(165)", estimatedSuccessLift: 1.0 },
    ],
    severity: "recoverable",
    retryable: false,
    category: "insufficient_funds",
  },
  {
    code: 1,
    programId: SPL_TOKEN_PROGRAM_ID,
    programName: "SPL Token",
    name: "InsufficientFunds",
    summary: "Token account balance is too low for this transfer.",
    causes: ["Sending more tokens than the account holds", "Fee deducted from token account", "Stale balance from cached quote"],
    fixes: [
      { priority: 1, action: "Reduce transfer amount to match available balance", estimatedSuccessLift: 1.0 },
      { priority: 2, action: "Re-fetch token account balance before constructing the transaction", codeHint: "connection.getTokenAccountBalance(pubkey)" },
    ],
    severity: "fatal",
    retryable: false,
    category: "insufficient_funds",
  },
  {
    code: 2,
    programId: SPL_TOKEN_PROGRAM_ID,
    programName: "SPL Token",
    name: "InvalidMint",
    summary: "The mint account is invalid or does not match the token account.",
    causes: ["Wrong mint address passed", "Token account belongs to a different mint"],
    fixes: [
      { priority: 1, action: "Verify the mint address matches the token account's mint" },
    ],
    severity: "fatal",
    retryable: false,
    category: "program_error",
  },
  {
    code: 3,
    programId: SPL_TOKEN_PROGRAM_ID,
    programName: "SPL Token",
    name: "MintMismatch",
    summary: "Source and destination token accounts have different mints.",
    causes: ["Trying to transfer between accounts of different token types"],
    fixes: [
      { priority: 1, action: "Ensure source and destination accounts are for the same token mint" },
    ],
    severity: "fatal",
    retryable: false,
    category: "program_error",
  },
  {
    code: 4,
    programId: SPL_TOKEN_PROGRAM_ID,
    programName: "SPL Token",
    name: "OwnerMismatch",
    summary: "Token account is not owned by the expected wallet.",
    causes: ["Wrong account passed", "Delegated authority not set", "Multi-sig owner mismatch"],
    fixes: [
      { priority: 1, action: "Verify the wallet owns the token account", codeHint: "getAssociatedTokenAddress(mint, owner)" },
      { priority: 2, action: "If using delegate, ensure approve instruction was included" },
    ],
    severity: "fatal",
    retryable: false,
    category: "program_error",
  },
  {
    code: 9,
    programId: SPL_TOKEN_PROGRAM_ID,
    programName: "SPL Token",
    name: "UninitializedState",
    summary: "Token account has not been initialized.",
    causes: ["Associated token account not created", "Account data is empty"],
    fixes: [
      { priority: 1, action: "Create the associated token account first", codeHint: "createAssociatedTokenAccountInstruction(payer, ata, owner, mint)", estimatedSuccessLift: 1.0 },
    ],
    severity: "recoverable",
    retryable: false,
    category: "account_not_found",
  },
  {
    code: 17,
    programId: SPL_TOKEN_PROGRAM_ID,
    programName: "SPL Token",
    name: "AccountFrozen",
    summary: "Token account is frozen and cannot send or receive.",
    causes: ["Freeze authority froze the account", "Compliance action by token issuer"],
    fixes: [
      { priority: 1, action: "Contact token issuer to unfreeze account" },
    ],
    severity: "fatal",
    retryable: false,
    category: "program_error",
  },
];

// ── Layer 3 — Protocol-specific errors ───────────────────────────────────────

const JUPITER_V6_PROGRAM_ID = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM_AMM_V4_ID = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const RAYDIUM_CLMM_ID = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
const ORCA_WHIRLPOOL_ID = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
const PUMP_FUN_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const MARINADE_ID = "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD";

const PROTOCOL_ERRORS: ErrorEntry[] = [
  // ── Jupiter v6 ───────────────────────────────────────────────────────────
  {
    code: 6001,
    programId: JUPITER_V6_PROGRAM_ID,
    programName: "Jupiter Aggregator v6",
    name: "SlippageToleranceExceeded",
    summary: "Pool price moved beyond your slippage tolerance during Jupiter routing.",
    causes: [
      "High volatility between quote and execution",
      "Route has multiple hops — price impact compounds",
      "Large order relative to pool liquidity",
      "MEV bot front-ran the transaction",
    ],
    fixes: [
      { priority: 1, action: "Increase slippage to 1.5%", codeHint: "slippageBps: 150", estimatedSuccessLift: 0.75 },
      { priority: 2, action: "Add priority fee to land before price moves", codeHint: "ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })", estimatedSuccessLift: 0.5 },
      { priority: 3, action: "Re-quote immediately before sending", estimatedSuccessLift: 0.4 },
      { priority: 4, action: "Split large swaps into smaller chunks to reduce price impact" },
    ],
    severity: "recoverable",
    retryable: true,
    category: "slippage",
  },
  {
    code: 6002,
    programId: JUPITER_V6_PROGRAM_ID,
    programName: "Jupiter Aggregator v6",
    name: "InvalidCalculation",
    summary: "Jupiter route calculation produced an invalid result.",
    causes: ["Stale route plan", "Pool state changed between quote and execution"],
    fixes: [
      { priority: 1, action: "Re-fetch the Jupiter quote and rebuild the transaction", estimatedSuccessLift: 0.9 },
    ],
    severity: "transient",
    retryable: true,
    category: "program_error",
  },
  {
    code: 6010,
    programId: JUPITER_V6_PROGRAM_ID,
    programName: "Jupiter Aggregator v6",
    name: "InvalidRoutePlan",
    summary: "The Jupiter route plan is invalid — pool accounts may have changed.",
    causes: ["Route plan computed from a stale quote", "Pool upgrade or migration mid-route"],
    fixes: [
      { priority: 1, action: "Re-fetch Jupiter quote and regenerate the transaction", estimatedSuccessLift: 0.95 },
    ],
    severity: "transient",
    retryable: true,
    category: "program_error",
  },
  {
    code: 6016,
    programId: JUPITER_V6_PROGRAM_ID,
    programName: "Jupiter Aggregator v6",
    name: "ExactOutAmountNotMatched",
    summary: "Exact output amount requirement was not satisfied.",
    causes: ["Pool liquidity insufficient for exact-out mode", "Price moved during execution"],
    fixes: [
      { priority: 1, action: "Switch to exact-in mode if using exact-out", estimatedSuccessLift: 0.8 },
      { priority: 2, action: "Increase slippage tolerance", codeHint: "slippageBps: 150" },
    ],
    severity: "recoverable",
    retryable: true,
    category: "slippage",
  },

  // ── Raydium AMM v4 ───────────────────────────────────────────────────────
  {
    code: 30,
    programId: RAYDIUM_AMM_V4_ID,
    programName: "Raydium AMM v4",
    name: "ExceededSlippage",
    summary: "Swap exceeded slippage limit on Raydium AMM.",
    causes: ["Price impact too high for pool size", "Volatile market conditions"],
    fixes: [
      { priority: 1, action: "Increase slippage tolerance", codeHint: "slippageBps: 200", estimatedSuccessLift: 0.7 },
      { priority: 2, action: "Reduce swap size to lower price impact" },
    ],
    severity: "recoverable",
    retryable: true,
    category: "slippage",
  },
  {
    code: 38,
    programId: RAYDIUM_AMM_V4_ID,
    programName: "Raydium AMM v4",
    name: "NotEnoughLiquidity",
    summary: "Raydium pool does not have enough liquidity for this swap.",
    causes: ["Pool liquidity too low for trade size", "One-sided liquidity pool"],
    fixes: [
      { priority: 1, action: "Reduce swap amount", estimatedSuccessLift: 0.85 },
      { priority: 2, action: "Use Jupiter to route through multiple pools" },
    ],
    severity: "recoverable",
    retryable: false,
    category: "program_error",
  },

  // ── Raydium CLMM ─────────────────────────────────────────────────────────
  {
    code: 6001,
    programId: RAYDIUM_CLMM_ID,
    programName: "Raydium CLMM",
    name: "NotEnoughTickArrayAccount",
    summary: "Price moved outside the initialized tick range for this CLMM pool.",
    causes: ["Concentrated liquidity position out of range", "High volatility moved price past initialized ticks"],
    fixes: [
      { priority: 1, action: "Use Jupiter which handles tick array initialization automatically" },
      { priority: 2, action: "Reduce swap size to keep price within current tick range" },
    ],
    severity: "recoverable",
    retryable: false,
    category: "program_error",
  },
  {
    code: 6013,
    programId: RAYDIUM_CLMM_ID,
    programName: "Raydium CLMM",
    name: "PriceLimitOutOfRange",
    summary: "Swap price limit is outside the current pool price range.",
    causes: ["Slippage limit set incorrectly for CLMM pools", "Market moved significantly since quote"],
    fixes: [
      { priority: 1, action: "Re-quote with current pool state", estimatedSuccessLift: 0.9 },
      { priority: 2, action: "Increase slippage tolerance for concentrated liquidity pools" },
    ],
    severity: "recoverable",
    retryable: true,
    category: "slippage",
  },

  // ── Orca Whirlpools ───────────────────────────────────────────────────────
  {
    code: 6002,
    programId: ORCA_WHIRLPOOL_ID,
    programName: "Orca Whirlpools",
    name: "TickArrayIndexOutofBounds",
    summary: "Swap price moved outside the Orca Whirlpool tick array range.",
    causes: ["Concentrated liquidity gap at current price", "Large price impact moved beyond initialized ticks"],
    fixes: [
      { priority: 1, action: "Use Jupiter aggregator to handle tick initialization", estimatedSuccessLift: 0.8 },
      { priority: 2, action: "Reduce swap size" },
    ],
    severity: "recoverable",
    retryable: false,
    category: "program_error",
  },
  {
    code: 6015,
    programId: ORCA_WHIRLPOOL_ID,
    programName: "Orca Whirlpools",
    name: "AmountCalcOverflow",
    summary: "Swap amount calculation overflowed — order size too large for this pool.",
    causes: ["Swap size exceeds pool capacity", "Arithmetic overflow in price calculation"],
    fixes: [
      { priority: 1, action: "Reduce swap amount significantly", estimatedSuccessLift: 0.95 },
    ],
    severity: "recoverable",
    retryable: false,
    category: "program_error",
  },
  {
    code: 6016,
    programId: ORCA_WHIRLPOOL_ID,
    programName: "Orca Whirlpools",
    name: "AmountRemainingOverflow",
    summary: "Remaining amount after swap overflowed — price impact too large.",
    causes: ["Pool price impact exceeded u64 bounds", "Extremely low liquidity"],
    fixes: [
      { priority: 1, action: "Reduce swap amount or use a more liquid pool", estimatedSuccessLift: 0.95 },
    ],
    severity: "recoverable",
    retryable: false,
    category: "slippage",
  },

  // ── Pump.fun ──────────────────────────────────────────────────────────────
  {
    code: 6001,
    programId: PUMP_FUN_ID,
    programName: "Pump.fun",
    name: "NotAuthorized",
    summary: "Caller is not authorized to perform this action on Pump.fun.",
    causes: ["Wrong signer", "Action restricted to creator or platform"],
    fixes: [{ priority: 1, action: "Ensure correct wallet is signing this transaction" }],
    severity: "fatal",
    retryable: false,
    category: "program_error",
  },
  {
    code: 6006,
    programId: PUMP_FUN_ID,
    programName: "Pump.fun",
    name: "SlippageExceeded",
    summary: "Token purchase price exceeded slippage limit on Pump.fun bonding curve.",
    causes: ["Other buyers front-ran this transaction", "Bonding curve price moved up"],
    fixes: [
      { priority: 1, action: "Increase slippage tolerance", codeHint: "slippageBps: 500", estimatedSuccessLift: 0.7 },
      { priority: 2, action: "Add a Jito tip to reduce front-running", codeHint: "jitoTipLamports: 100000" },
    ],
    severity: "recoverable",
    retryable: true,
    category: "slippage",
  },
  {
    code: 6007,
    programId: PUMP_FUN_ID,
    programName: "Pump.fun",
    name: "TooMuchSolRequired",
    summary: "SOL required for this Pump.fun purchase exceeds your max input.",
    causes: ["Price moved up since quote", "Max SOL limit set too tight"],
    fixes: [
      { priority: 1, action: "Re-quote and accept updated price", estimatedSuccessLift: 0.9 },
      { priority: 2, action: "Increase max SOL allowance", codeHint: "maxSolCost: quotedAmount * 1.05" },
    ],
    severity: "recoverable",
    retryable: true,
    category: "slippage",
  },
  {
    code: 6011,
    programId: PUMP_FUN_ID,
    programName: "Pump.fun",
    name: "BondingCurveComplete",
    summary: "Token's Pump.fun bonding curve is complete — token has migrated to Raydium.",
    causes: ["Token reached 100% of bonding curve — now trades on Raydium AMM"],
    fixes: [
      { priority: 1, action: "Trade this token on Raydium or via Jupiter instead of Pump.fun", estimatedSuccessLift: 1.0 },
    ],
    severity: "recoverable",
    retryable: false,
    category: "program_error",
  },

  // ── Marinade Finance ─────────────────────────────────────────────────────
  {
    code: 6000,
    programId: MARINADE_ID,
    programName: "Marinade Finance",
    name: "WrongValidatorAccountOrIndex",
    summary: "Invalid validator account passed to Marinade.",
    causes: ["Validator index mismatch", "Stale validator list"],
    fixes: [{ priority: 1, action: "Re-fetch validator list and retry" }],
    severity: "recoverable",
    retryable: true,
    category: "program_error",
  },
  {
    code: 6029,
    programId: MARINADE_ID,
    programName: "Marinade Finance",
    name: "UnstakingNotReadyYet",
    summary: "Delayed unstake is not ready to claim — epoch has not ended.",
    causes: ["Claiming mSOL unstake before the epoch completes"],
    fixes: [
      { priority: 1, action: "Wait until the current epoch ends (~2 days) before claiming" },
    ],
    severity: "recoverable",
    retryable: false,
    category: "program_error",
  },
];

// ── Registry & lookup ─────────────────────────────────────────────────────────

/** All entries merged for lookup */
const ALL_ENTRIES: ErrorEntry[] = [...NATIVE_ERRORS, ...TOKEN_ERRORS, ...PROTOCOL_ERRORS];

/**
 * Look up the richest error entry for a given error value.
 *
 * errValue examples:
 *   "BlockhashNotFound"
 *   { Custom: 6001 }
 *   { InstructionError: [2, { Custom: 6001 }] }
 *
 * programIds: account keys from the transaction (used to disambiguate custom codes).
 */
export function lookupError(
  errValue: unknown,
  programIds: string[] = []
): ErrorEntry | null {
  if (!errValue) return null;

  // ── Native string error ───────────────────────────────────────────────────
  if (typeof errValue === "string") {
    return ALL_ENTRIES.find((e) => e.code === errValue && !e.programId) ?? null;
  }

  if (typeof errValue !== "object") return null;
  const err = errValue as Record<string, unknown>;

  // ── { InstructionError: [index, inner] } ─────────────────────────────────
  const instrErr = err["InstructionError"];
  if (Array.isArray(instrErr) && instrErr.length === 2) {
    return lookupError(instrErr[1], programIds);
  }

  // ── { Custom: number } ───────────────────────────────────────────────────
  const customCode = err["Custom"];
  if (typeof customCode === "number") {
    // Prefer the most specific match (entry whose programId is in the tx)
    const protocolMatch = ALL_ENTRIES.find(
      (e) =>
        e.code === customCode &&
        e.programId &&
        programIds.includes(e.programId)
    );
    if (protocolMatch) return protocolMatch;

    // Fallback: any entry with this code
    return ALL_ENTRIES.find((e) => e.code === customCode) ?? null;
  }

  // ── Named instruction error strings (e.g. "InvalidAccountData") ──────────
  for (const key of Object.keys(err)) {
    const match = ALL_ENTRIES.find((e) => e.code === key && !e.programId);
    if (match) return match;
  }

  return null;
}

/**
 * Convenience: get all entries for a specific program.
 */
export function entriesForProgram(programId: string): ErrorEntry[] {
  return ALL_ENTRIES.filter((e) => e.programId === programId);
}

export {
  SPL_TOKEN_PROGRAM_ID,
  SPL_TOKEN_2022_PROGRAM_ID,
  JUPITER_V6_PROGRAM_ID,
  RAYDIUM_AMM_V4_ID,
  RAYDIUM_CLMM_ID,
  ORCA_WHIRLPOOL_ID,
  PUMP_FUN_ID,
  MARINADE_ID,
};

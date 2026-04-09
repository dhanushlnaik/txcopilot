import type {
  AnalysisResult,
  RiskLevel,
  RiskReason,
  FixSuggestion,
  TransactionBreakdown,
} from "./types";

// ===========================
// Rule-based Transaction Analyzer
// ===========================

/**
 * Known program error codes mapped to human explanations
 */
const ERROR_CODE_MAP: Record<
  string,
  { label: string; description: string; fix: string; fixPriority: "critical" | "recommended" | "optional" }
> = {
  // ===== Generic / System Program =====
  "0x0": {
    label: "Insufficient Token Balance",
    description:
      "The source account doesn't have enough tokens to complete this transfer or swap.",
    fix: "Check your token balance and reduce the amount, or acquire more tokens.",
    fixPriority: "critical",
  },
  "0x1": {
    label: "Insufficient Funds",
    description:
      "Your wallet doesn't have enough SOL to cover the transaction fee and any account rent requirements.",
    fix: "Add at least 0.05 SOL to your wallet to cover fees and rent-exempt minimums.",
    fixPriority: "critical",
  },

  // ===== Jupiter v6 (6001–6025) =====
  "0x1771": {
    label: "Slippage Tolerance Exceeded",
    description:
      "The token price moved beyond your slippage tolerance between when you submitted and when the transaction was processed.",
    fix: "Increase slippage tolerance to 3–5%, or retry when market volatility is lower.",
    fixPriority: "critical",
  },
  "0x1778": {
    label: "Not Enough Account Keys (Jupiter)",
    description:
      "The transaction is missing required account keys. This usually happens if the transaction was modified after being built by the Jupiter API.",
    fix: "Do not modify the transaction after fetching it from the Jupiter API. Rebuild and retry.",
    fixPriority: "critical",
  },
  "0x177e": {
    label: "Incorrect Token Program (Jupiter)",
    description:
      "A Token-2022 token was passed to the legacy SPL Token program, or vice versa.",
    fix: "Ensure the correct token program is used. Token-2022 tokens require the TokenzQd... program.",
    fixPriority: "critical",
  },
  "0x1788": {
    label: "Insufficient Funds for Swap (Jupiter)",
    description:
      "Your wallet lacks enough tokens for this swap, or not enough SOL for rent and fees.",
    fix: "Check both your token balance and SOL balance. You need SOL for fees even in token-to-token swaps.",
    fixPriority: "critical",
  },
  "0x1789": {
    label: "Invalid Token Account (Jupiter)",
    description:
      "An account provided to the swap is uninitialized or doesn't match what the program expects.",
    fix: "Ensure all Associated Token Accounts exist. Create them before retrying the swap.",
    fixPriority: "critical",
  },

  // ===== Raydium AMM / CLMM =====
  "0x1785": {
    label: "Amount Too Small (Raydium)",
    description:
      "The swap output amount is too small, often due to low liquidity or unfavorable rates.",
    fix: "Try a larger input amount or use a different liquidity pool.",
    fixPriority: "recommended",
  },
  "0x1786": {
    label: "Pool Liquidity Depleted (Raydium)",
    description:
      "The liquidity pool doesn't have enough reserves to fulfill your swap.",
    fix: "Try a different pool or reduce the swap amount.",
    fixPriority: "recommended",
  },
  "0x16": {
    label: "Pool Not Live Yet (Raydium)",
    description:
      "The pool hasn't reached its configured open time. You're trying to interact with it too early.",
    fix: "Wait until the pool's launch time, then retry the transaction.",
    fixPriority: "recommended",
  },

  // ===== Orca Whirlpool =====
  "0x177c": {
    label: "Token Max Exceeded (Orca)",
    description:
      "The amount of input tokens required exceeds the maximum you specified (slippage limit hit).",
    fix: "Increase slippage tolerance or reduce the swap amount.",
    fixPriority: "critical",
  },
  "0x177d": {
    label: "Token Min Not Met (Orca)",
    description:
      "The output amount is less than the minimum you specified (slippage limit hit).",
    fix: "Increase slippage tolerance, or wait for better liquidity.",
    fixPriority: "critical",
  },
  "0x177b": {
    label: "Zero Liquidity (Orca)",
    description:
      "The pool has zero liquidity in the current price range. Your swap cannot be filled.",
    fix: "Try a different pool or wait for liquidity providers to add funds.",
    fixPriority: "critical",
  },
  "0x1780": {
    label: "Invalid Tick Array (Orca)",
    description:
      "An incorrect tick array sequence was provided. The swap route is invalid for the current price range.",
    fix: "Refresh the swap quote and retry — the pool price may have moved.",
    fixPriority: "recommended",
  },

  // ===== Pump.fun =====
  "0x1778_pump": {
    label: "Overflow Error (Pump.fun)",
    description:
      "Arithmetic overflow during bonding curve calculation. Often caused by a missing bonding_curve_v2 PDA after a platform upgrade.",
    fix: "Ensure you're including the bonding_curve_v2 PDA as the last account. Update your SDK or client.",
    fixPriority: "critical",
  },
  "0x177b_pump": {
    label: "Too Little SOL Received (Pump.fun)",
    description:
      "The sell output is below the minimum threshold (1000 lamports). Liquidity may be insufficient.",
    fix: "Lower your slippage tolerance, or sell a smaller amount of tokens.",
    fixPriority: "critical",
  },
  "0x7d6": {
    label: "Constraint Seeds Violation (Pump.fun)",
    description:
      "The PDA seeds for the bonding curve don't match the mint address being used.",
    fix: "Verify the bonding curve PDA is derived from the correct mint address.",
    fixPriority: "critical",
  },

  // ===== Common Anchor Errors =====
  "0xbbf": {
    label: "Account Discriminator Mismatch",
    description:
      "The account data doesn't match the expected program type. The account may belong to a different program.",
    fix: "Verify you're interacting with the correct program and account.",
    fixPriority: "critical",
  },
  "0xbc0": {
    label: "Account Not Initialized",
    description:
      "A required account hasn't been initialized yet.",
    fix: "Initialize the account before using it in this transaction.",
    fixPriority: "critical",
  },
  "0x7d1": {
    label: "Constraint Violation",
    description:
      "An Anchor constraint check failed. This usually means invalid input data or account state.",
    fix: "Check that all accounts and parameters match what the program expects.",
    fixPriority: "critical",
  },
};

/**
 * Common instruction error patterns
 */
const INSTRUCTION_ERROR_PATTERNS: Array<{
  pattern: RegExp;
  label: string;
  description: string;
  fix: string;
  severity: RiskLevel;
}> = [
  {
    pattern: /insufficient funds/i,
    label: "Insufficient Funds",
    description: "The account balance is too low to cover this transaction.",
    fix: "Add more SOL to your wallet.",
    severity: "HIGH",
  },
  {
    pattern: /account not found/i,
    label: "Account Not Found",
    description:
      "A required account doesn't exist on-chain. It may have been closed or never created.",
    fix: "Ensure the destination account exists, or include a create-account instruction.",
    severity: "HIGH",
  },
  {
    pattern: /blockhash not found/i,
    label: "Expired Blockhash",
    description:
      "The transaction's blockhash expired before it was processed. Blockhashes are valid for about 60 seconds.",
    fix: "Retry the transaction with a fresh blockhash.",
    severity: "HIGH",
  },
  {
    pattern: /already processed/i,
    label: "Duplicate Transaction",
    description: "This exact transaction was already processed.",
    fix: "No action needed — the original transaction was successful.",
    severity: "LOW",
  },
  {
    pattern: /Program failed to complete/i,
    label: "Program Execution Failed",
    description:
      "The on-chain program ran out of compute units or encountered an internal error.",
    fix: "Increase the compute budget or simplify the transaction.",
    severity: "HIGH",
  },
  {
    pattern: /custom program error/i,
    label: "Custom Program Error",
    description:
      "The program returned a custom error code. This usually indicates invalid input or state.",
    fix: "Check the program documentation for the specific error code.",
    severity: "MEDIUM",
  },
  {
    pattern: /owner does not match/i,
    label: "Account Owner Mismatch",
    description:
      "An account is owned by a different program than expected.",
    fix: "Verify you're interacting with the correct program and accounts.",
    severity: "HIGH",
  },
  // ===== DeFi-specific log patterns =====
  {
    pattern: /exceeded CUs meter/i,
    label: "Compute Units Exceeded",
    description:
      "The transaction ran out of compute units before completing. Complex DeFi routes or multiple instructions can exhaust the default budget.",
    fix: "Add a ComputeBudget instruction requesting more CUs (e.g., 400,000 or higher).",
    severity: "HIGH",
  },
  {
    pattern: /Swap failed/i,
    label: "Swap Failed",
    description:
      "The DEX swap instruction failed. This can be caused by stale quotes, price movement, or pool state changes.",
    fix: "Refresh the swap quote and retry with higher slippage tolerance.",
    severity: "HIGH",
  },
  {
    pattern: /exceeds desired slippage limit/i,
    label: "Slippage Limit Hit",
    description:
      "The actual execution price exceeded your configured slippage limit.",
    fix: "Increase slippage to 3–5% for volatile tokens or retry during calmer markets.",
    severity: "HIGH",
  },
  {
    pattern: /insufficient lamports/i,
    label: "Insufficient SOL (Lamports)",
    description:
      "Not enough lamports (SOL) to cover rent-exempt minimums for new accounts or transaction fees.",
    fix: "Add at least 0.01 SOL to your wallet. New token accounts require ~0.002 SOL rent.",
    severity: "HIGH",
  },
  {
    pattern: /account already in use/i,
    label: "Account Already In Use",
    description:
      "The account you're trying to create or initialize already exists on-chain.",
    fix: "Use the existing account or use CreateIdempotent to avoid this error.",
    severity: "MEDIUM",
  },
  {
    pattern: /Token(?:2022|zQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb).*failed/i,
    label: "Token-2022 Error",
    description:
      "A Token-2022 (token extensions) instruction failed. The program may not support this token type.",
    fix: "Ensure the DEX and all instructions support Token-2022 tokens. Check for transfer fee or interest extensions.",
    severity: "HIGH",
  },
  {
    pattern: /privilege escalation/i,
    label: "Privilege Escalation",
    description:
      "A program tried to perform an action it doesn't have permission for (e.g., signing without authority).",
    fix: "Check that the transaction is signed by the correct wallet and all required signers are present.",
    severity: "HIGH",
  },
  {
    pattern: /immutable.*(failed|error|violat)/i,
    label: "Immutable Account Violation",
    description:
      "Attempted to modify an immutable account or account owner.",
    fix: "This account cannot be changed. Verify you're using the correct target account.",
    severity: "HIGH",
  },
  {
    pattern: /bonding.?curve/i,
    label: "Bonding Curve Interaction",
    description:
      "This transaction interacts with a bonding curve (e.g., Pump.fun). The token may not have graduated to a DEX yet.",
    fix: "Check if the token has migrated to Raydium. If still on the curve, verify the bonding curve PDA and parameters.",
    severity: "MEDIUM",
  },
  {
    pattern: /not rent exempt/i,
    label: "Account Not Rent Exempt",
    description:
      "An account doesn't have enough SOL to be rent-exempt. Solana requires minimum balances for all accounts.",
    fix: "Fund the account with at least 0.00203 SOL for standard token accounts.",
    severity: "HIGH",
  },
];

/**
 * Analyze a transaction and produce a structured result
 */
export function analyzeTransaction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawTx: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enhancedTx: any | null,
  signature: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  networkStatus?: any
): AnalysisResult {
  const reasons: RiskReason[] = [];
  const fixes: FixSuggestion[] = [];

  // Parse basic transaction details
  const breakdown = parseBreakdown(rawTx, enhancedTx, signature);

  // ===== RULE 1: Transaction already failed =====
  if (rawTx?.meta?.err) {
    const errStr = JSON.stringify(rawTx.meta.err);

    // Check for known error codes
    for (const [code, info] of Object.entries(ERROR_CODE_MAP)) {
      if (errStr.includes(code) || errStr.includes(String(parseInt(code, 16)))) {
        reasons.push({
          label: info.label,
          description: info.description,
          severity: "HIGH",
          code,
        });
        fixes.push({
          action: info.label,
          description: info.fix,
          priority: info.fixPriority,
        });
      }
    }

    // If no specific code matched, add generic failure
    if (reasons.length === 0) {
      reasons.push({
        label: "Transaction Failed",
        description: `The transaction failed with error: ${errStr}`,
        severity: "HIGH",
      });
      fixes.push({
        action: "Review Error Details",
        description:
          "Check the program logs below for specific error details and consult the program documentation.",
        priority: "recommended",
      });
    }
  }

  // ===== RULE 2: Check program logs for error patterns =====
  const logs: string[] = rawTx?.meta?.logMessages || [];
  for (const log of logs) {
    for (const pattern of INSTRUCTION_ERROR_PATTERNS) {
      if (pattern.pattern.test(log) && !reasons.some((r) => r.label === pattern.label)) {
        reasons.push({
          label: pattern.label,
          description: pattern.description,
          severity: pattern.severity,
        });
        fixes.push({
          action: pattern.label,
          description: pattern.fix,
          priority: pattern.severity === "HIGH" ? "critical" : "recommended",
        });
      }
    }
  }

  // ===== RULE 3: Check for slippage patterns in logs =====
  const hasSlippageLog = logs.some(
    (log) =>
      log.includes("Slippage") ||
      log.includes("slippage") ||
      log.includes("ExceededSlippage") ||
      log.includes("0x1771")
  );
  if (hasSlippageLog && !reasons.some((r) => r.label.includes("Slippage"))) {
    reasons.push({
      label: "Slippage Issue Detected",
      description:
        "Transaction logs indicate a slippage-related failure. The market price moved too much.",
      severity: "HIGH",
      code: "0x1771",
    });
    fixes.push({
      action: "Increase Slippage Tolerance",
      description:
        "Set slippage to 3–5% for volatile tokens, or try trading during less volatile periods.",
      priority: "critical",
    });
  }

  // Track whether the tx is a confirmed success (affects how we weight warnings)
  const isConfirmedSuccess = rawTx && !rawTx.meta?.err && rawTx.slot;

  // ===== RULE 4: Check transaction fee vs network =====
  if (networkStatus && rawTx?.meta) {
    const txFee = rawTx.meta.fee || 0;
    const feeInMicroLamports = txFee; // Already in lamports

    if (
      networkStatus.congestionLevel === "HIGH" &&
      feeInMicroLamports < networkStatus.medianFee * 1000
    ) {
      // Only flag fee as MEDIUM for non-confirmed txs; demote to LOW insight for confirmed
      reasons.push({
        label: isConfirmedSuccess ? "Low Priority Fee (Landed OK)" : "Priority Fee Too Low",
        description: isConfirmedSuccess
          ? `Your priority fee was below the network median, but the transaction still landed successfully.`
          : `Your transaction fee is below the network median during high congestion. This may cause the transaction to be dropped.`,
        severity: isConfirmedSuccess ? "LOW" : "MEDIUM",
      });
      if (!isConfirmedSuccess) {
        fixes.push({
          action: "Increase Priority Fee",
          description: `Use a priority fee of at least ${networkStatus.recommendedFee} micro-lamports for better landing rate during congestion.`,
          priority: "recommended",
        });
      }
    }

    // Only flag congestion for failed/pending txs — it's noise for confirmed ones
    if (networkStatus.congestionLevel === "HIGH" && !isConfirmedSuccess) {
      reasons.push({
        label: "High Network Congestion",
        description: `Network is processing ~${networkStatus.avgTps} TPS. Transactions are more likely to be delayed or dropped.`,
        severity: "MEDIUM",
      });
      fixes.push({
        action: "Wait or Increase Fee",
        description:
          "Retry in 10–30 seconds when congestion eases, or increase your priority fee.",
        priority: "recommended",
      });
    }
  }

  // ===== RULE 5: Transaction not found (dropped) =====
  if (!rawTx) {
    reasons.push({
      label: "Transaction Not Found",
      description:
        "This transaction was not found on-chain. It may have been dropped by validators, expired, or never submitted.",
      severity: "HIGH",
    });
    fixes.push({
      action: "Retry Transaction",
      description:
        "Submit the transaction again with a fresh blockhash and adequate priority fee.",
      priority: "critical",
    });
  }

  // ===== RULE 6: Complex transaction warning =====
  if (breakdown.instructionCount > 10) {
    // For confirmed txs, this is just a note, not a risk
    reasons.push({
      label: isConfirmedSuccess ? "Complex Transaction (Succeeded)" : "Complex Transaction",
      description: isConfirmedSuccess
        ? `This transaction used ${breakdown.instructionCount} instructions but completed successfully. Consider simplifying for reliability in future txs.`
        : `This transaction contains ${breakdown.instructionCount} instructions, which increases the chance of failure and higher compute costs.`,
      severity: isConfirmedSuccess ? "LOW" : "MEDIUM",
    });
    if (!isConfirmedSuccess) {
      fixes.push({
        action: "Simplify Transaction",
        description:
          "Consider splitting into multiple smaller transactions or increasing the compute budget.",
        priority: "optional",
      });
    }
  }

  // ===== Calculate overall risk =====
  let risk: RiskLevel = "LOW";
  let confidence = 85;

  if (reasons.some((r) => r.severity === "HIGH")) {
    risk = "HIGH";
    confidence = 92;
  } else if (reasons.some((r) => r.severity === "MEDIUM")) {
    risk = "MEDIUM";
    confidence = 78;
  }

  // Successful confirmed tx with no HIGH/MEDIUM issues
  if (isConfirmedSuccess && risk === "LOW") {
    confidence = 95;
    // Add success message if no other reasons exist
    if (reasons.length === 0) {
      reasons.push({
        label: "Transaction Successful",
        description:
          "This transaction was confirmed successfully with no errors detected.",
        severity: "LOW",
      });
    }
  }

  return {
    risk,
    confidence,
    reasons,
    fixes,
    breakdown,
  };
}

/**
 * Parse raw + enhanced tx into a TransactionBreakdown
 */
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

  // Determine status
  let status: "confirmed" | "failed" | "dropped" | "unknown" = "unknown";
  if (rawTx.meta?.err) {
    status = "failed";
  } else if (rawTx.slot) {
    status = "confirmed";
  }

  // Get fee in SOL
  const fee = (rawTx.meta?.fee || 0) / 1e9;

  // Get signers from account keys
  const signers: string[] = [];
  const message = rawTx.transaction?.message;
  if (message) {
    const accountKeys = message.accountKeys || message.staticAccountKeys || [];
    const numSigners = message.header?.numRequiredSignatures || 1;
    for (let i = 0; i < Math.min(numSigners, accountKeys.length); i++) {
      const key = accountKeys[i];
      signers.push(typeof key === "string" ? key : key.toBase58?.() || String(key));
    }
  }

  // Get instruction count
  const instructions = message?.instructions || [];
  const innerInstructions = rawTx.meta?.innerInstructions || [];
  const totalInstructions =
    instructions.length +
    innerInstructions.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, inner: any) => sum + (inner.instructions?.length || 0),
      0
    );

  // Enhanced type from Helius
  const type = enhancedTx?.type || inferTransactionType(rawTx);

  // Block time
  const blockTime = rawTx.blockTime
    ? new Date(rawTx.blockTime * 1000).toISOString()
    : undefined;

  // Logs
  const logs: string[] = rawTx.meta?.logMessages || [];

  return {
    signature,
    type,
    status,
    fee,
    slot: rawTx.slot,
    blockTime,
    signers,
    instructionCount: totalInstructions,
    logs,
  };
}

/**
 * Known DeFi program IDs → transaction type
 */
const PROGRAM_TYPE_MAP: Record<string, string> = {
  // Jupiter
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4": "SWAP",
  "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB": "SWAP",
  "JUP2jxvXaqu7NQY1GmNf4XJ1jzFkwDDOQ1dvpFtLb9U": "SWAP",
  "JUP3c2Uh3WA8Mg1g4yWEN4b7FSKaLVocNiCfj18fn7U": "SWAP",
  // Raydium
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8": "SWAP",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK": "SWAP",
  "routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS": "SWAP",
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C": "SWAP",
  // Orca / Whirlpool
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc": "SWAP",
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP": "SWAP",
  // Meteora
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo": "SWAP",
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB": "SWAP",
  // Pump.fun
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "SWAP",
  "pAMMBay6oceH9fJKBdHsEU5ASbKUZromSdMHvxSGmHE": "SWAP",
  // Lifinity
  "2wT8Yq49kHgDzXuPxZSaeLaH1qbmGXtEyPy64bL7aD3c": "SWAP",
  // Phoenix
  "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY": "SWAP",
  // Jito tip / fast lane (MEV bot infrastructure)
  "fastC7gqs2WUXgcyNna2BZAe9mte4zcTGprv3mv18N3": "MEV_TIP",
  "T1pyyaTNZsKv2WcRAB8oVnk93mLJo2Y8wUQqKuQhXKo": "MEV_TIP",
  // Marinade
  "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD": "STAKE",
  // Tensor / NFT
  "TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN": "NFT_TRADE",
  "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K": "NFT_TRADE",
  // SPL Staking
  "Stake11111111111111111111111111111111111111": "STAKE",
};

/**
 * Infer transaction type from raw data when Helius is unavailable.
 * Checks program IDs first (most reliable), then log keywords as fallback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inferTransactionType(rawTx: any): string {
  // === Strategy 1: Check program IDs in account keys ===
  const message = rawTx?.transaction?.message;
  const accountKeys: string[] = [];

  // Handle both legacy and versioned tx formats
  const keys = message?.accountKeys || message?.staticAccountKeys || [];
  for (const key of keys) {
    accountKeys.push(typeof key === "string" ? key : key.toBase58?.() || String(key));
  }

  // Also check loaded addresses (for versioned txs with address lookup tables)
  const loadedAddresses = rawTx?.meta?.loadedAddresses;
  if (loadedAddresses) {
    for (const key of [...(loadedAddresses.writable || []), ...(loadedAddresses.readonly || [])]) {
      accountKeys.push(typeof key === "string" ? key : String(key));
    }
  }

  for (const key of accountKeys) {
    const mappedType = PROGRAM_TYPE_MAP[key];
    if (mappedType) return mappedType;
  }

  // === Strategy 1.5: Extract program IDs from log messages ===
  const logs: string[] = rawTx?.meta?.logMessages || [];
  const programInvokeRegex = /^Program (\S+) invoke/;
  for (const log of logs) {
    const match = log.match(programInvokeRegex);
    if (match) {
      const programId = match[1];
      const mappedType = PROGRAM_TYPE_MAP[programId];
      if (mappedType) return mappedType;
    }
  }
  const logStr = logs.join(" ").toLowerCase();

  if (logStr.includes("instruction: swap") || logStr.includes("instruction: route")) {
    return "SWAP";
  }
  if (logStr.includes("swap") || logStr.includes("raydium") || logStr.includes("jupiter")) {
    return "SWAP";
  }
  if (logStr.includes("instruction: transfer") && !logStr.includes("swap")) {
    return "TRANSFER";
  }
  if (logStr.includes("mint") && (logStr.includes("nft") || logStr.includes("metaplex"))) {
    return "NFT_MINT";
  }
  if (logStr.includes("stake") || logStr.includes("delegate")) {
    return "STAKE";
  }
  if (logStr.includes("createidempotent") && logStr.includes("swap")) {
    return "SWAP";
  }

  // === Strategy 3: Heuristic from instruction shape ===
  const instructions = message?.instructions || [];
  if (instructions.length === 1) {
    return "TRANSFER";
  }
  if (instructions.length > 5) {
    return "COMPLEX";
  }

  return "UNKNOWN";
}

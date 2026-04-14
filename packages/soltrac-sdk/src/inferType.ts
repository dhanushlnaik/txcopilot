// ===========================
// Transaction type inference utilities
// Moved here from analyzer.ts — not part of simulation analysis
// ===========================

/**
 * Known DeFi program IDs → transaction type
 */
export const PROGRAM_TYPE_MAP: Record<string, string> = {
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
  "pAMMBay6oceH9fJKBdHsEU5ASbKuZromSdMHvxSGmHE": "SWAP",
  // Lifinity
  "2wT8Yq49kHgDzXuPxZSaeLaH1qbmGXtEyPy64bL7aD3c": "SWAP",
  // Phoenix
  "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY": "SWAP",
  // Jito tip / fast lane
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
export function inferTransactionType(rawTx: any): string {
  const message = rawTx?.transaction?.message;
  const accountKeys: string[] = [];

  const keys = message?.accountKeys || message?.staticAccountKeys || [];
  for (const key of keys) {
    accountKeys.push(typeof key === "string" ? key : key.toBase58?.() || String(key));
  }

  const loadedAddresses = rawTx?.meta?.loadedAddresses;
  if (loadedAddresses) {
    for (const key of [
      ...(loadedAddresses.writable || []),
      ...(loadedAddresses.readonly || []),
    ]) {
      accountKeys.push(typeof key === "string" ? key : String(key));
    }
  }

  for (const key of accountKeys) {
    const mappedType = PROGRAM_TYPE_MAP[key];
    if (mappedType) return mappedType;
  }

  const logs: string[] = rawTx?.meta?.logMessages || [];
  const programInvokeRegex = /^Program (\S+) invoke/;
  for (const log of logs) {
    const match = log.match(programInvokeRegex);
    if (match) {
      const mappedType = PROGRAM_TYPE_MAP[match[1]];
      if (mappedType) return mappedType;
    }
  }

  const logStr = logs.join(" ").toLowerCase();
  if (logStr.includes("instruction: swap") || logStr.includes("instruction: route")) return "SWAP";
  if (logStr.includes("swap") || logStr.includes("raydium") || logStr.includes("jupiter")) return "SWAP";
  if (logStr.includes("instruction: transfer") && !logStr.includes("swap")) return "TRANSFER";
  if (logStr.includes("mint") && (logStr.includes("nft") || logStr.includes("metaplex"))) return "NFT_MINT";
  if (logStr.includes("stake") || logStr.includes("delegate")) return "STAKE";
  if (logStr.includes("createidempotent") && logStr.includes("swap")) return "SWAP";

  const instructions = message?.instructions || [];
  if (instructions.length === 1) return "TRANSFER";
  if (instructions.length > 5) return "COMPLEX";

  return "UNKNOWN";
}

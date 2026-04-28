// ── Protocol fingerprinting ───────────────────────────────────────────────────
// Detect which protocols are in a transaction from program IDs + account keys.

export type ProtocolCategory =
  | "dex-aggregator"
  | "amm"
  | "clmm"
  | "orderbook"
  | "liquid-staking"
  | "lending"
  | "nft"
  | "mev"
  | "system"
  | "token"
  | "compute-budget";

export type ProtocolRisk =
  | "multi-hop-slippage"    // aggregated routes compound price impact
  | "route-staleness"       // quote may be stale by execution time
  | "liquidity-depth"       // pool may lack depth for large orders
  | "price-impact"          // order moves the pool price significantly
  | "concentrated-liquidity-gap" // CLMM ticks may not be initialized
  | "tick-range"            // price may be outside initialized tick range
  | "epoch-boundary"        // some ops only valid within an epoch window
  | "stake-account-state"   // stake account must be in a specific state
  | "front-run"             // MEV bots can front-run this tx type
  | "oracle-staleness"      // price oracle may have stale data
  | "mint-authority";       // mint/burn authority checks

export interface ProtocolInfo {
  programId: string;
  name: string;
  shortName: string;
  category: ProtocolCategory;
  risks: ProtocolRisk[];
  /** Hex prefix of custom error codes for this program */
  errorPrefix?: string;
  /** Link to program docs */
  docsUrl?: string;
  /** True if this program is a routing aggregator (implies multi-hop) */
  isAggregator?: boolean;
}

// ── Protocol registry ─────────────────────────────────────────────────────────

const PROTOCOLS: ProtocolInfo[] = [
  // ── Aggregators ────────────────────────────────────────────────────────
  {
    programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    name: "Jupiter Aggregator v6",
    shortName: "Jupiter",
    category: "dex-aggregator",
    risks: ["multi-hop-slippage", "route-staleness", "front-run"],
    errorPrefix: "0x177",
    docsUrl: "https://station.jup.ag/docs",
    isAggregator: true,
  },
  {
    programId: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB",
    name: "Jupiter Aggregator v4",
    shortName: "Jupiter v4",
    category: "dex-aggregator",
    risks: ["multi-hop-slippage", "route-staleness"],
    isAggregator: true,
  },

  // ── AMMs ───────────────────────────────────────────────────────────────
  {
    programId: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    name: "Raydium AMM v4",
    shortName: "Raydium",
    category: "amm",
    risks: ["liquidity-depth", "price-impact", "front-run"],
    docsUrl: "https://docs.raydium.io",
  },
  {
    programId: "5quBtoiQqxF9Jv6KYKctB59NT3gtFD2SqzeAgervEifn",
    name: "Raydium AMM v3",
    shortName: "Raydium v3",
    category: "amm",
    risks: ["liquidity-depth", "price-impact"],
  },
  {
    programId: "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
    name: "Orca AMM v1",
    shortName: "Orca v1",
    category: "amm",
    risks: ["liquidity-depth", "price-impact"],
    docsUrl: "https://docs.orca.so",
  },
  {
    programId: "DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1",
    name: "Orca AMM v2",
    shortName: "Orca v2",
    category: "amm",
    risks: ["liquidity-depth", "price-impact"],
  },

  // ── CLMMs ──────────────────────────────────────────────────────────────
  {
    programId: "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
    name: "Raydium CLMM",
    shortName: "Raydium CLMM",
    category: "clmm",
    risks: ["concentrated-liquidity-gap", "tick-range", "price-impact"],
    docsUrl: "https://docs.raydium.io/raydium/traders/trade-on-clmm",
  },
  {
    programId: "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
    name: "Orca Whirlpools",
    shortName: "Orca Whirlpools",
    category: "clmm",
    risks: ["concentrated-liquidity-gap", "tick-range", "price-impact"],
    docsUrl: "https://docs.orca.so/reference/whirlpool-overview",
  },
  {
    programId: "LBUZKhRxPF3XUpBCjp4YzTKgLLjgggwsTJ1xKqZ66MR",
    name: "Meteora DLMM",
    shortName: "Meteora DLMM",
    category: "clmm",
    risks: ["concentrated-liquidity-gap", "tick-range"],
    docsUrl: "https://docs.meteora.ag",
  },
  {
    programId: "Eo7WjKq67rjJQDd1d4EG8AvAGGgzfSPsGQ4tZsqixkFE",
    name: "Meteora AMM Pools",
    shortName: "Meteora",
    category: "amm",
    risks: ["liquidity-depth", "price-impact"],
  },

  // ── Orderbooks ─────────────────────────────────────────────────────────
  {
    programId: "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY",
    name: "Phoenix DEX",
    shortName: "Phoenix",
    category: "orderbook",
    risks: ["oracle-staleness", "liquidity-depth"],
    docsUrl: "https://docs.phoenix.trade",
  },
  {
    programId: "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb",
    name: "OpenBook v2",
    shortName: "OpenBook",
    category: "orderbook",
    risks: ["oracle-staleness", "liquidity-depth"],
  },

  // ── Liquid staking ─────────────────────────────────────────────────────
  {
    programId: "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",
    name: "Marinade Finance",
    shortName: "Marinade",
    category: "liquid-staking",
    risks: ["epoch-boundary", "stake-account-state"],
    docsUrl: "https://docs.marinade.finance",
  },
  {
    programId: "CrX7kMhLC3cSsXJdT7wiclwigfgZwzygW5bkf9a6pyxy",
    name: "Lido for Solana",
    shortName: "Lido",
    category: "liquid-staking",
    risks: ["epoch-boundary", "stake-account-state"],
  },
  {
    programId: "SP12tWFxD9oJsVWNavTTBZvMbA6gkAmxtVgxdqvyvhY",
    name: "Sanctum Router",
    shortName: "Sanctum",
    category: "liquid-staking",
    risks: ["epoch-boundary"],
  },

  // ── Consumer / meme ────────────────────────────────────────────────────
  {
    programId: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    name: "Pump.fun",
    shortName: "Pump.fun",
    category: "amm",
    risks: ["front-run", "price-impact", "liquidity-depth"],
    docsUrl: "https://pump.fun",
  },

  // ── MEV / Jito ─────────────────────────────────────────────────────────
  {
    programId: "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Poqbd",
    name: "Jito Tip Program",
    shortName: "Jito",
    category: "mev",
    risks: [],
  },
  {
    programId: "T1pyyaTNZsKv2WcRAB8oVnk93mLJw2XzjtVYqCsaHqt",
    name: "Jito Tip Payment",
    shortName: "Jito Tips",
    category: "mev",
    risks: [],
  },

  // ── System programs ────────────────────────────────────────────────────
  {
    programId: "11111111111111111111111111111111",
    name: "System Program",
    shortName: "System",
    category: "system",
    risks: [],
  },
  {
    programId: "ComputeBudget111111111111111111111111111111",
    name: "Compute Budget Program",
    shortName: "ComputeBudget",
    category: "compute-budget",
    risks: [],
  },
  {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    name: "SPL Token Program",
    shortName: "Token",
    category: "token",
    risks: [],
  },
  {
    programId: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    name: "SPL Token-2022",
    shortName: "Token-2022",
    category: "token",
    risks: ["mint-authority"],
  },
  {
    programId: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bE",
    name: "Associated Token Account Program",
    shortName: "ATA",
    category: "token",
    risks: [],
  },
];

// ── Lookup map (programId → ProtocolInfo) ─────────────────────────────────────

const PROTOCOL_MAP = new Map<string, ProtocolInfo>(
  PROTOCOLS.map((p) => [p.programId, p])
);

// ── Public API ────────────────────────────────────────────────────────────────

export interface FingerprintResult {
  /** All protocols detected in the transaction */
  protocols: ProtocolInfo[];
  /** Unique risk flags across all detected protocols */
  risks: ProtocolRisk[];
  /** True if any detected protocol is a DEX aggregator (multi-hop) */
  isAggregatedSwap: boolean;
  /** Human-readable protocol names for display */
  names: string[];
  /** Protocol categories present */
  categories: ProtocolCategory[];
}

/**
 * Fingerprint a transaction from its account keys.
 * Pass `tx.message.staticAccountKeys` (versioned) or `tx.compileMessage().accountKeys` (legacy).
 */
export function fingerprint(accountKeys: Array<{ toBase58(): string } | string>): FingerprintResult {
  const detected: ProtocolInfo[] = [];
  const seenIds = new Set<string>();

  for (const key of accountKeys) {
    const id = typeof key === "string" ? key : key.toBase58();
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const proto = PROTOCOL_MAP.get(id);
    if (proto) detected.push(proto);
  }

  const allRisks = new Set<ProtocolRisk>();
  const allCategories = new Set<ProtocolCategory>();

  for (const p of detected) {
    p.risks.forEach((r) => allRisks.add(r));
    allCategories.add(p.category);
  }

  return {
    protocols: detected,
    risks: Array.from(allRisks),
    isAggregatedSwap: detected.some((p) => p.isAggregator),
    names: detected
      .filter((p) => p.category !== "system" && p.category !== "compute-budget" && p.category !== "token")
      .map((p) => p.name),
    categories: Array.from(allCategories),
  };
}

/**
 * Look up a single protocol by program ID.
 */
export function lookupProtocol(programId: string): ProtocolInfo | undefined {
  return PROTOCOL_MAP.get(programId);
}

/**
 * Extract account keys from a transaction object (handles both legacy and versioned).
 */
export function extractAccountKeys(
  tx: { message: { staticAccountKeys?: unknown[]; accountKeys?: unknown[] } }
): string[] {
  const msg = tx.message as Record<string, unknown>;
  const keys = (msg["staticAccountKeys"] ?? msg["accountKeys"] ?? []) as Array<{ toBase58(): string } | string>;
  return keys.map((k) => (typeof k === "string" ? k : k.toBase58()));
}

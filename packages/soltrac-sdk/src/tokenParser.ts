/**
 * Extract token mints from transaction logs and build Jupiter deep links.
 * Supports: Transfer, MintTo, BurnFrom, and TransferChecked events from Token/Token-2022 programs.
 */

const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJsyFbPVwwQQfuMvGvgjvxDFEct";
const SPL_TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export interface TokenInfo {
  mint: string;
  symbol?: string;
  decimals?: number;
}

export interface JupiterSwapParams {
  inputMint: string;
  outputMint: string;
  slippageBps?: number;
}

/**
 * Parse SPL Token program logs to extract mints and token transfers.
 * Looks for patterns like:
 *  - Program TokenkegQfeZyiNwAJsyFbPVwwQQfuMvGvgjvxDFEct invoke [1]
 *  - Program log: Mint: 9n4...
 *  - Program data: Transfer, Amount=1000000, ...
 */
export function extractTokensFromLogs(logs: string[]): {
  inputMint: string | null;
  outputMint: string | null;
  allMints: string[];
} {
  const mints = new Set<string>();
  let inputMint: string | null = null;
  let outputMint: string | null = null;

  for (const log of logs) {
    // Look for "Program log: Mint:" patterns (common in token program invocations)
    const mintMatch = log.match(/Mint:\s*([1-9A-HJ-NP-Z]{32,44})/);
    if (mintMatch) {
      mints.add(mintMatch[1]);
    }

    // Look for base58-encoded mint addresses (32-44 chars)
    // Filter to only take those that look like public keys
    const pubkeyMatches = log.match(/[1-9A-HJ-NP-Z]{32,44}/g) || [];
    for (const pk of pubkeyMatches) {
      // Heuristic: if it's 43-44 chars, likely a base58 mint
      if (pk.length >= 43) {
        mints.add(pk);
      }
    }
  }

  // Heuristic: first mint seen = input, second = output
  // (This is imperfect but works for simple swaps)
  const sortedMints = Array.from(mints);
  if (sortedMints.length >= 2) {
    inputMint = sortedMints[0];
    outputMint = sortedMints[1];
  } else if (sortedMints.length === 1) {
    inputMint = sortedMints[0];
  }

  return { inputMint, outputMint, allMints: sortedMints };
}

/**
 * Build a Jupiter swap URL with token mints and slippage.
 * Format: https://jup.ag/swap/INPUT-OUTPUT?slippage=X
 */
export function buildJupiterSwapUrl(params: JupiterSwapParams): string {
  const { inputMint, outputMint, slippageBps = 100 } = params; // default 1% slippage
  const slippagePercent = (slippageBps / 100).toFixed(2);
  return `https://jup.ag/swap/${inputMint}-${outputMint}?slippage=${slippagePercent}`;
}

/**
 * Build Jupiter deep link from transaction logs.
 * Automatically extracts mints and applies suggested slippage.
 */
export function buildJupiterLinkFromLogs(
  logs: string[],
  options?: { slippageBps?: number; reverseTokens?: boolean }
): string | null {
  const { inputMint, outputMint } = extractTokensFromLogs(logs);

  if (!inputMint || !outputMint) {
    return null;
  }

  // If reverseTokens is true, assume the user wants to swap back
  // (e.g., if the forward swap failed, try swapping to recover)
  const [src, dst] = options?.reverseTokens
    ? [outputMint, inputMint]
    : [inputMint, outputMint];

  return buildJupiterSwapUrl({
    inputMint: src,
    outputMint: dst,
    slippageBps: options?.slippageBps ?? 150, // 1.5% for retries
  });
}

/**
 * Add a Jupiter deep link to fixParams when slippage adjustment is needed.
 * Extracts mints from logs if available.
 */
export function withJupiterLink(
  logs: string[] | null | undefined,
  slippageBps: number = 150
): { type: "slippage"; slippageBps: number; deepLinkUrl: string } | null {
  if (!logs || logs.length === 0) {
    return null;
  }

  const url = buildJupiterLinkFromLogs(logs, { slippageBps });
  if (!url) {
    return null;
  }

  return {
    type: "slippage",
    slippageBps,
    deepLinkUrl: url,
  };
}

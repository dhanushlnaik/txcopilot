// server-only removed — SDK is environment-agnostic
import type {
  ConfirmedSignatureInfo,
  RpcResponseAndContext,
  SimulatedTransactionResponse,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { Connection, PublicKey } from "@solana/web3.js";

const DEFAULT_RPC =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

function makeConnection(rpcUrl?: string): Connection {
  return new Connection(rpcUrl ?? DEFAULT_RPC, { commitment: "confirmed" });
}

/**
 * Validate a Solana transaction signature format (base58, 86–88 chars).
 */
export function isValidSignature(signature: string): boolean {
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{86,88}$/;
  return base58Regex.test(signature);
}

/**
 * Fetch a confirmed transaction by signature.
 */
export async function getTransaction(
  signature: string,
  options?: { rpcUrl?: string }
) {
  return makeConnection(options?.rpcUrl).getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
}

/**
 * Simulate a transaction and return the raw RPC response.
 * Pass the result directly to analyzeSimulation().
 */
export async function simulateTransaction(
  tx: Transaction | VersionedTransaction,
  options?: { rpcUrl?: string; commitment?: string }
): Promise<RpcResponseAndContext<SimulatedTransactionResponse>> {
  return makeConnection(options?.rpcUrl).simulateTransaction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx as any,
    {
      sigVerify: false,
      replaceRecentBlockhash: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      commitment: (options?.commitment ?? "confirmed") as any,
    }
  );
}

/**
 * Fetch recent signatures for a wallet address.
 */
export async function getRecentSignatures(
  walletAddress: string,
  options?: { rpcUrl?: string; limit?: number }
): Promise<ConfirmedSignatureInfo[]> {
  const pubkey = new PublicKey(walletAddress);
  return makeConnection(options?.rpcUrl).getSignaturesForAddress(pubkey, {
    limit: options?.limit ?? 20,
  });
}

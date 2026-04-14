import "server-only";
import type { ConfirmedSignatureInfo } from "@solana/web3.js";
import { Connection, PublicKey } from "@solana/web3.js";

// ===========================
// Solana RPC + Helius helpers
// ===========================

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "";
const HELIUS_RPC_URL =
  process.env.HELIUS_RPC_URL ||
  `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// Use Helius RPC if available, otherwise fallback to public
const rpcUrl = HELIUS_API_KEY ? HELIUS_RPC_URL : SOLANA_RPC_URL;

let connectionInstance: Connection | null = null;

function getConnection(): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(rpcUrl, {
      commitment: "confirmed",
    });
  }
  return connectionInstance;
}

/**
 * Validate a Solana transaction signature format
 */
export function isValidSignature(signature: string): boolean {
  // Base58 characters: 1-9, A-H, J-N, P-Z, a-k, m-z
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{86,88}$/;
  return base58Regex.test(signature);
}

/**
 * Fetch raw transaction details from Solana RPC
 */
export async function getTransactionDetails(signature: string) {
  const connection = getConnection();

  try {
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    return tx;
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return null;
  }
}

/**
 * Fetch enhanced parsed transaction from Helius API
 * Falls back to null if Helius key is not configured
 */
export async function getEnhancedTransaction(
  signature: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  if (!HELIUS_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: [signature] }),
      }
    );

    if (!response.ok) {
      console.error("Helius API error:", response.status);
      return null;
    }

    const data = await response.json();
    return data?.[0] || null;
  } catch (error) {
    console.error("Error fetching enhanced transaction:", error);
    return null;
  }
}

/**
 * Get network performance / congestion data
 */
export async function getNetworkStatus() {
  const connection = getConnection();

  try {
    const [perfSamples, recentFees] = await Promise.allSettled([
      connection.getRecentPerformanceSamples(15),
      connection.getRecentPrioritizationFees(),
    ]);

    // Calculate average TPS from performance samples
    let avgTps = 0;
    if (perfSamples.status === "fulfilled" && perfSamples.value.length > 0) {
      const totalTps = perfSamples.value.reduce((sum, sample) => {
        return sum + sample.numTransactions / Math.max(sample.samplePeriodSecs, 1);
      }, 0);
      avgTps = Math.round(totalTps / perfSamples.value.length);
    }

    // Calculate median & recommended priority fee
    let medianFee = 0;
    let recommendedFee = 0;
    if (recentFees.status === "fulfilled" && recentFees.value.length > 0) {
      const fees = recentFees.value
        .map((f) => f.prioritizationFee)
        .filter((f) => f > 0)
        .sort((a, b) => a - b);

      if (fees.length > 0) {
        medianFee = fees[Math.floor(fees.length / 2)];
        // Recommend 75th percentile for good landing rate
        recommendedFee = fees[Math.floor(fees.length * 0.75)];
      }
    }

    // Determine congestion level
    let congestionLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (avgTps > 3000) {
      congestionLevel = "HIGH";
    } else if (avgTps > 2000) {
      congestionLevel = "MEDIUM";
    }

    let statusMessage = "Network is healthy";
    if (congestionLevel === "HIGH") {
      statusMessage = "Network is congested — consider higher priority fees";
    } else if (congestionLevel === "MEDIUM") {
      statusMessage = "Moderate network activity — transactions may take longer";
    }

    return {
      congestionLevel,
      avgTps,
      recommendedFee,
      medianFee,
      statusMessage,
    };
  } catch (error) {
    console.error("Error fetching network status:", error);
    return {
      congestionLevel: "LOW" as const,
      avgTps: 0,
      recommendedFee: 0,
      medianFee: 0,
      statusMessage: "Unable to fetch network status",
    };
  }
}

/**
 * Get account balance for a public key
 */
export async function getAccountBalance(
  address: string
): Promise<number | null> {
  const connection = getConnection();
  try {
    const pubkey = new PublicKey(address);
    const balance = await connection.getBalance(pubkey);
    return balance / 1e9; // Convert lamports to SOL
  } catch {
    return null;
  }
}

/**
 * Fetch recent signatures for a wallet address.
 */
export async function getRecentSignaturesForAddress(
  walletAddress: string,
  limit = 20
): Promise<ConfirmedSignatureInfo[]> {
  const connection = getConnection();
  const pubkey = new PublicKey(walletAddress);

  return connection.getSignaturesForAddress(pubkey, {
    limit,
  });
}

/**
 * Simulate a raw transaction (base64 encoded) without submitting it.
 * Returns a result shaped similarly to getTransaction so the analyzer can process it.
 */
export async function simulateRawTransaction(base64Tx: string) {
  const connection = getConnection();

  try {
    const txBuffer = Buffer.from(base64Tx, "base64");

    // Try versioned transaction first, fall back to legacy
    let transaction;
    try {
      const { VersionedTransaction } = await import("@solana/web3.js");
      transaction = VersionedTransaction.deserialize(txBuffer);
    } catch {
      const { Transaction } = await import("@solana/web3.js");
      transaction = Transaction.from(txBuffer);
    }

    const simulation = await connection.simulateTransaction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transaction as any,
      {
        sigVerify: false,
        replaceRecentBlockhash: true,
        commitment: "confirmed",
      }
    );

    const result = simulation.value;

    // Shape the result like a raw transaction for the analyzer
    return {
      simulated: true,
      success: result.err === null,
      meta: {
        err: result.err,
        fee: 5000, // Default base fee estimate
        logMessages: result.logs || [],
        computeUnitsConsumed: result.unitsConsumed || 0,
      },
      // We don't have a real slot/blockTime for simulated txs
      slot: null,
      blockTime: null,
      transaction: {
        message: {
          // Extract account keys from the transaction if possible
          accountKeys: [],
          instructions: [],
          header: { numRequiredSignatures: 1 },
        },
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown simulation error";
    return {
      simulated: true,
      success: false,
      error: errorMessage,
      meta: {
        err: { SimulationFailed: errorMessage },
        fee: 0,
        logMessages: [`Simulation error: ${errorMessage}`],
        computeUnitsConsumed: 0,
      },
      slot: null,
      blockTime: null,
      transaction: {
        message: {
          accountKeys: [],
          instructions: [],
          header: { numRequiredSignatures: 1 },
        },
      },
    };
  }
}

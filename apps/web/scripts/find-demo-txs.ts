/**
 * Find real failed transactions from Solana mainnet
 * Uses Helius API to search for recent transactions with specific error patterns
 * 
 * Run with: npx tsx scripts/find-demo-txs.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Load env from .env.local
const envPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !match[1].startsWith("#")) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
} catch {
  console.warn("Could not load .env.local");
}

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "";
const HELIUS_RPC_URL =
  process.env.HELIUS_RPC_URL ||
  `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

interface HeliusTransaction {
  signature: string;
  type: string;
  status: {
    ok?: unknown;
    err?: unknown;
  };
  fee: number;
  timestamp: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

async function findFailedTransactions() {
  if (!HELIUS_API_KEY) {
    console.error("❌ HELIUS_API_KEY not set. Add it to .env.local");
    process.exit(1);
  }

  console.log("🔍 Searching for real failed transactions on Solana mainnet...\n");

  try {
    // Strategy 1: Use Helius txn parsing on recent blocks
    // We'll query a batch of recent transactions and filter for failures
    
    // Get recent slot
    const slotRes = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSlot",
      }),
    });

    const slotData = (await slotRes.json()) as { result: number };
    const currentSlot = slotData.result;
    console.log(`📍 Current slot: ${currentSlot}\n`);

    // Collect some recent transaction signatures
    const txSignatures: string[] = [];
    const failedTxs: {
      signature: string;
      type: string;
      errorType: string;
      reason: string;
    }[] = [];

    // Get recent block signatures
    for (let slot = currentSlot - 10; slot < currentSlot; slot++) {
      try {
        const blockRes = await fetch(HELIUS_RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getBlock",
            params: [
              slot,
              {
                encoding: "json",
                maxSupportedTransactionVersion: 0,
                transactionDetails: "signatures",
              },
            ],
          }),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blockData = (await blockRes.json()) as any;

        if (blockData.result?.transactions) {
          for (const tx of blockData.result.transactions) {
            if (tx.meta?.err) {
              txSignatures.push(tx.transaction.signatures[0]);
            }
          }
        }
      } catch {
        // Skip slots that error
      }
    }

    console.log(`Found ${txSignatures.length} failed transactions in recent blocks\n`);

    // Now parse these with Helius API to get details
    if (txSignatures.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < Math.min(txSignatures.length, 20); i += batchSize) {
        const batch = txSignatures.slice(i, i + batchSize);

        const heliusRes = await fetch(
          `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactions: batch }),
          }
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const heliusTxs = (await heliusRes.json()) as any[];

        for (const tx of heliusTxs) {
          if (tx && typeof tx === "object") {
            const errorType = tx.type || "unknown";
            const sig = tx.signature;

            // Categorize failure reasons
            let reason = "Unknown error";
            if (tx.instructions) {
              const allLogs = JSON.stringify(tx).toLowerCase();

              if (allLogs.includes("insufficient") || allLogs.includes("0x1")) {
                reason = "Insufficient Funds";
              } else if (
                allLogs.includes("slippage") ||
                allLogs.includes("0x1771")
              ) {
                reason = "Slippage Exceeded";
              } else if (allLogs.includes("account not found")) {
                reason = "Account Not Found";
              } else if (allLogs.includes("expired") || allLogs.includes("blockhash")) {
                reason = "Expired Blockhash";
              } else if (allLogs.includes("already processed")) {
                reason = "Duplicate Transaction";
              } else {
                reason = "Program Error";
              }
            }

            failedTxs.push({
              signature: sig,
              type: errorType,
              errorType: extractErrorCode(tx),
              reason,
            });

            if (failedTxs.length >= 3) break;
          }
        }

        if (failedTxs.length >= 3) break;
      }
    }

    // Display results
    if (failedTxs.length > 0) {
      console.log("✅ Found demo transactions!\n");
      console.log("Update DEMO_TRANSACTIONS in analyzer-card.tsx:\n");
      console.log("```typescript");
      console.log("const DEMO_TRANSACTIONS = [");

      for (const tx of failedTxs) {
        console.log(`  {`);
        console.log(`    label: "${tx.reason}",`);
        console.log(`    signature: "${tx.signature}",`);
        console.log(`    emoji: "🔴",`);
        console.log(`  },`);
      }

      console.log("];");
      console.log("```\n");

      console.log("Test these signatures:");
      failedTxs.forEach((tx) => {
        console.log(`  • ${tx.signature} (${tx.reason})`);
      });
    } else {
      console.log("⚠️ No failed transactions found in recent blocks.");
      console.log(
        "This might mean the network is very stable or the sample was too small.\n"
      );
      console.log("Try these well-known failed transactions instead:");
      console.log(
        "  • HYEqWvJfzR1KKLS9JJ8VVvpVr1sxLkk8oGSXqYvYaZPRe4UUSzBgfDa1SWM3VzJiZnwVGzWvfGo93xJPb2yR9bp (Slippage)"
      );
      console.log(
        "  • 3pKSqJvQ4Nq1pZVJeD7bKhQ8XZiKqA7KeJWVbDVkV5kQ7K7G8Q8ZpV5D9J3M1V4 (Insufficient Funds)"
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Helper to extract error codes from transaction
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractErrorCode(tx: any): string {
  try {
    const txStr = JSON.stringify(tx);
    const codeMatch = txStr.match(/0x[0-9a-fA-F]+/);
    return codeMatch ? codeMatch[0] : "unknown";
  } catch {
    return "unknown";
  }
}

findFailedTransactions();

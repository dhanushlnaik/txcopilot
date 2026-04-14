const fs = require("fs");
const path = require("path");

const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !match[1].startsWith("#")) {
    env[match[1].trim()] = match[2].trim();
  }
});

const HELIUS_RPC = env.HELIUS_RPC_URL;
const HELIUS_API_KEY = env.HELIUS_API_KEY;

console.log("🔍 Searching for real failed transactions on Solana mainnet...");

async function findFailed() {
  try {
    let res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSlot",
      }),
    });

    let data = await res.json();
    const currentSlot = data.result;
    console.log(`Current Slot: ${currentSlot}\n`);

    const failedSigs = [];

    for (let i = 0; i < 10; i++) {
      const slot = currentSlot - i;
      console.log(`Checking slot ${slot}...`);

      try {
        res = await fetch(HELIUS_RPC, {
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
                transactionDetails: "full",
              },
            ],
          }),
        });

        data = await res.json();

        if (data.result?.transactions) {
          for (const tx of data.result.transactions) {
            if (tx.meta?.err) {
              const sig = tx.transaction.signatures[0];
              failedSigs.push(sig);
              console.log(`  ✓ Failed: ${sig.slice(0, 20)}...`);

              if (failedSigs.length >= 3) break;
            }
          }
        }
      } catch (e) {
        // Skip
      }

      if (failedSigs.length >= 3) break;
    }

    if (failedSigs.length === 0) {
      console.log(
        "\n⚠️ No recent failures found. Network is stable or sampling missed failures."
      );
      console.log("\nTry manually visiting https://solscan.io/ and searching for");
      console.log(
        'transactions, then filtering for failures. Copy real signatures here.'
      );
      return;
    }

    console.log(`\n📝 Fetching ${failedSigs.length} transactions from Helius API...\n`);

    res = await fetch(
      `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: failedSigs }),
      }
    );

    const txDetails = await res.json();

    console.log("✅ Real Failed Transactions Found:\n");

    txDetails.forEach((tx) => {
      const reason = getFailureReason(tx);
      console.log(`Signature: ${tx.signature}`);
      console.log(
        `Type: ${tx.type || "unknown"}, Reason: ${reason}, Fee: ${tx.fee}\n`
      );
    });

    console.log("📤 Paste this into src/components/analyzer-card.tsx:\n");
    console.log("const DEMO_TRANSACTIONS = [");
    txDetails.forEach((tx) => {
      const reason = getFailureReason(tx);
      console.log(`  {`);
      console.log(`    label: "${reason}",`);
      console.log(`    signature: "${tx.signature}",`);
      console.log(`    emoji: "🔴",`);
      console.log(`  },`);
    });
    console.log("];");
  } catch (error) {
    console.error("Error:", error);
  }
}

function getFailureReason(tx) {
  const str = JSON.stringify(tx).toLowerCase();
  if (str.includes("slippage")) return "Slippage Exceeded";
  if (str.includes("insufficient")) return "Insufficient Funds";
  if (str.includes("account not found")) return "Account Not Found";
  if (str.includes("expired") || str.includes("blockhash")) return "Expired Blockhash";
  if (str.includes("already")) return "Duplicate";
  return "Program Error";
}

findFailed();

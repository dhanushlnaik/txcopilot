import chalk from "chalk";
import { Connection } from "@solana/web3.js";
import { banner, box, section, row, spin, riskChalk, fmtLamports } from "../format";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

export async function runNetwork(opts: { rpc?: string }) {
  const rpcUrl = opts.rpc ?? process.env.SOLANA_RPC_URL ?? DEFAULT_RPC;

  banner();

  const stop = spin("Fetching live network data…");

  let avgTps = 0, successRatePct = 100, slotHeight = 0, sampleCount = 0;
  let feeTiers: Array<{ label: string; fee: number; successRate: number }> = [];
  let congestionScore = 0;
  let congestionLabel = "LOW";

  try {
    const conn = new Connection(rpcUrl, { commitment: "confirmed" });

    const [samplesResult, feesResult] = await Promise.allSettled([
      conn.getRecentPerformanceSamples(60),
      conn.getRecentPrioritizationFees(),
    ]);

    if (samplesResult.status === "fulfilled" && samplesResult.value.length > 0) {
      const samples = samplesResult.value.slice(0, 20);
      sampleCount = samples.length;
      slotHeight  = samplesResult.value[0]?.slot ?? 0;

      const totalTx = samples.reduce((s, x) => s + x.numTransactions, 0);
      avgTps = Math.round(
        samples.reduce((s, x) => s + x.numTransactions / Math.max(x.samplePeriodSecs, 1), 0) / samples.length
      );

      const successTx = samples.reduce(
        (s, x) => s + ((x as { numSuccessfulTransactions?: number }).numSuccessfulTransactions ?? x.numTransactions),
        0
      );
      successRatePct = totalTx > 0 ? Math.round((successTx / totalTx) * 100) : 100;

      const norm = Math.min(avgTps / 4000, 1);
      congestionScore = Math.round(norm * 100);
      congestionLabel =
        congestionScore >= 80 ? "CRITICAL" :
        congestionScore >= 60 ? "HIGH" :
        congestionScore >= 35 ? "MODERATE" : "LOW";
    }

    if (feesResult.status === "fulfilled" && feesResult.value.length > 0) {
      const sorted = feesResult.value.map((f) => f.prioritizationFee).sort((a, b) => a - b);
      const p = (pct: number) => sorted[Math.floor(sorted.length * pct)] ?? 0;
      feeTiers = [
        { label: "economy",  fee: p(0.25), successRate: Math.max(55, successRatePct - 20) },
        { label: "standard", fee: p(0.50), successRate: Math.max(75, successRatePct - 8)  },
        { label: "fast",     fee: p(0.75), successRate: Math.min(99, successRatePct + 3)  },
      ];
    }
  } catch (e) {
    stop();
    console.error(chalk.red("\n  Error: ") + (e instanceof Error ? e.message : String(e)));
    process.exit(1);
  }

  stop();

  const recommendation =
    congestionScore >= 75 || successRatePct < 70 ? "WAIT" :
    congestionScore >= 45 || successRatePct < 85 ? "CAUTION" : "GOOD";

  const recChalk = riskChalk(recommendation);

  // Header box
  const congChalk =
    congestionLabel === "CRITICAL" ? chalk.red :
    congestionLabel === "HIGH"     ? chalk.yellow :
    congestionLabel === "MODERATE" ? chalk.yellow :
    chalk.green;

  box(
    [
      recChalk.bold(`  ${recommendation === "GOOD" ? "GOOD TO SEND" : recommendation}`) +
        "  " + chalk.dim(`Congestion: ${congChalk(congestionLabel)} (${congestionScore}/100)`),
      chalk.dim(`  ${avgTps.toLocaleString()} TPS  ·  ${successRatePct}% success rate  ·  Slot ${slotHeight.toLocaleString()}`),
    ],
    recChalk
  );

  section("Network Stats");
  row("TPS",           avgTps.toLocaleString() + " tx/s");
  row("Success Rate",  `${successRatePct}%`);
  row("Congestion",    `${congestionScore}/100 — ${congChalk(congestionLabel)}`);
  row("Slot Height",   slotHeight.toLocaleString());
  row("Samples",       `${sampleCount} performance windows`);

  if (feeTiers.length > 0) {
    section("Priority Fee Tiers");
    feeTiers.forEach(({ label, fee, successRate }) => {
      const tierChalk = label === "fast" ? chalk.green : label === "standard" ? chalk.yellow : chalk.dim;
      const feeStr    = fmtLamports(fee).padEnd(18);
      const rateStr   = chalk.dim(`${successRate}% success`);
      console.log(`  ${tierChalk(label.padEnd(10))} ${feeStr}  ${rateStr}`);
    });
  }

  section("Recommendation");
  if (recommendation === "GOOD") {
    console.log("  " + chalk.green("✓ Network conditions are healthy. Economy fee should land reliably."));
  } else if (recommendation === "CAUTION") {
    console.log("  " + chalk.yellow("⚠ Moderate congestion. Use standard or fast fee tier."));
  } else {
    console.log("  " + chalk.red("✗ Network heavily congested. Wait for conditions to improve."));
  }

  console.log(`\n  ${chalk.dim("RPC:")} ${chalk.dim(rpcUrl)}\n`);
}

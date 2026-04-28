import "server-only";
import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

const RPC_URL =
  process.env.HELIUS_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export async function GET() {
  try {
    const connection = new Connection(RPC_URL, { commitment: "confirmed" });

    const [samplesResult, feesResult] = await Promise.allSettled([
      connection.getRecentPerformanceSamples(60),
      connection.getRecentPrioritizationFees(),
    ]);

    if (samplesResult.status === "rejected") {
      throw new Error(`Performance samples failed: ${samplesResult.reason}`);
    }

    const samples = samplesResult.value;
    const recent = samples.slice(0, 20);

    const totalTx = recent.reduce((s, x) => s + x.numTransactions, 0);
    const avgTps = Math.round(
      recent.reduce((s, x) => s + x.numTransactions / Math.max(x.samplePeriodSecs, 1), 0) / recent.length
    );

    // numSuccessfulTransactions added in newer RPC versions — fallback to total
    const successTx = recent.reduce(
      (s, x) => s + ((x as { numSuccessfulTransactions?: number }).numSuccessfulTransactions ?? x.numTransactions),
      0
    );
    const successRatePct = totalTx > 0 ? Math.round((successTx / totalTx) * 100) : 100;
    const slotHeight = samples[0]?.slot ?? 0;

    // Congestion: map TPS against practical max (~4 000 TPS sustained)
    const normalized = Math.min(avgTps / 4000, 1);
    const congestionScore = Math.round(normalized * 100);
    const congestionLabel =
      congestionScore >= 80 ? "CRITICAL" :
      congestionScore >= 60 ? "HIGH" :
      congestionScore >= 35 ? "MODERATE" : "LOW";

    // Priority fee tiers from live network data
    const fees =
      feesResult.status === "fulfilled"
        ? feesResult.value.map((f) => f.prioritizationFee).sort((a, b) => a - b)
        : [];

    const p = (pct: number) =>
      fees.length > 0 ? (fees[Math.floor(fees.length * pct)] ?? 0) : 0;

    const feeTiers = [
      { label: "economy" as const,  priorityFeeMicroLamports: p(0.25), estimatedSuccessRatePct: Math.max(55, successRatePct - 20) },
      { label: "standard" as const, priorityFeeMicroLamports: p(0.50), estimatedSuccessRatePct: Math.max(75, successRatePct - 8)  },
      { label: "fast" as const,     priorityFeeMicroLamports: p(0.75), estimatedSuccessRatePct: Math.min(99, successRatePct + 3)  },
    ];

    const recommendation =
      congestionScore >= 75 || successRatePct < 70 ? "WAIT" :
      congestionScore >= 45 || successRatePct < 85 ? "CAUTION" : "GOOD";

    const recommendationReason =
      recommendation === "WAIT"
        ? `Network heavily congested (${congestionScore}/100) — success rate ${successRatePct}%. Wait for congestion to clear or use fast tier.`
        : recommendation === "CAUTION"
          ? `Moderate congestion detected (${congestionScore}/100). Use standard or fast fee tier for reliable landing.`
          : `Network conditions are healthy (${congestionScore}/100, ${successRatePct}% success). Economy fee tier should land reliably.`;

    return NextResponse.json({
      success: true,
      data: {
        tps: avgTps,
        successRatePct,
        congestionScore,
        congestionLabel,
        feeTiers,
        slotHeight,
        sampleCount: recent.length,
        recommendation,
        recommendationReason,
        fetchedAt: Date.now(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

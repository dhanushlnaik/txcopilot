import { NextResponse } from "next/server";
import { simulateRawTransaction, getNetworkStatus } from "@/lib/solana";
import { analyzeTransaction } from "@/lib/analyzer";

/**
 * POST /api/simulate
 * Accepts a base64-encoded transaction, simulates it on-chain,
 * and returns the analysis result — predicting if it will fail
 * before the user sends it.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transaction } = body;

    if (!transaction || typeof transaction !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing 'transaction' field. Provide a base64-encoded transaction.",
        },
        { status: 400 }
      );
    }

    // Basic base64 validation
    try {
      const buf = Buffer.from(transaction, "base64");
      if (buf.length < 10) {
        throw new Error("Too short");
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid transaction format. Provide a valid base64-encoded Solana transaction.",
        },
        { status: 400 }
      );
    }

    // Run simulation + fetch network status in parallel
    const [simResult, networkStatus] = await Promise.all([
      simulateRawTransaction(transaction),
      getNetworkStatus(),
    ]);

    // Pipe the simulated result through the analyzer engine
    const analysis = analyzeTransaction(
      simResult, // shaped like a raw tx
      null, // no enhanced tx for simulations
      "simulation", // placeholder signature
      networkStatus
    );

    // Add simulation-specific metadata
    return NextResponse.json({
      success: true,
      mode: "simulation",
      data: {
        ...analysis,
        simulation: {
          wouldSucceed: simResult.success,
          computeUnitsUsed: simResult.meta?.computeUnitsConsumed || 0,
          logsCount: simResult.meta?.logMessages?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error("Simulation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to simulate transaction. Please try again.",
      },
      { status: 500 }
    );
  }
}

import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { preflight, explain, explainFromSimulation, isValidSignature } from "soltrac-sdk";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { input?: string };
    const input = (body.input ?? "").trim();

    if (!input) {
      return NextResponse.json({ success: false, error: "No input provided" }, { status: 400 });
    }

    const rpcUrl = process.env.SOLANA_RPC_URL;

    // ── Route by input type ─────────────────────────────────────────────────
    if (isValidSignature(input)) {
      // Post-mortem on a confirmed transaction
      const [explanation, simResult] = await Promise.all([
        explain(input, {
          rpcUrl,
          enableAI: !!process.env.GEMINI_API_KEY,
          geminiApiKey: process.env.GEMINI_API_KEY,
        }),
        // Re-use explain's fetch — we'll derive simResult from explanation
        Promise.resolve(null),
      ]);

      return NextResponse.json({
        success: true,
        inputType: "signature",
        explanation,
        preflight: null,
      });
    }

    // Assume base64-encoded unsigned transaction
    try {
      const result = await preflight(input, { rpcUrl });

      // Derive explanation synchronously from the simulation data
      const accountKeys = result.protocols.protocols.map((p) => p.programId);
      const explanation = explainFromSimulation({
        err: result.simulation.optimistic.err ?? result.simulation.baseline.err,
        logs: result.simulation.optimistic.logs,
        accountKeys,
      });

      return NextResponse.json({
        success: true,
        inputType: "transaction",
        explanation,
        preflight: {
          risk: result.risk,
          recommendation: result.recommendation,
          riskScore: result.riskScore,
          simulation: result.simulation,
          protocols: result.protocols,
          taxonomyMatch: result.taxonomyMatch,
        },
      });
    } catch (preflightErr) {
      const msg = preflightErr instanceof Error ? preflightErr.message : "Simulation failed";
      return NextResponse.json({ success: false, error: msg }, { status: 422 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

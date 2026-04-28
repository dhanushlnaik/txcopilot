import { NextResponse } from "next/server";
import {
  isValidSignature,
  getTransactionDetails,
  getEnhancedTransaction,
  getNetworkStatus,
} from "@/lib/solana";
import { analyzeTransaction } from "@/lib/analyzer";

type AnalyzeResponse =
  | { success: true; data: ReturnType<typeof analyzeTransaction> }
  | { success: false; error: string };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signature } = body;

    if (!signature || typeof signature !== "string") {
      return NextResponse.json<AnalyzeResponse>(
        { success: false, error: "Transaction signature is required" },
        { status: 400 }
      );
    }

    const trimmedSig = signature.trim();

    if (!isValidSignature(trimmedSig)) {
      return NextResponse.json<AnalyzeResponse>(
        {
          success: false,
          error:
            "Invalid transaction signature format. Expected a base58 string (86–88 characters).",
        },
        { status: 400 }
      );
    }

    // Fetch transaction data and network status in parallel
    const [rawTx, enhancedTx, networkStatus] = await Promise.all([
      getTransactionDetails(trimmedSig),
      getEnhancedTransaction(trimmedSig),
      getNetworkStatus(),
    ]);

    // Run analyzer
    const result = analyzeTransaction(
      rawTx,
      enhancedTx,
      trimmedSig,
      networkStatus
    );

    return NextResponse.json<AnalyzeResponse>({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json<AnalyzeResponse>(
      {
        success: false,
        error: "An error occurred while analyzing the transaction. Please try again.",
      },
      { status: 500 }
    );
  }
}

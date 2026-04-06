import { NextResponse } from "next/server";
import { getNetworkStatus } from "@/lib/solana";
import type { NetworkResponse } from "@/lib/types";

export async function GET() {
  try {
    const status = await getNetworkStatus();

    return NextResponse.json<NetworkResponse>({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("Network status error:", error);
    return NextResponse.json<NetworkResponse>(
      {
        success: false,
        error: "Failed to fetch network status",
      },
      { status: 500 }
    );
  }
}

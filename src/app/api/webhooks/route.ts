import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import {
  createWebhookSubscription,
  listWebhookSubscriptions,
} from "@/lib/webhook-store";
import { requireWebhookAdmin } from "@/lib/webhook-auth";
import type { WebhookEvent } from "@/lib/types";

const ALLOWED_EVENTS: WebhookEvent[] = ["failed", "high_risk"];

function isWebhookEvent(value: unknown): value is WebhookEvent {
  return (
    typeof value === "string" &&
    ALLOWED_EVENTS.includes(value as WebhookEvent)
  );
}

function isValidWalletAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

function isValidWebhookUrl(webhookUrl: string): boolean {
  try {
    const parsed = new URL(webhookUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const unauthorized = requireWebhookAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json({
    success: true,
    data: listWebhookSubscriptions(),
  });
}

export async function POST(request: Request) {
  const unauthorized = requireWebhookAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = await request.json();
    const walletAddress = String(body?.walletAddress ?? "").trim();
    const webhookUrl = String(body?.webhookUrl ?? "").trim();
    const events = Array.isArray(body?.events)
      ? (body.events as unknown[]).filter(isWebhookEvent)
      : [];

    if (!walletAddress || !isValidWalletAddress(walletAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Solana wallet address.",
        },
        { status: 400 }
      );
    }

    if (!webhookUrl || !isValidWebhookUrl(webhookUrl)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid webhook URL. Use an http(s) URL.",
        },
        { status: 400 }
      );
    }

    if (events.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Select at least one event type.",
        },
        { status: 400 }
      );
    }

    const subscription = createWebhookSubscription({
      walletAddress,
      webhookUrl,
      events,
    });

    return NextResponse.json(
      {
        success: true,
        data: subscription,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create webhook error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create webhook subscription.",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { analyzeTransaction } from "@/lib/analyzer";
import {
  hasSeenSignature,
  listWebhookSubscriptions,
  markSignatureAsSeen,
  updateWebhookLastChecked,
} from "@/lib/webhook-store";
import {
  getEnhancedTransaction,
  getNetworkStatus,
  getRecentSignaturesForAddress,
  getTransactionDetails,
} from "@/lib/solana";
import type { WebhookAlertPayload, WebhookEvent } from "@/lib/types";
import { requireWebhookAdmin } from "@/lib/webhook-auth";

const DELIVERY_TIMEOUT_MS = 8_000;
const DELIVERY_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;

interface DeliveryResult {
  ok: boolean;
  attempts: number;
  status?: number;
  statusText?: string;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDiscordWebhookUrl(webhookUrl: string): boolean {
  try {
    const parsed = new URL(webhookUrl);
    return (
      parsed.hostname === "discord.com" &&
      parsed.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

function buildDiscordPayload(payload: WebhookAlertPayload) {
  const reasons = payload.analysis.reasons
    .slice(0, 3)
    .map((reason) => `• ${reason.label}`)
    .join("\n");

  return {
    content: `SolTrac Alert: ${payload.event}`,
    embeds: [
      {
        title: "Transaction Alert",
        color: payload.analysis.risk === "HIGH" ? 0xff4d4f : 0xfacc15,
        fields: [
          { name: "Wallet", value: payload.wallet, inline: false },
          { name: "Signature", value: payload.signature, inline: false },
          { name: "Risk", value: payload.analysis.risk, inline: true },
          {
            name: "Top Reasons",
            value: reasons || "No reasons detected",
            inline: false,
          },
        ],
        timestamp: payload.timestamp,
      },
    ],
  };
}

async function deliverAlert(
  webhookUrl: string,
  payload: WebhookAlertPayload
): Promise<DeliveryResult> {
  const body = isDiscordWebhookUrl(webhookUrl)
    ? buildDiscordPayload(payload)
    : payload;

  let lastResult: DeliveryResult = { ok: false, attempts: 0 };

  for (let attempt = 1; attempt <= DELIVERY_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return {
          ok: true,
          attempts: attempt,
          status: response.status,
          statusText: response.statusText,
        };
      }

      lastResult = {
        ok: false,
        attempts: attempt,
        status: response.status,
        statusText: response.statusText,
        error: `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
      };

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) {
        return lastResult;
      }
    } catch (error) {
      clearTimeout(timeout);

      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? `Request timed out after ${DELIVERY_TIMEOUT_MS}ms`
            : error.message
          : "Unknown delivery error";

      lastResult = {
        ok: false,
        attempts: attempt,
        error: message,
      };
    }

    if (attempt < DELIVERY_MAX_ATTEMPTS) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  return lastResult;
}

function shouldSendEvent(event: WebhookEvent, hasFailure: boolean, risk: string): boolean {
  if (event === "failed") {
    return hasFailure;
  }

  return risk === "HIGH";
}

function eventName(event: WebhookEvent): WebhookAlertPayload["event"] {
  return event === "failed" ? "transaction_failed" : "transaction_high_risk";
}

export async function POST(request: Request) {
  const unauthorized = requireWebhookAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  let forceTest = false;
  try {
    const body = await request.json();
    forceTest = body?.forceTest === true;
  } catch {
    forceTest = false;
  }

  const subscriptions = listWebhookSubscriptions();
  const nowIso = new Date().toISOString();
  const summary = {
    checked: subscriptions.length,
    alertsSent: 0,
    forceTest,
    errors: [] as string[],
  };

  if (subscriptions.length === 0) {
    return NextResponse.json({
      success: true,
      data: summary,
    });
  }

  const networkStatus = await getNetworkStatus();

  for (const subscription of subscriptions) {
    try {
      if (forceTest) {
        const testAnalysis = analyzeTransaction(
          null,
          null,
          `test-${Date.now()}`,
          networkStatus
        );

        for (const event of subscription.events) {
          const payload: WebhookAlertPayload = {
            event: eventName(event),
            wallet: subscription.walletAddress,
            signature: `test-${Date.now()}`,
            analysis: testAnalysis,
            timestamp: nowIso,
          };

          const delivery = await deliverAlert(subscription.webhookUrl, payload);
          if (!delivery.ok) {
            summary.errors.push(
              `Failed to deliver test alert to ${subscription.webhookUrl} (attempts=${delivery.attempts}${delivery.status ? `, status=${delivery.status}` : ""}${delivery.statusText ? ` ${delivery.statusText}` : ""}${delivery.error ? `, error=${delivery.error}` : ""})`
            );
            continue;
          }

          summary.alertsSent += 1;
        }

        continue;
      }

      const signatureInfos = await getRecentSignaturesForAddress(
        subscription.walletAddress,
        20
      );
      const lastCheckedMs = subscription.lastChecked
        ? Date.parse(subscription.lastChecked)
        : 0;

      const signaturesToAnalyze = signatureInfos.filter((info) => {
        if (!info.blockTime) {
          return true;
        }

        return info.blockTime * 1000 > lastCheckedMs;
      });

      for (const signatureInfo of signaturesToAnalyze) {
        const signature = signatureInfo.signature;

        if (hasSeenSignature(subscription.id, signature)) {
          continue;
        }

        const rawTx = await getTransactionDetails(signature);
        const enhancedTx = await getEnhancedTransaction(signature);
        const analysis = analyzeTransaction(
          rawTx,
          enhancedTx,
          signature,
          networkStatus
        );
        const hasFailure = Boolean(rawTx?.meta?.err);

        for (const event of subscription.events) {
          if (!shouldSendEvent(event, hasFailure, analysis.risk)) {
            continue;
          }

          const payload: WebhookAlertPayload = {
            event: eventName(event),
            wallet: subscription.walletAddress,
            signature,
            analysis,
            timestamp: nowIso,
          };

          const delivery = await deliverAlert(subscription.webhookUrl, payload);
          if (!delivery.ok) {
            summary.errors.push(
              `Failed to deliver alert to ${subscription.webhookUrl} for ${signature} (attempts=${delivery.attempts}${delivery.status ? `, status=${delivery.status}` : ""}${delivery.statusText ? ` ${delivery.statusText}` : ""}${delivery.error ? `, error=${delivery.error}` : ""})`
            );
            continue;
          }

          summary.alertsSent += 1;
        }

        markSignatureAsSeen(subscription.id, signature);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      summary.errors.push(
        `Failed to check wallet ${subscription.walletAddress}: ${message}`
      );
    } finally {
      updateWebhookLastChecked(subscription.id, nowIso);
    }
  }

  return NextResponse.json({
    success: true,
    data: summary,
  });
}

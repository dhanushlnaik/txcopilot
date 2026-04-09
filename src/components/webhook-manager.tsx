"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, FlaskConical, Loader2, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { WebhookEvent, WebhookSubscription } from "@/lib/types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const EVENT_OPTIONS: Array<{ value: WebhookEvent; label: string }> = [
  { value: "failed", label: "Failed Transactions" },
  { value: "high_risk", label: "High Risk Alerts" },
];

function webhookAdminHeader(adminKey: string): HeadersInit {
  if (!adminKey.trim()) {
    return {};
  }

  return {
    "x-soltrac-admin-key": adminKey,
  };
}

export default function WebhookManager() {
  const [walletAddress, setWalletAddress] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["failed"]);
  const [adminKey, setAdminKey] = useState("");
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedEventSet = useMemo(() => new Set(events), [events]);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/webhooks", {
        cache: "no-store",
        headers: {
          ...webhookAdminHeader(adminKey),
        },
      });
      const payload = (await response.json()) as ApiResponse<WebhookSubscription[]>;

      if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Failed to load subscriptions");
      }

      setSubscriptions(payload.data);
    } catch (loadError) {
      const msg =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load subscriptions";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  const toggleEvent = (event: WebhookEvent) => {
    setEvents((current) => {
      if (current.includes(event)) {
        if (current.length === 1) {
          return current;
        }

        return current.filter((item) => item !== event);
      }

      return [...current, event];
    });
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...webhookAdminHeader(adminKey),
        },
        body: JSON.stringify({
          walletAddress,
          webhookUrl,
          events,
        }),
      });

      const payload = (await response.json()) as ApiResponse<WebhookSubscription>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to create subscription");
      }

      setWalletAddress("");
      setWebhookUrl("");
      setEvents(["failed"]);
      setMessage("Webhook subscription saved.");
      await loadSubscriptions();
    } catch (createError) {
      const msg =
        createError instanceof Error
          ? createError.message
          : "Failed to create subscription";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/webhooks/${id}`, {
        method: "DELETE",
        headers: {
          ...webhookAdminHeader(adminKey),
        },
      });
      const payload = (await response.json()) as ApiResponse<null>;

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to delete subscription");
      }

      setMessage("Subscription deleted.");
      await loadSubscriptions();
    } catch (deleteError) {
      const msg =
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete subscription";
      setError(msg);
    }
  };

  const handleRunCheck = async (forceTest = false) => {
    setChecking(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/webhooks/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...webhookAdminHeader(adminKey),
        },
        body: JSON.stringify({ forceTest }),
      });
      const payload = (await response.json()) as ApiResponse<{
        checked: number;
        alertsSent: number;
        forceTest?: boolean;
        errors: string[];
      }>;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "Failed to run webhook check");
      }

      const { checked, alertsSent, errors: deliveryErrors } = payload.data;
      setMessage(
        forceTest
          ? `Test run complete: ${checked} subscriptions scanned, ${alertsSent} test alerts sent.`
          : `Check complete: ${checked} subscriptions scanned, ${alertsSent} alerts sent.`
      );
      if (deliveryErrors.length > 0) {
        setError(deliveryErrors[0]);
      }

      await loadSubscriptions();
    } catch (checkError) {
      const msg =
        checkError instanceof Error
          ? checkError.message
          : "Failed to run webhook check";
      setError(msg);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm">
      <CardHeader className="px-5 pt-5 pb-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Alerts</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor wallets and receive failure or high-risk alerts via webhook.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void handleRunCheck(false);
            }}
            disabled={checking || loading}
            className="bg-[#14F195]/10 text-[#14F195] hover:bg-[#14F195]/20"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span className="ml-2">Run Check</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void handleRunCheck(true);
            }}
            disabled={checking || loading}
            className="bg-[#9945FF]/10 text-[#CFA8FF] hover:bg-[#9945FF]/20"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4" />
            )}
            <span className="ml-2">Send Test</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-5 pb-6 sm:px-6">
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            value={adminKey}
            onChange={(event) => setAdminKey(event.target.value)}
            placeholder="Admin key (if WEBHOOK_ADMIN_KEY is set)"
            type="password"
            className="text-sm"
            disabled={submitting || checking}
          />
          <Input
            value={walletAddress}
            onChange={(event) => setWalletAddress(event.target.value)}
            placeholder="Wallet address"
            className="font-mono text-sm"
            disabled={submitting}
          />
          <Input
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder="https://your-webhook-endpoint.com"
            className="text-sm"
            disabled={submitting}
          />

          <div className="flex flex-wrap gap-2">
            {EVENT_OPTIONS.map((eventOption) => {
              const selected = selectedEventSet.has(eventOption.value);

              return (
                <button
                  key={eventOption.value}
                  type="button"
                  onClick={() => toggleEvent(eventOption.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selected
                      ? "border-[#9945FF]/40 bg-[#9945FF]/15 text-[#E0C7FF]"
                      : "border-border/50 bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {eventOption.label}
                </button>
              );
            })}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[#00FFA3] to-[#14F195] text-[#050816] hover:opacity-90"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="h-4 w-4" />
            )}
            <span className="ml-2">Add Subscription</span>
          </Button>
        </form>

        {message && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-300">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading subscriptions...</div>
          ) : subscriptions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No active subscriptions yet.
            </div>
          ) : (
            subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="rounded-xl border border-border/40 bg-secondary/20 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-mono text-xs text-foreground">
                      {subscription.walletAddress}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {subscription.webhookUrl}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {subscription.events.map((event) => (
                        <Badge
                          key={`${subscription.id}-${event}`}
                          variant="outline"
                          className="border-border/50 bg-background/20 text-[10px]"
                        >
                          {event === "failed" ? "FAILED" : "HIGH RISK"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-red-300"
                    onClick={() => {
                      void handleDelete(subscription.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BellRing,
  ChevronDown,
  FlaskConical,
  KeyRound,
  Loader2,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WebhookEvent, WebhookSubscription } from "@/lib/types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const EVENT_OPTIONS: Array<{ value: WebhookEvent; label: string; description: string }> = [
  { value: "failed", label: "Failed Txs", description: "Alert when a transaction fails" },
  { value: "high_risk", label: "High Risk", description: "Alert when risk score is HIGH" },
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
  const [showAdminKey, setShowAdminKey] = useState(false);
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

      // Don't show auth errors on initial load — user may not need a key
      if (response.status === 401) {
        setSubscriptions([]);
        setLoading(false);
        return;
      }

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
      setMessage("Webhook subscription created.");
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
          ? `Test complete — ${alertsSent} test alerts sent across ${checked} subscriptions.`
          : `Check complete — ${alertsSent} alerts sent across ${checked} subscriptions.`
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
    <Card className="border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
      {/* Header with gradient accent */}
      <div className="px-5 pt-5 pb-4 sm:px-6 border-b border-border/20 bg-gradient-to-b from-[#9945FF]/5 to-transparent">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl border border-[#9945FF]/30 bg-[#9945FF]/10">
              <BellRing className="h-5 w-5 text-[#CFA8FF]" />
            </div>
            <div>
              <h3
                className="text-base sm:text-lg font-semibold text-foreground"
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                Wallet Alerts
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monitor wallets and receive failure alerts via webhook
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void handleRunCheck(false);
              }}
              disabled={checking || loading || subscriptions.length === 0}
              className="h-8 bg-[#14F195]/10 text-[#14F195] hover:bg-[#14F195]/20 border border-[#14F195]/20 text-xs cursor-pointer"
            >
              {checking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">Check Now</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                void handleRunCheck(true);
              }}
              disabled={checking || loading || subscriptions.length === 0}
              className="h-8 bg-[#9945FF]/10 text-[#CFA8FF] hover:bg-[#9945FF]/20 border border-[#9945FF]/20 text-xs cursor-pointer"
            >
              {checking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FlaskConical className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">Test</span>
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="space-y-4 px-5 py-5 sm:px-6">
        {/* Create form */}
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            value={walletAddress}
            onChange={(event) => setWalletAddress(event.target.value)}
            placeholder="Wallet address to monitor"
            className="font-mono text-sm bg-secondary/30 border-border/40 focus:border-[#9945FF]/50"
            disabled={submitting}
          />
          <Input
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder="https://your-webhook-endpoint.com"
            className="text-sm bg-secondary/30 border-border/40 focus:border-[#9945FF]/50"
            disabled={submitting}
          />

          {/* Event toggles */}
          <div className="flex flex-wrap gap-2">
            {EVENT_OPTIONS.map((eventOption) => {
              const selected = selectedEventSet.has(eventOption.value);

              return (
                <button
                  key={eventOption.value}
                  type="button"
                  onClick={() => toggleEvent(eventOption.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                    selected
                      ? "border-[#9945FF]/40 bg-[#9945FF]/15 text-[#E0C7FF] shadow-[0_0_12px_rgba(153,69,255,0.1)]"
                      : "border-border/50 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  {eventOption.label}
                </button>
              );
            })}
          </div>

          {/* Admin key toggle */}
          <button
            type="button"
            onClick={() => setShowAdminKey(!showAdminKey)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
          >
            <KeyRound className="h-3 w-3" />
            Admin key
            <ChevronDown className={cn("h-3 w-3 transition-transform", showAdminKey && "rotate-180")} />
          </button>

          {showAdminKey && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Input
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                placeholder="WEBHOOK_ADMIN_KEY value"
                type="password"
                className="text-sm bg-secondary/30 border-border/40"
                disabled={submitting || checking}
              />
            </motion.div>
          )}

          <Button
            type="submit"
            disabled={submitting || !walletAddress.trim() || !webhookUrl.trim()}
            className="w-full bg-gradient-to-r from-[#9945FF] to-[#DC1FFF] text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellRing className="h-4 w-4" />
            )}
            <span className="ml-2">Subscribe</span>
          </Button>
        </form>

        {/* Status messages */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-xs text-green-300 flex items-center gap-2"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
            {message}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300 flex items-center gap-2"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
            {error}
          </motion.div>
        )}

        {/* Subscriptions list */}
        {loading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading subscriptions…
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="py-6 text-center">
            <BellRing className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground/60">
              No active subscriptions
            </p>
            <p className="text-xs text-muted-foreground/40 mt-0.5">
              Add a wallet address above to start monitoring
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium">
              Active ({subscriptions.length})
            </p>
            {subscriptions.map((subscription, i) => (
              <motion.div
                key={subscription.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-xl border border-border/30 bg-secondary/15 p-3 hover:border-border/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <p className="truncate font-mono text-xs text-foreground">
                      {subscription.walletAddress}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground/70">
                      → {subscription.webhookUrl}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {subscription.events.map((event) => (
                        <Badge
                          key={`${subscription.id}-${event}`}
                          variant="outline"
                          className={cn(
                            "text-[9px] font-medium",
                            event === "failed"
                              ? "border-red-500/20 bg-red-500/5 text-red-400"
                              : "border-amber-500/20 bg-amber-500/5 text-amber-400"
                          )}
                        >
                          {event === "failed" ? "FAILED" : "HIGH RISK"}
                        </Badge>
                      ))}
                      {subscription.lastChecked && (
                        <span className="text-[9px] text-muted-foreground/40 ml-1 self-center">
                          Last: {new Date(subscription.lastChecked).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    onClick={() => {
                      void handleDelete(subscription.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

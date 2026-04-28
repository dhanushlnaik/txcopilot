"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Zap,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeeTier {
  label: "economy" | "standard" | "fast";
  priorityFeeMicroLamports: number;
  estimatedSuccessRatePct: number;
}

interface NetworkData {
  tps: number;
  successRatePct: number;
  congestionScore: number;
  congestionLabel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  feeTiers: FeeTier[];
  slotHeight: number;
  sampleCount: number;
  recommendation: "GOOD" | "CAUTION" | "WAIT";
  recommendationReason: string;
  fetchedAt: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function congestionColor(label: string) {
  if (label === "CRITICAL") return { text: "text-red-400",    bar: "bg-red-500",    border: "border-red-500/20",    bg: "bg-red-500/10" };
  if (label === "HIGH")     return { text: "text-amber-400",  bar: "bg-amber-500",  border: "border-amber-500/20",  bg: "bg-amber-500/10" };
  if (label === "MODERATE") return { text: "text-yellow-400", bar: "bg-yellow-500", border: "border-yellow-500/20", bg: "bg-yellow-500/10" };
  return                           { text: "text-[#00FFA3]",  bar: "bg-[#00FFA3]",  border: "border-[#00FFA3]/20",  bg: "bg-[#00FFA3]/10" };
}

function recConfig(rec: string) {
  if (rec === "WAIT")    return { label: "WAIT",         icon: XCircle,       className: "text-red-400   border-red-500/30   bg-red-500/10"    };
  if (rec === "CAUTION") return { label: "CAUTION",      icon: Clock,         className: "text-amber-400 border-amber-500/30 bg-amber-500/10"  };
  return                        { label: "GOOD TO SEND", icon: CheckCircle2,  className: "text-[#00FFA3] border-[#00FFA3]/30 bg-[#00FFA3]/10"  };
}

function tierColor(label: string) {
  if (label === "fast")     return "text-[#00FFA3] border-[#00FFA3]/30 bg-[#00FFA3]/10";
  if (label === "standard") return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  return "text-muted-foreground border-border/30 bg-muted/20";
}

function formatLamports(microLamports: number): string {
  if (microLamports >= 1_000_000) return `${(microLamports / 1_000_000).toFixed(2)}M μL`;
  if (microLamports >= 1_000)     return `${(microLamports / 1_000).toFixed(1)}k μL`;
  return `${microLamports} μL`;
}

function formatSol(microLamports: number): string {
  const lamports = microLamports / 1_000_000;
  const sol = lamports / 1_000_000_000;
  return sol < 0.000001 ? "<0.000001 SOL" : `${sol.toFixed(6)} SOL`;
}

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, delay = 0, highlight = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  delay?: number;
  highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Card className={cn("border-border/30 bg-card/60 h-full", highlight && "border-[#00FFA3]/20 bg-[#00FFA3]/5")}>
        <CardContent className="p-4 flex items-start gap-3">
          <div className="rounded-lg border border-border/30 bg-muted/20 p-2 shrink-0">
            <Icon className={cn("h-4 w-4", highlight ? "text-[#00FFA3]" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
            <p
              className={cn("text-xl font-black tabular-nums mt-0.5", highlight ? "text-[#00FFA3]" : "text-foreground")}
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              {value}
            </p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CongestionGauge({ score, label }: { score: number; label: string }) {
  const colors = congestionColor(label);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className={cn("border bg-card/60", colors.border, colors.bg)}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Network Congestion
            </p>
            <Badge
              variant="outline"
              className={cn("font-bold text-xs", colors.text, colors.border, colors.bg)}
            >
              {label}
            </Badge>
          </div>
          <div className="flex items-end gap-3 mb-3">
            <span
              className={cn("text-5xl font-black tabular-nums", colors.text)}
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              {score}
            </span>
            <span className="text-sm text-muted-foreground mb-1">/ 100</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted/30 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              className={cn("h-full rounded-full", colors.bar)}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
            <span>Low</span>
            <span>Moderate</span>
            <span>Critical</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RecommendationBanner({ rec, reason }: { rec: string; reason: string }) {
  const { label, icon: Icon, className } = recConfig(rec);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.18, duration: 0.3 }}
      className={cn("rounded-xl border p-4 flex items-start gap-3", className)}
    >
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs opacity-80 mt-0.5 leading-relaxed">{reason}</p>
      </div>
    </motion.div>
  );
}

function FeeTierRow({ tier, delay }: { tier: FeeTier; delay: number }) {
  const colors = tierColor(tier.label);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={cn("rounded-lg border p-3 flex flex-col gap-1.5", colors)}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold capitalize">{tier.label}</span>
        <div className="text-right">
          <span className="text-xs font-mono">{formatLamports(tier.priorityFeeMicroLamports)}</span>
          <span className="text-[10px] opacity-60 ml-2">{formatSol(tier.priorityFeeMicroLamports)}</span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-current/10 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${tier.estimatedSuccessRatePct}%` }}
          transition={{ delay: delay + 0.1, duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full bg-current/50"
        />
      </div>
      <p className="text-[10px] opacity-60">{tier.estimatedSuccessRatePct}% estimated success</p>
    </motion.div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/30", className)} />;
}

function NetworkSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-36" />
      <Skeleton className="h-16" />
      <Skeleton className="h-44" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function NetworkPage() {
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [, forceUpdate] = useState(0);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/network");
      const json = await res.json() as { success: boolean; data?: NetworkData; error?: string };
      if (!json.success) throw new Error(json.error ?? "Failed to fetch network data");
      setData(json.data!);
      setLastUpdated(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 15 s
  useEffect(() => {
    const id = setInterval(() => fetchData(true), 15_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // Tick the "X seconds ago" label every second
  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 flex flex-col gap-6">
      {/* Back */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to analyzer
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl font-black tracking-tight"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            <span className="text-[#00FFA3]">Network</span>{" "}
            <span className="text-foreground">Pulse</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-1 text-sm text-muted-foreground"
          >
            Live Solana network stats · auto-refreshes every 15s
          </motion.p>
        </div>

        <div className="flex items-center gap-2 shrink-0 mt-1">
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              {timeAgo(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            type="button"
            className="rounded-lg border border-border/30 p-2 text-muted-foreground hover:text-foreground hover:border-[#9945FF]/40 transition-colors disabled:opacity-40 cursor-pointer"
            title="Refresh now"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <NetworkSkeleton />
          </motion.div>
        )}

        {error && !loading && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center"
          >
            <p className="text-sm font-medium text-red-400">Failed to load network data</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">{error}</p>
            <button
              onClick={() => fetchData()}
              type="button"
              className="text-xs border border-border/30 rounded-lg px-3 py-1.5 hover:border-[#9945FF]/40 transition-colors cursor-pointer"
            >
              Try again
            </button>
          </motion.div>
        )}

        {data && !loading && (
          <motion.div
            key="data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* 4 stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="TPS"
                value={data.tps.toLocaleString()}
                sub="transactions/sec"
                icon={Activity}
                delay={0}
              />
              <StatCard
                label="Success Rate"
                value={`${data.successRatePct}%`}
                sub="last 20 samples"
                icon={TrendingUp}
                delay={0.05}
                highlight={data.successRatePct >= 90}
              />
              <StatCard
                label="Slot"
                value={data.slotHeight.toLocaleString()}
                sub="current height"
                icon={Zap}
                delay={0.1}
              />
              <StatCard
                label="Samples"
                value={data.sampleCount.toString()}
                sub="perf windows"
                icon={Activity}
                delay={0.15}
              />
            </div>

            {/* Congestion gauge */}
            <CongestionGauge score={data.congestionScore} label={data.congestionLabel} />

            {/* Send recommendation */}
            <RecommendationBanner rec={data.recommendation} reason={data.recommendationReason} />

            {/* Fee tiers */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="border-border/30 bg-card/60">
                <CardHeader className="px-5 pt-5 pb-3">
                  <h3
                    className="text-sm font-semibold flex items-center gap-2"
                    style={{ fontFamily: "var(--font-space-grotesk)" }}
                  >
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    Priority Fee Tiers
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Live percentiles from{" "}
                    <code className="font-mono text-[10px]">getRecentPrioritizationFees()</code>
                  </p>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-2">
                  {data.feeTiers.map((tier, i) => (
                    <FeeTierRow key={tier.label} tier={tier} delay={0.3 + i * 0.07} />
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating refresh indicator */}
      <AnimatePresence>
        {refreshing && data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full border border-border/40 bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground shadow-lg"
          >
            <RefreshCw className="h-3 w-3 animate-spin" />
            Refreshing…
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

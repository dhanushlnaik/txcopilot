"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Zap,
  ClipboardPaste,
  Loader2,
  Copy,
  Check,
  ChevronRight,
  Activity,
  Cpu,
  Network,
  Clock,
  GitBranch,
  BarChart2,
  Circle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Explanation, InstructionTraceEntry, RiskScore, ScorerSignal, MultiPassReport, FeeTier, FingerprintResult, ErrorEntry } from "soltrac-sdk";

// ── API response shape ────────────────────────────────────────────────────────

interface PreflightData {
  risk: "safe" | "warning" | "fail";
  recommendation: "SEND" | "REVIEW" | "DO_NOT_SEND";
  riskScore: RiskScore;
  simulation: MultiPassReport;
  protocols: FingerprintResult;
  taxonomyMatch: ErrorEntry | null;
}

interface CheckResult {
  success: boolean;
  inputType: "signature" | "transaction";
  explanation: Explanation;
  preflight: PreflightData | null;
}

// ── Demo transactions ─────────────────────────────────────────────────────────

const DEMO_TXS = [
  {
    label: "Jupiter slippage failure",
    sig: "56YU2EU1AkRuZjDg2PQ8b4G2GK4iyrFq8mD6RzNhtD21pQXC7Hdb6VJqPdqv2MjqbKDVTmfoyYhtrKgHRNNuwbo",
  },
  {
    label: "Insufficient funds",
    sig: "CYQd7an8JWYRcJwfXs3iwa3fAq3HWggkWQUcjRotyS3CBzQc8zut9fLgXx4gR5BAmsw6M1Utb1PwXztyndJFSsi",
  },
];

// ── Visual config ─────────────────────────────────────────────────────────────

const SIGNAL_ICONS: Record<string, React.ElementType> = {
  cu_pressure: Cpu,
  slippage_risk: BarChart2,
  network_congestion: Network,
  blockhash_age: Clock,
  account_conflicts: GitBranch,
  instruction_complexity: Activity,
  program_error_history: Shield,
  wallet_failure_rate: Circle,
};

const SIGNAL_LABELS: Record<string, string> = {
  cu_pressure: "Compute Pressure",
  slippage_risk: "Slippage Risk",
  network_congestion: "Network Congestion",
  blockhash_age: "Blockhash Age",
  account_conflicts: "Account Conflicts",
  instruction_complexity: "Instruction Complexity",
  program_error_history: "Program Error History",
  wallet_failure_rate: "Wallet Failure Rate",
};

const LOADING_STEPS = [
  "Fetching transaction...",
  "Running baseline simulation...",
  "Running optimistic pass...",
  "Probing compute units...",
  "Scoring 8 risk signals...",
  "Fingerprinting protocols...",
  "Generating explanation...",
];

function signalBarColor(score: number): string {
  if (score >= 70) return "bg-red-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-[#00FFA3]";
}

function riskColor(risk: string) {
  if (risk === "fail") return { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", glow: "glow-red" };
  if (risk === "warning") return { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "glow-amber" };
  return { text: "text-[#00FFA3]", bg: "bg-[#00FFA3]/10", border: "border-[#00FFA3]/20", glow: "glow-green" };
}

function recBadge(rec: string) {
  if (rec === "DO_NOT_SEND") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (rec === "REVIEW") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-[#00FFA3]/15 text-[#00FFA3] border-[#00FFA3]/30";
}

function tierColor(label: string) {
  if (label === "fast") return "text-[#00FFA3] border-[#00FFA3]/30 bg-[#00FFA3]/10";
  if (label === "standard") return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  return "text-muted-foreground border-border/30 bg-muted/20";
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCountUp(target: number, delay = 0.3, duration = 0.8) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    setDisplay(0);
    const timeout = setTimeout(() => {
      const start = performance.now();
      const frame = (now: number) => {
        const progress = Math.min((now - start) / (duration * 1000), 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [target, delay, duration]);

  return display;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RiskGauge({ score, risk, recommendation }: { score: number; risk: string; recommendation: string }) {
  const colors = riskColor(risk);
  const recColors = recBadge(recommendation);
  const animatedScore = useCountUp(score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={cn("rounded-xl border p-6 text-center", colors.bg, colors.border, colors.glow)}
    >
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Risk Score</p>
      <div
        className={cn("text-7xl font-black tabular-nums", colors.text)}
        style={{ fontFamily: "var(--font-space-grotesk)" }}
      >
        {animatedScore}
      </div>
      <p className="text-xs text-muted-foreground mt-1 mb-4">out of 100</p>
      <Badge
        variant="outline"
        className={cn("text-sm font-bold px-4 py-1 uppercase tracking-wider", recColors)}
      >
        {recommendation.replace(/_/g, " ")}
      </Badge>
    </motion.div>
  );
}

function SignalBar({ signal, delay }: { signal: ScorerSignal; delay: number }) {
  const Icon = SIGNAL_ICONS[signal.name] ?? Activity;
  const barColor = signal.available ? signalBarColor(signal.score) : "bg-muted-foreground/30";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium truncate">{SIGNAL_LABELS[signal.name] ?? signal.name}</span>
          {!signal.available && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground/60 border-border/30 shrink-0">
              pending
            </Badge>
          )}
        </div>
        <span
          className={cn(
            "font-mono font-semibold tabular-nums shrink-0",
            signal.available ? (signal.score >= 70 ? "text-red-400" : signal.score >= 40 ? "text-amber-400" : "text-[#00FFA3]") : "text-muted-foreground/50"
          )}
        >
          {signal.available ? signal.score : "—"}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: signal.available ? `${signal.score}%` : "50%" }}
          transition={{ delay: delay + 0.1, duration: 0.6, ease: "easeOut" }}
          className={cn("h-full rounded-full", barColor)}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/60 leading-snug">{signal.reason}</p>
    </motion.div>
  );
}

function InstructionTrace({ trace }: { trace: InstructionTraceEntry[] }) {
  if (trace.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {trace.map((entry, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className={cn(
            "flex items-center gap-2 rounded px-1 -mx-1 py-0.5",
            entry.result === "failed" && "bg-red-500/5"
          )}
          style={{ paddingLeft: `${entry.depth * 16 + 4}px` }}
        >
          <div
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0",
              entry.result === "success" ? "bg-[#00FFA3]" : entry.result === "failed" ? "bg-red-400 animate-pulse" : "bg-muted-foreground/40"
            )}
          />
          <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          <span className="text-xs font-mono text-foreground/80 truncate">{entry.programName}</span>
          {entry.result === "failed" && entry.failureReason && (
            <span className="text-[10px] text-red-400 ml-1 truncate">— {entry.failureReason}</span>
          )}
          <Badge
            variant="outline"
            className={cn(
              "ml-auto text-[9px] px-1.5 py-0 shrink-0",
              entry.result === "success"
                ? "border-[#00FFA3]/30 text-[#00FFA3]/80"
                : entry.result === "failed"
                  ? "border-red-500/30 text-red-400"
                  : "border-border/30 text-muted-foreground"
            )}
          >
            {entry.result}
          </Badge>
        </motion.div>
      ))}
    </div>
  );
}

function FeeTierCard({ tier }: { tier: FeeTier }) {
  const colors = tierColor(tier.label);
  const lamports = tier.priorityFeeMicroLamports;
  const displayFee =
    lamports >= 1_000_000 ? `${(lamports / 1_000_000).toFixed(2)}M μL` : `${lamports.toLocaleString()} μL`;

  return (
    <div className={cn("rounded-lg border p-3 flex flex-col gap-1", colors)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold capitalize">{tier.label}</span>
        <span className="text-[10px] font-mono">{displayFee}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-current/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-current/50"
          style={{ width: `${tier.estimatedSuccessRatePct}%` }}
        />
      </div>
      <p className="text-[10px] opacity-70">{tier.estimatedSuccessRatePct}% success rate</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-[#00FFA3]" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function LoadingCard() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-border/30">
      <CardContent className="p-8 flex flex-col items-center gap-4">
        <div className="relative">
          <Loader2 className="h-8 w-8 animate-spin text-[#9945FF]" />
          <div className="absolute inset-0 h-8 w-8 animate-ping rounded-full bg-[#9945FF]/10" />
        </div>
        <div className="text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-medium"
            >
              {LOADING_STEPS[step]}
            </motion.p>
          </AnimatePresence>
          <p className="text-xs text-muted-foreground mt-1">
            Step {step + 1} of {LOADING_STEPS.length}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main result renderer ──────────────────────────────────────────────────────

function CheckResult({ data }: { data: CheckResult }) {
  const { explanation, preflight, inputType } = data;
  const riskColors = riskColor(preflight?.riskScore.risk ?? (explanation.tier === "unknown" ? "warning" : "warning"));

  return (
    <div className="space-y-4">
      {/* Risk Gauge + Root Cause */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {preflight ? (
          <RiskGauge
            score={preflight.riskScore.score}
            risk={preflight.riskScore.risk}
            recommendation={preflight.riskScore.recommendation}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn("rounded-xl border p-6 text-center", riskColors.bg, riskColors.border)}
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Analysis Tier</p>
            <p className={cn("text-3xl font-bold uppercase", riskColors.text)} style={{ fontFamily: "var(--font-space-grotesk)" }}>
              {explanation.tier}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Confidence: {Math.round(explanation.confidence * 100)}%
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border/30 bg-card/60 p-5 flex flex-col gap-3"
        >
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Root Cause</p>
            <p className="text-sm font-mono font-semibold text-foreground">{explanation.rootCause}</p>
          </div>
          {explanation.failedAt && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Failed At</p>
              <p className="text-xs text-muted-foreground">{explanation.failedAt}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-auto">
            <Badge variant="outline" className="text-[10px]">
              Tier: {explanation.tier}
            </Badge>
            <Badge
              variant="outline"
              className={cn("text-[10px]", explanation.retryable ? "border-[#00FFA3]/30 text-[#00FFA3]/80" : "border-red-500/30 text-red-400")}
            >
              {explanation.retryable ? "Retryable" : "Non-retryable"}
            </Badge>
            {inputType === "signature" && (
              <Badge variant="outline" className="text-[10px] border-[#9945FF]/30 text-[#9945FF]/80">
                Post-mortem
              </Badge>
            )}
          </div>
        </motion.div>
      </div>

      {/* Summary banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className={cn("rounded-xl border p-4", riskColors.bg, riskColors.border)}
      >
        <p className="text-sm leading-relaxed text-foreground">{explanation.summary}</p>
        {explanation.technicalDetail && (
          <p className="text-xs font-mono text-muted-foreground mt-2 leading-relaxed">{explanation.technicalDetail}</p>
        )}
      </motion.div>

      {/* Recommended Fixes — moved up for scanability */}
      {explanation.fixes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-border/30 bg-card/60">
            <CardHeader className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                Recommended Fixes
              </h3>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              {explanation.fixes
                .sort((a, b) => a.priority - b.priority)
                .map((fix, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.07 }}
                    className="flex items-start gap-3 rounded-lg border border-border/30 bg-secondary/30 p-3"
                  >
                    <div className="rounded-full bg-[#00FFA3]/10 border border-[#00FFA3]/20 w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-[#00FFA3]">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{fix.action}</p>
                      {fix.codeHint && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <code className="text-xs font-mono bg-muted/40 rounded px-2 py-0.5 text-muted-foreground flex-1 truncate">
                            {fix.codeHint}
                          </code>
                          <CopyButton text={fix.codeHint} />
                        </div>
                      )}
                      {fix.estimatedSuccessLift !== undefined && (
                        <p className="text-[10px] text-[#00FFA3]/70 mt-1">
                          +{Math.round((fix.estimatedSuccessLift ?? 0) * 100)}% estimated success lift
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Instruction Trace — moved up, most visual */}
      {explanation.instructionTrace.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
        >
          <Card className="border-border/30 bg-card/60">
            <CardHeader className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                Instruction Trace
              </h3>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <InstructionTrace trace={explanation.instructionTrace} />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Risk Signals */}
      {preflight && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="border-border/30 bg-card/60">
            <CardHeader className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                Risk Signals
              </h3>
              <p className="text-xs text-muted-foreground">
                Confidence: {Math.round(preflight.riskScore.confidence * 100)}% of signal weight available
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              {preflight.riskScore.signals.map((signal, i) => (
                <SignalBar key={signal.name} signal={signal} delay={0.4 + i * 0.05} />
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* CU Probe + Fee Tiers */}
      {preflight && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <Card className="border-border/30 bg-card/60">
            <CardHeader className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                <Cpu className="h-4 w-4 text-muted-foreground" />
                Compute Units
              </h3>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {[
                { label: "Consumed", value: preflight.simulation.cuProbe.consumed.toLocaleString() },
                {
                  label: "Limit",
                  value: preflight.simulation.cuProbe.currentLimit
                    ? preflight.simulation.cuProbe.currentLimit.toLocaleString()
                    : "default",
                },
                { label: "Recommended", value: preflight.simulation.cuProbe.recommended.toLocaleString() },
                { label: "Headroom", value: `${preflight.simulation.cuProbe.headroomPct}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs font-mono font-medium text-foreground">{value}</span>
                </div>
              ))}
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Usage</span>
                  <span>
                    {preflight.simulation.cuProbe.currentLimit
                      ? `${Math.round((preflight.simulation.cuProbe.consumed / preflight.simulation.cuProbe.currentLimit) * 100)}%`
                      : "—"}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: preflight.simulation.cuProbe.currentLimit
                        ? `${Math.min(100, (preflight.simulation.cuProbe.consumed / preflight.simulation.cuProbe.currentLimit) * 100)}%`
                        : "0%",
                    }}
                    transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full",
                      preflight.simulation.cuProbe.headroomPct < 15
                        ? "bg-red-500"
                        : preflight.simulation.cuProbe.headroomPct < 30
                          ? "bg-amber-500"
                          : "bg-[#00FFA3]"
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/30 bg-card/60">
            <CardHeader className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                <Zap className="h-4 w-4 text-muted-foreground" />
                Priority Fee Tiers
              </h3>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              {preflight.simulation.feeTiers.length > 0 ? (
                preflight.simulation.feeTiers.map((tier) => (
                  <FeeTierCard key={tier.label} tier={tier} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Fee tier data not available for this simulation.</p>
              )}
              {preflight.simulation.isStaleBlockhash && (
                <div className="flex items-center gap-2 mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">Stale blockhash detected — rebuild tx before sending</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Detected Protocols */}
      {explanation.protocols.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-border/30 bg-card/60">
            <CardHeader className="px-5 pt-5 pb-3">
              <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                Detected Protocols
              </h3>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex flex-wrap gap-2 mb-3">
                {explanation.protocols.map((name) => (
                  <Badge key={name} variant="outline" className="border-[#9945FF]/30 bg-[#9945FF]/10 text-[#D7B8FF] text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
              {explanation.protocolRisks.length > 0 && (
                <>
                  <Separator className="bg-border/20 mb-3" />
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Protocol Risks</p>
                  <div className="flex flex-wrap gap-1.5">
                    {explanation.protocolRisks.map((risk) => (
                      <Badge key={risk} variant="outline" className="text-[10px] border-amber-500/25 text-amber-400/80">
                        {risk.replace(/-/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Taxonomy match */}
      {preflight?.taxonomyMatch && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Card className="border-[#9945FF]/20 bg-[#9945FF]/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Shield className="h-4 w-4 text-[#9945FF] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-[#D7B8FF] mb-1">{preflight.taxonomyMatch.name}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{preflight.taxonomyMatch.summary}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

// ── Zero state ────────────────────────────────────────────────────────────────

function ZeroState({ onSelect }: { onSelect: (sig: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center gap-6 py-8 text-center"
    >
      <div className="grid grid-cols-3 gap-3 w-full max-w-md">
        {[
          { icon: Shield, label: "8 risk signals", sub: "from live RPC data" },
          { icon: Cpu, label: "CU optimization", sub: "binary-search probe" },
          { icon: Zap, label: "Staleness detection", sub: "dual-pass simulation" },
        ].map(({ icon: Icon, label, sub }) => (
          <div
            key={label}
            className="rounded-xl border border-border/20 bg-card/40 p-3 flex flex-col items-center gap-1.5"
          >
            <Icon className="h-4 w-4 text-[#9945FF]" />
            <p className="text-xs font-semibold">{label}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 items-center">
        <p className="text-xs text-muted-foreground">Try a real failed transaction:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {DEMO_TXS.map(({ label, sig }) => (
            <button
              key={label}
              onClick={() => onSelect(sig)}
              type="button"
              className="text-xs border border-border/30 rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-[#9945FF]/40 transition-colors cursor-pointer"
            >
              {label} →
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CheckPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);

  const handleCheck = useCallback(async (raw?: string) => {
    const value = (raw ?? input).trim();
    if (!value) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: value }),
      });
      const data = await res.json() as CheckResult & { error?: string };
      if (!data.success) {
        setError(data.error ?? "Check failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [input]);

  const handleSelect = useCallback((sig: string) => {
    setInput(sig);
    handleCheck(sig);
  }, [handleCheck]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text.trim());
    } catch {
      // not available
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !loading) {
        e.preventDefault();
        handleCheck();
      }
    },
    [handleCheck, loading]
  );

  const showZeroState = !result && !loading && !error;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 flex flex-col gap-8">
      {/* Back link */}
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
      <div>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl font-black tracking-tight"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          <span className="text-[#00FFA3]">Pre-flight</span>{" "}
          <span className="text-foreground">Check</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-2 text-sm text-muted-foreground"
        >
          Paste a base64-encoded transaction for deep risk analysis, or a signature for post-mortem.
        </motion.p>
      </div>

      {/* Input card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="animated-border"
      >
        <Card className="border-0 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="check-input" className="text-xs font-medium text-muted-foreground">
                Transaction or Signature
              </label>
              <div className="relative">
                <textarea
                  id="check-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Paste a base64 transaction or Solana signature…"
                  rows={3}
                  disabled={loading}
                  className="w-full resize-none rounded-lg border border-border/50 bg-background/50 px-4 py-3 pr-10 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#9945FF]/40 focus:border-[#9945FF]/50 disabled:opacity-50 transition-colors"
                />
                <button
                  onClick={handlePaste}
                  type="button"
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </button>
              </div>
            </div>
            <Button
              onClick={() => handleCheck()}
              disabled={loading || !input.trim()}
              className="w-full h-11 font-semibold bg-gradient-to-r from-[#9945FF] to-[#DC1FFF] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Run Pre-flight Check
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Zero state */}
      <AnimatePresence>
        {showZeroState && <ZeroState onSelect={handleSelect} />}
      </AnimatePresence>

      {/* Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <LoadingCard />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="border-red-500/20 glow-red">
              <CardContent className="p-4 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Check failed</p>
                  <p className="text-xs text-muted-foreground mt-1">{error}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <CheckResult data={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

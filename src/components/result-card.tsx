"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AnalysisResult, RiskLevel } from "@/lib/types";

const RISK_CONFIG: Record<
  RiskLevel,
  {
    icon: React.ElementType;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    glowClass: string;
    badgeVariant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  LOW: {
    icon: ShieldCheck,
    label: "Low Risk — Transaction Healthy",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    glowClass: "glow-green",
    badgeVariant: "default",
  },
  MEDIUM: {
    icon: AlertTriangle,
    label: "Medium Risk — Potential Issues",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    glowClass: "glow-amber",
    badgeVariant: "secondary",
  },
  HIGH: {
    icon: ShieldAlert,
    label: "High Risk — Likely to Fail",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    glowClass: "glow-red pulse-risk",
    badgeVariant: "destructive",
  },
};

const SEVERITY_COLORS: Record<RiskLevel, string> = {
  LOW: "text-green-400 bg-green-500/10 border-green-500/20",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  HIGH: "text-red-400 bg-red-500/10 border-red-500/20",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  recommended: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  optional: "text-muted-foreground bg-muted/50 border-border/50",
};

export default function ResultCard({ result }: { result: AnalysisResult }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const config = RISK_CONFIG[result.risk];
  const RiskIcon = config.icon;

  const handleCopySignature = async () => {
    try {
      await navigator.clipboard.writeText(result.breakdown.signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may not be available
    }
  };

  return (
    <Card className={cn("overflow-hidden border", config.borderColor, config.glowClass)}>
      {/* Risk Header */}
      <CardHeader className={cn("p-5 sm:p-6", config.bgColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              <div
                className={cn(
                  "rounded-xl p-2.5",
                  config.bgColor,
                  "border",
                  config.borderColor
                )}
              >
                <RiskIcon className={cn("h-6 w-6", config.color)} />
              </div>
            </motion.div>
            <div>
              <h3
                className={cn("text-lg font-bold tracking-tight", config.color)}
                style={{ fontFamily: "var(--font-space-grotesk)" }}
              >
                {config.label}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.breakdown.type} •{" "}
                {result.breakdown.status === "confirmed"
                  ? "Confirmed"
                  : result.breakdown.status === "failed"
                    ? "Failed"
                    : "Dropped"}{" "}
                • Confidence: {result.confidence}%
              </p>
            </div>
          </div>
          <Badge
            variant={config.badgeVariant}
            className={cn(
              "text-xs font-bold px-3 py-1 uppercase tracking-wider",
              result.risk === "LOW" &&
                "bg-green-500/15 text-green-400 border-green-500/30",
              result.risk === "MEDIUM" &&
                "bg-amber-500/15 text-amber-400 border-amber-500/30",
              result.risk === "HIGH" &&
                "bg-red-500/15 text-red-400 border-red-500/30"
            )}
          >
            {result.risk}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Why Section */}
        {result.reasons.length > 0 && (
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <h4
              className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Why
            </h4>
            <div className="space-y-2">
              {result.reasons.map((reason, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3 rounded-lg border border-border/30 bg-secondary/30 p-3"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      "mt-0.5 text-[10px] shrink-0 font-bold",
                      SEVERITY_COLORS[reason.severity]
                    )}
                  >
                    {reason.severity}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {reason.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {reason.description}
                    </p>
                    {reason.code && (
                      <span className="inline-block mt-1 text-[10px] font-mono text-muted-foreground/60 bg-muted/30 px-1.5 py-0.5 rounded">
                        Code: {reason.code}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Separator */}
        {result.fixes.length > 0 && result.reasons.length > 0 && (
          <div className="px-5 sm:px-6 py-4">
            <Separator className="bg-border/30" />
          </div>
        )}

        {/* What to Do Section */}
        {result.fixes.length > 0 && (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            <h4
              className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              <Wrench className="h-4 w-4 text-muted-foreground" />
              What to Do
            </h4>
            <div className="space-y-2">
              {result.fixes.map((fix, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="flex items-start gap-3 rounded-lg border border-border/30 bg-secondary/30 p-3"
                >
                  <CheckCircle2 className="h-4 w-4 text-[#00FFA3] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {fix.action}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold",
                          PRIORITY_COLORS[fix.priority]
                        )}
                      >
                        {fix.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {fix.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Details Toggle */}
        <div className="border-t border-border/30">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex w-full items-center justify-between px-5 py-3 sm:px-6 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            type="button"
          >
            <span className="font-medium">Transaction Details</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                showDetails && "rotate-180"
              )}
            />
          </button>

          {/* Details Content */}
          <motion.div
            initial={false}
            animate={{
              height: showDetails ? "auto" : 0,
              opacity: showDetails ? 1 : 0,
            }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 sm:px-6 sm:pb-6 space-y-3">
              {/* Signature */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground shrink-0">
                  Signature
                </span>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-xs font-mono text-foreground truncate">
                    {result.breakdown.signature}
                  </span>
                  <button
                    onClick={handleCopySignature}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Copy signature"
                    type="button"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                  <a
                    href={`https://solscan.io/tx/${result.breakdown.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    title="View on Solscan"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Type", value: result.breakdown.type },
                  { label: "Status", value: result.breakdown.status },
                  {
                    label: "Fee",
                    value: `${result.breakdown.fee.toFixed(6)} SOL`,
                  },
                  {
                    label: "Instructions",
                    value: String(result.breakdown.instructionCount),
                  },
                  ...(result.breakdown.slot
                    ? [
                        {
                          label: "Slot",
                          value: result.breakdown.slot.toLocaleString(),
                        },
                      ]
                    : []),
                  ...(result.breakdown.blockTime
                    ? [
                        {
                          label: "Time",
                          value: new Date(
                            result.breakdown.blockTime
                          ).toLocaleString(),
                        },
                      ]
                    : []),
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-md bg-muted/30 px-3 py-2"
                  >
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {item.label}
                    </p>
                    <p className="text-xs font-medium text-foreground mt-0.5">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Signers */}
              {result.breakdown.signers.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Signers
                  </p>
                  {result.breakdown.signers.map((signer, i) => (
                    <p key={i} className="text-xs font-mono text-foreground truncate">
                      {signer}
                    </p>
                  ))}
                </div>
              )}

              {/* Logs */}
              {result.breakdown.logs.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Program Logs ({result.breakdown.logs.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto rounded-md bg-muted/20 p-3 scrollbar-thin">
                    {result.breakdown.logs.slice(0, 30).map((log, i) => (
                      <p
                        key={i}
                        className={cn(
                          "text-[11px] font-mono leading-relaxed break-all",
                          log.toLowerCase().includes("error") ||
                            log.toLowerCase().includes("failed")
                            ? "text-red-400"
                            : log.toLowerCase().includes("success")
                              ? "text-green-400"
                              : "text-muted-foreground"
                        )}
                      >
                        {log}
                      </p>
                    ))}
                    {result.breakdown.logs.length > 30 && (
                      <p className="text-[10px] text-muted-foreground/50 mt-2">
                        ... and {result.breakdown.logs.length - 30} more lines
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}

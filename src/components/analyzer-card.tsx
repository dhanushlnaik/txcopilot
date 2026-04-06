"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, ClipboardPaste, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import ResultCard from "@/components/result-card";
import type { AnalysisResult } from "@/lib/types";

const DEMO_TRANSACTIONS = [
  {
    label: "Failed Swap",
    signature:
      "56YU2EU1AkRuZjDg2PQ8b4G2GK4iyrFq8mD6RzNhtD21pQXC7Hdb6VJqPdqv2MjqbKDVTmfoyYhtrKgHRNNuwbo",
    emoji: "🔴",
  },
  {
    label: "Successful Swap",
    signature:
      "4uTpd4ik2DoKq7gMHWRXqdS8vmVy92K7AfcnD7M1EFypJTgQsAvNodAtD5n4YRBKMqi9x4VaocjyyqUL9CVfpxs2",
    emoji: "🟢",
  },
  {
    label: "Insufficient Funds",
    signature:
      "CYQd7an8JWYRcJwfXs3iwa3fAq3HWggkWQUcjRotyS3CBzQc8zut9fLgXx4gR5BAmsw6M1Utb1PwXztyndJFSsi",
    emoji: "🔴",
  },
];

export default function AnalyzerCard() {
  const [signature, setSignature] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async (sig?: string) => {
    const txSig = sig || signature;
    if (!txSig.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: txSig.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Analysis failed");
        return;
      }

      setResult(data.data);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [signature]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setSignature(text.trim());
    } catch {
      // Clipboard API may not be available
    }
  }, []);

  const handleDemoClick = useCallback(
    (sig: string) => {
      setSignature(sig);
      handleAnalyze(sig);
    },
    [handleAnalyze]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !loading) {
        handleAnalyze();
      }
    },
    [handleAnalyze, loading]
  );

  return (
    <section className="relative w-full max-w-2xl mx-auto px-4">
      {/* Main analyzer card with animated border */}
      <div className="animated-border">
        <Card className="relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-6 sm:p-8">
            {/* Input area */}
            <div className="flex flex-col gap-3">
              <label
                htmlFor="tx-signature-input"
                className="text-sm font-medium text-muted-foreground"
              >
                Transaction Signature
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="tx-signature-input"
                    type="text"
                    placeholder="Paste a Solana transaction signature..."
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-10 pr-10 h-12 font-mono text-sm bg-background/50 border-border/50 focus:border-[#00FFA3]/50 focus:ring-[#00FFA3]/20 placeholder:text-muted-foreground/50"
                    disabled={loading}
                  />
                  <button
                    onClick={handlePaste}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    title="Paste from clipboard"
                    type="button"
                  >
                    <ClipboardPaste className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  onClick={() => handleAnalyze()}
                  disabled={loading || !signature.trim()}
                  size="lg"
                  className="h-12 px-6 bg-gradient-to-r from-[#00FFA3] to-[#14F195] text-[#050816] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 shrink-0"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline ml-2">Analyze</span>
                </Button>
              </div>
            </div>

            {/* Demo transaction chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground mr-1 self-center">
                Try:
              </span>
              {DEMO_TRANSACTIONS.map((demo) => (
                <button
                  key={demo.label}
                  onClick={() => handleDemoClick(demo.signature)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/50 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all disabled:opacity-40 cursor-pointer"
                  type="button"
                >
                  <span>{demo.emoji}</span>
                  {demo.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading state */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6"
          >
            <Card className="border-border/30">
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="relative">
                    <Loader2 className="h-8 w-8 animate-spin text-[#00FFA3]" />
                    <div className="absolute inset-0 h-8 w-8 animate-ping rounded-full bg-[#00FFA3]/10" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      Analyzing transaction...
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Fetching data from Solana network
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      <AnimatePresence>
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6"
          >
            <Card className="border-red-500/20 glow-red">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-red-500/10 p-2">
                    <span className="text-lg">⚠️</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-400">
                      Analysis Failed
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {error}
                    </p>
                  </div>
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
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mt-6"
          >
            <ResultCard result={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

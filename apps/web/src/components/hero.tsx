"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ShieldCheck, Activity } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center px-4 pt-24 pb-8 sm:pt-32 sm:pb-12 text-center">
      {/* Eyebrow Badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-6"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(0,255,163,0.15)] bg-[rgba(0,255,163,0.05)] px-4 py-1.5 text-xs font-medium text-[#00FFA3] tracking-wide">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FFA3] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00FFA3]" />
          </span>
          Solana Transaction Intelligence
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl"
        style={{ fontFamily: "var(--font-space-grotesk)" }}
      >
        <span className="gradient-text">Know before you send.</span>
        <br />
        <span className="text-foreground">Fix before you fail.</span>
      </motion.h1>

      {/* Subline */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
      >
        Predict if a Solana transaction will fail, understand why, and get the
        next best action instantly.
      </motion.p>

      {/* CTA links */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-6 flex flex-wrap items-center justify-center gap-3"
      >
        <Link
          href="/check"
          className="inline-flex items-center gap-2 rounded-full border border-[#9945FF]/30 bg-[#9945FF]/10 px-5 py-2 text-sm font-medium text-[#D7B8FF] hover:bg-[#9945FF]/20 transition-colors"
        >
          <ShieldCheck className="h-4 w-4" />
          Pre-flight Check
        </Link>
        <Link
          href="/network"
          className="inline-flex items-center gap-2 rounded-full border border-[#00FFA3]/20 bg-[#00FFA3]/5 px-5 py-2 text-sm font-medium text-[#00FFA3]/80 hover:bg-[#00FFA3]/10 transition-colors"
        >
          <Activity className="h-4 w-4" />
          Network Pulse
        </Link>
      </motion.div>
    </section>
  );
}

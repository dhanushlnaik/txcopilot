"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export function BackgroundDots() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* Dot pattern */}
      <div className="absolute inset-0 dot-pattern opacity-60" />

      {/* Radial gradient overlay for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0, 255, 163, 0.04) 0%, transparent 60%)",
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{
          background:
            "linear-gradient(to top, var(--background) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}

export function Spotlight() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, delay: 0.2 }}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Primary spotlight — mint/green */}
      <div
        className="absolute -top-20 left-1/2 -translate-x-1/2 h-[600px] w-[800px]"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 0%, transparent 30%, rgba(0, 255, 163, 0.06) 40%, rgba(20, 241, 149, 0.04) 50%, rgba(0, 255, 163, 0.06) 60%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Secondary glow — purple */}
      <div
        className="absolute -top-10 right-1/4 h-[400px] w-[400px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(153, 69, 255, 0.05) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
    </motion.div>
  );
}

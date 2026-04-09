"use client";

import { motion } from "framer-motion";
import { ClipboardPaste, Cpu, Wrench, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: ClipboardPaste,
    number: "01",
    title: "Paste",
    description: "Drop any Solana transaction signature into the analyzer.",
    color: "#00FFA3",
    gradient: "from-[#00FFA3]/20 to-[#14F195]/5",
    glow: "group-hover:shadow-[0_0_30px_rgba(0,255,163,0.15)]",
  },
  {
    icon: Cpu,
    number: "02",
    title: "Analyze",
    description:
      "Our engine scans logs, error codes, and network state in real time.",
    color: "#9945FF",
    gradient: "from-[#9945FF]/20 to-[#7C3AED]/5",
    glow: "group-hover:shadow-[0_0_30px_rgba(153,69,255,0.15)]",
  },
  {
    icon: Wrench,
    number: "03",
    title: "Fix",
    description:
      "Get a clear risk verdict and actionable steps to fix or prevent failure.",
    color: "#DC1FFF",
    gradient: "from-[#DC1FFF]/20 to-[#9945FF]/5",
    glow: "group-hover:shadow-[0_0_30px_rgba(220,31,255,0.15)]",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export default function HowItWorks() {
  return (
    <section className="w-full max-w-4xl mx-auto px-4 py-20">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00FFA3]/70 mb-3">
          How it works
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight">
          Three steps to{" "}
          <span className="gradient-text">transaction clarity</span>
        </h2>
        <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
          No setup. No wallet connection. Just paste a signature and get answers
          in seconds.
        </p>
      </motion.div>

      {/* Steps grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        {steps.map((step, index) => (
          <motion.div key={step.number} variants={itemVariants} className="relative">
            {/* Connector arrow (visible between cards on desktop) */}
            {index < steps.length - 1 && (
              <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground/30">
                <ArrowRight className="h-5 w-5" />
              </div>
            )}

            <div
              className={`group relative overflow-hidden rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-6 transition-all duration-300 hover:border-border/80 ${step.glow}`}
            >
              {/* Gradient background on hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-b ${step.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
              />

              {/* Content */}
              <div className="relative z-10">
                {/* Step number + icon row */}
                <div className="flex items-center justify-between mb-5">
                  <span
                    className="text-xs font-mono font-bold tracking-wider"
                    style={{ color: step.color, opacity: 0.5 }}
                  >
                    {step.number}
                  </span>
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg border border-border/50 transition-colors duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${step.color}10, ${step.color}05)`,
                    }}
                  >
                    <step.icon
                      className="h-5 w-5 transition-transform duration-300 group-hover:scale-110"
                      style={{ color: step.color }}
                    />
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold font-heading mb-2 tracking-tight">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

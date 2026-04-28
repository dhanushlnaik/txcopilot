import chalk from "chalk";

// ── Color helpers ─────────────────────────────────────────────────────────────

export function riskChalk(risk: string) {
  if (risk === "fail" || risk === "DO_NOT_SEND" || risk === "CRITICAL" || risk === "WAIT") return chalk.red;
  if (risk === "warning" || risk === "REVIEW" || risk === "CAUTION" || risk === "HIGH" || risk === "MODERATE") return chalk.yellow;
  return chalk.green;
}

export function scoreChalk(score: number) {
  if (score >= 70) return chalk.red;
  if (score >= 40) return chalk.yellow;
  return chalk.green;
}

// ── Banner ────────────────────────────────────────────────────────────────────

export function banner() {
  console.log(
    chalk.bold("\n  ✦ " + chalk.green("Sol") + chalk.white("Trac") + chalk.dim(" — Solana Transaction Intelligence\n"))
  );
}

// ── Box ───────────────────────────────────────────────────────────────────────

export function box(lines: string[], borderColor: chalk.Chalk = chalk.white) {
  const width = Math.max(...lines.map((l) => stripAnsi(l).length)) + 4;
  const top    = borderColor("┌" + "─".repeat(width) + "┐");
  const bottom = borderColor("└" + "─".repeat(width) + "┘");
  const mid    = lines.map((l) => {
    const pad = width - stripAnsi(l).length - 2;
    return borderColor("│") + " " + l + " ".repeat(Math.max(0, pad - 1)) + " " + borderColor("│");
  });
  console.log([top, ...mid, bottom].join("\n"));
}

// ── Section label ─────────────────────────────────────────────────────────────

export function section(label: string) {
  console.log("\n" + chalk.dim(label.toUpperCase()));
}

// ── Signal bar ────────────────────────────────────────────────────────────────

const BAR_WIDTH = 10;

export function signalBar(score: number | null): string {
  if (score === null) return chalk.dim("──────────");
  const filled = Math.round((score / 100) * BAR_WIDTH);
  const bar = "▓".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  return scoreChalk(score ?? 0)(bar);
}

// ── Table row ─────────────────────────────────────────────────────────────────

export function row(label: string, value: string, labelWidth = 24) {
  console.log("  " + chalk.dim(label.padEnd(labelWidth)) + value);
}

// ── Spinner (no ora dep) ──────────────────────────────────────────────────────

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function spin(label: string): () => void {
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write("\r  " + chalk.cyan(FRAMES[i++ % FRAMES.length]) + "  " + chalk.dim(label));
  }, 80);

  return () => {
    clearInterval(id);
    process.stdout.write("\r" + " ".repeat(label.length + 8) + "\r");
  };
}

// ── Strip ANSI (minimal) ──────────────────────────────────────────────────────

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, "");
}

// ── Truncate ──────────────────────────────────────────────────────────────────

export function trunc(str: string, max = 60): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

// ── Format μLamports ─────────────────────────────────────────────────────────

export function fmtLamports(u: number): string {
  if (u >= 1_000_000) return `${(u / 1_000_000).toFixed(2)}M μL`;
  if (u >= 1_000)     return `${(u / 1_000).toFixed(1)}k μL`;
  return `${u} μL`;
}

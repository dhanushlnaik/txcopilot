import chalk from "chalk";
import { preflight, explain, explainFromSimulation, isValidSignature } from "soltrac-sdk";
import type { Explanation, PreflightResult } from "soltrac-sdk";
import {
  banner, box, section, row, signalBar, spin, riskChalk, scoreChalk, trunc,
} from "../format";

const SIGNAL_LABELS: Record<string, string> = {
  cu_pressure:           "Compute Pressure",
  slippage_risk:         "Slippage Risk",
  network_congestion:    "Network Congestion",
  blockhash_age:         "Blockhash Age",
  account_conflicts:     "Account Conflicts",
  instruction_complexity:"Instruction Complexity",
  program_error_history: "Program Error History",
  wallet_failure_rate:   "Wallet Failure Rate",
};

function printHeader(riskScore: PreflightResult["riskScore"] | null, explanation: Explanation) {
  const risk    = riskScore?.risk ?? (explanation.retryable ? "warning" : "fail");
  const rec     = riskScore?.recommendation ?? (explanation.retryable ? "REVIEW" : "DO_NOT_SEND");
  const score   = riskScore?.score ?? Math.round(explanation.confidence * 100);
  const rcChalk = riskChalk(rec);

  box(
    [
      rcChalk.bold(`  ${rec.replace(/_/g, " ")}`) + "  " + chalk.dim(`Score: ${scoreChalk(score)(String(score).padStart(3))}`),
      chalk.dim(`  Risk: ${rcChalk(risk.toUpperCase())}  ·  Tier: ${explanation.tier}  ·  ${explanation.retryable ? chalk.green("Retryable") : chalk.red("Non-retryable")}`),
    ],
    rcChalk
  );
}

function printExplanation(ex: Explanation) {
  section("Root Cause");
  row("Root Cause",  chalk.bold(ex.rootCause));
  if (ex.failedAt)  row("Failed At",   ex.failedAt);
  row("Confidence", `${Math.round(ex.confidence * 100)}%`);

  section("Summary");
  console.log("  " + ex.summary);
  if (ex.technicalDetail) {
    console.log("  " + chalk.dim(ex.technicalDetail));
  }

  if (ex.fixes.length > 0) {
    section("Recommended Fixes");
    ex.fixes
      .sort((a, b) => a.priority - b.priority)
      .forEach((fix, i) => {
        const lift = fix.estimatedSuccessLift !== undefined
          ? chalk.green(`  +${Math.round(fix.estimatedSuccessLift * 100)}%`)
          : "";
        console.log(`  ${chalk.bold(String(i + 1))}  ${fix.action}${lift}`);
        if (fix.codeHint) {
          console.log("     " + chalk.dim("$ ") + chalk.cyan(fix.codeHint));
        }
      });
  }

  if (ex.protocols.length > 0) {
    section("Protocols");
    console.log("  " + ex.protocols.map((p) => chalk.magenta(p)).join("  "));
  }

  if (ex.instructionTrace.length > 0) {
    section("Instruction Trace");
    ex.instructionTrace.forEach((entry) => {
      const indent = "  " + "  ".repeat(entry.depth);
      const dot    = entry.result === "success" ? chalk.green("●") : entry.result === "failed" ? chalk.red("●") : chalk.dim("○");
      const name   = entry.result === "failed" ? chalk.red(entry.programName) : chalk.dim(entry.programName);
      const reason = entry.failureReason ? chalk.red(` — ${entry.failureReason}`) : "";
      console.log(`${indent}${dot} ${name}${reason}`);
    });
  }
}

function printSignals(pf: PreflightResult) {
  section("Risk Signals");
  const conf = Math.round(pf.riskScore.confidence * 100);
  console.log(chalk.dim(`  ${conf}% of signal weight available\n`));

  pf.riskScore.signals.forEach((sig) => {
    const label  = (SIGNAL_LABELS[sig.name] ?? sig.name).padEnd(26);
    const bar    = signalBar(sig.available ? sig.score : null);
    const score  = sig.available ? scoreChalk(sig.score)(String(sig.score).padStart(3)) : chalk.dim(" — ");
    const reason = chalk.dim("  " + trunc(sig.reason, 55));
    const pending = !sig.available ? chalk.dim(" (pending)") : "";
    console.log(`  ${chalk.dim(label)} ${bar} ${score}${pending}${reason}`);
  });
}

function printCuAndFees(pf: PreflightResult) {
  section("Compute Units");
  const cu = pf.simulation.cuProbe;
  row("Consumed",    cu.consumed.toLocaleString());
  row("Limit",       cu.currentLimit ? cu.currentLimit.toLocaleString() : "default");
  row("Recommended", cu.recommended.toLocaleString());
  row("Headroom",    `${cu.headroomPct}%`);

  if (pf.simulation.feeTiers.length > 0) {
    section("Priority Fee Tiers");
    pf.simulation.feeTiers.forEach((tier) => {
      const tierLabel = tier.label.padEnd(10);
      const fee = `${tier.priorityFeeMicroLamports.toLocaleString()} μL`.padEnd(18);
      const rate = `${tier.estimatedSuccessRatePct}% success`;
      const tierChalk = tier.label === "fast" ? chalk.green : tier.label === "standard" ? chalk.yellow : chalk.dim;
      console.log(`  ${tierChalk(tierLabel)} ${fee}  ${chalk.dim(rate)}`);
    });
  }

  if (pf.simulation.isStaleBlockhash) {
    console.log("\n  " + chalk.yellow("⚠ Stale blockhash detected — rebuild tx before sending"));
  }
}

export async function runCheck(input: string, opts: { rpc?: string }) {
  const rpcUrl = opts.rpc ?? process.env.SOLANA_RPC_URL;

  banner();

  if (isValidSignature(input)) {
    // Post-mortem on a confirmed signature
    console.log(chalk.dim(`  Post-mortem: ${trunc(input, 60)}\n`));
    const stop = spin("Fetching and analyzing transaction…");

    let explanation: Explanation;
    try {
      explanation = await explain(input, {
        rpcUrl,
        enableAI: false,
      });
    } catch (e) {
      stop();
      console.error(chalk.red("\n  Error: ") + (e instanceof Error ? e.message : String(e)));
      process.exit(1);
    }
    stop();

    printHeader(null, explanation);
    printExplanation(explanation);
  } else {
    // Pre-flight on a base64 transaction
    console.log(chalk.dim(`  Pre-flight check on base64 transaction\n`));
    const stop = spin("Running multi-pass simulation + 8 risk signals…");

    let pf: PreflightResult;
    let explanation: Explanation;
    try {
      pf = await preflight(input, { rpcUrl });
      const accountKeys = pf.protocols.protocols.map((p) => p.programId);
      explanation = explainFromSimulation({
        err: pf.simulation.optimistic.err ?? pf.simulation.baseline.err,
        logs: pf.simulation.optimistic.logs,
        accountKeys,
      });
    } catch (e) {
      stop();
      console.error(chalk.red("\n  Error: ") + (e instanceof Error ? e.message : String(e)));
      process.exit(1);
    }
    stop();

    printHeader(pf.riskScore, explanation);
    printExplanation(explanation);
    printSignals(pf);
    printCuAndFees(pf);

    if (pf.taxonomyMatch) {
      section("Taxonomy Match");
      console.log("  " + chalk.magenta.bold(pf.taxonomyMatch.name));
      console.log("  " + chalk.dim(pf.taxonomyMatch.summary));
    }
  }

  console.log();
}

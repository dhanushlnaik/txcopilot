import chalk from "chalk";
import { explain, isValidSignature } from "soltrac-sdk";
import { banner, section, row, spin, riskChalk, trunc } from "../format";

export async function runExplain(signature: string, opts: { rpc?: string; ai?: boolean }) {
  if (!isValidSignature(signature)) {
    console.error(chalk.red("  Invalid signature. Must be a base58-encoded Solana transaction signature."));
    process.exit(1);
  }

  banner();
  console.log(chalk.dim(`  Explaining: ${trunc(signature, 60)}\n`));

  const stop = spin("Fetching transaction and running analysis…");

  try {
    const result = await explain(signature, {
      rpcUrl: opts.rpc ?? process.env.SOLANA_RPC_URL,
      enableAI: opts.ai ?? !!process.env.GEMINI_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY,
    });

    stop();

    const rColor = riskChalk(result.retryable ? "REVIEW" : "DO_NOT_SEND");

    section("Explanation");
    row("Root Cause",  chalk.bold(result.rootCause));
    row("Failed At",   result.failedAt || "—");
    row("Tier",        result.tier);
    row("Confidence",  `${Math.round(result.confidence * 100)}%`);
    row("Retryable",   result.retryable ? chalk.green("Yes") : chalk.red("No"));

    section("Summary");
    console.log("  " + result.summary);
    if (result.technicalDetail) {
      console.log("  " + chalk.dim(result.technicalDetail));
    }

    if (result.fixes.length > 0) {
      section("Fixes");
      result.fixes
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

    if (result.protocols.length > 0) {
      section("Protocols Involved");
      console.log("  " + result.protocols.map((p) => chalk.magenta(p)).join("  "));
    }

    if (result.protocolRisks.length > 0) {
      section("Protocol Risks");
      result.protocolRisks.forEach((r) => {
        console.log("  " + chalk.yellow("·") + " " + chalk.dim(r.replace(/-/g, " ")));
      });
    }

    if (result.instructionTrace.length > 0) {
      section("Instruction Trace");
      result.instructionTrace.forEach((entry) => {
        const indent = "  " + "  ".repeat(entry.depth);
        const dot    = entry.result === "success" ? chalk.green("●") : entry.result === "failed" ? chalk.red("●") : chalk.dim("○");
        const name   = entry.result === "failed" ? chalk.red(entry.programName) : chalk.dim(entry.programName);
        const reason = entry.failureReason ? chalk.red(` — ${entry.failureReason}`) : "";
        console.log(`${indent}${dot} ${name}${reason}`);
      });
    }

    console.log();

    void rColor; // used for future coloring of header
  } catch (e) {
    stop();
    console.error(chalk.red("\n  Error: ") + (e instanceof Error ? e.message : String(e)));
    process.exit(1);
  }
}

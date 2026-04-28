import chalk from "chalk";
import { lookupProtocol, lookupError } from "soltrac-sdk";
import { banner, section, row } from "../format";

const CATEGORY_COLORS: Record<string, chalk.Chalk> = {
  "dex-aggregator":  chalk.magenta,
  "amm":             chalk.cyan,
  "clmm":            chalk.blue,
  "orderbook":       chalk.white,
  "liquid-staking":  chalk.green,
  "lending":         chalk.yellow,
  "mev":             chalk.red,
  "system":          chalk.dim,
  "token":           chalk.dim,
  "compute-budget":  chalk.dim,
};

export function runProgram(programId: string) {
  banner();

  const info = lookupProtocol(programId);

  if (!info) {
    console.log(chalk.yellow("  Unknown program — not in the protocol registry.\n"));
    console.log(chalk.dim("  Program ID: ") + programId);
    console.log(chalk.dim("\n  If this is a known protocol, open an issue at github.com/dhanushlnaik/soltrac\n"));
    return;
  }

  const catChalk = CATEGORY_COLORS[info.category] ?? chalk.white;

  section("Protocol");
  row("Name",       chalk.bold(info.name));
  row("Short Name", info.shortName);
  row("Category",   catChalk(info.category));
  row("Program ID", chalk.dim(info.programId));
  if (info.isAggregator) row("Aggregator", chalk.green("Yes — multi-hop routing"));
  if (info.docsUrl)      row("Docs",       chalk.cyan(info.docsUrl));

  if (info.risks.length > 0) {
    section("Known Risks");
    info.risks.forEach((r) => {
      console.log("  " + chalk.yellow("·") + " " + r.replace(/-/g, " "));
    });
  }

  // Try to show a few representative error codes from taxonomy
  const sampleErrors = [6001, 6002, 6003, 0, 1, 2].flatMap((code) => {
    const entry = lookupError({ Custom: code }, [programId]);
    return entry ? [entry] : [];
  }).slice(0, 5);

  if (sampleErrors.length > 0) {
    section("Error Codes");
    sampleErrors.forEach((e) => {
      const sev = e.severity === "fatal" ? chalk.red : e.severity === "recoverable" ? chalk.yellow : chalk.dim;
      console.log(`  ${chalk.dim(String(e.code).padStart(6))}  ${chalk.bold(e.name)}`);
      console.log(`          ${chalk.dim(e.summary)}`);
      console.log(`          ${sev(e.severity)}${e.retryable ? chalk.dim(" · retryable") : chalk.dim(" · fatal")}`);
    });
  }

  console.log();
}

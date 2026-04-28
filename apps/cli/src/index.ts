#!/usr/bin/env node
import { Command } from "commander";
import { runCheck } from "./commands/check";
import { runExplain } from "./commands/explain";
import { runNetwork } from "./commands/network";
import { runProgram } from "./commands/program";

const program = new Command();

program
  .name("soltrac")
  .description("Solana transaction intelligence — check, explain, network, program")
  .version("0.1.0");

// ── soltrac check <input> ─────────────────────────────────────────────────────

program
  .command("check <input>")
  .description("Pre-flight check (base64 tx) or post-mortem analysis (signature)")
  .option("--rpc <url>", "Solana RPC URL (default: SOLANA_RPC_URL env var)")
  .action((input: string, opts: { rpc?: string }) => {
    runCheck(input, opts).catch((e) => {
      console.error("Fatal:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
  });

// ── soltrac explain <signature> ───────────────────────────────────────────────

program
  .command("explain <signature>")
  .description("Explain a confirmed transaction by signature")
  .option("--rpc <url>",  "Solana RPC URL")
  .option("--ai",         "Enable AI (Gemini) explanation tier (requires GEMINI_API_KEY)")
  .action((signature: string, opts: { rpc?: string; ai?: boolean }) => {
    runExplain(signature, opts).catch((e) => {
      console.error("Fatal:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
  });

// ── soltrac network ───────────────────────────────────────────────────────────

program
  .command("network")
  .description("Show live Solana network congestion, TPS, and priority fee tiers")
  .option("--rpc <url>", "Solana RPC URL")
  .action((opts: { rpc?: string }) => {
    runNetwork(opts).catch((e) => {
      console.error("Fatal:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
  });

// ── soltrac program <program-id> ──────────────────────────────────────────────

program
  .command("program <programId>")
  .description("Look up a protocol by program ID — shows risks, error codes, docs")
  .action((programId: string) => {
    runProgram(programId);
  });

program.parse();

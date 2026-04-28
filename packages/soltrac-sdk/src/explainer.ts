import { Connection } from "@solana/web3.js";
import { lookupError } from "./taxonomy";
import { fingerprint, lookupProtocol } from "./fingerprint";
import type { ErrorEntry } from "./taxonomy";
import type { FingerprintResult } from "./fingerprint";
import type { ErrorCategory } from "./types";

const DEFAULT_RPC =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// ── Public types ──────────────────────────────────────────────────────────────

export type ExplainTier = "deterministic" | "log-pattern" | "ai" | "unknown";

export interface ExplanationFix {
  priority: number;
  action: string;
  codeHint?: string;
  estimatedSuccessLift?: number;
}

export interface InstructionTraceEntry {
  index: number;
  depth: number;
  programId: string;
  programName: string;
  result: "success" | "failed" | "pending";
  failureReason?: string;
}

export interface Explanation {
  /** One sentence, plain English */
  summary: string;
  /** Structured root cause label */
  rootCause: string;
  /** e.g. "Jupiter v6 → instruction 3 of 5" */
  failedAt: string;
  /** Raw error + program ID */
  technicalDetail: string;
  /** Detected protocol names */
  protocols: string[];
  /** Risk flags from fingerprint */
  protocolRisks: string[];
  /** Ranked fixes */
  fixes: ExplanationFix[];
  retryable: boolean;
  /** Which analysis tier produced this result */
  tier: ExplainTier;
  /** 0–1: certainty of root cause */
  confidence: number;
  /** Parsed instruction execution trace */
  instructionTrace: InstructionTraceEntry[];
}

export interface ExplainOptions {
  rpcUrl?: string;
  /** Enable LLM fallback for genuinely unknown errors */
  enableAI?: boolean;
  /** Gemini API key for LLM tier */
  geminiApiKey?: string;
  /** Custom LLM function — receives a prompt, returns text */
  llmFn?: (prompt: string) => Promise<string>;
}

// ── Root cause labels ─────────────────────────────────────────────────────────

const ROOT_CAUSE_LABELS: Record<ErrorCategory, string> = {
  slippage:           "SLIPPAGE_EXCEEDED",
  compute_exceeded:   "COMPUTE_BUDGET_EXCEEDED",
  insufficient_funds: "INSUFFICIENT_FUNDS",
  account_not_found:  "ACCOUNT_NOT_FOUND",
  stale_blockhash:    "STALE_BLOCKHASH",
  program_error:      "PROGRAM_ERROR",
  mev_suspected:      "MEV_SUSPECTED",
  unknown:            "UNKNOWN",
};

// ── Tier 2: log pattern matchers ──────────────────────────────────────────────

interface LogPattern {
  pattern: RegExp;
  rootCause: string;
  summary: string;
  category: ErrorCategory;
  retryable: boolean;
  fixes: ExplanationFix[];
}

const LOG_PATTERNS: LogPattern[] = [
  {
    pattern: /SlippageTolerance|slippage tolerance exceeded/i,
    rootCause: "SLIPPAGE_EXCEEDED",
    summary: "Slippage tolerance exceeded — pool price moved against you.",
    category: "slippage",
    retryable: true,
    fixes: [
      { priority: 1, action: "Increase slippage to 1.5%", codeHint: "slippageBps: 150", estimatedSuccessLift: 0.75 },
      { priority: 2, action: "Add priority fee to land faster", codeHint: "computeUnitPrice: 50000" },
      { priority: 3, action: "Re-quote immediately before sending" },
    ],
  },
  {
    pattern: /insufficient funds|insufficient lamports/i,
    rootCause: "INSUFFICIENT_FUNDS",
    summary: "Insufficient funds — account balance too low for this operation.",
    category: "insufficient_funds",
    retryable: false,
    fixes: [
      { priority: 1, action: "Check token or SOL balance before constructing the transaction", estimatedSuccessLift: 1.0 },
      { priority: 2, action: "Re-fetch balance — quote may be stale" },
    ],
  },
  {
    pattern: /already in use|already initialized/i,
    rootCause: "ACCOUNT_ALREADY_INITIALIZED",
    summary: "Account is already initialized — attempting to create it again.",
    category: "program_error",
    retryable: false,
    fixes: [
      { priority: 1, action: "Check if account already exists before initializing", codeHint: "connection.getAccountInfo(pubkey)", estimatedSuccessLift: 1.0 },
    ],
  },
  {
    pattern: /blockhash not found|blockhash.*expired/i,
    rootCause: "STALE_BLOCKHASH",
    summary: "Transaction blockhash expired before it could land.",
    category: "stale_blockhash",
    retryable: true,
    fixes: [
      { priority: 1, action: "Re-fetch blockhash and re-sign", codeHint: "connection.getLatestBlockhash()", estimatedSuccessLift: 0.95 },
      { priority: 2, action: "Add priority fee to land faster" },
    ],
  },
  {
    pattern: /compute budget exceeded|exceeded.*compute/i,
    rootCause: "COMPUTE_BUDGET_EXCEEDED",
    summary: "Transaction ran out of compute units mid-execution.",
    category: "compute_exceeded",
    retryable: true,
    fixes: [
      { priority: 1, action: "Increase compute unit limit", codeHint: "ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 })", estimatedSuccessLift: 0.9 },
    ],
  },
  {
    pattern: /not enough liquidity|insufficient liquidity/i,
    rootCause: "INSUFFICIENT_LIQUIDITY",
    summary: "Pool does not have enough liquidity for this swap size.",
    category: "program_error",
    retryable: false,
    fixes: [
      { priority: 1, action: "Reduce swap amount", estimatedSuccessLift: 0.9 },
      { priority: 2, action: "Route through Jupiter to aggregate across multiple pools" },
    ],
  },
  {
    pattern: /tick array.*not found|tick.*out of range/i,
    rootCause: "TICK_RANGE_EXCEEDED",
    summary: "CLMM pool: price moved outside initialized tick range.",
    category: "program_error",
    retryable: false,
    fixes: [
      { priority: 1, action: "Use Jupiter which handles tick array initialization automatically", estimatedSuccessLift: 0.85 },
      { priority: 2, action: "Reduce swap size to keep price within current tick range" },
    ],
  },
  {
    pattern: /owner.*mismatch|invalid owner/i,
    rootCause: "OWNER_MISMATCH",
    summary: "Account owner does not match expected program.",
    category: "program_error",
    retryable: false,
    fixes: [
      { priority: 1, action: "Verify all account addresses are correct for this wallet" },
      { priority: 2, action: "Ensure associated token accounts are derived for the correct owner" },
    ],
  },
  {
    pattern: /bonding curve.*complete|already.*graduated/i,
    rootCause: "BONDING_CURVE_COMPLETE",
    summary: "Token has graduated from Pump.fun — now trades on Raydium.",
    category: "program_error",
    retryable: false,
    fixes: [
      { priority: 1, action: "Trade this token on Raydium or via Jupiter instead of Pump.fun", estimatedSuccessLift: 1.0 },
    ],
  },
  {
    pattern: /custom program error: 0x(\w+)/i,
    rootCause: "CUSTOM_PROGRAM_ERROR",
    summary: "Program returned a custom error code.",
    category: "program_error",
    retryable: false,
    fixes: [
      { priority: 1, action: "Check program documentation for this error code" },
    ],
  },
];

// ── Instruction trace parser ──────────────────────────────────────────────────

const INVOKE_RE = /^Program (\S+) invoke \[(\d+)\]/;
const SUCCESS_RE = /^Program (\S+) success/;
const FAILED_RE = /^Program (\S+) failed: (.+)/;

function parseInstructionTrace(
  logs: string[],
  fp: FingerprintResult
): InstructionTraceEntry[] {
  void fp;
  const trace: InstructionTraceEntry[] = [];
  let topLevelIndex = 0;

  for (const log of logs) {
    const invokeMatch = INVOKE_RE.exec(log);
    if (invokeMatch) {
      const programId = invokeMatch[1];
      const depth = parseInt(invokeMatch[2], 10);
      if (depth === 1) topLevelIndex++;
      const proto = lookupProtocol(programId);
      trace.push({
        index: topLevelIndex,
        depth,
        programId,
        programName: proto?.name ?? programId.slice(0, 8) + "…",
        result: "pending",
      });
      continue;
    }

    const successMatch = SUCCESS_RE.exec(log);
    if (successMatch) {
      const programId = successMatch[1];
      for (let i = trace.length - 1; i >= 0; i--) {
        if (trace[i].programId === programId && trace[i].result === "pending") {
          trace[i].result = "success";
          break;
        }
      }
      continue;
    }

    const failedMatch = FAILED_RE.exec(log);
    if (failedMatch) {
      const programId = failedMatch[1];
      const reason = failedMatch[2];
      for (let i = trace.length - 1; i >= 0; i--) {
        if (trace[i].programId === programId && trace[i].result === "pending") {
          trace[i].result = "failed";
          trace[i].failureReason = reason;
          break;
        }
      }
    }
  }

  return trace;
}

function buildFailedAt(trace: InstructionTraceEntry[]): string {
  const failedEntry = trace.find((e) => e.result === "failed");
  if (!failedEntry) return "unknown";

  const topLevelCount = trace.filter((e) => e.depth === 1).length;
  const pos = `instruction ${failedEntry.index} of ${topLevelCount}`;

  if (failedEntry.depth > 1) {
    const parent = trace
      .filter((e) => e.depth === failedEntry.depth - 1 && e.index === failedEntry.index)
      .at(-1);
    if (parent) {
      return `${parent.programName} → ${failedEntry.programName} (${pos})`;
    }
  }

  return `${failedEntry.programName} (${pos})`;
}

// ── Builder helpers ───────────────────────────────────────────────────────────

function fromTaxonomyEntry(
  entry: ErrorEntry,
  fp: FingerprintResult,
  trace: InstructionTraceEntry[],
  technicalDetail: string
): Explanation {
  return {
    summary: entry.summary,
    rootCause: ROOT_CAUSE_LABELS[entry.category] ?? "PROGRAM_ERROR",
    failedAt: buildFailedAt(trace),
    technicalDetail,
    protocols: fp.names,
    protocolRisks: fp.risks,
    fixes: entry.fixes,
    retryable: entry.retryable,
    tier: "deterministic",
    confidence: 0.95,
    instructionTrace: trace,
  };
}

function fromLogPattern(
  match: LogPattern,
  fp: FingerprintResult,
  trace: InstructionTraceEntry[],
  technicalDetail: string
): Explanation {
  return {
    summary: match.summary,
    rootCause: match.rootCause,
    failedAt: buildFailedAt(trace),
    technicalDetail,
    protocols: fp.names,
    protocolRisks: fp.risks,
    fixes: match.fixes,
    retryable: match.retryable,
    tier: "log-pattern",
    confidence: 0.75,
    instructionTrace: trace,
  };
}

function buildUnknownExplanation(
  fp: FingerprintResult,
  trace: InstructionTraceEntry[],
  technicalDetail: string
): Explanation {
  return {
    summary: "Transaction failed — error pattern not recognised. Check program logs.",
    rootCause: "UNKNOWN",
    failedAt: buildFailedAt(trace),
    technicalDetail,
    protocols: fp.names,
    protocolRisks: fp.risks,
    fixes: [
      { priority: 1, action: "Check the full program logs for the specific error message" },
      { priority: 2, action: "Look up the custom error code in the program IDL" },
    ],
    retryable: false,
    tier: "unknown",
    confidence: 0,
    instructionTrace: trace,
  };
}

// ── Tiers 1 + 2 (synchronous — no network) ───────────────────────────────────

function runSyncTiers(
  err: unknown,
  logs: string[],
  accountKeys: string[]
): { fp: FingerprintResult; trace: InstructionTraceEntry[]; result: Explanation | null } {
  const fp = fingerprint(accountKeys);
  const trace = parseInstructionTrace(logs, fp);

  const failedEntry = trace.find((e) => e.result === "failed");
  const rawErrStr = JSON.stringify(err);
  const technicalDetail = failedEntry
    ? `${failedEntry.failureReason ?? rawErrStr} at ${failedEntry.programName} (${failedEntry.programId})`
    : rawErrStr;

  // Tier 1 — taxonomy
  if (err !== null) {
    const entry = lookupError(err, accountKeys);
    if (entry) {
      return { fp, trace, result: fromTaxonomyEntry(entry, fp, trace, technicalDetail) };
    }
  }

  // Tier 2 — log patterns
  const allLogs = logs.join("\n");
  for (const lp of LOG_PATTERNS) {
    if (lp.pattern.test(allLogs)) {
      return { fp, trace, result: fromLogPattern(lp, fp, trace, technicalDetail) };
    }
  }

  return { fp, trace, result: null };
}

// ── Tier 3: LLM ──────────────────────────────────────────────────────────────

function buildLLMPrompt(
  logs: string[],
  err: unknown,
  fp: FingerprintResult,
  technicalDetail: string
): string {
  return `You are a Solana transaction debugger. Analyze this failed transaction and respond with JSON only.

Protocols detected: ${fp.names.join(", ") || "unknown"}
Raw error: ${JSON.stringify(err)}
Technical detail: ${technicalDetail}

Program logs (first 30 lines):
${logs.slice(0, 30).join("\n")}

Respond with this exact JSON shape (no markdown, no text outside JSON):
{
  "summary": "<one sentence plain English explanation>",
  "rootCause": "<SCREAMING_SNAKE_CASE label>",
  "fixes": [
    { "priority": 1, "action": "<plain English fix>", "codeHint": "<optional code snippet>" }
  ],
  "retryable": <true|false>,
  "confidence": <0.0-1.0>
}`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

interface LLMPayload {
  summary?: string;
  rootCause?: string;
  fixes?: ExplanationFix[];
  retryable?: boolean;
  confidence?: number;
}

async function runAITier(
  logs: string[],
  err: unknown,
  fp: FingerprintResult,
  trace: InstructionTraceEntry[],
  technicalDetail: string,
  opts: ExplainOptions
): Promise<Explanation | null> {
  try {
    const prompt = buildLLMPrompt(logs, err, fp, technicalDetail);
    let raw: string;

    if (opts.llmFn) {
      raw = await opts.llmFn(prompt);
    } else if (opts.geminiApiKey) {
      raw = await callGemini(prompt, opts.geminiApiKey);
    } else {
      return null;
    }

    const jsonStr = raw.replace(/^```json?\s*/m, "").replace(/\s*```$/m, "").trim();
    const parsed = JSON.parse(jsonStr) as LLMPayload;

    return {
      summary: parsed.summary ?? "Transaction failed — see logs.",
      rootCause: parsed.rootCause ?? "UNKNOWN",
      failedAt: buildFailedAt(trace),
      technicalDetail,
      protocols: fp.names,
      protocolRisks: fp.risks,
      fixes: parsed.fixes ?? [],
      retryable: parsed.retryable ?? false,
      tier: "ai",
      confidence: parsed.confidence ?? 0.6,
      instructionTrace: trace,
    };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Post-mortem: explain a confirmed transaction by its signature.
 * Runs tiers 1→2→3 in order, stopping at the first confident match.
 */
export async function explain(
  signature: string,
  opts: ExplainOptions = {}
): Promise<Explanation> {
  const conn = new Connection(opts.rpcUrl ?? DEFAULT_RPC, "confirmed");
  const tx = await conn.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  if (!tx) {
    return {
      summary: "Transaction not found on-chain.",
      rootCause: "NOT_FOUND",
      failedAt: "unknown",
      technicalDetail: `Signature: ${signature}`,
      protocols: [],
      protocolRisks: [],
      fixes: [{ priority: 1, action: "Verify the signature and confirmation status" }],
      retryable: false,
      tier: "unknown",
      confidence: 0,
      instructionTrace: [],
    };
  }

  const msg = tx.transaction.message;
  const accountKeys: string[] =
    "staticAccountKeys" in msg
      ? msg.staticAccountKeys.map((k) => k.toBase58())
      : (msg as { accountKeys: Array<{ toBase58(): string }> }).accountKeys.map((k) => k.toBase58());

  const err = tx.meta?.err ?? null;
  const logs = tx.meta?.logMessages ?? [];

  const { fp, trace, result } = runSyncTiers(err, logs, accountKeys);
  if (result) return result;

  // Tier 3 — LLM
  if (opts.enableAI && logs.length > 0) {
    const failedEntry = trace.find((e) => e.result === "failed");
    const td = failedEntry
      ? `${failedEntry.failureReason ?? JSON.stringify(err)} at ${failedEntry.programName}`
      : JSON.stringify(err);
    const aiResult = await runAITier(logs, err, fp, trace, td, opts);
    if (aiResult) return aiResult;
  }

  const failedEntry = trace.find((e) => e.result === "failed");
  const td = failedEntry
    ? `${failedEntry.failureReason ?? JSON.stringify(err)} at ${failedEntry.programName} (${failedEntry.programId})`
    : JSON.stringify(err);
  return buildUnknownExplanation(fp, trace, td);
}

/**
 * Pre-flight variant: explain from simulation data already in hand.
 * Synchronous — only runs tiers 1 and 2 (no network, no LLM).
 * Pass the result of `preflight()` or a raw simulation response.
 */
export function explainFromSimulation(input: {
  err: unknown;
  logs: string[];
  accountKeys: string[];
}): Explanation {
  const { fp, trace, result } = runSyncTiers(input.err, input.logs, input.accountKeys);

  if (result) return result;

  const failedEntry = trace.find((e) => e.result === "failed");
  const td = failedEntry
    ? `${failedEntry.failureReason ?? JSON.stringify(input.err)} at ${failedEntry.programName} (${failedEntry.programId})`
    : JSON.stringify(input.err);
  return buildUnknownExplanation(fp, trace, td);
}

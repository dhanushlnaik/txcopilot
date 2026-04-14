// ===========================
// Core domain types for SolTrac
// ===========================

// ===========================
// Simulation-first analysis types
// ===========================

export type ErrorCategory =
  | "slippage"
  | "compute_exceeded"
  | "insufficient_funds"
  | "account_not_found"
  | "stale_blockhash"
  | "program_error"
  | "mev_suspected"
  | "unknown";

export type FixParams =
  | { type: "slippage"; slippageBps: number; deepLinkUrl: string }
  | { type: "priority_fee"; priorityFeeMicroLamports: number }
  | { type: "retry" };

export interface SimResult {
  /** Outcome of simulation */
  risk: "safe" | "warning" | "fail";
  /** Structured error category, null on success */
  category: ErrorCategory | null;
  /** Human-readable explanation */
  reason: string;
  /** Actionable fix text, null if none */
  fix: string | null;
  /** Structured fix params for deep linking or auto-apply */
  fixParams: FixParams | null;
  /** 0.0–1.0, derived from error source not hardcoded */
  confidence: number;
  /** Which layer produced the result */
  source: "simulation" | "logs" | "heuristic";
  /** Raw simulation response for further inspection */
  raw: unknown;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface RiskReason {
  /** Short label for the reason */
  label: string;
  /** Human-readable explanation */
  description: string;
  /** Severity contributes to overall risk */
  severity: RiskLevel;
  /** Optional raw error code */
  code?: string;
}

export interface FixSuggestion {
  /** Action verb (e.g., "Increase slippage") */
  action: string;
  /** Detailed description */
  description: string;
  /** Priority ordering */
  priority: "critical" | "recommended" | "optional";
}

export interface TransactionBreakdown {
  /** Transaction signature */
  signature: string;
  /** Parsed transaction type (SWAP, TRANSFER, etc.) */
  type: string;
  /** Transaction status */
  status: "confirmed" | "failed" | "dropped" | "unknown";
  /** Fee in SOL */
  fee: number;
  /** Block slot */
  slot?: number;
  /** Block time as ISO string */
  blockTime?: string;
  /** Signers list */
  signers: string[];
  /** Number of instructions */
  instructionCount: number;
  /** Raw program logs */
  logs: string[];
  /** Token transfers if applicable */
  tokenTransfers?: TokenTransfer[];
}

export interface TokenTransfer {
  mint: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  decimals: number;
}

export interface AnalysisResult {
  /** Overall risk level */
  risk: RiskLevel;
  /** Confidence as a percentage 0–100 */
  confidence: number;
  /** List of identified risk reasons */
  reasons: RiskReason[];
  /** Actionable fix suggestions */
  fixes: FixSuggestion[];
  /** Transaction metadata breakdown */
  breakdown: TransactionBreakdown;
}

export interface NetworkStatus {
  /** Current congestion level */
  congestionLevel: "LOW" | "MEDIUM" | "HIGH";
  /** Average TPS over recent samples */
  avgTps: number;
  /** Recommended priority fee in micro-lamports */
  recommendedFee: number;
  /** Median priority fee */
  medianFee: number;
  /** Human-readable status message */
  statusMessage: string;
}

// ===========================
// API request/response types
// ===========================

export interface AnalyzeRequest {
  signature: string;
}

export interface AnalyzeResponse {
  success: boolean;
  data?: AnalysisResult;
  error?: string;
}

export interface NetworkResponse {
  success: boolean;
  data?: NetworkStatus;
  error?: string;
}

export type WebhookEvent = "failed" | "high_risk";

export interface WebhookSubscription {
  id: string;
  walletAddress: string;
  webhookUrl: string;
  events: WebhookEvent[];
  createdAt: string;
  lastChecked?: string;
}

export interface WebhookAlertPayload {
  event: "transaction_failed" | "transaction_high_risk";
  wallet: string;
  signature: string;
  analysis: AnalysisResult;
  timestamp: string;
}

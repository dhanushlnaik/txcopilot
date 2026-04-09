// ===========================
// Core domain types for SolTrac
// ===========================

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

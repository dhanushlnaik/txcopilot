import { describe, expect, it } from "vitest";
import { analyzeTransaction } from "@/lib/analyzer";

const VALID_SIGNATURE =
  "56YU2EU1AkRuZjDg2PQ8b4G2GK4iyrFq8mD6RzNhtD21pQXC7Hdb6VJqPdqv2MjqbKDVTmfoyYhtrKgHRNNuwbo";

function buildRawTx(options?: {
  err?: unknown;
  logs?: string[];
  slot?: number | null;
  accountKeys?: string[];
  instructions?: unknown[];
}) {
  return {
    slot: options?.slot ?? 123,
    meta: {
      err: options?.err ?? null,
      fee: 5000,
      logMessages: options?.logs ?? [],
      innerInstructions: [],
    },
    transaction: {
      message: {
        accountKeys: options?.accountKeys ?? ["Signer1111111111111111111111111111111111111"],
        instructions: options?.instructions ?? [{}],
        header: { numRequiredSignatures: 1 },
      },
    },
  };
}

describe("analyzeTransaction", () => {
  it("maps Jupiter slippage (code 6001) to slippage category", () => {
    const rawTx = buildRawTx({ err: { InstructionError: [1, { Custom: 6001 }] } });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.code === "slippage")).toBe(true);
  });

  it("maps Jupiter insufficient funds (code 6021) to insufficient_funds category", () => {
    const rawTx = buildRawTx({ err: { InstructionError: [1, { Custom: 6021 }] } });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.code === "insufficient_funds")).toBe(true);
  });

  it("maps Orca TokenMinSubceeded (code 6008) to slippage category", () => {
    const rawTx = buildRawTx({ err: { InstructionError: [1, { Custom: 6008 }] } });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.code === "slippage")).toBe(true);
  });

  it("maps Orca TokenMaxExceeded (code 6012) to slippage category", () => {
    const rawTx = buildRawTx({ err: { InstructionError: [1, { Custom: 6012 }] } });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.code === "slippage")).toBe(true);
  });

  it("maps Pump.fun constraint seeds (code 1814) to program_error category", () => {
    const rawTx = buildRawTx({ err: { InstructionError: [1, { Custom: 1814 }] } });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.code === "program_error")).toBe(true);
  });

  it("detects insufficient funds from logs when err is unrecognized", () => {
    // Log fallback (layer 3) only runs when err is non-null but unrecognized
    const rawTx = buildRawTx({
      err: { UnknownErrorShape: true },
      logs: ["Program log: insufficient funds"],
    });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.label === "Insufficient Funds")).toBe(true);
  });

  it("detects stale blockhash from logs when err is unrecognized", () => {
    const rawTx = buildRawTx({
      err: { UnknownErrorShape: true },
      logs: ["Blockhash not found"],
    });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    // categoryLabel('stale_blockhash') = "Stale Blockhash"
    expect(result.reasons.some((reason) => reason.label === "Stale Blockhash")).toBe(true);
  });

  it("detects compute budget exceeded from logs when err is unrecognized", () => {
    const rawTx = buildRawTx({
      err: { UnknownErrorShape: true },
      logs: ["Program failed: exceeded CUs meter"],
    });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    // categoryLabel('compute_exceeded') = "Compute Budget Exceeded"
    expect(result.reasons.some((reason) => reason.label === "Compute Budget Exceeded")).toBe(true);
  });

  it("ignores InitializeImmutableOwner", () => {
    const rawTx = buildRawTx({
      logs: ["Program log: Instruction: InitializeImmutableOwner"],
    });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(
      result.reasons.some((reason) => reason.label === "Immutable Account Violation")
    ).toBe(false);
  });

  it("ignores normal Token-2022 invocations", () => {
    const rawTx = buildRawTx({
      logs: [
        "Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]",
        "Program log: Instruction: TransferChecked",
      ],
    });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.label === "Token-2022 Error")).toBe(
      false
    );
  });

  it("scores confirmed-success as LOW", () => {
    const rawTx = buildRawTx({ err: null, logs: [], slot: 222 });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.risk).toBe("LOW");
  });

  it("scores failed tx as HIGH", () => {
    const rawTx = buildRawTx({ err: { InstructionError: [1, "Custom"] } });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.risk).toBe("HIGH");
  });

  it("infers SWAP type from Jupiter program ID", () => {
    const rawTx = buildRawTx({
      accountKeys: [
        "Signer1111111111111111111111111111111111111",
        "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      ],
    });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.breakdown.type).toBe("SWAP");
  });

  it("infers MEV_TIP from Jito program ID", () => {
    const rawTx = buildRawTx({
      logs: ["Program fastC7gqs2WUXgcyNna2BZAe9mte4zcTGprv3mv18N3 invoke [1]"],
      accountKeys: ["Signer1111111111111111111111111111111111111"],
    });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.breakdown.type).toBe("MEV_TIP");
  });

  it("handles null rawTx gracefully", () => {
    const result = analyzeTransaction(null, null, VALID_SIGNATURE);

    expect(result.breakdown.status).toBe("dropped");
    expect(result.breakdown.type).toBe("UNKNOWN");
    expect(result.risk).toBe("HIGH");
  });
});

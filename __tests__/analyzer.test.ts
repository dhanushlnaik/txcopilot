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
  it("maps 0x1771 to slippage error", () => {
    const rawTx = buildRawTx({ err: { InstructionError: [1, { Custom: 6001 }] } });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.code === "0x1771")).toBe(true);
  });

  it("maps 0x1 to insufficient funds", () => {
    const rawTx = buildRawTx({ err: { InstructionError: [1, { Custom: 1 }] } });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.code === "0x1")).toBe(true);
  });

  it("maps Jupiter 0x1778 correctly", () => {
    const rawTx = buildRawTx({ err: { InstructionError: [1, { Custom: 6008 }] } });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.code === "0x1778")).toBe(true);
  });

  it("maps Orca 0x177c correctly", () => {
    const rawTx = buildRawTx({ err: { InstructionError: [1, { Custom: 6012 }] } });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.code === "0x177c")).toBe(true);
  });

  it("maps Pump.fun 0x7d6 correctly", () => {
    const rawTx = buildRawTx({ err: { InstructionError: [1, { Custom: 2006 }] } });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.code === "0x7d6")).toBe(true);
  });

  it("detects insufficient funds from logs", () => {
    const rawTx = buildRawTx({ logs: ["Program log: insufficient funds"] });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.label === "Insufficient Funds")).toBe(true);
  });

  it("detects expired blockhash from logs", () => {
    const rawTx = buildRawTx({ logs: ["Blockhash not found"] });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.label === "Expired Blockhash")).toBe(true);
  });

  it("detects compute units exceeded", () => {
    const rawTx = buildRawTx({ logs: ["Program failed: exceeded CUs meter"] });
    const result = analyzeTransaction(rawTx, null, VALID_SIGNATURE);

    expect(result.reasons.some((reason) => reason.label === "Compute Units Exceeded")).toBe(true);
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

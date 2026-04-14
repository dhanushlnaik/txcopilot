import { describe, expect, it } from "vitest";
import { analyzeSimulation } from "@/lib/analyzer";
import type { SimulateTransactionResponse } from "@/lib/analyzer";

// ===========================
// Test helper
// ===========================

type SimResultOverrides = {
  err?: unknown;
  logs?: string[];
  unitsConsumed?: number;
};

function makeSimResult(overrides: SimResultOverrides = {}): SimulateTransactionResponse {
  return {
    context: { slot: 100 },
    value: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      err: ("err" in overrides ? overrides.err : null) as any,
      logs: overrides.logs ?? [],
      accounts: null,
      unitsConsumed: overrides.unitsConsumed ?? 50_000,
      returnData: null,
    },
  };
}

// ===========================
// SUCCESS CASES
// ===========================

describe("analyzeSimulation — success", () => {
  it("null error → safe, confidence 1.0, source simulation", () => {
    const r = analyzeSimulation(makeSimResult({ err: null }));
    expect(r.risk).toBe("safe");
    expect(r.confidence).toBe(1.0);
    expect(r.source).toBe("simulation");
    expect(r.category).toBeNull();
  });
});

// ===========================
// LAYER 2: TOP-LEVEL STRING ERRORS
// ===========================

describe("analyzeSimulation — top-level string errors (layer 2)", () => {
  it("BlockhashNotFound → stale_blockhash, confidence 1.0", () => {
    const r = analyzeSimulation(makeSimResult({ err: "BlockhashNotFound" }));
    expect(r.risk).toBe("fail");
    expect(r.category).toBe("stale_blockhash");
    expect(r.confidence).toBe(1.0);
    expect(r.source).toBe("simulation");
    expect(r.fix).toBeTruthy();
  });

  it("AccountNotFound string → account_not_found, confidence 1.0", () => {
    const r = analyzeSimulation(makeSimResult({ err: "AccountNotFound" }));
    expect(r.category).toBe("account_not_found");
    expect(r.confidence).toBe(1.0);
  });
});

// ===========================
// LAYER 2: CUSTOM CODE ERRORS
// ===========================

describe("analyzeSimulation — InstructionError Custom codes (layer 2)", () => {
  it("Custom code 6001 → slippage, confidence 1.0", () => {
    const r = analyzeSimulation(
      makeSimResult({ err: { InstructionError: [2, { Custom: 6001 }] } })
    );
    expect(r.risk).toBe("fail");
    expect(r.category).toBe("slippage");
    expect(r.confidence).toBe(1.0);
    expect(r.source).toBe("simulation");
    expect(r.fixParams?.type).toBe("slippage");
  });

  it("Custom code 6008 → slippage (Orca TokenMinSubceeded)", () => {
    const r = analyzeSimulation(
      makeSimResult({ err: { InstructionError: [0, { Custom: 6008 }] } })
    );
    expect(r.category).toBe("slippage");
  });

  it("Custom code 6012 → slippage (Orca TokenMaxExceeded)", () => {
    const r = analyzeSimulation(
      makeSimResult({ err: { InstructionError: [1, { Custom: 6012 }] } })
    );
    expect(r.category).toBe("slippage");
  });

  it("Unknown custom code → program_error, confidence 0.7", () => {
    const r = analyzeSimulation(
      makeSimResult({ err: { InstructionError: [0, { Custom: 99999 }] } })
    );
    expect(r.category).toBe("program_error");
    expect(r.confidence).toBe(0.7);
  });
});

// ===========================
// LAYER 2: STRING TYPE INSTRUCTIONERROR
// ===========================

describe("analyzeSimulation — InstructionError string types (layer 2)", () => {
  it("ComputationalBudgetExceeded → compute_exceeded, confidence 1.0", () => {
    const r = analyzeSimulation(
      makeSimResult({ err: { InstructionError: [0, "ComputationalBudgetExceeded"] } })
    );
    expect(r.category).toBe("compute_exceeded");
    expect(r.confidence).toBe(1.0);
    expect(r.fixParams?.type).toBe("priority_fee");
  });

  it("InsufficientFunds string → insufficient_funds, confidence 1.0", () => {
    const r = analyzeSimulation(
      makeSimResult({ err: { InstructionError: [0, "InsufficientFunds"] } })
    );
    expect(r.category).toBe("insufficient_funds");
    expect(r.confidence).toBe(1.0);
  });
});

// ===========================
// LAYER 2b: COMPUTE RATIO
// ===========================

describe("analyzeSimulation — compute ratio checks (layer 2b)", () => {
  it("unitsConsumed > 95% of budget → compute_exceeded, warning risk", () => {
    const r = analyzeSimulation(
      makeSimResult({ err: null, unitsConsumed: 195_000 }),
      { computeBudget: 200_000 }
    );
    expect(r.category).toBe("compute_exceeded");
    expect(r.confidence).toBe(1.0);
    expect(r.source).toBe("simulation");
    // err was null so risk is warning, not fail
    expect(r.risk).toBe("warning");
  });

  it("unitsConsumed 87% of budget → warning risk, category still null", () => {
    const r = analyzeSimulation(
      makeSimResult({ err: null, unitsConsumed: 174_000 }),
      { computeBudget: 200_000 }
    );
    expect(r.risk).toBe("warning");
    expect(r.category).toBeNull();
  });

  it("unitsConsumed 50% of budget → safe, no warning", () => {
    const r = analyzeSimulation(
      makeSimResult({ err: null, unitsConsumed: 100_000 }),
      { computeBudget: 200_000 }
    );
    expect(r.risk).toBe("safe");
  });
});

// ===========================
// LAYER 3: LOG FALLBACK
// ===========================

describe("analyzeSimulation — log fallback (layer 3)", () => {
  it("layer 2 result is not overridden by log match", () => {
    // Custom 99999 → program_error at layer 2 (source: simulation, confidence 0.7)
    // Log match should NOT fire — layer 3 only runs when category is null
    const r = analyzeSimulation(
      makeSimResult({
        err: { InstructionError: [0, { Custom: 99999 }] },
        logs: ["Program log: exceeds desired slippage limit"],
      })
    );
    expect(r.category).toBe("program_error");
    expect(r.source).toBe("simulation");
  });

  it("unknown err shape + slippage log → log fallback fires, confidence 0.5", () => {
    // { SomeUnknownErrShape: true } has no InstructionError key → falls through to layer 3
    const r = analyzeSimulation(
      makeSimResult({
        err: { SomeUnknownErrShape: true },
        logs: ["Program log: exceeds desired slippage limit"],
      })
    );
    expect(r.confidence).toBeLessThanOrEqual(0.5);
    expect(r.source).toBe("logs");
  });
});

// ===========================
// NO DUPLICATE REASONS
// ===========================

describe("analyzeSimulation — no duplication", () => {
  it("slippage error code + slippage log → single result from layer 2", () => {
    const r = analyzeSimulation(
      makeSimResult({
        err: { InstructionError: [0, { Custom: 6001 }] },
        logs: [
          "Program log: SlippageToleranceExceeded",
          "Program log: exceeds desired slippage limit",
        ],
      })
    );
    // Layer 2 wins with confidence 1.0 — layer 3 never runs
    expect(r.category).toBe("slippage");
    expect(r.confidence).toBe(1.0);
    expect(r.fix).toBeTruthy();
  });
});

// ===========================
// FIXPARAMS
// ===========================

describe("analyzeSimulation — fixParams", () => {
  it("slippage → fixParams has type slippage and slippageBps", () => {
    const r = analyzeSimulation(
      makeSimResult({ err: { InstructionError: [0, { Custom: 6001 }] } })
    );
    expect(r.fixParams).not.toBeNull();
    expect(r.fixParams?.type).toBe("slippage");
    // type narrowing
    if (r.fixParams?.type === "slippage") {
      expect(r.fixParams.slippageBps).toBeGreaterThan(0);
    }
  });

  it("stale_blockhash → fixParams type retry", () => {
    const r = analyzeSimulation(makeSimResult({ err: "BlockhashNotFound" }));
    expect(r.fixParams?.type).toBe("retry");
  });

  it("insufficient_funds → fixParams null", () => {
    const r = analyzeSimulation(
      makeSimResult({ err: { InstructionError: [0, "InsufficientFunds"] } })
    );
    expect(r.fixParams).toBeNull();
  });
});

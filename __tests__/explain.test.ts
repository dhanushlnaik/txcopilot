import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult } from "@/lib/types";
import { POST as explainPost } from "@/app/api/explain/route";

const SAMPLE_ANALYSIS: AnalysisResult = {
  risk: "HIGH",
  confidence: 91,
  reasons: [
    {
      label: "Program Execution Failed",
      description: "The instruction failed in runtime execution.",
      severity: "HIGH",
    },
  ],
  fixes: [
    {
      action: "Increase Compute Budget",
      description: "Request more CUs before swap instruction.",
      priority: "critical",
    },
  ],
  breakdown: {
    signature: "sample-signature",
    type: "UNKNOWN",
    status: "failed",
    fee: 0.000005,
    signers: [],
    instructionCount: 2,
    logs: ["Program failed to complete"],
  },
};

const VALID_BREAKDOWN_TEXT = `Transaction Summary:
The transaction failed during on-chain execution after the sell instruction attempted to route through a pool path that did not satisfy runtime constraints.

Known Error Evidence:
Mapped reason codes: Program Execution Failed | Program log evidence indicates an execution failure during instruction processing.

What Is Unknown:
The exact custom numeric error code is not present in the provided reasons or logs, so the precise program enum variant cannot be confirmed from current evidence.

Next Debug Steps:
Re-run simulation with full logs enabled, capture the exact custom error code if present, verify pool accounts and token program compatibility, and retry with a higher compute budget and refreshed route parameters.`;

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GEMINI_API_KEY;
});

describe("POST /api/explain", () => {
  it("returns 503 when GEMINI_API_KEY is missing", async () => {
    const response = await explainPost(
      new Request("http://localhost/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: "sample-signature",
          analysis: SAMPLE_ANALYSIS,
        }),
      })
    );

    expect(response.status).toBe(503);
  });

  it("returns 400 for invalid payload", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const response = await explainPost(
      new Request("http://localhost/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: "" }),
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns streamed explanation text on success", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: VALID_BREAKDOWN_TEXT,
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await explainPost(
      new Request("http://localhost/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: "sample-signature",
          analysis: SAMPLE_ANALYSIS,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    await expect(response.text()).resolves.toContain("Transaction Summary:");
  });

  it("falls back to another Gemini model when first returns 503", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_EXPLAIN_MODEL = "gemini-1.5-flash";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { status: "UNAVAILABLE", message: "high demand" },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: VALID_BREAKDOWN_TEXT }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await explainPost(
      new Request("http://localhost/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: "sample-signature",
          analysis: SAMPLE_ANALYSIS,
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Known Error Evidence:");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

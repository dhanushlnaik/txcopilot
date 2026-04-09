import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as analyzePost } from "@/app/api/analyze/route";
import { GET as networkGet } from "@/app/api/network/route";
import { POST as simulatePost } from "@/app/api/simulate/route";

const VALID_SIGNATURE =
  "56YU2EU1AkRuZjDg2PQ8b4G2GK4iyrFq8mD6RzNhtD21pQXC7Hdb6VJqPdqv2MjqbKDVTmfoyYhtrKgHRNNuwbo";
const VALID_WALLET = "11111111111111111111111111111111";

function jsonRequest(url: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("API validation routes", () => {
  it("POST /api/analyze returns 400 without signature", async () => {
    const response = await analyzePost(jsonRequest("http://localhost/api/analyze", {}));

    expect(response.status).toBe(400);
  });

  it("POST /api/analyze returns 400 for invalid signature", async () => {
    const response = await analyzePost(
      jsonRequest("http://localhost/api/analyze", { signature: "invalid" })
    );

    expect(response.status).toBe(400);
  });

  it("POST /api/simulate returns 400 without transaction", async () => {
    const response = await simulatePost(
      jsonRequest("http://localhost/api/simulate", {})
    );

    expect(response.status).toBe(400);
  });

  it("POST /api/simulate returns 400 for invalid base64", async () => {
    const response = await simulatePost(
      jsonRequest("http://localhost/api/simulate", { transaction: "@@@" })
    );

    expect(response.status).toBe(400);
  });

  it("POST /api/simulate returns 400 for too-short payload", async () => {
    const tooShortPayload = Buffer.from("abc").toString("base64");
    const response = await simulatePost(
      jsonRequest("http://localhost/api/simulate", { transaction: tooShortPayload })
    );

    expect(response.status).toBe(400);
  });

  it("GET /api/network returns 200", async () => {
    const response = await networkGet();

    expect(response.status).toBe(200);
  });
});

describe("Webhook routes", () => {
  beforeEach(async () => {
    vi.resetModules();
    delete process.env.WEBHOOK_ADMIN_KEY;
    const webhookStore = await import("@/lib/webhook-store");
    webhookStore.__resetWebhookStore();
  });

  it("creates and lists webhook subscriptions", async () => {
    const { GET, POST } = await import("@/app/api/webhooks/route");

    const createResponse = await POST(
      jsonRequest("http://localhost/api/webhooks", {
        walletAddress: VALID_WALLET,
        webhookUrl: "https://example.com/webhook",
        events: ["failed"],
      })
    );
    const created = (await createResponse.json()) as {
      success: boolean;
      data?: { id: string };
    };

    expect(createResponse.status).toBe(201);
    expect(created.success).toBe(true);
    expect(created.data?.id).toBeTypeOf("string");

    const listResponse = await GET(new Request("http://localhost/api/webhooks"));
    const listed = (await listResponse.json()) as {
      success: boolean;
      data?: Array<{ id: string }>;
    };

    expect(listResponse.status).toBe(200);
    expect(listed.success).toBe(true);
    expect(listed.data?.length).toBe(1);
  });

  it("deletes webhook subscriptions", async () => {
    const webhooksRoute = await import("@/app/api/webhooks/route");
    const deleteRoute = await import("@/app/api/webhooks/[id]/route");

    const createResponse = await webhooksRoute.POST(
      jsonRequest("http://localhost/api/webhooks", {
        walletAddress: VALID_WALLET,
        webhookUrl: "https://example.com/webhook",
        events: ["failed"],
      })
    );
    const created = (await createResponse.json()) as {
      data?: { id: string };
    };

    const deleteResponse = await deleteRoute.DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: String(created.data?.id) }),
    });
    const listResponse = await webhooksRoute.GET(
      new Request("http://localhost/api/webhooks")
    );
    const listed = (await listResponse.json()) as {
      data?: Array<{ id: string }>;
    };

    expect(deleteResponse.status).toBe(200);
    expect(listed.data?.length).toBe(0);
  });

  it("runs webhook check and sends alerts", async () => {
    vi.resetModules();

    const nowEpoch = Math.floor(Date.now() / 1000);
    const simulatedRawTx = {
      slot: 123,
      meta: {
        err: { InstructionError: [1, { Custom: 1 }] },
        fee: 5000,
        logMessages: ["Program log: insufficient funds"],
        innerInstructions: [],
      },
      transaction: {
        message: {
          accountKeys: ["Signer1111111111111111111111111111111111111"],
          instructions: [{}],
          header: { numRequiredSignatures: 1 },
        },
      },
    };

    vi.doMock("@/lib/solana", () => ({
      getNetworkStatus: vi.fn().mockResolvedValue({
        congestionLevel: "LOW",
        avgTps: 2000,
        medianFee: 1,
        recommendedFee: 2,
        statusMessage: "ok",
      }),
      getRecentSignaturesForAddress: vi.fn().mockResolvedValue([
        {
          signature: VALID_SIGNATURE,
          blockTime: nowEpoch,
        },
      ]),
      getTransactionDetails: vi.fn().mockResolvedValue(simulatedRawTx),
      getEnhancedTransaction: vi.fn().mockResolvedValue(null),
    }));

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const webhookStore = await import("@/lib/webhook-store");
    webhookStore.__resetWebhookStore();

    const webhooksRoute = await import("@/app/api/webhooks/route");
    const checkRoute = await import("@/app/api/webhooks/check/route");

    await webhooksRoute.POST(
      jsonRequest("http://localhost/api/webhooks", {
        walletAddress: VALID_WALLET,
        webhookUrl: "https://example.com/webhook",
        events: ["failed", "high_risk"],
      })
    );

    const response = await checkRoute.POST(
      jsonRequest("http://localhost/api/webhooks/check", {})
    );
    const payload = (await response.json()) as {
      success: boolean;
      data: { checked: number; alertsSent: number; errors: string[] };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.checked).toBe(1);
    expect(payload.data.alertsSent).toBeGreaterThanOrEqual(1);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("force-test mode sends test alerts", async () => {
    vi.resetModules();

    vi.doMock("@/lib/solana", () => ({
      getNetworkStatus: vi.fn().mockResolvedValue({
        congestionLevel: "LOW",
        avgTps: 2000,
        medianFee: 1,
        recommendedFee: 2,
        statusMessage: "ok",
      }),
      getRecentSignaturesForAddress: vi.fn().mockResolvedValue([]),
      getTransactionDetails: vi.fn().mockResolvedValue(null),
      getEnhancedTransaction: vi.fn().mockResolvedValue(null),
    }));

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const webhookStore = await import("@/lib/webhook-store");
    webhookStore.__resetWebhookStore();

    const webhooksRoute = await import("@/app/api/webhooks/route");
    const checkRoute = await import("@/app/api/webhooks/check/route");

    await webhooksRoute.POST(
      jsonRequest("http://localhost/api/webhooks", {
        walletAddress: VALID_WALLET,
        webhookUrl: "https://example.com/webhook",
        events: ["failed", "high_risk"],
      })
    );

    const response = await checkRoute.POST(
      jsonRequest("http://localhost/api/webhooks/check", { forceTest: true })
    );
    const payload = (await response.json()) as {
      success: boolean;
      data: { checked: number; alertsSent: number; errors: string[]; forceTest: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.forceTest).toBe(true);
    expect(payload.data.alertsSent).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns 401 when admin key is configured and header is missing", async () => {
    process.env.WEBHOOK_ADMIN_KEY = "secret-key";
    const { GET } = await import("@/app/api/webhooks/route");

    const response = await GET(new Request("http://localhost/api/webhooks"));
    expect(response.status).toBe(401);
  });

  it("accepts request with matching admin key header", async () => {
    process.env.WEBHOOK_ADMIN_KEY = "secret-key";
    const { GET } = await import("@/app/api/webhooks/route");

    const response = await GET(
      new Request("http://localhost/api/webhooks", {
        headers: {
          "x-soltrac-admin-key": "secret-key",
        },
      })
    );
    expect(response.status).toBe(200);
  });
});

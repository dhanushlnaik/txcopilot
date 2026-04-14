import { NextResponse } from "next/server";
import type { AnalysisResult } from "@/lib/types";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.GEMINI_EXPLAIN_MODEL || "gemini-1.5-flash";
const GEMINI_FALLBACK_MODELS = [
  DEFAULT_MODEL,
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-live-2.5-flash-preview",
];

function isValidExplainPayload(body: unknown): body is {
  signature: string;
  analysis: AnalysisResult;
} {
  if (!body || typeof body !== "object") {
    return false;
  }

  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.signature === "string" &&
    Boolean(candidate.signature.trim()) &&
    typeof candidate.analysis === "object" &&
    candidate.analysis !== null
  );
}

function extractOutputText(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }

  const typed = data as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const chunks: string[] = [];
  for (const candidate of typed.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.text) {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function uniqueModels(models: string[]): string[] {
  return Array.from(new Set(models.filter(Boolean)));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}

function isLowQualityExplanation(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 180) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  const requiredSections = [
    "transaction summary:",
    "known error evidence:",
    "what is unknown:",
    "next debug steps:",
  ];
  const hasAllSections = requiredSections.every((section) => lower.includes(section));
  if (!hasAllSections) {
    return true;
  }

  // Heuristic: incomplete ending often indicates truncation.
  const endsWithTerminalPunctuation = /[.!?)]$/.test(trimmed);
  if (!endsWithTerminalPunctuation) {
    return true;
  }

  return false;
}

function streamText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const CHUNK_SIZE = 18;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        const chunk = text.slice(i, i + CHUNK_SIZE);
        controller.enqueue(encoder.encode(chunk));
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
      controller.close();
    },
  });
}

function extractKnownErrorEvidence(analysis: AnalysisResult): string {
  const codedReasons = analysis.reasons
    .filter((reason) => Boolean(reason.code))
    .map((reason) => `${reason.label} (${reason.code})`);

  const customLog = analysis.breakdown.logs.find((log) =>
    /custom program error/i.test(log)
  );

  const customHex = customLog?.match(/custom program error:\s*(0x[0-9a-f]+)/i)?.[1];
  const customDecimal = customLog?.match(/custom program error:\s*(\d+)/i)?.[1];

  const evidence: string[] = [];
  if (codedReasons.length > 0) {
    evidence.push(`Mapped reason codes: ${codedReasons.join(", ")}`);
  }
  if (customHex) {
    evidence.push(`Custom program error from logs: ${customHex}`);
  } else if (customDecimal) {
    evidence.push(`Custom program error from logs (decimal): ${customDecimal}`);
  }

  if (evidence.length === 0) {
    return "No exact numeric custom error code found in reasons/logs.";
  }

  return evidence.join(" | ");
}

async function requestGeminiBreakdown(params: {
  apiKey: string;
  model: string;
  signature: string;
  analysis: AnalysisResult;
  knownErrorEvidence: string;
}): Promise<{
  ok: boolean;
  status: number;
  errorText?: string;
  explanation?: string;
}> {
  const { apiKey, model, signature, analysis, knownErrorEvidence } = params;
  const aiResponse = await fetch(
    `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are a Solana transaction debugger. Give concise, practical explanations with likely root cause, why it happened, and concrete next fixes.
Write plain text only. Do not use markdown symbols such as #, *, -, or backticks.
Use short paragraphs and clear section labels in plain text.
Never invent a custom error code. If the exact code is missing, explicitly say so.
Do not say "custom error 0" unless zero is explicitly present in the evidence.

Required section labels:
Transaction Summary:
Known Error Evidence:
What Is Unknown:
Next Debug Steps:

Explain this Solana tx analysis in plain language for a developer.

Signature: ${signature}
Known Error Evidence: ${knownErrorEvidence}

Analysis JSON:
${JSON.stringify(analysis, null, 2)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 420,
        },
      }),
    }
  );

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    return {
      ok: false,
      status: aiResponse.status,
      errorText,
    };
  }

  const aiData = await aiResponse.json();
  const explanation =
    extractOutputText(aiData) ||
    "No detailed breakdown was generated. Please retry with more detailed logs.";

  return {
    ok: true,
    status: aiResponse.status,
    explanation,
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "Detailed breakdown is unavailable. Set GEMINI_API_KEY.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid JSON body.",
      },
      { status: 400 }
    );
  }

  if (!isValidExplainPayload(body)) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing or invalid signature/analysis payload.",
      },
      { status: 400 }
    );
  }

  try {
    const knownErrorEvidence = extractKnownErrorEvidence(body.analysis);
    const models = uniqueModels(GEMINI_FALLBACK_MODELS);
    const providerErrors: string[] = [];
    let explanation = "";
    let delivered = false;

    for (const model of models) {
      const result = await requestGeminiBreakdown({
        apiKey,
        model,
        signature: body.signature,
        analysis: body.analysis,
        knownErrorEvidence,
      });
      let shouldTryNextModel = false;

      if (result.ok && result.explanation) {
        if (isLowQualityExplanation(result.explanation)) {
          providerErrors.push(`${model}: low-quality or truncated output`);
          shouldTryNextModel = true;
        } else {
          explanation = result.explanation;
          delivered = true;
          break;
        }
      }

      if (!result.ok) {
        providerErrors.push(
          `${model}: status ${result.status}${result.errorText ? ` ${result.errorText.slice(0, 120)}` : ""}`
        );
        shouldTryNextModel = isRetryableStatus(result.status);
      }

      if (!shouldTryNextModel) {
        break;
      }
    }

    if (!delivered) {
      return NextResponse.json(
        {
          success: false,
          error: `AI provider error after fallback attempts: ${providerErrors.join(" | ")}`,
        },
        { status: 502 }
      );
    }

    return new Response(streamText(explanation), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to generate detailed breakdown: ${message}`,
      },
      { status: 500 }
    );
  }
}

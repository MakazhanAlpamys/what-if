import { NextRequest } from "next/server";
import { createSSEStream, SSE_HEADERS } from "./sse";

interface K2Config {
  apiKey: string;
  apiUrl: string;
  model: string;
}

export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function getK2Config(): K2Config | null {
  const apiKey = process.env.K2_API_KEY;
  const apiUrl = process.env.K2_API_URL;
  const model = process.env.K2_MODEL;
  if (!apiKey || !apiUrl || !model) return null;
  return { apiKey, apiUrl, model };
}

export function validateScenario(scenario: unknown): string | null {
  if (!scenario || typeof scenario !== "string") return "Scenario is required";
  if (scenario.length > 2000) return "Scenario is too long. Maximum 2000 characters.";
  return null;
}

export async function streamFromK2(
  config: K2Config,
  messages: { role: string; content: string }[]
): Promise<Response> {
  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    console.error("K2 API error:", response.status, await response.text());
    return Response.json(
      { error: "AI service is temporarily unavailable. Please try again." },
      { status: 502 }
    );
  }

  return new Response(createSSEStream(response), { headers: SSE_HEADERS });
}

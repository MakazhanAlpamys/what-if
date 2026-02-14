import { NextRequest } from "next/server";
import { createSSEStream, SSE_HEADERS } from "@/lib/sse";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const EXPAND_SYSTEM_PROMPT = `You are an alternate history simulator. The user will provide context about
an alternate history timeline — a chain of events from the initial divergence point to a specific branch.
Your task is to generate 2-3 NEW sub-branches that continue from that specific branch.

IMPORTANT: You must respond with ONLY valid JSON (no markdown, no code fences, no extra text).
The JSON must follow this exact structure:

{
  "branches": [
    {
      "id": "<unique-string>",
      "year": <number>,
      "title": "Consequence title",
      "description": "Detailed description of what happens (2-3 sentences)",
      "impact": "critical" | "high" | "medium" | "low",
      "branches": []
    }
  ]
}

Rules:
- Generate 2-3 new branches
- Years must be after the parent event's year and chronologically realistic
- Show cause-and-effect reasoning in descriptions
- Be creative but historically plausible
- IDs must be unique (use format: "expand-<timestamp>-<index>")
- Respond in the same language as the user's input`;

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const { allowed, resetTime } = checkRateLimit(`expand:${ip}`, { limit: 20, windowSeconds: 60 });
  if (!allowed) return rateLimitResponse(resetTime);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { scenario, chain } = body;

  if (!scenario || typeof scenario !== "string") {
    return Response.json({ error: "Scenario is required" }, { status: 400 });
  }

  if (scenario.length > 2000) {
    return Response.json(
      { error: "Scenario is too long. Maximum 2000 characters." },
      { status: 400 }
    );
  }

  if (
    !Array.isArray(chain) ||
    chain.length === 0 ||
    !chain.every(
      (n: unknown) =>
        typeof n === "object" &&
        n !== null &&
        typeof (n as Record<string, unknown>).year === "number" &&
        typeof (n as Record<string, unknown>).title === "string" &&
        typeof (n as Record<string, unknown>).description === "string"
    )
  ) {
    return Response.json(
      { error: "Chain must be a non-empty array of timeline nodes" },
      { status: 400 }
    );
  }

  if (chain.length > 20) {
    return Response.json({ error: "Chain is too deep" }, { status: 400 });
  }

  const apiKey = process.env.K2_API_KEY;
  const apiUrl = process.env.K2_API_URL;
  const model = process.env.K2_MODEL;

  if (!apiKey || !apiUrl || !model) {
    return Response.json({ error: "API configuration missing" }, { status: 500 });
  }

  const userMessage = `Original scenario: "${scenario}"

Timeline chain leading to this branch:
${chain.map((node: { year: number; title: string; description: string }, i: number) => `${i + 1}. [${node.year}] ${node.title}: ${node.description}`).join("\n")}

Generate 2-3 new sub-branches that continue from the last event in the chain.`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: EXPAND_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      stream: true,
      max_tokens: 4096,
    }),
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

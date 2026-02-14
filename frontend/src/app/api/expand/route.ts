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
    request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
  const { allowed, resetTime } = checkRateLimit(`expand:${ip}`, { limit: 20, windowSeconds: 60 });
  if (!allowed) return rateLimitResponse(resetTime);

  const { scenario, chain } = await request.json();

  if (!scenario || !chain) {
    return Response.json({ error: "Scenario and chain are required" }, { status: 400 });
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
    const errorText = await response.text();
    return Response.json(
      { error: "K2 API error", details: errorText },
      { status: response.status }
    );
  }

  return new Response(createSSEStream(response), { headers: SSE_HEADERS });
}

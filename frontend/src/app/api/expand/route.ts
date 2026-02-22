import { NextRequest } from "next/server";
import { getClientIP, getK2Config, validateScenario, streamFromK2 } from "@/lib/k2-api";
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
  const ip = getClientIP(request);
  const { allowed, resetTime } = checkRateLimit(`expand:${ip}`, { limit: 20, windowSeconds: 60 });
  if (!allowed) return rateLimitResponse(resetTime);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scenarioError = validateScenario(body.scenario);
  if (scenarioError) return Response.json({ error: scenarioError }, { status: 400 });

  const { chain } = body;

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

  const config = getK2Config();
  if (!config) return Response.json({ error: "API configuration missing" }, { status: 500 });

  const userMessage = `Original scenario: "${body.scenario}"

Timeline chain leading to this branch:
${chain.map((node: { year: number; title: string; description: string }, i: number) => `${i + 1}. [${node.year}] ${node.title}: ${node.description}`).join("\n")}

Generate 2-3 new sub-branches that continue from the last event in the chain.`;

  return streamFromK2(config, [
    { role: "system", content: EXPAND_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ]);
}

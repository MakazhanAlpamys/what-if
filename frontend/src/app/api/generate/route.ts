import { NextRequest } from "next/server";
import { getClientIP, getK2Config, validateScenario, streamFromK2 } from "@/lib/k2-api";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const SYSTEM_PROMPT = `You are an alternate history simulator inspired by Marvel's "What If...?" series.
The user will provide a "what-if" historical scenario. Your task is to generate a branching timeline
of alternate consequences.

IMPORTANT: You must respond with ONLY valid JSON (no markdown, no code fences, no extra text).
The JSON must follow this exact structure:

{
  "scenario": "The user's what-if question restated clearly",
  "realHistory": "A brief 1-2 sentence summary of what actually happened in real history",
  "timeline": {
    "id": "root",
    "year": <number>,
    "title": "The initial divergence point",
    "description": "Detailed description of what changes at this moment (2-3 sentences)",
    "impact": "critical",
    "branches": [
      {
        "id": "branch-1",
        "year": <number>,
        "title": "First major consequence",
        "description": "Detailed description (2-3 sentences)",
        "impact": "critical" | "high" | "medium" | "low",
        "branches": [
          {
            "id": "branch-1-1",
            "year": <number>,
            "title": "Sub-consequence",
            "description": "Detailed description (2-3 sentences)",
            "impact": "critical" | "high" | "medium" | "low",
            "branches": []
          }
        ]
      }
    ]
  }
}

Rules:
- Generate 2-3 branches at the first level
- Each first-level branch should have 1-2 sub-branches
- Years must be chronologically ordered and realistic
- Impact levels: "critical" = changes world history, "high" = major regional impact, "medium" = significant but contained, "low" = minor ripple effect
- IDs must be unique strings
- Descriptions should show cause-and-effect reasoning
- Be creative but historically plausible
- Respond in the same language as the user's input`;

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed, resetTime } = checkRateLimit(`generate:${ip}`, { limit: 10, windowSeconds: 60 });
  if (!allowed) return rateLimitResponse(resetTime);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const scenarioError = validateScenario(body.scenario);
  if (scenarioError) return Response.json({ error: scenarioError }, { status: 400 });

  const config = getK2Config();
  if (!config) return Response.json({ error: "API configuration missing" }, { status: 500 });

  return streamFromK2(config, [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: body.scenario },
  ]);
}

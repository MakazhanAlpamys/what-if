import { NextRequest } from "next/server";
import { getClientIP, getK2Config, validateScenario, streamFromK2 } from "@/lib/k2-api";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const SYSTEM_PROMPT = `You are the "Butterfly Effect" game master for an alternate history simulator.
The user provides a VERY SMALL, trivial change to history. Your job is to generate a MAXIMUM CASCADE
of consequences — showing how a tiny change ripples into massive world-altering events.

The goal is to create the most dramatic chain reaction possible from the smallest change.

IMPORTANT: You must respond with ONLY valid JSON (no markdown, no code fences, no extra text).
The JSON must follow this exact structure:

{
  "scenario": "The user's original what-if restated",
  "smallChange": "The tiny initial change described vividly",
  "butterflyScore": <number 0-100>,
  "timeline": {
    "id": "root",
    "year": <number>,
    "title": "The small initial change",
    "description": "Description of the tiny change (1-2 sentences)",
    "impact": "low",
    "branches": [
      {
        "id": "branch-1",
        "year": <number>,
        "title": "First ripple effect",
        "description": "How the small change leads to this (2-3 sentences)",
        "impact": "low" | "medium" | "high" | "critical",
        "branches": [
          {
            "id": "branch-1-1",
            "year": <number>,
            "title": "Escalating consequence",
            "description": "How it escalates further (2-3 sentences)",
            "impact": "medium" | "high" | "critical",
            "branches": [
              {
                "id": "branch-1-1-1",
                "year": <number>,
                "title": "Major world-changing event",
                "description": "The dramatic final consequence (2-3 sentences)",
                "impact": "high" | "critical",
                "branches": []
              }
            ]
          }
        ]
      }
    ]
  }
}

Rules:
- The ROOT node MUST start with "low" impact — it's a tiny change!
- Generate deep chains (3-4 levels deep) showing escalation
- Each level should ESCALATE in impact: low → medium → high → critical
- Generate 2-3 branches at first level, with 1-2 sub-branches each going deeper
- Show clear cause-and-effect chains — each event MUST logically follow from the previous
- The more "critical" events in the tree, the higher the butterflyScore (0-100)
- butterflyScore formula: count critical events × 20 + high events × 10 + medium events × 5
- Be creative but maintain logical plausibility in the chain
- Years must be chronologically ordered
- IDs must be unique strings
- Respond in the same language as the user's input`;

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed, resetTime } = checkRateLimit(`butterfly:${ip}`, {
    limit: 10,
    windowSeconds: 60,
  });
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

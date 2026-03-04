import { NextRequest } from "next/server";
import { getClientIP, getK2Config, validateScenario, streamFromK2 } from "@/lib/k2-api";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const SYSTEM_PROMPT = `You are a "Reality vs Alternative" history comparison generator.
Given a what-if scenario, generate TWO parallel timelines:
1. The REAL history (what actually happened)
2. The ALTERNATIVE history (what would have happened if the scenario were true)

Show where the timelines DIVERGE and where they might CONVERGE again (where the same outcome occurs
in both timelines despite different paths).

IMPORTANT: You must respond with ONLY valid JSON (no markdown, no code fences, no extra text).
The JSON must follow this exact structure:

{
  "scenario": "The what-if scenario",
  "realTimeline": {
    "id": "real-root",
    "year": <number>,
    "title": "Real: Starting point",
    "description": "What actually happened at this moment (2-3 sentences)",
    "impact": "critical",
    "branches": [
      {
        "id": "real-1",
        "year": <number>,
        "title": "Real: What followed",
        "description": "Description (2-3 sentences)",
        "impact": "critical" | "high" | "medium" | "low",
        "branches": [
          {
            "id": "real-1-1",
            "year": <number>,
            "title": "Real: Later development",
            "description": "Description (2-3 sentences)",
            "impact": "critical" | "high" | "medium" | "low",
            "branches": []
          }
        ]
      }
    ]
  },
  "altTimeline": {
    "id": "alt-root",
    "year": <number>,
    "title": "Alt: The divergence point",
    "description": "What would have changed (2-3 sentences)",
    "impact": "critical",
    "branches": [
      {
        "id": "alt-1",
        "year": <number>,
        "title": "Alt: Alternative consequence",
        "description": "Description (2-3 sentences)",
        "impact": "critical" | "high" | "medium" | "low",
        "branches": [
          {
            "id": "alt-1-1",
            "year": <number>,
            "title": "Alt: Further divergence",
            "description": "Description (2-3 sentences)",
            "impact": "critical" | "high" | "medium" | "low",
            "branches": []
          }
        ]
      }
    ]
  },
  "divergencePoints": [
    {
      "realNodeId": "real-root",
      "altNodeId": "alt-root",
      "year": <number>,
      "description": "Where and why the timelines diverge"
    }
  ],
  "convergencePoints": [
    {
      "realNodeId": "real-1-1",
      "altNodeId": "alt-1-1",
      "year": <number>,
      "description": "Where the timelines converge back to similar outcomes (if any)"
    }
  ]
}

Rules:
- Both timelines should have similar depth (2-3 levels each)
- Generate 2-3 first-level branches per timeline
- Prefix real timeline IDs with "real-" and alt timeline IDs with "alt-"
- Prefix real timeline titles with "Real: " and alt timeline titles with "Alt: "
- divergencePoints and convergencePoints nodeIds MUST reference actual node IDs
- There should be at least 1 divergence point
- convergencePoints can be empty if timelines never reconverge
- Be historically accurate for the real timeline
- Respond in the same language as the user's input`;

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed, resetTime } = checkRateLimit(`compare:${ip}`, { limit: 10, windowSeconds: 60 });
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

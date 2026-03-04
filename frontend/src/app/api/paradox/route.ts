import { NextRequest } from "next/server";
import { getClientIP, getK2Config, fetchFromK2 } from "@/lib/k2-api";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isParadoxResponse } from "@/lib/validate";
import { extractJSON } from "@/lib/stream";

const PARADOX_SYSTEM_PROMPT = `You are a logic analyzer for alternate history timelines.
Analyze the following timeline tree for logical contradictions, impossible sequences, or paradoxes.

A paradox is when:
- Event B depends on conditions that Event A made impossible
- Two events in different branches contradict each other's premises
- A consequence precedes its cause chronologically (wrong year order)
- An event's described outcome contradicts its own setup
- Technology or social changes happen too fast or too slow to be plausible

IMPORTANT: You must respond with ONLY valid JSON (no markdown, no code fences, no extra text).
The JSON must follow this exact structure:

{
  "paradoxes": [
    {
      "id": "paradox-1",
      "nodeIds": ["id-of-node-1", "id-of-node-2"],
      "description": "Clear explanation of the logical contradiction",
      "severity": "critical" | "minor"
    }
  ]
}

If no paradoxes are found, return: { "paradoxes": [] }

Rules:
- Only report genuine logical contradictions, not just unlikely events
- severity "critical" = fundamental logic break, "minor" = implausible but not impossible
- nodeIds must reference actual node IDs from the provided timeline
- Be specific about WHY the events contradict each other
- Respond in the same language as the timeline content`;

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed, resetTime } = checkRateLimit(`paradox:${ip}`, { limit: 5, windowSeconds: 60 });
  if (!allowed) return rateLimitResponse(resetTime);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.timeline || typeof body.timeline !== "object") {
    return Response.json({ error: "Timeline data is required" }, { status: 400 });
  }

  const config = getK2Config();
  if (!config) return Response.json({ error: "API configuration missing" }, { status: 500 });

  const timelineJSON = JSON.stringify(body.timeline, null, 2);

  const result = await fetchFromK2(config, [
    { role: "system", content: PARADOX_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Scenario: "${body.scenario || "Unknown"}"\n\nAnalyze this timeline for paradoxes:\n${timelineJSON}`,
    },
  ]);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  const parsed = extractJSON(result.content);
  if (parsed && isParadoxResponse(parsed)) {
    return Response.json(parsed);
  }

  // If parsing fails, return empty paradoxes
  return Response.json({ paradoxes: [] });
}

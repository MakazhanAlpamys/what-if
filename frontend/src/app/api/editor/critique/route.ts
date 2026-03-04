import { NextRequest } from "next/server";
import { getClientIP, getK2Config, fetchFromK2 } from "@/lib/k2-api";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { extractJSON } from "@/lib/stream";
import { isEditorCritiqueResponse } from "@/lib/game-validate";

const SYSTEM_PROMPT = `You are a historical plausibility critic. The user has created their own alternate
history timeline. Analyze it for historical accuracy, logical consistency, and plausibility.

IMPORTANT: You must respond with ONLY valid JSON (no markdown, no code fences, no extra text).
The JSON must follow this exact structure:

{
  "overall": "A brief overall assessment of the timeline (2-3 sentences)",
  "score": <number 0-100>,
  "issues": [
    {
      "nodeId": "the-id-of-the-problematic-node",
      "type": "implausible" | "anachronism" | "missing-cause" | "contradiction",
      "message": "Explanation of the issue (1-2 sentences)"
    }
  ],
  "suggestions": [
    "A suggestion for improvement (1 sentence each)"
  ]
}

Issue types:
- "implausible": Event is historically unlikely given the circumstances
- "anachronism": Technology, social structures, or ideas appear before their time
- "missing-cause": Event happens without sufficient causal chain
- "contradiction": Two events in the timeline contradict each other

Scoring:
- 90-100: Excellent, highly plausible and well-reasoned
- 70-89: Good, mostly plausible with minor issues
- 50-69: Fair, some significant plausibility problems
- 30-49: Poor, major logical issues
- 0-29: Implausible, fundamental problems

Be constructive but honest. Respond in the same language as the timeline content.`;

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed, resetTime } = checkRateLimit(`editor-critique:${ip}`, {
    limit: 5,
    windowSeconds: 60,
  });
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
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Scenario: "${body.scenario || "User-created timeline"}"

Analyze this user-created alternate history timeline:
${timelineJSON}`,
    },
  ]);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  const parsed = extractJSON(result.content);
  if (parsed && isEditorCritiqueResponse(parsed)) {
    return Response.json(parsed);
  }

  return Response.json({
    overall: "Could not analyze timeline",
    score: 0,
    issues: [],
    suggestions: [],
  });
}

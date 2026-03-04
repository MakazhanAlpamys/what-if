import { NextRequest } from "next/server";
import { getClientIP, getK2Config, streamFromK2 } from "@/lib/k2-api";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const SYSTEM_PROMPT = `You are the "Fix History" game master. Generate a DYSTOPIAN alternate history timeline
that the player must "fix" by finding and cutting the right branch.

Create a timeline where ONE specific wrong turn led to a terrible outcome. The player needs to identify
which branch to remove to restore a better timeline.

IMPORTANT: You must respond with ONLY valid JSON (no markdown, no code fences, no extra text).
The JSON must follow this exact structure:

{
  "scenario": "Brief description of the dystopian scenario",
  "correctNodeId": "the-id-of-the-node-that-should-be-cut",
  "idealOutcome": "Description of what the better outcome would be if the correct branch is cut (2-3 sentences)",
  "maxMoves": <number 3-5>,
  "dystopianTimeline": {
    "id": "root",
    "year": <number>,
    "title": "Initial historical event",
    "description": "The starting point of this timeline (2-3 sentences)",
    "impact": "medium",
    "branches": [
      {
        "id": "branch-good",
        "year": <number>,
        "title": "A positive development",
        "description": "Something good that happened (2-3 sentences)",
        "impact": "medium",
        "branches": []
      },
      {
        "id": "branch-bad",
        "year": <number>,
        "title": "The WRONG TURN — this is the problem branch",
        "description": "The event that leads to dystopia (2-3 sentences)",
        "impact": "critical",
        "branches": [
          {
            "id": "branch-bad-1",
            "year": <number>,
            "title": "Dystopian consequence",
            "description": "How things get worse (2-3 sentences)",
            "impact": "critical",
            "branches": [
              {
                "id": "branch-bad-1-1",
                "year": <number>,
                "title": "Final dystopian state",
                "description": "The terrible end result (2-3 sentences)",
                "impact": "critical",
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
- The correctNodeId MUST match the ID of the branch that, if removed, fixes the timeline
- The dystopian timeline should have 2-3 first-level branches (mix of good and bad)
- Only ONE branch path leads to dystopia — the others should be neutral or positive
- The "bad" branch should have 2-3 levels of escalating consequences
- maxMoves is the maximum number of attempts the player gets (3-5)
- Make the dystopia dramatic but historically plausible
- The correct branch to cut should NOT be the root — it should be a specific wrong turn
- IDs must be unique strings
- Choose diverse historical scenarios
- Respond in the same language: vary between English and non-English scenarios`;

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed, resetTime } = checkRateLimit(`fix-history:${ip}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!allowed) return rateLimitResponse(resetTime);

  const config = getK2Config();
  if (!config) return Response.json({ error: "API configuration missing" }, { status: 500 });

  return streamFromK2(config, [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: "Generate a new Fix History puzzle with a dystopian timeline to repair.",
    },
  ]);
}

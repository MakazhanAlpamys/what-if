import { NextRequest } from "next/server";
import { getClientIP, getK2Config, fetchFromK2 } from "@/lib/k2-api";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { extractJSON } from "@/lib/stream";
import { isDetectiveCheckResponse } from "@/lib/game-validate";

const SYSTEM_PROMPT = `You are a judge for the "History Detective" game. The player was shown a final outcome
of an alternate history and had to guess the initial divergence event.

Compare the player's guess to the correct answer and score them.

IMPORTANT: You must respond with ONLY valid JSON (no markdown, no code fences, no extra text).
The JSON must follow this exact structure:

{
  "score": <number 0-100>,
  "isCorrect": <boolean>,
  "feedback": "Detailed explanation of how close the guess was (2-3 sentences)",
  "correctAnswer": "The correct answer restated"
}

Scoring rules:
- 100: Exact match or essentially the same event
- 80-99: Very close — right event, maybe wrong details (year, specific person)
- 50-79: Partially correct — right general area/time period but wrong specific event
- 20-49: On the right track — correct region or era but wrong event type
- 1-19: Very far off but shows some logical reasoning
- 0: Completely unrelated

Be generous if the player captures the spirit of the answer even if wording differs.
Respond in the same language as the player's guess.`;

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed, resetTime } = checkRateLimit(`detective-check:${ip}`, {
    limit: 20,
    windowSeconds: 60,
  });
  if (!allowed) return rateLimitResponse(resetTime);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { guess, correctAnswer, finalOutcome } = body;
  if (!guess || typeof guess !== "string") {
    return Response.json({ error: "Guess is required" }, { status: 400 });
  }
  if (!correctAnswer || typeof correctAnswer !== "string") {
    return Response.json({ error: "Correct answer is required" }, { status: 400 });
  }

  const config = getK2Config();
  if (!config) return Response.json({ error: "API configuration missing" }, { status: 500 });

  const result = await fetchFromK2(config, [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Final outcome shown to player: "${finalOutcome}"
Correct answer (the initial divergence): "${correctAnswer}"
Player's guess: "${guess}"

Score this guess.`,
    },
  ]);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  const parsed = extractJSON(result.content);
  if (parsed && isDetectiveCheckResponse(parsed)) {
    return Response.json(parsed);
  }

  return Response.json(
    { score: 0, isCorrect: false, feedback: "Could not evaluate guess", correctAnswer },
    { status: 200 }
  );
}

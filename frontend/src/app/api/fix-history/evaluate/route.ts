import { NextRequest } from "next/server";
import { getClientIP } from "@/lib/k2-api";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed, resetTime } = checkRateLimit(`fix-eval:${ip}`, {
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

  const { selectedNodeId, correctNodeId, moveNumber, maxMoves } = body;

  if (!selectedNodeId || !correctNodeId) {
    return Response.json({ error: "Node IDs required" }, { status: 400 });
  }

  const isCorrect = selectedNodeId === correctNodeId;
  const movesLeft = maxMoves - moveNumber;

  if (isCorrect) {
    const score = Math.max(10, 100 - (moveNumber - 1) * 25);
    return Response.json({
      success: true,
      score,
      feedback: `Correct! You found the critical divergence point${moveNumber === 1 ? " on your first try! Perfect score!" : ` in ${moveNumber} moves.`}`,
    });
  }

  if (movesLeft <= 0) {
    return Response.json({
      success: false,
      score: 0,
      feedback: "Out of moves! The correct branch has been highlighted.",
    });
  }

  return Response.json({
    success: false,
    score: 0,
    feedback: `Wrong branch. ${movesLeft} move${movesLeft > 1 ? "s" : ""} remaining. Look for the event that directly led to the dystopian outcome.`,
  });
}

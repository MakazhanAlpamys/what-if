import type {
  ButterflyResponse,
  DetectiveResponse,
  DetectiveCheckResponse,
  FixHistoryResponse,
  FixHistoryEvaluation,
  CompareResponse,
  EditorCritiqueResponse,
  TimelineNode,
} from "./types";

const VALID_IMPACTS = new Set(["critical", "high", "medium", "low"]);

function isTimelineNode(obj: unknown): obj is TimelineNode {
  if (!obj || typeof obj !== "object") return false;
  const node = obj as Record<string, unknown>;
  return (
    typeof node.id === "string" &&
    typeof node.year === "number" &&
    typeof node.title === "string" &&
    typeof node.description === "string" &&
    typeof node.impact === "string" &&
    VALID_IMPACTS.has(node.impact) &&
    Array.isArray(node.branches) &&
    node.branches.every(isTimelineNode)
  );
}

export function isButterflyResponse(obj: unknown): obj is ButterflyResponse {
  if (!obj || typeof obj !== "object") return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.scenario === "string" &&
    typeof data.smallChange === "string" &&
    isTimelineNode(data.timeline) &&
    typeof data.butterflyScore === "number"
  );
}

export function isDetectiveResponse(obj: unknown): obj is DetectiveResponse {
  if (!obj || typeof obj !== "object") return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.finalOutcome === "string" &&
    typeof data.finalYear === "number" &&
    typeof data.correctAnswer === "string" &&
    Array.isArray(data.hints) &&
    isTimelineNode(data.fullTimeline)
  );
}

export function isDetectiveCheckResponse(obj: unknown): obj is DetectiveCheckResponse {
  if (!obj || typeof obj !== "object") return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.score === "number" &&
    typeof data.isCorrect === "boolean" &&
    typeof data.feedback === "string" &&
    typeof data.correctAnswer === "string"
  );
}

export function isFixHistoryResponse(obj: unknown): obj is FixHistoryResponse {
  if (!obj || typeof obj !== "object") return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.scenario === "string" &&
    isTimelineNode(data.dystopianTimeline) &&
    typeof data.correctNodeId === "string" &&
    typeof data.idealOutcome === "string" &&
    typeof data.maxMoves === "number"
  );
}

export function isFixHistoryEvaluation(obj: unknown): obj is FixHistoryEvaluation {
  if (!obj || typeof obj !== "object") return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.success === "boolean" &&
    typeof data.score === "number" &&
    typeof data.feedback === "string"
  );
}

export function isCompareResponse(obj: unknown): obj is CompareResponse {
  if (!obj || typeof obj !== "object") return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.scenario === "string" &&
    isTimelineNode(data.realTimeline) &&
    isTimelineNode(data.altTimeline) &&
    Array.isArray(data.divergencePoints) &&
    Array.isArray(data.convergencePoints)
  );
}

export function isEditorCritiqueResponse(obj: unknown): obj is EditorCritiqueResponse {
  if (!obj || typeof obj !== "object") return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.overall === "string" &&
    typeof data.score === "number" &&
    Array.isArray(data.issues) &&
    Array.isArray(data.suggestions)
  );
}

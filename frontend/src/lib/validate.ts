import type { TimelineNode, ScenarioResponse, ExpandResponse } from "./types";

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

export function isScenarioResponse(obj: unknown): obj is ScenarioResponse {
  if (!obj || typeof obj !== "object") return false;
  const data = obj as Record<string, unknown>;
  return (
    typeof data.scenario === "string" &&
    typeof data.realHistory === "string" &&
    isTimelineNode(data.timeline)
  );
}

export function isExpandResponse(obj: unknown): obj is ExpandResponse {
  if (!obj || typeof obj !== "object") return false;
  const data = obj as Record<string, unknown>;
  return Array.isArray(data.branches) && data.branches.every(isTimelineNode);
}

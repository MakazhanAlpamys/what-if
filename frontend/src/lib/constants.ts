import type { TimelineNode } from "./types";

export const IMPACT_COLORS: Record<TimelineNode["impact"], string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

export const IMPACT_LABELS: Record<TimelineNode["impact"], string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Maximum depth of tree expansion to prevent performance issues */
export const MAX_TREE_DEPTH = 5;

export interface TimelineNode {
  id: string;
  year: number;
  title: string;
  description: string;
  impact: "critical" | "high" | "medium" | "low";
  branches: TimelineNode[];
}

export interface ScenarioResponse {
  scenario: string;
  realHistory: string;
  timeline: TimelineNode;
}

export interface ExpandResponse {
  branches: TimelineNode[];
}

export interface Paradox {
  id: string;
  nodeIds: string[];
  description: string;
  severity: "critical" | "minor";
}

export interface ParadoxResponse {
  paradoxes: Paradox[];
}

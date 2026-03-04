export interface TimelineNode {
  id: string;
  year: number;
  title: string;
  description: string;
  impact: "critical" | "high" | "medium" | "low";
  branches: TimelineNode[];
  region?: string;
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

// === Game Mode Types ===

export type GameMode =
  | "explore"
  | "butterfly"
  | "detective"
  | "fix-history"
  | "compare"
  | "map"
  | "editor";

// Butterfly Effect
export interface ButterflyResponse {
  scenario: string;
  smallChange: string;
  timeline: TimelineNode;
  butterflyScore: number;
}

// History Detective
export interface DetectiveResponse {
  finalOutcome: string;
  finalYear: number;
  correctAnswer: string;
  hints: DetectiveHint[];
  fullTimeline: TimelineNode;
  difficulty: "easy" | "medium" | "hard";
}

export interface DetectiveHint {
  level: number;
  text: string;
  nodeId: string;
}

export interface DetectiveCheckResponse {
  score: number;
  isCorrect: boolean;
  feedback: string;
  correctAnswer: string;
}

// Fix History
export interface FixHistoryResponse {
  scenario: string;
  dystopianTimeline: TimelineNode;
  correctNodeId: string;
  idealOutcome: string;
  maxMoves: number;
}

export interface FixHistoryEvaluation {
  success: boolean;
  score: number;
  feedback: string;
  fixedTimeline?: TimelineNode;
}

// Compare (Reality vs Alternative)
export interface CompareResponse {
  scenario: string;
  realTimeline: TimelineNode;
  altTimeline: TimelineNode;
  divergencePoints: DivergencePoint[];
  convergencePoints: ConvergencePoint[];
}

export interface DivergencePoint {
  realNodeId: string;
  altNodeId: string;
  year: number;
  description: string;
}

export interface ConvergencePoint {
  realNodeId: string;
  altNodeId: string;
  year: number;
  description: string;
}

// Editor
export interface EditorCritiqueResponse {
  overall: string;
  score: number;
  issues: EditorIssue[];
  suggestions: string[];
}

export interface EditorIssue {
  nodeId: string;
  type: "implausible" | "anachronism" | "missing-cause" | "contradiction";
  message: string;
}

// Leaderboard
export interface ButterflyScore {
  scenario: string;
  score: number;
  criticalCount: number;
  totalNodes: number;
  timestamp: number;
}

export interface DetectiveScore {
  scenario: string;
  score: number;
  hintsUsed: number;
  timestamp: number;
}

export interface FixHistoryScore {
  scenario: string;
  score: number;
  movesUsed: number;
  timestamp: number;
}

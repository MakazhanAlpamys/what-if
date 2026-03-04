import { describe, it, expect } from "vitest";
import {
  isButterflyResponse,
  isDetectiveResponse,
  isDetectiveCheckResponse,
  isFixHistoryResponse,
  isFixHistoryEvaluation,
  isCompareResponse,
  isEditorCritiqueResponse,
} from "./game-validate";

const validNode = {
  id: "root",
  year: 1900,
  title: "Test",
  description: "A test event",
  impact: "critical",
  branches: [],
};

const validNodeWithBranches = {
  ...validNode,
  branches: [
    { id: "b1", year: 1910, title: "B1", description: "Branch 1", impact: "high", branches: [] },
  ],
};

describe("isButterflyResponse", () => {
  it("returns true for valid response", () => {
    expect(
      isButterflyResponse({
        scenario: "test",
        smallChange: "tiny change",
        timeline: validNode,
        butterflyScore: 42,
      })
    ).toBe(true);
  });

  it("returns true with nested branches", () => {
    expect(
      isButterflyResponse({
        scenario: "test",
        smallChange: "tiny",
        timeline: validNodeWithBranches,
        butterflyScore: 80,
      })
    ).toBe(true);
  });

  it("returns false for null", () => {
    expect(isButterflyResponse(null)).toBe(false);
  });

  it("returns false for missing fields", () => {
    expect(isButterflyResponse({ scenario: "test" })).toBe(false);
    expect(isButterflyResponse({ scenario: "test", smallChange: "x", timeline: validNode })).toBe(
      false
    );
  });

  it("returns false for wrong types", () => {
    expect(
      isButterflyResponse({
        scenario: "test",
        smallChange: "x",
        timeline: validNode,
        butterflyScore: "42",
      })
    ).toBe(false);
  });

  it("returns false for invalid timeline node", () => {
    expect(
      isButterflyResponse({
        scenario: "test",
        smallChange: "x",
        timeline: { id: "root" },
        butterflyScore: 42,
      })
    ).toBe(false);
  });
});

describe("isDetectiveResponse", () => {
  const valid = {
    finalOutcome: "The world is different",
    finalYear: 2024,
    correctAnswer: "Something happened",
    difficulty: "medium",
    hints: [{ level: 1, text: "A hint", nodeId: "b1" }],
    fullTimeline: validNodeWithBranches,
  };

  it("returns true for valid response", () => {
    expect(isDetectiveResponse(valid)).toBe(true);
  });

  it("returns true with empty hints", () => {
    expect(isDetectiveResponse({ ...valid, hints: [] })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isDetectiveResponse(null)).toBe(false);
  });

  it("returns false for missing finalOutcome", () => {
    const { finalOutcome: _, ...rest } = valid;
    expect(isDetectiveResponse(rest)).toBe(false);
  });

  it("returns false for wrong finalYear type", () => {
    expect(isDetectiveResponse({ ...valid, finalYear: "2024" })).toBe(false);
  });

  it("returns false for invalid timeline", () => {
    expect(isDetectiveResponse({ ...valid, fullTimeline: {} })).toBe(false);
  });
});

describe("isDetectiveCheckResponse", () => {
  it("returns true for valid response", () => {
    expect(
      isDetectiveCheckResponse({
        score: 85,
        isCorrect: true,
        feedback: "Great guess!",
        correctAnswer: "The answer",
      })
    ).toBe(true);
  });

  it("returns true for zero score", () => {
    expect(
      isDetectiveCheckResponse({
        score: 0,
        isCorrect: false,
        feedback: "Wrong",
        correctAnswer: "The answer",
      })
    ).toBe(true);
  });

  it("returns false for null", () => {
    expect(isDetectiveCheckResponse(null)).toBe(false);
  });

  it("returns false for missing isCorrect", () => {
    expect(isDetectiveCheckResponse({ score: 85, feedback: "x", correctAnswer: "y" })).toBe(false);
  });

  it("returns false for wrong score type", () => {
    expect(
      isDetectiveCheckResponse({
        score: "85",
        isCorrect: true,
        feedback: "x",
        correctAnswer: "y",
      })
    ).toBe(false);
  });
});

describe("isFixHistoryResponse", () => {
  const valid = {
    scenario: "Dystopian world",
    dystopianTimeline: validNodeWithBranches,
    correctNodeId: "b1",
    idealOutcome: "A better world",
    maxMoves: 3,
  };

  it("returns true for valid response", () => {
    expect(isFixHistoryResponse(valid)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isFixHistoryResponse(null)).toBe(false);
  });

  it("returns false for missing correctNodeId", () => {
    const { correctNodeId: _, ...rest } = valid;
    expect(isFixHistoryResponse(rest)).toBe(false);
  });

  it("returns false for wrong maxMoves type", () => {
    expect(isFixHistoryResponse({ ...valid, maxMoves: "3" })).toBe(false);
  });

  it("returns false for invalid timeline", () => {
    expect(isFixHistoryResponse({ ...valid, dystopianTimeline: "not a node" })).toBe(false);
  });
});

describe("isFixHistoryEvaluation", () => {
  it("returns true for valid success", () => {
    expect(isFixHistoryEvaluation({ success: true, score: 100, feedback: "Perfect!" })).toBe(true);
  });

  it("returns true for valid failure", () => {
    expect(isFixHistoryEvaluation({ success: false, score: 0, feedback: "Wrong branch" })).toBe(
      true
    );
  });

  it("returns false for null", () => {
    expect(isFixHistoryEvaluation(null)).toBe(false);
  });

  it("returns false for missing success", () => {
    expect(isFixHistoryEvaluation({ score: 100, feedback: "x" })).toBe(false);
  });
});

describe("isCompareResponse", () => {
  const valid = {
    scenario: "What if...",
    realTimeline: { ...validNode, id: "real-root" },
    altTimeline: { ...validNode, id: "alt-root" },
    divergencePoints: [
      { realNodeId: "real-root", altNodeId: "alt-root", year: 1900, description: "Diverge" },
    ],
    convergencePoints: [],
  };

  it("returns true for valid response", () => {
    expect(isCompareResponse(valid)).toBe(true);
  });

  it("returns true with empty arrays", () => {
    expect(isCompareResponse({ ...valid, divergencePoints: [], convergencePoints: [] })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isCompareResponse(null)).toBe(false);
  });

  it("returns false for missing altTimeline", () => {
    const { altTimeline: _, ...rest } = valid;
    expect(isCompareResponse(rest)).toBe(false);
  });

  it("returns false for non-array divergencePoints", () => {
    expect(isCompareResponse({ ...valid, divergencePoints: "not array" })).toBe(false);
  });

  it("returns false for invalid timeline nodes", () => {
    expect(isCompareResponse({ ...valid, realTimeline: { id: "x" } })).toBe(false);
  });
});

describe("isEditorCritiqueResponse", () => {
  it("returns true for valid response", () => {
    expect(
      isEditorCritiqueResponse({
        overall: "Good timeline",
        score: 75,
        issues: [{ nodeId: "n1", type: "implausible", message: "Unlikely" }],
        suggestions: ["Add more detail"],
      })
    ).toBe(true);
  });

  it("returns true with empty arrays", () => {
    expect(
      isEditorCritiqueResponse({ overall: "Perfect", score: 100, issues: [], suggestions: [] })
    ).toBe(true);
  });

  it("returns false for null", () => {
    expect(isEditorCritiqueResponse(null)).toBe(false);
  });

  it("returns false for missing score", () => {
    expect(isEditorCritiqueResponse({ overall: "x", issues: [], suggestions: [] })).toBe(false);
  });

  it("returns false for wrong score type", () => {
    expect(
      isEditorCritiqueResponse({ overall: "x", score: "75", issues: [], suggestions: [] })
    ).toBe(false);
  });

  it("returns false for non-array issues", () => {
    expect(
      isEditorCritiqueResponse({ overall: "x", score: 75, issues: "none", suggestions: [] })
    ).toBe(false);
  });
});

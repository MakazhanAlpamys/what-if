import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getButterflyScores,
  addButterflyScore,
  getDetectiveScores,
  addDetectiveScore,
  getFixHistoryScores,
  addFixHistoryScore,
} from "./game-storage";

let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  });
});

describe("Butterfly scores", () => {
  const entry = {
    scenario: "Napoleon overslept",
    score: 80,
    criticalCount: 3,
    totalNodes: 10,
    timestamp: Date.now(),
  };

  it("returns empty array when no scores saved", () => {
    expect(getButterflyScores()).toEqual([]);
  });

  it("adds and retrieves a score", () => {
    addButterflyScore(entry);
    const scores = getButterflyScores();
    expect(scores).toHaveLength(1);
    expect(scores[0].scenario).toBe("Napoleon overslept");
    expect(scores[0].score).toBe(80);
  });

  it("sorts scores descending", () => {
    addButterflyScore({ ...entry, score: 50 });
    addButterflyScore({ ...entry, score: 90 });
    addButterflyScore({ ...entry, score: 70 });
    const scores = getButterflyScores();
    expect(scores[0].score).toBe(90);
    expect(scores[1].score).toBe(70);
    expect(scores[2].score).toBe(50);
  });

  it("limits to 10 scores", () => {
    for (let i = 0; i < 12; i++) {
      addButterflyScore({ ...entry, score: i * 10, timestamp: Date.now() + i });
    }
    expect(getButterflyScores()).toHaveLength(10);
  });

  it("handles corrupted JSON gracefully", () => {
    store["whatif-butterfly-scores"] = "not json";
    expect(getButterflyScores()).toEqual([]);
  });
});

describe("Detective scores", () => {
  const entry = {
    scenario: "Mystery puzzle",
    score: 75,
    hintsUsed: 1,
    timestamp: Date.now(),
  };

  it("returns empty array when no scores saved", () => {
    expect(getDetectiveScores()).toEqual([]);
  });

  it("adds and retrieves a score", () => {
    addDetectiveScore(entry);
    const scores = getDetectiveScores();
    expect(scores).toHaveLength(1);
    expect(scores[0].score).toBe(75);
    expect(scores[0].hintsUsed).toBe(1);
  });

  it("sorts scores descending", () => {
    addDetectiveScore({ ...entry, score: 30 });
    addDetectiveScore({ ...entry, score: 100 });
    const scores = getDetectiveScores();
    expect(scores[0].score).toBe(100);
    expect(scores[1].score).toBe(30);
  });
});

describe("Fix History scores", () => {
  const entry = {
    scenario: "Fix the timeline",
    score: 100,
    movesUsed: 1,
    timestamp: Date.now(),
  };

  it("returns empty array when no scores saved", () => {
    expect(getFixHistoryScores()).toEqual([]);
  });

  it("adds and retrieves a score", () => {
    addFixHistoryScore(entry);
    const scores = getFixHistoryScores();
    expect(scores).toHaveLength(1);
    expect(scores[0].score).toBe(100);
    expect(scores[0].movesUsed).toBe(1);
  });

  it("keeps highest scores when limit reached", () => {
    for (let i = 0; i < 12; i++) {
      addFixHistoryScore({ ...entry, score: i * 10, timestamp: Date.now() + i });
    }
    const scores = getFixHistoryScores();
    expect(scores).toHaveLength(10);
    // lowest should be score 20 (0 and 10 are dropped)
    expect(scores[scores.length - 1].score).toBe(20);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveTimeline, addToHistory, getHistory, clearHistory } from "./storage";
import type { ScenarioResponse } from "./types";

const mockStorage: Record<string, string> = {};

beforeEach(() => {
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
    }),
  });
});

const mockScenarioData: ScenarioResponse = {
  scenario: "Test scenario",
  realHistory: "Real history",
  timeline: {
    id: "root",
    year: 1800,
    title: "Test",
    description: "Test desc",
    impact: "critical",
    branches: [],
  },
};

describe("saveTimeline", () => {
  it("saves a timeline and returns an id", () => {
    const id = saveTimeline("What if test?", mockScenarioData);
    expect(id).toBeTruthy();
    expect(id.startsWith("tl-")).toBe(true);
  });
});

describe("addToHistory / getHistory", () => {
  it("adds and retrieves history entries", () => {
    addToHistory("What if Rome?");
    const history = getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].scenario).toBe("What if Rome?");
  });

  it("deduplicates entries", () => {
    addToHistory("What if Rome?");
    addToHistory("What if Moon?");
    addToHistory("What if Rome?");
    const history = getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].scenario).toBe("What if Rome?");
  });
});

describe("clearHistory", () => {
  it("clears all history", () => {
    addToHistory("Entry 1");
    addToHistory("Entry 2");
    clearHistory();
    expect(getHistory()).toHaveLength(0);
  });
});

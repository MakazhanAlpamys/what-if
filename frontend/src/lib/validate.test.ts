import { describe, it, expect } from "vitest";
import { isScenarioResponse, isExpandResponse } from "./validate";

describe("isScenarioResponse", () => {
  it("validates a correct ScenarioResponse", () => {
    const valid = {
      scenario: "What if Rome never fell?",
      realHistory: "Rome fell in 476 AD.",
      timeline: {
        id: "root",
        year: 476,
        title: "Rome Endures",
        description: "The Roman Empire continues to thrive.",
        impact: "critical",
        branches: [],
      },
    };
    expect(isScenarioResponse(valid)).toBe(true);
  });

  it("validates nested branches", () => {
    const valid = {
      scenario: "Test",
      realHistory: "Real test",
      timeline: {
        id: "root",
        year: 1000,
        title: "Root",
        description: "Root event",
        impact: "high",
        branches: [
          {
            id: "b1",
            year: 1001,
            title: "Branch 1",
            description: "First branch",
            impact: "medium",
            branches: [],
          },
        ],
      },
    };
    expect(isScenarioResponse(valid)).toBe(true);
  });

  it("rejects null", () => {
    expect(isScenarioResponse(null)).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(isScenarioResponse({ scenario: "test" })).toBe(false);
    expect(isScenarioResponse({ scenario: "test", realHistory: "real" })).toBe(false);
  });

  it("rejects invalid impact level", () => {
    const invalid = {
      scenario: "Test",
      realHistory: "Real",
      timeline: {
        id: "root",
        year: 100,
        title: "Title",
        description: "Desc",
        impact: "extreme",
        branches: [],
      },
    };
    expect(isScenarioResponse(invalid)).toBe(false);
  });

  it("rejects non-number year", () => {
    const invalid = {
      scenario: "Test",
      realHistory: "Real",
      timeline: {
        id: "root",
        year: "1000",
        title: "Title",
        description: "Desc",
        impact: "high",
        branches: [],
      },
    };
    expect(isScenarioResponse(invalid)).toBe(false);
  });
});

describe("isExpandResponse", () => {
  it("validates a correct ExpandResponse", () => {
    const valid = {
      branches: [
        {
          id: "expand-1",
          year: 1820,
          title: "New branch",
          description: "A new consequence",
          impact: "low",
          branches: [],
        },
      ],
    };
    expect(isExpandResponse(valid)).toBe(true);
  });

  it("validates empty branches array", () => {
    expect(isExpandResponse({ branches: [] })).toBe(true);
  });

  it("rejects missing branches", () => {
    expect(isExpandResponse({})).toBe(false);
    expect(isExpandResponse(null)).toBe(false);
  });

  it("rejects invalid branch items", () => {
    const invalid = {
      branches: [{ id: "x" }],
    };
    expect(isExpandResponse(invalid)).toBe(false);
  });
});

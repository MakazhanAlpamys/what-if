import { describe, it, expect } from "vitest";
import { extractJSON } from "./stream";

describe("extractJSON", () => {
  it("parses valid JSON directly", () => {
    const json = '{"scenario":"test","timeline":{}}';
    const result = extractJSON(json);
    expect(result).toEqual({ scenario: "test", timeline: {} });
  });

  it("returns null for empty string", () => {
    expect(extractJSON("")).toBeNull();
  });

  it("returns null for non-JSON text", () => {
    expect(extractJSON("just some random text without braces")).toBeNull();
  });

  it("strips <think> blocks and parses remaining JSON", () => {
    const text = '<think>Let me think about this... { "not": "this" }</think>{"scenario":"real"}';
    const result = extractJSON(text);
    expect(result).toEqual({ scenario: "real" });
  });

  it("strips markdown code fences", () => {
    const text = '```json\n{"scenario":"fenced"}\n```';
    const result = extractJSON(text);
    expect(result).toEqual({ scenario: "fenced" });
  });

  it("strips markdown code fences without language", () => {
    const text = '```\n{"scenario":"nolang"}\n```';
    const result = extractJSON(text);
    expect(result).toEqual({ scenario: "nolang" });
  });

  it("finds last balanced JSON block amid reasoning text", () => {
    const text =
      'The user asks about history. A possible response looks like {"not":"this"}. But here is the real answer: {"scenario":"correct","data":{"nested":true}}';
    const result = extractJSON(text);
    expect(result).toEqual({ scenario: "correct", data: { nested: true } });
  });

  it("handles <think> block with nested braces then valid JSON", () => {
    const text =
      '<think>I need to create { branches: [] } for this.</think>\n{"branches":[{"id":"b1","year":1800,"title":"Test","description":"Desc","impact":"low","branches":[]}]}';
    const result = extractJSON(text);
    expect(result).toEqual({
      branches: [
        {
          id: "b1",
          year: 1800,
          title: "Test",
          description: "Desc",
          impact: "low",
          branches: [],
        },
      ],
    });
  });

  it("handles deeply nested JSON", () => {
    const json = '{"a":{"b":{"c":{"d":"deep"}}}}';
    const result = extractJSON(json);
    expect(result).toEqual({ a: { b: { c: { d: "deep" } } } });
  });

  it("handles JSON with arrays", () => {
    const json = '{"items":[1,2,{"nested":[3,4]}]}';
    const result = extractJSON(json);
    expect(result).toEqual({ items: [1, 2, { nested: [3, 4] }] });
  });

  it("handles whitespace around JSON", () => {
    const text = '  \n  {"scenario":"whitespace"}  \n  ';
    const result = extractJSON(text);
    expect(result).toEqual({ scenario: "whitespace" });
  });

  it("returns null for unbalanced braces", () => {
    const text = '{"broken": "json"';
    expect(extractJSON(text)).toBeNull();
  });

  it("handles multiple <think> blocks", () => {
    const text =
      '<think>first thought</think>some text<think>second thought with { braces }</think>{"result":"ok"}';
    const result = extractJSON(text);
    expect(result).toEqual({ result: "ok" });
  });
});

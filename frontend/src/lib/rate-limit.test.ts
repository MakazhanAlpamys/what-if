import { describe, it, expect } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const id = `test-allow-${Date.now()}`;
    const result = checkRateLimit(id, { limit: 5, windowSeconds: 60 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests over the limit", () => {
    const id = `test-block-${Date.now()}`;
    const config = { limit: 2, windowSeconds: 60 };

    checkRateLimit(id, config);
    checkRateLimit(id, config);
    const third = checkRateLimit(id, config);

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("tracks remaining correctly", () => {
    const id = `test-remaining-${Date.now()}`;
    const config = { limit: 3, windowSeconds: 60 };

    const r1 = checkRateLimit(id, config);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(id, config);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(id, config);
    expect(r3.remaining).toBe(0);
    expect(r3.allowed).toBe(true);
  });
});

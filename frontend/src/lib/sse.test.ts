import { describe, it, expect } from "vitest";
import { createSSEStream, SSE_HEADERS } from "./sse";

function makeK2Response(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream);
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const lines: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    lines.push(text);
  }

  return lines;
}

describe("createSSEStream", () => {
  it("forwards content deltas from K2 response", async () => {
    const k2Response = makeK2Response([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    const output = await readStream(createSSEStream(k2Response));

    expect(output[0]).toContain('"content":"Hello"');
    expect(output[1]).toContain('"content":" World"');
    expect(output[2]).toContain("[DONE]");
  });

  it("skips chunks without content", async () => {
    const k2Response = makeK2Response([
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"text"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    const output = await readStream(createSSEStream(k2Response));

    expect(output[0]).toContain('"content":"text"');
    expect(output[1]).toContain("[DONE]");
  });

  it("sends DONE when K2 stream ends without explicit DONE", async () => {
    const k2Response = makeK2Response(['data: {"choices":[{"delta":{"content":"only"}}]}\n\n']);

    const output = await readStream(createSSEStream(k2Response));

    expect(output[0]).toContain('"content":"only"');
    expect(output[1]).toContain("[DONE]");
  });

  it("skips malformed JSON chunks", async () => {
    const k2Response = makeK2Response([
      "data: not-json\n\n",
      'data: {"choices":[{"delta":{"content":"valid"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    const output = await readStream(createSSEStream(k2Response));

    expect(output[0]).toContain('"content":"valid"');
    expect(output[1]).toContain("[DONE]");
  });
});

describe("SSE_HEADERS", () => {
  it("has correct content type", () => {
    expect(SSE_HEADERS["Content-Type"]).toBe("text/event-stream");
  });

  it("disables caching", () => {
    expect(SSE_HEADERS["Cache-Control"]).toBe("no-cache");
  });
});

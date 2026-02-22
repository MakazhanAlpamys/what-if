/**
 * Parse an SSE buffer: split lines, extract data payloads, detect [DONE].
 */
export function extractSSEData(
  buffer: string,
  chunk: string
): { data: string[]; buffer: string; done: boolean } {
  const combined = buffer + chunk;
  const lines = combined.split("\n");
  const remaining = lines.pop() || "";
  const data: string[] = [];
  let done = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("data:")) continue;
    const value = trimmed.slice(5).trim();
    if (value === "[DONE]") {
      done = true;
      break;
    }
    data.push(value);
  }

  return { data, buffer: remaining, done };
}

/**
 * Shared SSE streaming helper for K2 API proxy routes.
 * Reads K2's SSE response, extracts content deltas, and forwards them to the client.
 */
export function createSSEStream(k2Response: Response): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const reader = k2Response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            break;
          }

          const result = extractSSEData(buffer, decoder.decode(value, { stream: true }));
          buffer = result.buffer;

          if (result.done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          for (const d of result.data) {
            try {
              const parsed = JSON.parse(d);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/** Standard SSE response headers */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

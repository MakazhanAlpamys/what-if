import type {
  ButterflyResponse,
  DetectiveResponse,
  CompareResponse,
  FixHistoryResponse,
} from "./types";
import {
  isButterflyResponse,
  isDetectiveResponse,
  isCompareResponse,
  isFixHistoryResponse,
} from "./game-validate";
import { extractSSEData } from "./sse";
import { extractJSON } from "./stream";

async function streamSSE<T>(
  url: string,
  body: Record<string, unknown>,
  validate: (data: unknown) => data is T,
  onChunk: (text: string) => void,
  onDone: (data: T) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      try {
        const err = await response.json();
        if (response.status === 429 && err.retryAfter) {
          onError(`Too many requests. Please try again in ${err.retryAfter} seconds.`);
        } else {
          onError(err.error || "Request failed");
        }
      } catch {
        onError(`Request failed with status ${response.status}`);
      }
      return;
    }

    if (!response.body) {
      onError("Response body is not available");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const result = extractSSEData(buffer, decoder.decode(value, { stream: true }));
        buffer = result.buffer;

        if (result.done) {
          const parsed = extractJSON(fullText);
          if (parsed && validate(parsed)) {
            onDone(parsed);
          } else {
            onError("Failed to parse AI response. The model returned invalid JSON.");
          }
          return;
        }

        for (const d of result.data) {
          try {
            const parsed = JSON.parse(d);
            if (parsed.content) {
              fullText += parsed.content;
              onChunk(fullText);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const parsed = extractJSON(fullText);
    if (parsed && validate(parsed)) {
      onDone(parsed);
    } else {
      onError("Stream ended unexpectedly");
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    onError(err instanceof Error ? err.message : "Stream failed");
  }
}

export async function streamButterfly(
  scenario: string,
  onChunk: (text: string) => void,
  onDone: (data: ButterflyResponse) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) {
  return streamSSE(
    "/api/butterfly/generate",
    { scenario },
    isButterflyResponse,
    onChunk,
    onDone,
    onError,
    signal
  );
}

export async function streamDetective(
  onChunk: (text: string) => void,
  onDone: (data: DetectiveResponse) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) {
  return streamSSE(
    "/api/detective/generate",
    {},
    isDetectiveResponse,
    onChunk,
    onDone,
    onError,
    signal
  );
}

export async function streamFixHistory(
  onChunk: (text: string) => void,
  onDone: (data: FixHistoryResponse) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) {
  return streamSSE(
    "/api/fix-history/generate",
    {},
    isFixHistoryResponse,
    onChunk,
    onDone,
    onError,
    signal
  );
}

export async function streamCompare(
  scenario: string,
  onChunk: (text: string) => void,
  onDone: (data: CompareResponse) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) {
  return streamSSE(
    "/api/compare/generate",
    { scenario },
    isCompareResponse,
    onChunk,
    onDone,
    onError,
    signal
  );
}

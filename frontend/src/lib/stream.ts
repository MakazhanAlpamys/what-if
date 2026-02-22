import { ScenarioResponse, ExpandResponse } from "./types";
import { isScenarioResponse, isExpandResponse } from "./validate";
import { extractSSEData } from "./sse";

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

    // If we get here without [DONE], try to parse what we have
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

export async function streamGenerate(
  scenario: string,
  onChunk: (text: string) => void,
  onDone: (data: ScenarioResponse) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) {
  return streamSSE(
    "/api/generate",
    { scenario },
    isScenarioResponse,
    onChunk,
    onDone,
    onError,
    signal
  );
}

export async function streamExpand(
  scenario: string,
  chain: { year: number; title: string; description: string }[],
  onChunk: (text: string) => void,
  onDone: (data: ExpandResponse) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) {
  return streamSSE(
    "/api/expand",
    { scenario, chain },
    isExpandResponse,
    onChunk,
    onDone,
    onError,
    signal
  );
}

export function extractJSON(text: string): unknown | null {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Strip <think>...</think> blocks (reasoning models like K2 Think V2)
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");

    // Handle unclosed <think> tags — strip the tag to avoid matching braces in reasoning
    const unclosedIdx = cleaned.search(/<think>/i);
    if (unclosedIdx !== -1) {
      cleaned = cleaned.slice(0, unclosedIdx) + " " + cleaned.slice(unclosedIdx + 7);
    }

    // Strip markdown code fences
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) {
      cleaned = fenceMatch[1];
    }

    // Try parsing cleaned text directly
    try {
      return JSON.parse(cleaned.trim());
    } catch {
      // Find the last balanced { ... } block by scanning backwards from the end.
      let depth = 0;
      let endPos = -1;
      for (let i = cleaned.length - 1; i >= 0; i--) {
        if (cleaned[i] === "}") {
          if (depth === 0) endPos = i;
          depth++;
        } else if (cleaned[i] === "{") {
          depth--;
          if (depth === 0 && endPos !== -1) {
            try {
              return JSON.parse(cleaned.slice(i, endPos + 1));
            } catch {
              endPos = -1;
            }
          }
        }
      }
      return null;
    }
  }
}

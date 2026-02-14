import { ScenarioResponse, ExpandResponse } from "./types";
import { isScenarioResponse, isExpandResponse } from "./validate";

export async function streamGenerate(
  scenario: string,
  onChunk: (text: string) => void,
  onDone: (data: ScenarioResponse) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) {
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json();
      onError(err.error || "Failed to generate");
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

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            const parsed = extractJSON(fullText);
            if (parsed && isScenarioResponse(parsed)) {
              onDone(parsed);
            } else {
              onError("Failed to parse AI response. The model returned invalid JSON.");
            }
            return;
          }

          try {
            const parsed = JSON.parse(data);
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
    if (parsed && isScenarioResponse(parsed)) {
      onDone(parsed);
    } else {
      onError("Stream ended unexpectedly");
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    onError(err instanceof Error ? err.message : "Stream failed");
  }
}

export async function streamExpand(
  scenario: string,
  chain: { year: number; title: string; description: string }[],
  onChunk: (text: string) => void,
  onDone: (data: ExpandResponse) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
) {
  try {
    const response = await fetch("/api/expand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, chain }),
      signal,
    });

    if (!response.ok) {
      const err = await response.json();
      onError(err.error || "Failed to expand");
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

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            const parsed = extractJSON(fullText);
            if (parsed && isExpandResponse(parsed)) {
              onDone(parsed);
            } else {
              onError("Failed to parse expand response");
            }
            return;
          }

          try {
            const parsed = JSON.parse(data);
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
    if (parsed && isExpandResponse(parsed)) {
      onDone(parsed);
    } else {
      onError("Stream ended unexpectedly");
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    onError(err instanceof Error ? err.message : "Stream failed");
  }
}

export function extractJSON(text: string): unknown | null {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Strip <think>...</think> blocks (reasoning models like K2 Think V2)
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");

    // Strip markdown code fences
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) {
      cleaned = fenceMatch[1];
    }

    // Try parsing cleaned text directly
    try {
      return JSON.parse(cleaned.trim());
    } catch {
      // K2 Think V2 outputs reasoning text (with { } examples) before the actual JSON.
      // Find the last balanced { ... } block by scanning backwards from the end.
      let depth = 0;
      for (let i = cleaned.length - 1; i >= 0; i--) {
        if (cleaned[i] === "}") depth++;
        else if (cleaned[i] === "{") {
          depth--;
          if (depth === 0) {
            try {
              return JSON.parse(cleaned.slice(i));
            } catch {
              return null;
            }
          }
        }
      }
      return null;
    }
  }
}

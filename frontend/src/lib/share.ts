import LZString from "lz-string";
import type { ScenarioResponse } from "./types";

export function encodeTimeline(data: ScenarioResponse): string {
  const json = JSON.stringify(data);
  return LZString.compressToEncodedURIComponent(json);
}

export function decodeTimeline(encoded: string): ScenarioResponse | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (parsed && parsed.scenario && parsed.timeline) {
      return parsed as ScenarioResponse;
    }
    return null;
  } catch {
    return null;
  }
}

export function generateShareURL(data: ScenarioResponse): string {
  const encoded = encodeTimeline(data);
  const url = new URL(window.location.origin + "/timeline");
  url.searchParams.set("share", encoded);
  return url.toString();
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

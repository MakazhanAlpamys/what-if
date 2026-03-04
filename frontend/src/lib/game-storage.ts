import type { ButterflyScore, DetectiveScore, FixHistoryScore } from "./types";

const BUTTERFLY_KEY = "whatif-butterfly-scores";
const DETECTIVE_KEY = "whatif-detective-scores";
const FIX_HISTORY_KEY = "whatif-fix-history-scores";
const MAX_SCORES = 10;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage full or unavailable
  }
}

function getScores<T>(key: string): T[] {
  const raw = safeGetItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function addScore<T extends { score: number }>(key: string, entry: T): void {
  const scores = getScores<T>(key);
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  if (scores.length > MAX_SCORES) scores.length = MAX_SCORES;
  safeSetItem(key, JSON.stringify(scores));
}

// Butterfly
export function getButterflyScores(): ButterflyScore[] {
  return getScores<ButterflyScore>(BUTTERFLY_KEY);
}

export function addButterflyScore(entry: ButterflyScore): void {
  addScore(BUTTERFLY_KEY, entry);
}

// Detective
export function getDetectiveScores(): DetectiveScore[] {
  return getScores<DetectiveScore>(DETECTIVE_KEY);
}

export function addDetectiveScore(entry: DetectiveScore): void {
  addScore(DETECTIVE_KEY, entry);
}

// Fix History
export function getFixHistoryScores(): FixHistoryScore[] {
  return getScores<FixHistoryScore>(FIX_HISTORY_KEY);
}

export function addFixHistoryScore(entry: FixHistoryScore): void {
  addScore(FIX_HISTORY_KEY, entry);
}

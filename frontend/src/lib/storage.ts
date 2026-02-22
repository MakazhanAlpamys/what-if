import type { ScenarioResponse } from "./types";

const STORAGE_KEY = "whatif-timelines";
const HISTORY_KEY = "whatif-history";
const MAX_HISTORY = 20;
const MAX_SAVED = 50;

export interface SavedTimeline {
  id: string;
  scenario: string;
  data: ScenarioResponse;
  savedAt: number;
}

export interface HistoryEntry {
  scenario: string;
  timestamp: number;
}

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

export function saveTimeline(scenario: string, data: ScenarioResponse): string {
  const saved = getSavedTimelines();
  const id = `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: SavedTimeline = { id, scenario, data, savedAt: Date.now() };

  saved.unshift(entry);
  if (saved.length > MAX_SAVED) saved.length = MAX_SAVED;

  safeSetItem(STORAGE_KEY, JSON.stringify(saved));
  return id;
}

export function getSavedTimelines(): SavedTimeline[] {
  const raw = safeGetItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedTimeline[];
  } catch {
    return [];
  }
}

export function getTimelineById(id: string): SavedTimeline | null {
  const saved = getSavedTimelines();
  return saved.find((t) => t.id === id) ?? null;
}

export function deleteSavedTimeline(id: string): void {
  const saved = getSavedTimelines();
  const filtered = saved.filter((t) => t.id !== id);
  safeSetItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function addToHistory(scenario: string): void {
  const history = getHistory();
  // Remove duplicate if exists
  const filtered = history.filter((h) => h.scenario !== scenario);
  filtered.unshift({ scenario, timestamp: Date.now() });
  if (filtered.length > MAX_HISTORY) filtered.length = MAX_HISTORY;
  safeSetItem(HISTORY_KEY, JSON.stringify(filtered));
}

export function getHistory(): HistoryEntry[] {
  const raw = safeGetItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  safeSetItem(HISTORY_KEY, JSON.stringify([]));
}

export function exportTimelineJSON(data: ScenarioResponse, scenario: string): void {
  const exportData = { ...data, exportedAt: new Date().toISOString(), originalScenario: scenario };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `what-if-${scenario.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

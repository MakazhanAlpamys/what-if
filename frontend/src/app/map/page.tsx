"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";

import TimelineNodeComponent from "@/components/TimelineNode";
import ErrorIcon from "@/components/ErrorIcon";
import ThemeToggle from "@/components/ThemeToggle";
import SoundToggle from "@/components/SoundToggle";
import { streamGenerate } from "@/lib/stream";
import { buildTreeLayout } from "@/lib/tree-layout";
import { collectAllNodes, findNodeById } from "@/lib/tree-utils";
import { soundManager } from "@/lib/sounds";
import { IMPACT_COLORS } from "@/lib/constants";
import type { ScenarioResponse, TimelineNode } from "@/lib/types";

// ---------------------------------------------------------------------------
// Region definitions (simplified SVG world map)
// ---------------------------------------------------------------------------

const REGIONS: Record<string, { name: string; path: string; cx: number; cy: number }> = {
  "north-america": {
    name: "North America",
    path: "M50,60 L130,50 L150,100 L130,140 L80,150 L40,120 Z",
    cx: 95,
    cy: 100,
  },
  "south-america": {
    name: "South America",
    path: "M100,160 L130,155 L145,200 L135,260 L110,270 L95,240 L85,190 Z",
    cx: 115,
    cy: 210,
  },
  europe: {
    name: "Europe",
    path: "M230,50 L280,45 L290,70 L275,95 L240,100 L220,80 Z",
    cx: 255,
    cy: 72,
  },
  africa: {
    name: "Africa",
    path: "M230,110 L280,100 L300,140 L290,200 L260,230 L230,220 L215,170 L220,130 Z",
    cx: 255,
    cy: 165,
  },
  asia: {
    name: "Asia",
    path: "M290,40 L380,35 L420,70 L400,120 L350,130 L300,110 L280,70 Z",
    cx: 350,
    cy: 80,
  },
  "middle-east": {
    name: "Middle East",
    path: "M280,90 L310,85 L320,110 L300,120 L275,110 Z",
    cx: 298,
    cy: 102,
  },
  oceania: {
    name: "Oceania",
    path: "M370,180 L420,175 L430,210 L400,225 L370,215 Z",
    cx: 400,
    cy: 198,
  },
  global: { name: "Global", path: "", cx: 240, cy: 150 },
};

// ---------------------------------------------------------------------------
// Region inference from text
// ---------------------------------------------------------------------------

function inferRegion(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(america|usa|united states|washington|new york)\b/.test(lower)) return "north-america";
  if (/\b(brazil|argentina|peru|chile|colombia|south america)\b/.test(lower))
    return "south-america";
  if (/\b(europe|britain|france|germany|italy|spain|rome|london|paris|berlin)\b/.test(lower))
    return "europe";
  if (/\b(africa|egypt|nigeria|ethiopia|sahara|cairo)\b/.test(lower)) return "africa";
  if (/\b(asia|china|japan|india|korea|beijing|tokyo)\b/.test(lower)) return "asia";
  if (
    /\b(middle east|arab|iraq|iran|israel|syria|ottoman|persian|jerusalem|baghdad|constantinople)\b/.test(
      lower
    )
  )
    return "middle-east";
  if (/\b(australia|oceania|pacific|new zealand)\b/.test(lower)) return "oceania";
  return "global";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNodeRegion(node: TimelineNode): string {
  if (node.region && REGIONS[node.region]) return node.region;
  return inferRegion(`${node.title} ${node.description}`);
}

/** Group all nodes by region. */
function groupByRegion(root: TimelineNode): Record<string, TimelineNode[]> {
  const allNodes = collectAllNodes(root);
  const groups: Record<string, TimelineNode[]> = {};
  for (const n of allNodes) {
    const region = getNodeRegion(n);
    if (!groups[region]) groups[region] = [];
    groups[region].push(n);
  }
  return groups;
}

/** Max events in any single region — used to normalize opacity. */
function maxRegionCount(groups: Record<string, TimelineNode[]>): number {
  let max = 0;
  for (const key of Object.keys(groups)) {
    if (groups[key].length > max) max = groups[key].length;
  }
  return Math.max(max, 1);
}

/** Dominant impact color for a set of nodes (most severe wins). */
function dominantColor(nodes: TimelineNode[]): string {
  const priority: TimelineNode["impact"][] = ["critical", "high", "medium", "low"];
  for (const level of priority) {
    if (nodes.some((n) => n.impact === level)) return IMPACT_COLORS[level];
  }
  return IMPACT_COLORS.low;
}

// ---------------------------------------------------------------------------
// React Flow node types
// ---------------------------------------------------------------------------

const nodeTypes = { timelineNode: TimelineNodeComponent };

// ---------------------------------------------------------------------------
// Map content component
// ---------------------------------------------------------------------------

type ViewMode = "map" | "tree";

function MapContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scenario = searchParams.get("q") || "";

  const [scenarioData, setScenarioData] = useState<ScenarioResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React Flow state (tree view)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Grouped regions
  const regionGroups = useMemo(() => {
    if (!scenarioData) return {};
    return groupByRegion(scenarioData.timeline);
  }, [scenarioData]);

  const maxCount = useMemo(() => maxRegionCount(regionGroups), [regionGroups]);

  // Events for the currently selected region
  const selectedRegionEvents = useMemo(() => {
    if (!selectedRegion) return [];
    return regionGroups[selectedRegion] ?? [];
  }, [selectedRegion, regionGroups]);

  // No-op callbacks for tree layout (map page doesn't support expanding)
  const noopExpand = useCallback(() => {}, []);
  const handleSelect = useCallback((nodeId: string) => {
    soundManager?.playClick();
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  // Build tree layout when in tree mode
  useEffect(() => {
    if (!scenarioData || viewMode !== "tree") return;
    const { nodes: layoutNodes, edges: layoutEdges } = buildTreeLayout(
      scenarioData.timeline,
      null,
      selectedNodeId,
      noopExpand,
      handleSelect
    );
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [scenarioData, viewMode, selectedNodeId, noopExpand, handleSelect, setNodes, setEdges]);

  // Start generation
  const startGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setError(null);
    setIsGenerating(true);
    setStreamText("");
    soundManager?.playPortalOpen();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    streamGenerate(
      scenario,
      (text) => setStreamText(text),
      (data) => {
        setScenarioData(data);
        setIsGenerating(false);
        setStreamText("");
        soundManager?.playSuccess();
        showToast("Timeline loaded — explore the world map!");
      },
      (err) => {
        setError(err);
        setIsGenerating(false);
        soundManager?.playError();
        showToast("Failed to generate timeline.");
      },
      abortController.signal
    );
  }, [scenario, showToast]);

  // Initialize on mount
  useEffect(() => {
    if (!scenario) {
      router.push("/");
      return;
    }
    startGeneration();
    return () => {
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selected node object (for detail panel in tree view)
  const selectedNode = useMemo(() => {
    if (!scenarioData || !selectedNodeId) return null;
    return findNodeById(scenarioData.timeline, selectedNodeId);
  }, [scenarioData, selectedNodeId]);

  const btnClass =
    "cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]";

  return (
    <div
      className="relative z-10 flex h-screen w-screen flex-col"
      role="main"
      aria-label="World Map visualization"
    >
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="z-40 flex shrink-0 items-center justify-between border-b border-[var(--accent-ghost)] bg-[var(--surface-overlay)] px-3 py-2 backdrop-blur-xl sm:px-6 sm:py-3">
        {/* Left: back button */}
        <button
          onClick={() => router.push("/")}
          aria-label="Go back to new scenario"
          className={`flex items-center gap-2 text-sm ${btnClass}`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden sm:inline">New scenario</span>
        </button>

        {/* Center: badge + scenario title */}
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="shrink-0 rounded-full bg-gradient-to-r from-purple-500 to-violet-600 px-3 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
            World Map
          </span>
          <h1 className="hidden max-w-lg truncate text-sm text-[var(--text-tertiary)] italic sm:block">
            &ldquo;{scenario}&rdquo;
          </h1>
        </div>

        {/* Right: view toggle + theme/sound */}
        <div className="flex items-center gap-1">
          {/* View toggle */}
          {scenarioData && !isGenerating && (
            <div className="mr-1 flex items-center rounded-lg border border-[var(--accent-ghost)] bg-[var(--surface-secondary)] p-0.5">
              <button
                onClick={() => setViewMode("map")}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === "map"
                    ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                Map
              </button>
              <button
                onClick={() => setViewMode("tree")}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === "tree"
                    ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                Tree
              </button>
            </div>
          )}
          <SoundToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* ── Toast ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--accent-faint)] bg-[var(--surface-secondary)] px-4 py-2 text-sm text-[var(--text-secondary)] shadow-xl backdrop-blur-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading state ────────────────────────────────────────── */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[var(--surface-overlay)]"
          >
            <div className="relative mb-6 h-28 w-28">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3 + i * 1.5, repeat: Infinity, ease: "linear" }}
                  className="vortex-ring"
                  style={{
                    width: `${100 - i * 18}%`,
                    height: `${100 - i * 18}%`,
                    top: `${i * 9}%`,
                    left: `${i * 9}%`,
                    borderColor: `rgba(139, 92, 246, ${0.15 + i * 0.1})`,
                    opacity: 0.4 + i * 0.15,
                  }}
                />
              ))}
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.6)]"
              />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">
              Creating alternate reality...
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint)]">
              K2 Think V2 is reasoning through your scenario
            </p>
            {streamText && (
              <div
                className="mx-auto max-h-48 max-w-xl overflow-y-auto rounded-xl border border-[var(--accent-ghost)] bg-[var(--accent-ghost)] p-4"
                aria-live="polite"
              >
                <pre
                  className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-[var(--text-faint)]"
                  aria-label="AI reasoning output"
                >
                  {streamText.length > 800 ? `...${streamText.slice(-800)}` : streamText}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error state ──────────────────────────────────────────── */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[var(--surface-overlay)]">
          <div className="max-w-md text-center">
            <div className="mb-4 text-4xl">
              <ErrorIcon className="inline h-12 w-12" />
            </div>
            <h2 className="mb-2 text-lg font-semibold text-[var(--text-secondary)]">
              Failed to create reality
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint)]">{error}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              {scenario && (
                <button
                  onClick={startGeneration}
                  className="cursor-pointer rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
                >
                  Retry this scenario
                </button>
              )}
              <button
                onClick={() => router.push("/")}
                className="cursor-pointer rounded-xl border border-[var(--accent-faint)] bg-transparent px-6 py-2.5 text-sm font-medium text-[var(--text-tertiary)] transition-colors hover:border-[var(--accent-muted)] hover:text-[var(--text-secondary)]"
              >
                Try another scenario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────── */}
      {scenarioData && !isGenerating && !error && (
        <div className="relative flex min-h-0 flex-1">
          {/* Map view */}
          {viewMode === "map" && (
            <div className="flex min-h-0 flex-1">
              {/* SVG map area */}
              <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
                <svg
                  viewBox="0 0 480 300"
                  className="h-full max-h-full w-full max-w-4xl"
                  style={{ filter: "drop-shadow(0 0 30px rgba(139, 92, 246, 0.08))" }}
                >
                  {/* Ocean / background grid lines */}
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path
                        d="M 40 0 L 0 0 0 40"
                        fill="none"
                        stroke="rgba(139, 92, 246, 0.06)"
                        strokeWidth="0.5"
                      />
                    </pattern>
                    {/* Ripple animation keyframes are handled via CSS below */}
                  </defs>
                  <rect width="480" height="300" fill="url(#grid)" rx="8" />

                  {/* Region shapes */}
                  {Object.entries(REGIONS).map(([key, region]) => {
                    if (!region.path) return null; // skip "global"
                    const events = regionGroups[key] ?? [];
                    const hasEvents = events.length > 0;
                    const color = hasEvents ? dominantColor(events) : "rgba(139, 92, 246, 0.15)";
                    const opacity = hasEvents ? 0.2 + (events.length / maxCount) * 0.55 : 0.08;
                    const isSelected = selectedRegion === key;
                    const isHovered = hoveredRegion === key;

                    return (
                      <g key={key}>
                        {/* Region path */}
                        <path
                          d={region.path}
                          fill={color}
                          fillOpacity={
                            isSelected
                              ? Math.min(opacity + 0.25, 1)
                              : isHovered
                                ? Math.min(opacity + 0.15, 1)
                                : opacity
                          }
                          stroke={
                            isSelected ? color : hasEvents ? color : "rgba(139, 92, 246, 0.2)"
                          }
                          strokeWidth={isSelected ? 2 : 1}
                          strokeOpacity={isSelected ? 0.9 : 0.5}
                          className="cursor-pointer transition-all duration-300"
                          onClick={() => {
                            soundManager?.playClick();
                            setSelectedRegion(isSelected ? null : key);
                          }}
                          onMouseEnter={() => setHoveredRegion(key)}
                          onMouseLeave={() => setHoveredRegion(null)}
                        />

                        {/* Pulsing dot for regions with events */}
                        {hasEvents && (
                          <>
                            {/* Ripple rings */}
                            <circle
                              cx={region.cx}
                              cy={region.cy}
                              r="4"
                              fill="none"
                              stroke={color}
                              strokeWidth="1"
                              opacity="0"
                              className="map-ripple"
                            />
                            <circle
                              cx={region.cx}
                              cy={region.cy}
                              r="4"
                              fill="none"
                              stroke={color}
                              strokeWidth="1"
                              opacity="0"
                              className="map-ripple"
                              style={{ animationDelay: "1s" }}
                            />
                            {/* Core dot */}
                            <circle
                              cx={region.cx}
                              cy={region.cy}
                              r="4"
                              fill={color}
                              className="map-pulse cursor-pointer"
                              onClick={() => {
                                soundManager?.playClick();
                                setSelectedRegion(isSelected ? null : key);
                              }}
                            />
                            {/* Glow */}
                            <circle
                              cx={region.cx}
                              cy={region.cy}
                              r="8"
                              fill={color}
                              opacity="0.15"
                              className="map-pulse"
                            />
                          </>
                        )}

                        {/* Region label */}
                        <text
                          x={region.cx}
                          y={region.cy + (hasEvents ? 16 : 6)}
                          textAnchor="middle"
                          className="pointer-events-none fill-[var(--text-muted)] text-[7px] font-medium select-none"
                          opacity={isHovered || isSelected || hasEvents ? 0.9 : 0.4}
                        >
                          {region.name}
                        </text>

                        {/* Event count badge */}
                        {hasEvents && (
                          <>
                            <rect
                              x={region.cx + 6}
                              y={region.cy - 14}
                              width={events.length > 9 ? 18 : 14}
                              height="14"
                              rx="7"
                              fill={color}
                              opacity="0.85"
                            />
                            <text
                              x={region.cx + 6 + (events.length > 9 ? 9 : 7)}
                              y={region.cy - 4}
                              textAnchor="middle"
                              className="pointer-events-none fill-white text-[8px] font-bold select-none"
                            >
                              {events.length}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}

                  {/* Global indicator (center) when there are global events */}
                  {(regionGroups["global"]?.length ?? 0) > 0 && (
                    <g>
                      <circle
                        cx={REGIONS.global.cx}
                        cy={REGIONS.global.cy}
                        r="6"
                        fill={dominantColor(regionGroups["global"])}
                        opacity="0.3"
                        className="map-pulse cursor-pointer"
                        onClick={() => {
                          soundManager?.playClick();
                          setSelectedRegion(selectedRegion === "global" ? null : "global");
                        }}
                      />
                      <text
                        x={REGIONS.global.cx}
                        y={REGIONS.global.cy + 16}
                        textAnchor="middle"
                        className="pointer-events-none fill-[var(--text-muted)] text-[7px] font-medium select-none"
                        opacity="0.5"
                      >
                        Global
                      </text>
                    </g>
                  )}
                </svg>

                {/* Hover tooltip */}
                <AnimatePresence>
                  {hoveredRegion && REGIONS[hoveredRegion] && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="pointer-events-none absolute top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--accent-faint)] bg-[var(--surface-secondary)] px-3 py-1.5 text-xs text-[var(--text-secondary)] shadow-xl backdrop-blur-xl"
                    >
                      <span className="font-semibold">{REGIONS[hoveredRegion].name}</span>
                      {" — "}
                      {regionGroups[hoveredRegion]?.length ?? 0} event
                      {(regionGroups[hoveredRegion]?.length ?? 0) !== 1 ? "s" : ""}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right panel: events for selected region */}
              <AnimatePresence>
                {selectedRegion && (
                  <motion.aside
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 340, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                    className="flex h-full shrink-0 flex-col overflow-hidden border-l border-[var(--accent-ghost)] bg-[var(--surface-secondary)]"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--accent-ghost)] px-4 py-3">
                      <div>
                        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                          {REGIONS[selectedRegion]?.name ?? selectedRegion}
                        </h2>
                        <p className="text-xs text-[var(--text-faint)]">
                          {selectedRegionEvents.length} event
                          {selectedRegionEvents.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedRegion(null)}
                        aria-label="Close region panel"
                        className={btnClass}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3">
                      {selectedRegionEvents.length === 0 ? (
                        <p className="py-8 text-center text-xs text-[var(--text-faint)]">
                          No events in this region.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {selectedRegionEvents
                            .sort((a, b) => a.year - b.year)
                            .map((node) => {
                              const color = IMPACT_COLORS[node.impact];
                              return (
                                <motion.div
                                  key={node.id}
                                  initial={{ opacity: 0, x: 20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="cursor-pointer rounded-xl border border-[var(--accent-ghost)] bg-[var(--surface-primary)] p-3 transition-colors hover:border-[var(--accent-faint)]"
                                  onClick={() => {
                                    soundManager?.playClick();
                                    setSelectedNodeId(node.id);
                                  }}
                                >
                                  <div className="mb-1.5 flex items-center gap-2">
                                    <span
                                      className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                                      style={{ backgroundColor: `${color}20`, color }}
                                    >
                                      {node.year}
                                    </span>
                                    <span
                                      className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase"
                                      style={{ backgroundColor: `${color}15`, color }}
                                    >
                                      {node.impact}
                                    </span>
                                  </div>
                                  <h3 className="text-xs leading-snug font-semibold text-[var(--text-primary)]">
                                    {node.title}
                                  </h3>
                                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                                    {node.description}
                                  </p>
                                </motion.div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Tree view */}
          {viewMode === "tree" && (
            <div id="map-tree-canvas" className="h-full w-full flex-1">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                minZoom={0.2}
                maxZoom={1.5}
                className="!bg-transparent"
                nodesDraggable={false}
              >
                <Background color="rgba(139, 92, 246, 0.05)" gap={40} size={1} />
                <Controls showInteractive={false} aria-label="Map controls" />
                <MiniMap
                  nodeColor="var(--accent-soft, rgba(139, 92, 246, 0.4))"
                  maskColor="var(--minimap-mask, rgba(5, 5, 16, 0.8))"
                  className="!rounded-xl !border !border-[var(--accent-border)] !bg-[var(--minimap-bg)]"
                  pannable
                  zoomable
                />
              </ReactFlow>
            </div>
          )}
        </div>
      )}

      {/* ── Node detail modal (when clicking an event card) ──── */}
      <AnimatePresence>
        {selectedNode && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedNodeId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--accent-ghost)] bg-[var(--surface-secondary)] p-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-md px-2 py-0.5 text-xs font-bold"
                    style={{
                      backgroundColor: `${IMPACT_COLORS[selectedNode.impact]}20`,
                      color: IMPACT_COLORS[selectedNode.impact],
                    }}
                  >
                    {selectedNode.year}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
                    style={{
                      backgroundColor: `${IMPACT_COLORS[selectedNode.impact]}15`,
                      color: IMPACT_COLORS[selectedNode.impact],
                    }}
                  >
                    {selectedNode.impact}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  aria-label="Close detail"
                  className={btnClass}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
                {selectedNode.title}
              </h2>
              <p className="text-sm leading-relaxed text-[var(--text-tertiary)]">
                {selectedNode.description}
              </p>
              {selectedNode.region && (
                <p className="mt-3 text-xs text-[var(--text-faint)]">
                  Region: {REGIONS[selectedNode.region]?.name ?? selectedNode.region}
                </p>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Legend (bottom) ───────────────────────────────────────── */}
      {scenarioData && !isGenerating && !error && viewMode === "map" && (
        <div className="z-30 flex shrink-0 items-center justify-center gap-4 border-t border-[var(--accent-ghost)] bg-[var(--surface-overlay)] px-4 py-2 backdrop-blur-xl sm:gap-6">
          {(Object.entries(IMPACT_COLORS) as [TimelineNode["impact"], string][]).map(
            ([level, color]) => (
              <div key={level} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[11px] text-[var(--text-muted)] capitalize">{level}</span>
              </div>
            )
          )}
        </div>
      )}

      {/* ── CSS for map animations ───────────────────────────────── */}
      <style jsx>{`
        @keyframes map-pulse-anim {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.3);
          }
        }
        @keyframes map-ripple-anim {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(4.5);
            opacity: 0;
          }
        }
        :global(.map-pulse) {
          animation: map-pulse-anim 2s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        :global(.map-ripple) {
          animation: map-ripple-anim 2.5s ease-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree-view wrapper (provides ReactFlowProvider only in tree mode)
// ---------------------------------------------------------------------------

function MapWithFlowProvider() {
  return (
    <ReactFlowProvider>
      <MapContent />
    </ReactFlowProvider>
  );
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

function MapLoading() {
  return (
    <div className="relative z-10 flex h-screen w-screen items-center justify-center">
      <div className="h-16 w-16 animate-spin rounded-full border-2 border-[var(--accent-faint)] border-t-[var(--accent)]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function MapPage() {
  return (
    <Suspense fallback={<MapLoading />}>
      <MapWithFlowProvider />
    </Suspense>
  );
}

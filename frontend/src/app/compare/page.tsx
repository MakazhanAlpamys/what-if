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
import Spinner from "@/components/Spinner";
import ErrorIcon from "@/components/ErrorIcon";
import ThemeToggle from "@/components/ThemeToggle";
import SoundToggle from "@/components/SoundToggle";
import { streamCompare } from "@/lib/game-stream";
import { buildTreeLayout } from "@/lib/tree-layout";
import { findNodeById } from "@/lib/tree-utils";
import { soundManager } from "@/lib/sounds";
import { IMPACT_COLORS } from "@/lib/constants";
import type { CompareResponse, DivergencePoint, ConvergencePoint, TimelineNode } from "@/lib/types";

const nodeTypes = { timelineNode: TimelineNodeComponent };

/* ------------------------------------------------------------------ */
/*  Inner flow component — each side gets its own ReactFlowProvider   */
/* ------------------------------------------------------------------ */

interface CompareFlowInnerProps {
  timeline: TimelineNode;
  label: string;
  labelColor: string;
  bgColor: string;
  accentColor: string;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}

function CompareFlowInner({
  timeline,
  label,
  labelColor,
  bgColor,
  accentColor,
  selectedNodeId,
  onSelect,
}: CompareFlowInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const handleExpand = useCallback(() => {}, []);

  useEffect(() => {
    const { nodes: layoutNodes, edges: layoutEdges } = buildTreeLayout(
      timeline,
      null,
      selectedNodeId,
      handleExpand,
      onSelect
    );
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [timeline, selectedNodeId, handleExpand, onSelect, setNodes, setEdges]);

  return (
    <div className="relative flex h-full flex-col">
      {/* Side label */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-[10px] font-bold tracking-widest uppercase"
          style={{ backgroundColor: `${labelColor}20`, color: labelColor }}
        >
          {label}
        </span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.15}
        maxZoom={1.5}
        className="!bg-transparent"
        nodesDraggable={false}
      >
        <Background color={bgColor} gap={40} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={accentColor}
          maskColor="var(--minimap-mask)"
          className="!rounded-xl !border !border-[var(--accent-border)] !bg-[var(--minimap-bg)]"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

function CompareFlow(props: CompareFlowInnerProps) {
  return (
    <ReactFlowProvider>
      <CompareFlowInner {...props} />
    </ReactFlowProvider>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail overlay for a selected node (simplified, no expand)        */
/* ------------------------------------------------------------------ */

function CompareDetailOverlay({
  node,
  side,
  onClose,
}: {
  node: TimelineNode;
  side: "reality" | "alternative";
  onClose: () => void;
}) {
  const color = IMPACT_COLORS[node.impact];
  const sideColor = side === "reality" ? "#3b82f6" : "#a855f7";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute right-4 bottom-4 z-30 w-80 rounded-2xl border border-[var(--accent-border)] bg-[var(--surface-secondary)] p-5 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
          style={{ backgroundColor: `${sideColor}20`, color: sideColor }}
        >
          {side}
        </span>
        <button
          onClick={onClose}
          className="cursor-pointer rounded-lg p-1 text-[var(--text-faint)] transition-colors hover:text-[var(--text-secondary)]"
          aria-label="Close detail"
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

      <div className="mb-3 flex items-center gap-2">
        <span
          className="rounded-lg px-2.5 py-0.5 text-sm font-bold"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {node.year}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {node.impact} impact
        </span>
      </div>

      <h3 className="mb-2 text-sm leading-tight font-bold text-[var(--text-primary)]">
        {node.title}
      </h3>
      <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">{node.description}</p>

      {node.branches.length > 0 && (
        <div className="mt-3 text-[10px] text-[var(--text-faint)]">
          {node.branches.length} sub-branch{node.branches.length !== 1 ? "es" : ""}
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Divergence / Convergence point tooltip                            */
/* ------------------------------------------------------------------ */

interface PointTooltipProps {
  point: DivergencePoint | ConvergencePoint;
  type: "divergence" | "convergence";
  onClose: () => void;
}

function PointTooltip({ point, type, onClose }: PointTooltipProps) {
  const color = type === "divergence" ? "#ef4444" : "#22c55e";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute left-1/2 z-50 w-64 -translate-x-1/2 rounded-xl border bg-[var(--surface-secondary)] p-4 shadow-2xl backdrop-blur-xl"
      style={{ borderColor: `${color}30`, top: "100%", marginTop: 8 }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {type} &middot; {point.year}
        </span>
        <button
          onClick={onClose}
          className="cursor-pointer rounded p-0.5 text-[var(--text-faint)] transition-colors hover:text-[var(--text-secondary)]"
          aria-label="Close tooltip"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">{point.description}</p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main compare content                                              */
/* ------------------------------------------------------------------ */

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scenario = searchParams.get("q") || "";

  const [data, setData] = useState<CompareResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Per-side selected node
  const [realSelectedId, setRealSelectedId] = useState<string | null>(null);
  const [altSelectedId, setAltSelectedId] = useState<string | null>(null);

  // Active point tooltip
  const [activePointIdx, setActivePointIdx] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSelectReal = useCallback((nodeId: string) => {
    soundManager?.playClick();
    setRealSelectedId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleSelectAlt = useCallback((nodeId: string) => {
    soundManager?.playClick();
    setAltSelectedId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const startGeneration = useCallback(() => {
    if (!scenario) return;
    abortRef.current?.abort();
    setError(null);
    setIsGenerating(true);
    setStreamText("");
    soundManager?.playPortalOpen();

    const abort = new AbortController();
    abortRef.current = abort;

    streamCompare(
      scenario,
      (text) => setStreamText(text),
      (result) => {
        setData(result);
        setIsGenerating(false);
        setStreamText("");
        soundManager?.playSuccess();
        showToast("Timelines generated — compare realities!");
      },
      (err) => {
        setError(err);
        setIsGenerating(false);
        soundManager?.playError();
      },
      abort.signal
    );
  }, [scenario, showToast]);

  // Initialize
  useEffect(() => {
    if (!scenario) {
      router.push("/");
      return;
    }
    startGeneration();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (realSelectedId) setRealSelectedId(null);
        if (altSelectedId) setAltSelectedId(null);
        if (activePointIdx !== null) setActivePointIdx(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [realSelectedId, altSelectedId, activePointIdx]);

  // Resolved selected nodes
  const realSelectedNode = useMemo(() => {
    if (!data || !realSelectedId) return null;
    return findNodeById(data.realTimeline, realSelectedId);
  }, [data, realSelectedId]);

  const altSelectedNode = useMemo(() => {
    if (!data || !altSelectedId) return null;
    return findNodeById(data.altTimeline, altSelectedId);
  }, [data, altSelectedId]);

  // Merge divergence + convergence points and sort by year
  type MarkerPoint =
    | { type: "divergence"; point: DivergencePoint; idx: number }
    | { type: "convergence"; point: ConvergencePoint; idx: number };

  const allPoints = useMemo((): MarkerPoint[] => {
    if (!data) return [];
    const divs: MarkerPoint[] = data.divergencePoints.map((p, i) => ({
      type: "divergence" as const,
      point: p,
      idx: i,
    }));
    const convs: MarkerPoint[] = data.convergencePoints.map((p, i) => ({
      type: "convergence" as const,
      point: p,
      idx: data.divergencePoints.length + i,
    }));
    return [...divs, ...convs].sort((a, b) => a.point.year - b.point.year);
  }, [data]);

  const btnClass =
    "cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]";

  return (
    <div
      className="relative z-10 flex h-screen w-screen flex-col"
      role="main"
      aria-label="Reality vs Alternative comparison"
    >
      {/* Top bar */}
      <div className="relative z-40 flex shrink-0 items-center justify-between border-b border-[var(--accent-ghost)] bg-[var(--surface-overlay)] px-3 py-2 backdrop-blur-xl sm:px-6 sm:py-3">
        <button
          onClick={() => router.push("/")}
          aria-label="Go back"
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
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-600 px-3 py-1 text-xs font-bold text-white">
            Reality vs Alternative
          </span>
          {data && (
            <h1 className="hidden max-w-xs truncate text-sm text-[var(--text-tertiary)] italic lg:block">
              &ldquo;{data.scenario}&rdquo;
            </h1>
          )}
        </div>

        <div className="flex items-center gap-1">
          <SoundToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-blue-500/20 bg-[var(--surface-secondary)] px-4 py-2 text-sm text-blue-300 shadow-xl backdrop-blur-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
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
                    borderColor: `rgba(59, 130, 246, ${0.15 + i * 0.1})`,
                    opacity: 0.4 + i * 0.15,
                  }}
                />
              ))}
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)]"
              />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">
              Splitting realities...
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint)]">
              K2 Think V2 is generating both timelines side by side
            </p>
            {streamText && (
              <div className="mx-auto max-h-48 max-w-xl overflow-y-auto rounded-xl border border-blue-500/10 bg-[var(--accent-ghost)] p-4">
                <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-[var(--text-faint)]">
                  {streamText.length > 800 ? `...${streamText.slice(-800)}` : streamText}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[var(--surface-overlay)]">
          <div className="max-w-md text-center">
            <ErrorIcon className="mx-auto mb-4 h-12 w-12" />
            <h2 className="mb-2 text-lg font-semibold text-[var(--text-secondary)]">
              Realities collapsed!
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint)]">{error}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={startGeneration}
                className="cursor-pointer rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                Try again
              </button>
              <button
                onClick={() => router.push("/")}
                className="cursor-pointer rounded-xl border border-[var(--accent-faint)] px-6 py-2.5 text-sm font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
              >
                New scenario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split-screen comparison */}
      {data && !isGenerating && (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* Two-panel flow area */}
          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
            {/* Reality (left) */}
            <div className="relative border-b border-[var(--accent-ghost)] md:border-r md:border-b-0">
              <CompareFlow
                timeline={data.realTimeline}
                label="Reality"
                labelColor="#3b82f6"
                bgColor="rgba(59, 130, 246, 0.03)"
                accentColor="rgba(59, 130, 246, 0.4)"
                selectedNodeId={realSelectedId}
                onSelect={handleSelectReal}
              />

              {/* Detail overlay for reality side */}
              <AnimatePresence>
                {realSelectedNode && (
                  <CompareDetailOverlay
                    node={realSelectedNode}
                    side="reality"
                    onClose={() => setRealSelectedId(null)}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Vertical divider with year markers (desktop) */}
            <div className="pointer-events-none absolute top-0 bottom-0 left-1/2 z-20 hidden -translate-x-1/2 md:block">
              <div className="h-full w-px bg-gradient-to-b from-transparent via-[var(--accent-faint)] to-transparent" />

              {/* Divergence / convergence point markers */}
              {allPoints.map((item, i) => {
                const total = allPoints.length;
                const topPercent = total <= 1 ? 50 : 10 + (i / (total - 1)) * 80;
                const isDivergence = item.type === "divergence";
                const dotColor = isDivergence ? "#ef4444" : "#22c55e";

                return (
                  <div
                    key={item.idx}
                    className="pointer-events-auto absolute left-1/2 -translate-x-1/2"
                    style={{ top: `${topPercent}%` }}
                  >
                    <button
                      onClick={() =>
                        setActivePointIdx((prev) => (prev === item.idx ? null : item.idx))
                      }
                      className="group relative flex cursor-pointer items-center justify-center"
                      title={`${item.type}: ${item.point.year}`}
                      aria-label={`${item.type} point at ${item.point.year}: ${item.point.description}`}
                    >
                      {/* Glow ring */}
                      <span
                        className="absolute h-6 w-6 animate-ping rounded-full opacity-20"
                        style={{ backgroundColor: dotColor }}
                      />
                      {/* Dot */}
                      <span
                        className="relative z-10 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white shadow-lg transition-transform group-hover:scale-125"
                        style={{
                          backgroundColor: dotColor,
                          boxShadow: `0 0 8px ${dotColor}60`,
                        }}
                      >
                        {isDivergence ? (
                          <svg
                            className="h-2.5 w-2.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 14l-7 7m0 0l-7-7m7 7V3"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-2.5 w-2.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 10l7-7m0 0l7 7m-7-7v18"
                            />
                          </svg>
                        )}
                      </span>

                      {/* Year label */}
                      <span
                        className="absolute top-5 rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap"
                        style={{ backgroundColor: `${dotColor}15`, color: dotColor }}
                      >
                        {item.point.year}
                      </span>
                    </button>

                    {/* Tooltip */}
                    <AnimatePresence>
                      {activePointIdx === item.idx && (
                        <PointTooltip
                          point={item.point}
                          type={item.type}
                          onClose={() => setActivePointIdx(null)}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Alternative (right) */}
            <div className="relative">
              <CompareFlow
                timeline={data.altTimeline}
                label="Alternative"
                labelColor="#a855f7"
                bgColor="rgba(168, 85, 247, 0.03)"
                accentColor="rgba(168, 85, 247, 0.4)"
                selectedNodeId={altSelectedId}
                onSelect={handleSelectAlt}
              />

              {/* Detail overlay for alternative side */}
              <AnimatePresence>
                {altSelectedNode && (
                  <CompareDetailOverlay
                    node={altSelectedNode}
                    side="alternative"
                    onClose={() => setAltSelectedId(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom panel: divergence & convergence cards */}
          {allPoints.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="shrink-0 border-t border-[var(--accent-ghost)] bg-[var(--surface-overlay)] backdrop-blur-xl"
            >
              <div className="flex items-center gap-3 overflow-x-auto px-4 py-3">
                <span className="shrink-0 text-[10px] font-medium tracking-wider text-[var(--text-faint)] uppercase">
                  Key Points
                </span>
                <div className="h-4 w-px shrink-0 bg-[var(--accent-ghost)]" />

                {allPoints.map((item) => {
                  const isDivergence = item.type === "divergence";
                  const dotColor = isDivergence ? "#ef4444" : "#22c55e";
                  const isActive = activePointIdx === item.idx;

                  return (
                    <button
                      key={item.idx}
                      onClick={() =>
                        setActivePointIdx((prev) => (prev === item.idx ? null : item.idx))
                      }
                      className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                        isActive
                          ? "border-[var(--accent-muted)] bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                          : "border-[var(--accent-ghost)] bg-transparent text-[var(--text-muted)] hover:border-[var(--accent-faint)] hover:text-[var(--text-tertiary)]"
                      }`}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />
                      <span className="font-semibold">{item.point.year}</span>
                      <span className="max-w-[180px] truncate">{item.point.description}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Keyboard hints */}
      {data && !isGenerating && (
        <div className="absolute right-4 bottom-16 z-30 hidden text-xs text-[var(--text-invisible)] lg:block">
          Click nodes to inspect &middot; Escape to close
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page wrapper with Suspense                                        */
/* ------------------------------------------------------------------ */

function CompareLoading() {
  return (
    <div className="relative z-10 flex h-screen w-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<CompareLoading />}>
      <CompareContent />
    </Suspense>
  );
}

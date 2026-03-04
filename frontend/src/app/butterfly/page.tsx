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
import DetailPanel from "@/components/DetailPanel";
import Spinner from "@/components/Spinner";
import ErrorIcon from "@/components/ErrorIcon";
import ThemeToggle from "@/components/ThemeToggle";
import SoundToggle from "@/components/SoundToggle";
import { streamButterfly } from "@/lib/game-stream";
import { buildTreeLayout } from "@/lib/tree-layout";
import { findNodeById, collectAllNodes } from "@/lib/tree-utils";
import { soundManager } from "@/lib/sounds";
import { IMPACT_COLORS } from "@/lib/constants";
import { addButterflyScore, getButterflyScores } from "@/lib/game-storage";
import type { ButterflyResponse, ButterflyScore, TimelineNode } from "@/lib/types";

const nodeTypes = { timelineNode: TimelineNodeComponent };

function countByImpact(node: TimelineNode): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const all = collectAllNodes(node);
  for (const n of all) counts[n.impact]++;
  return counts;
}

function ButterflyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scenario = searchParams.get("q") || "";

  const [data, setData] = useState<ButterflyResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ButterflyScore[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSelect = useCallback((nodeId: string) => {
    soundManager?.playClick();
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleExpand = useCallback(() => {}, []);

  const startGeneration = useCallback(() => {
    if (!scenario) return;
    abortRef.current?.abort();
    setError(null);
    setIsGenerating(true);
    setStreamText("");
    soundManager?.playPortalOpen();

    const abort = new AbortController();
    abortRef.current = abort;

    streamButterfly(
      scenario,
      (text) => setStreamText(text),
      (result) => {
        setData(result);
        setIsGenerating(false);
        setStreamText("");
        soundManager?.playSuccess();

        // Calculate and save score
        const counts = countByImpact(result.timeline);
        const calculatedScore = counts.critical * 20 + counts.high * 10 + counts.medium * 5;
        const totalNodes = collectAllNodes(result.timeline).length;

        addButterflyScore({
          scenario: result.smallChange || scenario,
          score: Math.max(calculatedScore, result.butterflyScore),
          criticalCount: counts.critical,
          totalNodes,
          timestamp: Date.now(),
        });

        showToast(`Butterfly Score: ${Math.max(calculatedScore, result.butterflyScore)}!`);
      },
      (err) => {
        setError(err);
        setIsGenerating(false);
        soundManager?.playError();
      },
      abort.signal
    );
  }, [scenario, showToast]);

  // Build tree layout
  useEffect(() => {
    if (!data) return;
    const { nodes: layoutNodes, edges: layoutEdges } = buildTreeLayout(
      data.timeline,
      null,
      selectedNodeId,
      handleExpand,
      handleSelect
    );
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [data, selectedNodeId, handleExpand, handleSelect, setNodes, setEdges]);

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
      if (e.key === "Escape" && selectedNodeId) setSelectedNodeId(null);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedNodeId]);

  const selectedNode = useMemo(() => {
    if (!data || !selectedNodeId) return null;
    return findNodeById(data.timeline, selectedNodeId);
  }, [data, selectedNodeId]);

  const impactCounts = useMemo(() => {
    if (!data) return null;
    return countByImpact(data.timeline);
  }, [data]);

  const butterflyScore = useMemo(() => {
    if (!impactCounts) return 0;
    return impactCounts.critical * 20 + impactCounts.high * 10 + impactCounts.medium * 5;
  }, [impactCounts]);

  const btnClass =
    "cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]";

  return (
    <div className="relative z-10 h-screen w-screen" role="main">
      {/* Top bar */}
      <div className="absolute top-0 right-0 left-0 z-40 flex items-center justify-between border-b border-[var(--accent-ghost)] bg-[var(--surface-overlay)] px-3 py-2 backdrop-blur-xl sm:px-6 sm:py-3">
        <button
          onClick={() => router.push("/")}
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
          <span className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-1 text-xs font-bold text-white">
            Butterfly Effect
          </span>
          {data && (
            <span className="text-sm font-semibold text-amber-400">
              Score: {Math.max(butterflyScore, data.butterflyScore)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setLeaderboard(getButterflyScores());
              setShowLeaderboard(true);
            }}
            className={btnClass}
            title="Leaderboard"
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
                d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
          <SoundToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Score breakdown */}
      {data && impactCounts && !isGenerating && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-amber-500/20 bg-[var(--surface-secondary)] px-5 py-2.5 shadow-xl backdrop-blur-xl"
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-400">
              {Math.max(butterflyScore, data.butterflyScore)}
            </div>
            <div className="text-[10px] tracking-wider text-[var(--text-faint)] uppercase">
              Score
            </div>
          </div>
          <div className="h-8 w-px bg-[var(--accent-ghost)]" />
          {(["critical", "high", "medium", "low"] as const).map((impact) => (
            <div key={impact} className="text-center">
              <div className="text-lg font-bold" style={{ color: IMPACT_COLORS[impact] }}>
                {impactCounts[impact]}
              </div>
              <div className="text-[10px] text-[var(--text-faint)] capitalize">{impact}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-32 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-500/30 bg-[var(--surface-secondary)] px-4 py-2 text-sm text-amber-300 shadow-xl backdrop-blur-xl"
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
                    borderColor: `rgba(245, 158, 11, ${0.15 + i * 0.1})`,
                    opacity: 0.4 + i * 0.15,
                  }}
                />
              ))}
            </div>
            <h2 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">
              Flapping butterfly wings...
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint)]">
              Calculating chain reaction from your tiny change
            </p>
            {streamText && (
              <div className="mx-auto max-h-48 max-w-xl overflow-y-auto rounded-xl border border-amber-500/10 bg-[var(--accent-ghost)] p-4">
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
              Butterfly escaped!
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint)]">{error}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={startGeneration}
                className="cursor-pointer rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-500"
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

      {/* React Flow */}
      {data && !isGenerating && (
        <div className="h-full w-full">
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
            <Background color="rgba(245, 158, 11, 0.05)" gap={40} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor="rgba(245, 158, 11, 0.4)"
              maskColor="var(--minimap-mask)"
              className="!rounded-xl !border !border-amber-500/20 !bg-[var(--minimap-bg)]"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[var(--backdrop)] sm:hidden"
            onClick={() => setSelectedNodeId(null)}
          />
        )}
      </AnimatePresence>
      <DetailPanel
        node={selectedNode}
        realHistory=""
        onClose={() => setSelectedNodeId(null)}
        onExpand={handleExpand}
        onCollapse={() => {}}
        isExpanding={false}
        hasChildren={selectedNode ? selectedNode.branches.length > 0 : false}
      />

      {/* Leaderboard modal */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] backdrop-blur-sm"
            onClick={() => setShowLeaderboard(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mx-4 w-full max-w-md rounded-2xl border border-amber-500/20 bg-[var(--surface-secondary)] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 text-lg font-semibold text-amber-400">Butterfly Leaderboard</h3>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-[var(--text-faint)]">
                  No scores yet. Play to add yours!
                </p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, i) => (
                    <div
                      key={entry.timestamp}
                      className="flex items-center gap-3 rounded-xl border border-[var(--accent-ghost)] bg-[var(--surface-primary)] p-3"
                    >
                      <span
                        className={`text-lg font-bold ${i === 0 ? "text-amber-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-[var(--text-faint)]"}`}
                      >
                        #{i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[var(--text-secondary)]">
                          {entry.scenario}
                        </p>
                        <p className="text-xs text-[var(--text-faint)]">
                          {entry.criticalCount} critical events · {entry.totalNodes} total nodes
                        </p>
                      </div>
                      <span className="text-lg font-bold text-amber-400">{entry.score}</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowLeaderboard(false)}
                className="mt-4 w-full cursor-pointer rounded-lg border border-[var(--accent-faint)] py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)]"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ButterflyLoading() {
  return (
    <div className="relative z-10 flex h-screen w-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export default function ButterflyPage() {
  return (
    <Suspense fallback={<ButterflyLoading />}>
      <ReactFlowProvider>
        <ButterflyContent />
      </ReactFlowProvider>
    </Suspense>
  );
}

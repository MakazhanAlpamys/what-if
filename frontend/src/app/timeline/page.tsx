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
import SearchBar from "@/components/SearchBar";
import ThemeToggle from "@/components/ThemeToggle";
import { streamGenerate, streamExpand } from "@/lib/stream";
import { buildTreeLayout } from "@/lib/tree-layout";
import { MAX_TREE_DEPTH } from "@/lib/constants";
import { findNodeById, findChainToNode, addBranchesToNode, collapseNode } from "@/lib/tree-utils";
import { saveTimeline, exportTimelineJSON, addToHistory } from "@/lib/storage";
import type { ScenarioResponse } from "@/lib/types";

const nodeTypes = { timelineNode: TimelineNodeComponent };

function TimelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scenario = searchParams.get("q") || "";

  const [scenarioData, setScenarioData] = useState<ScenarioResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamTextRef = useRef("");

  // Undo/redo state
  const [undoStack, setUndoStack] = useState<ScenarioResponse[]>([]);
  const [redoStack, setRedoStack] = useState<ScenarioResponse[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const hasChildrenMapRef = useRef<Map<string, boolean>>(new Map());

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const pushUndo = useCallback((data: ScenarioResponse) => {
    setUndoStack((prev) => [...prev.slice(-20), data]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, scenarioData!]);
    setScenarioData(prev);
    showToast("Undone");
  }, [undoStack, scenarioData, showToast]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, scenarioData!]);
    setScenarioData(next);
    showToast("Redone");
  }, [redoStack, scenarioData, showToast]);

  const handleExpand = useCallback(
    (nodeId: string) => {
      if (!scenarioData || expandingNodeId) {
        if (expandingNodeId) {
          showToast("Another branch is being explored. Please wait.");
        }
        return;
      }

      const chain = findChainToNode(scenarioData.timeline, nodeId);
      if (!chain) return;

      if (chain.length >= MAX_TREE_DEPTH) {
        setError(
          `Maximum depth of ${MAX_TREE_DEPTH} levels reached. Try a new scenario for fresh exploration.`
        );
        return;
      }

      setExpandingNodeId(nodeId);

      const expandAbort = new AbortController();
      streamExpand(
        scenario,
        chain,
        () => {},
        (data) => {
          setScenarioData((prev) => {
            if (!prev) return prev;
            pushUndo(prev);
            return {
              ...prev,
              timeline: addBranchesToNode(prev.timeline, nodeId, data.branches),
            };
          });
          setExpandingNodeId(null);
        },
        (err) => {
          console.error("Expand error:", err);
          setExpandingNodeId(null);
          showToast("Failed to expand branch. Try again.");
        },
        expandAbort.signal
      );
    },
    [scenarioData, expandingNodeId, scenario, pushUndo, showToast]
  );

  const handleCollapse = useCallback(
    (nodeId: string) => {
      if (!scenarioData) return;
      pushUndo(scenarioData);
      setScenarioData((prev) => {
        if (!prev) return prev;
        return { ...prev, timeline: collapseNode(prev.timeline, nodeId) };
      });
      showToast("Branch collapsed");
    },
    [scenarioData, pushUndo, showToast]
  );

  const handleSelect = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleSave = useCallback(() => {
    if (!scenarioData) return;
    saveTimeline(scenario, scenarioData);
    showToast("Timeline saved!");
  }, [scenarioData, scenario, showToast]);

  const handleExport = useCallback(() => {
    if (!scenarioData) return;
    exportTimelineJSON(scenarioData, scenario);
    showToast("Exported as JSON");
  }, [scenarioData, scenario, showToast]);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsGenerating(true);
    setStreamText("");
    streamTextRef.current = "";

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    streamGenerate(
      scenario,
      (text) => {
        streamTextRef.current = text;
        setStreamText(text);
      },
      (data) => {
        setScenarioData(data);
        setIsGenerating(false);
        setStreamText("");
        addToHistory(scenario);
      },
      (err) => {
        setError(err);
        setIsGenerating(false);
      },
      abortController.signal
    );
  }, [scenario]);

  // Build tree layout when data or expanding state changes
  useEffect(() => {
    if (!scenarioData) return;

    const {
      nodes: layoutNodes,
      edges: layoutEdges,
      hasChildrenMap,
    } = buildTreeLayout(
      scenarioData.timeline,
      expandingNodeId,
      selectedNodeId,
      handleExpand,
      handleSelect
    );

    hasChildrenMapRef.current = hasChildrenMap;
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [
    scenarioData,
    expandingNodeId,
    selectedNodeId,
    handleExpand,
    handleSelect,
    setNodes,
    setEdges,
  ]);

  // Generate scenario on mount
  useEffect(() => {
    if (!scenario) {
      router.push("/");
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsGenerating(true);
    setError(null);
    setStreamText("");
    streamTextRef.current = "";

    streamGenerate(
      scenario,
      (text) => {
        streamTextRef.current = text;
        setStreamText(text);
      },
      (data) => {
        setScenarioData(data);
        setIsGenerating(false);
        setStreamText("");
        addToHistory(scenario);
      },
      (err) => {
        setError(err);
        setIsGenerating(false);
      },
      abortController.signal
    );

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Shift+Z or Ctrl+Y - Redo
      if ((e.ctrlKey || e.metaKey) && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl+S - Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      // Ctrl+E - Export
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        handleExport();
      }
      // Escape - Deselect
      if (e.key === "Escape" && selectedNodeId && !document.querySelector("[role='dialog']")) {
        setSelectedNodeId(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleSave, handleExport, selectedNodeId]);

  const selectedNode = useMemo(() => {
    if (!scenarioData || !selectedNodeId) return null;
    return findNodeById(scenarioData.timeline, selectedNodeId);
  }, [scenarioData, selectedNodeId]);

  return (
    <div
      className="relative z-10 h-screen w-screen"
      role="main"
      aria-label="Timeline visualization"
    >
      {/* Skip to content link */}
      <a
        href="#timeline-canvas"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to timeline
      </a>

      {/* Top bar */}
      <div className="absolute top-0 right-0 left-0 z-40 flex items-center justify-between border-b border-violet-500/10 bg-[rgba(5,5,16,0.9)] px-3 py-2 backdrop-blur-xl sm:px-6 sm:py-3">
        <button
          onClick={() => router.push("/")}
          aria-label="Go back to new scenario"
          className="flex cursor-pointer items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
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
        <h1 className="hidden max-w-lg truncate text-sm text-white/50 italic sm:block">
          &ldquo;{scenario}&rdquo;
        </h1>
        <div className="flex items-center gap-1">
          {/* Undo/Redo */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            aria-label="Undo (Ctrl+Z)"
            title="Undo (Ctrl+Z)"
            className="cursor-pointer rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
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
                d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"
              />
            </svg>
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            aria-label="Redo (Ctrl+Shift+Z)"
            title="Redo (Ctrl+Shift+Z)"
            className="cursor-pointer rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
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
                d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4"
              />
            </svg>
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!scenarioData}
            aria-label="Save timeline (Ctrl+S)"
            title="Save timeline (Ctrl+S)"
            className="cursor-pointer rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
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
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={!scenarioData}
            aria-label="Export as JSON (Ctrl+E)"
            title="Export as JSON (Ctrl+E)"
            className="cursor-pointer rounded-lg p-2 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>

          {/* Search */}
          <SearchBar root={scenarioData?.timeline ?? null} onSelectNode={handleSelect} />

          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </div>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-violet-500/20 bg-[rgba(8,8,25,0.95)] px-4 py-2 text-sm text-white/70 shadow-xl backdrop-blur-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanding indicator */}
      <AnimatePresence>
        {expandingNodeId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-violet-500/20 bg-[rgba(8,8,25,0.95)] px-4 py-2 text-sm text-violet-300/70 shadow-xl backdrop-blur-xl"
          >
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Exploring new branches...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[rgba(5,5,16,0.95)]"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="mb-6 h-20 w-20 rounded-full border-2 border-violet-500/20 border-t-violet-500"
            />
            <h2 className="mb-2 text-xl font-semibold text-white/80">
              Creating alternate reality...
            </h2>
            <p className="mb-6 text-sm text-white/30">
              K2 Think V2 is reasoning through your scenario
            </p>
            {streamText && (
              <div
                className="mx-auto max-h-48 max-w-xl overflow-y-auto rounded-xl border border-violet-500/10 bg-violet-500/5 p-4"
                aria-live="polite"
              >
                <pre
                  className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-white/30"
                  aria-label="AI reasoning output"
                >
                  {streamText.length > 800 ? `...${streamText.slice(-800)}` : streamText}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[rgba(5,5,16,0.95)]">
          <div className="max-w-md text-center">
            <div className="mb-4 text-4xl">
              <svg
                className="inline h-12 w-12 text-red-400/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-white/70">Failed to create reality</h2>
            <p className="mb-6 text-sm text-white/30">{error}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={handleRetry}
                className="cursor-pointer rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
              >
                Retry this scenario
              </button>
              <button
                onClick={() => router.push("/")}
                className="cursor-pointer rounded-xl border border-violet-500/20 bg-transparent px-6 py-2.5 text-sm font-medium text-white/60 transition-colors hover:border-violet-500/40 hover:text-white/80"
              >
                Try another scenario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* React Flow */}
      {scenarioData && !isGenerating && (
        <div id="timeline-canvas" className="h-full w-full">
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
              nodeColor="rgba(139, 92, 246, 0.4)"
              maskColor="rgba(5, 5, 16, 0.8)"
              className="!rounded-xl !border !border-violet-500/15 !bg-[rgba(5,5,16,0.9)]"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
      )}

      {/* Detail panel with mobile backdrop */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 sm:hidden"
            onClick={() => setSelectedNodeId(null)}
          />
        )}
      </AnimatePresence>

      <DetailPanel
        node={selectedNode}
        realHistory={scenarioData?.realHistory || ""}
        scenario={scenario}
        onClose={() => setSelectedNodeId(null)}
        onExpand={handleExpand}
        onCollapse={handleCollapse}
        isExpanding={!!expandingNodeId}
        hasChildren={selectedNode ? selectedNode.branches.length > 0 : false}
      />

      {/* Keyboard shortcuts help (bottom) */}
      {scenarioData && !isGenerating && (
        <div className="absolute right-4 bottom-4 z-30 hidden text-xs text-white/15 lg:block">
          Ctrl+F Search · Ctrl+Z Undo · Ctrl+S Save · Ctrl+E Export
        </div>
      )}
    </div>
  );
}

function TimelineLoading() {
  return (
    <div className="relative z-10 flex h-screen w-screen items-center justify-center">
      <div className="h-16 w-16 animate-spin rounded-full border-2 border-violet-500/20 border-t-violet-500" />
    </div>
  );
}

export default function TimelinePage() {
  return (
    <Suspense fallback={<TimelineLoading />}>
      <ReactFlowProvider>
        <TimelineContent />
      </ReactFlowProvider>
    </Suspense>
  );
}

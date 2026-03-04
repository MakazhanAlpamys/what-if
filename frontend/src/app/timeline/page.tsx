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
  useReactFlow,
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
import SoundToggle from "@/components/SoundToggle";
import Spinner from "@/components/Spinner";
import ErrorIcon from "@/components/ErrorIcon";
import ConfirmDialog from "@/components/ConfirmDialog";
import ToolbarMenu from "@/components/ToolbarMenu";
import { streamGenerate, streamExpand } from "@/lib/stream";
import { buildTreeLayout } from "@/lib/tree-layout";
import { MAX_TREE_DEPTH } from "@/lib/constants";
import { soundManager } from "@/lib/sounds";
import {
  findNodeById,
  findChainToNode,
  addBranchesToNode,
  collapseNode,
  collectAllNodes,
} from "@/lib/tree-utils";
import { saveTimeline, exportTimelineJSON, addToHistory, getTimelineById } from "@/lib/storage";
import { generateShareURL, copyToClipboard, decodeTimeline } from "@/lib/share";
import { exportAsPNG, exportAsSVG } from "@/lib/export-image";
import type { ScenarioResponse, Paradox } from "@/lib/types";

const nodeTypes = { timelineNode: TimelineNodeComponent };

function TimelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scenario = searchParams.get("q") || "";
  const loadId = searchParams.get("load") || "";
  const shareData = searchParams.get("share") || "";

  const [scenarioData, setScenarioData] = useState<ScenarioResponse | null>(null);
  const [displayScenario, setDisplayScenario] = useState(scenario);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newNodeIds, setNewNodeIds] = useState<Set<string>>(new Set());
  const [collapseConfirmNodeId, setCollapseConfirmNodeId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [paradoxes, setParadoxes] = useState<Paradox[]>([]);
  const [paradoxNodeIds, setParadoxNodeIds] = useState<Set<string>>(new Set());
  const [isCheckingParadox, setIsCheckingParadox] = useState(false);
  const [showParadoxPanel, setShowParadoxPanel] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const expandAbortRef = useRef<AbortController | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newNodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo/redo state
  const [undoStack, setUndoStack] = useState<ScenarioResponse[]>([]);
  const [redoStack, setRedoStack] = useState<ScenarioResponse[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { setCenter, getNode } = useReactFlow();

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const pushUndo = useCallback((data: ScenarioResponse) => {
    setUndoStack((prev) => [...prev.slice(-20), data]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !scenarioData) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((s) => [...s, scenarioData]);
    setScenarioData(prev);
    showToast("Undone");
  }, [undoStack, scenarioData, showToast]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !scenarioData) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    setUndoStack((s) => [...s, scenarioData]);
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
        showToast(
          `Maximum depth of ${MAX_TREE_DEPTH} levels reached. Try a new scenario for fresh exploration.`
        );
        return;
      }

      setExpandingNodeId(nodeId);

      expandAbortRef.current?.abort();
      const expandAbort = new AbortController();
      expandAbortRef.current = expandAbort;
      streamExpand(
        displayScenario,
        chain,
        () => {},
        (data) => {
          // Track new node IDs for animation
          const ids = new Set<string>();
          data.branches.forEach((b) => {
            collectAllNodes(b).forEach((n) => ids.add(n.id));
          });
          if (newNodeTimerRef.current) clearTimeout(newNodeTimerRef.current);
          setNewNodeIds(ids);
          newNodeTimerRef.current = setTimeout(() => setNewNodeIds(new Set()), 1500);

          setScenarioData((prev) => {
            if (!prev) return prev;
            pushUndo(prev);
            return {
              ...prev,
              timeline: addBranchesToNode(prev.timeline, nodeId, data.branches),
            };
          });
          setExpandingNodeId(null);
          expandAbortRef.current = null;
          soundManager?.playWhoosh();
        },
        (err) => {
          console.error("Expand error:", err);
          setExpandingNodeId(null);
          expandAbortRef.current = null;
          soundManager?.playError();
          showToast("Failed to expand branch. Try again.");
        },
        expandAbort.signal
      );
    },
    [scenarioData, expandingNodeId, displayScenario, pushUndo, showToast]
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

  const handleCollapseRequest = useCallback((nodeId: string) => {
    setCollapseConfirmNodeId(nodeId);
  }, []);

  const handleCollapseConfirm = useCallback(() => {
    if (collapseConfirmNodeId) {
      handleCollapse(collapseConfirmNodeId);
      setCollapseConfirmNodeId(null);
    }
  }, [collapseConfirmNodeId, handleCollapse]);

  const handleSelect = useCallback((nodeId: string) => {
    soundManager?.playClick();
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      const rfNode = getNode(nodeId);
      if (rfNode) {
        const x = rfNode.position.x + (rfNode.measured?.width ?? 260) / 2;
        const y = rfNode.position.y + (rfNode.measured?.height ?? 160) / 2;
        setCenter(x, y, { zoom: 1, duration: 800 });
      }
    },
    [getNode, setCenter]
  );

  const handleSave = useCallback(() => {
    if (!scenarioData) return;
    saveTimeline(displayScenario, scenarioData);
    showToast("Timeline saved!");
  }, [scenarioData, displayScenario, showToast]);

  const handleExport = useCallback(() => {
    if (!scenarioData) return;
    exportTimelineJSON(scenarioData, displayScenario);
    showToast("Exported as JSON");
  }, [scenarioData, displayScenario, showToast]);

  const handleShare = useCallback(async () => {
    if (!scenarioData) return;
    const url = generateShareURL(scenarioData);
    if (url.length > 8000) {
      showToast("Timeline too large to share via URL. Use JSON export.");
      return;
    }
    const success = await copyToClipboard(url);
    if (success) {
      showToast("Share link copied to clipboard!");
    } else {
      showToast("Could not copy link. Try JSON export.");
    }
  }, [scenarioData, showToast]);

  const handleExportPNG = useCallback(async () => {
    try {
      await exportAsPNG(`what-if-${displayScenario.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-")}`);
      showToast("Exported as PNG");
    } catch {
      showToast("PNG export failed");
    }
    setShowExportMenu(false);
  }, [displayScenario, showToast]);

  const handleExportSVG = useCallback(async () => {
    try {
      await exportAsSVG(`what-if-${displayScenario.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-")}`);
      showToast("Exported as SVG");
    } catch {
      showToast("SVG export failed");
    }
    setShowExportMenu(false);
  }, [displayScenario, showToast]);

  const handleCheckParadox = useCallback(async () => {
    if (!scenarioData || isCheckingParadox) return;
    setIsCheckingParadox(true);
    try {
      const res = await fetch("/api/paradox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: displayScenario,
          timeline: scenarioData.timeline,
        }),
      });
      if (!res.ok) {
        showToast("Failed to check for paradoxes");
        return;
      }
      const data = await res.json();
      if (data.paradoxes && data.paradoxes.length > 0) {
        setParadoxes(data.paradoxes);
        const ids = new Set<string>();
        data.paradoxes.forEach((p: Paradox) => p.nodeIds.forEach((id: string) => ids.add(id)));
        setParadoxNodeIds(ids);
        setShowParadoxPanel(true);
        soundManager?.playParadox();
        showToast(
          `${data.paradoxes.length} paradox${data.paradoxes.length > 1 ? "es" : ""} detected!`
        );
      } else {
        setParadoxes([]);
        setParadoxNodeIds(new Set());
        showToast("No paradoxes detected! Timeline is logically consistent.");
      }
    } catch {
      showToast("Failed to check for paradoxes");
    } finally {
      setIsCheckingParadox(false);
    }
  }, [scenarioData, isCheckingParadox, displayScenario, showToast]);

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
        addToHistory(scenario);
        soundManager?.playSuccess();
      },
      (err) => {
        setError(err);
        setIsGenerating(false);
        soundManager?.playError();
      },
      abortController.signal
    );
  }, [scenario]);

  // Build tree layout when data or state changes
  useEffect(() => {
    if (!scenarioData) return;

    const { nodes: layoutNodes, edges: layoutEdges } = buildTreeLayout(
      scenarioData.timeline,
      expandingNodeId,
      selectedNodeId,
      handleExpand,
      handleSelect,
      newNodeIds,
      paradoxNodeIds
    );

    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [
    scenarioData,
    expandingNodeId,
    selectedNodeId,
    newNodeIds,
    paradoxNodeIds,
    handleExpand,
    handleSelect,
    setNodes,
    setEdges,
  ]);

  // Initialize on mount: load, share, or generate
  useEffect(() => {
    // Handle shared timeline
    if (shareData) {
      const decoded = decodeTimeline(shareData);
      if (decoded) {
        setScenarioData(decoded);
        setDisplayScenario(decoded.scenario);
        return;
      }
      setError("Failed to decode shared timeline. The link may be corrupted.");
      return;
    }

    // Handle saved timeline loading
    if (loadId) {
      const saved = getTimelineById(loadId);
      if (saved) {
        setScenarioData(saved.data);
        setDisplayScenario(saved.scenario);
        return;
      }
      setError("Saved timeline not found. It may have been deleted.");
      return;
    }

    // Generate new timeline
    if (!scenario) {
      router.push("/");
      return;
    }

    startGeneration();

    return () => {
      abortControllerRef.current?.abort();
      expandAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as globalThis.Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        handleExport();
      }
      if (e.key === "Escape" && selectedNodeId) {
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

  // Icons for toolbar
  const undoIcon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"
      />
    </svg>
  );
  const redoIcon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4"
      />
    </svg>
  );
  const saveIcon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
      />
    </svg>
  );
  const exportIcon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
  const shareIcon = (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  );

  const btnClass =
    "cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div
      className="relative z-10 h-screen w-screen"
      role="main"
      aria-label="Timeline visualization"
    >
      {/* Top bar */}
      <div className="absolute top-0 right-0 left-0 z-40 flex items-center justify-between border-b border-[var(--accent-ghost)] bg-[var(--surface-overlay)] px-3 py-2 backdrop-blur-xl sm:px-6 sm:py-3">
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
        <h1 className="hidden max-w-lg truncate text-sm text-[var(--text-tertiary)] italic sm:block">
          &ldquo;{displayScenario}&rdquo;
        </h1>

        {/* Desktop toolbar */}
        <div className="hidden items-center gap-1 sm:flex">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            aria-label="Undo (Ctrl+Z)"
            title="Undo (Ctrl+Z)"
            className={btnClass}
          >
            {undoIcon}
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            aria-label="Redo (Ctrl+Shift+Z)"
            title="Redo (Ctrl+Shift+Z)"
            className={btnClass}
          >
            {redoIcon}
          </button>
          <button
            onClick={handleSave}
            disabled={!scenarioData}
            aria-label="Save timeline (Ctrl+S)"
            title="Save timeline (Ctrl+S)"
            className={btnClass}
          >
            {saveIcon}
          </button>

          {/* Export dropdown */}
          <div ref={exportMenuRef} className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!scenarioData}
              aria-label="Export timeline"
              title="Export timeline"
              className={btnClass}
            >
              {exportIcon}
            </button>
            {showExportMenu && (
              <div className="absolute top-full right-0 mt-1 w-36 rounded-xl border border-[var(--accent-border)] bg-[var(--surface-secondary)] py-1 shadow-xl backdrop-blur-xl">
                <button
                  onClick={() => {
                    handleExport();
                    setShowExportMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
                >
                  Export JSON
                </button>
                <button
                  onClick={handleExportPNG}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
                >
                  Export PNG
                </button>
                <button
                  onClick={handleExportSVG}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
                >
                  Export SVG
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleShare}
            disabled={!scenarioData}
            aria-label="Share timeline"
            title="Share timeline"
            className={btnClass}
          >
            {shareIcon}
          </button>

          <button
            onClick={handleCheckParadox}
            disabled={!scenarioData || isCheckingParadox}
            aria-label="Check for paradoxes"
            title="Check for paradoxes"
            className={btnClass}
          >
            {isCheckingParadox ? (
              <Spinner className="h-4 w-4" />
            ) : (
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            )}
          </button>

          <SearchBar
            root={scenarioData?.timeline ?? null}
            onSelectNode={handleSelect}
            onNavigateToNode={handleNavigateToNode}
          />
          <SoundToggle />
          <ThemeToggle />
        </div>

        {/* Mobile toolbar */}
        <div className="flex items-center gap-1 sm:hidden">
          <SearchBar
            root={scenarioData?.timeline ?? null}
            onSelectNode={handleSelect}
            onNavigateToNode={handleNavigateToNode}
          />
          <ToolbarMenu
            actions={[
              {
                label: "Undo",
                icon: undoIcon,
                onClick: handleUndo,
                disabled: undoStack.length === 0,
                shortcut: "Ctrl+Z",
              },
              {
                label: "Redo",
                icon: redoIcon,
                onClick: handleRedo,
                disabled: redoStack.length === 0,
                shortcut: "Ctrl+Y",
              },
              {
                label: "Save",
                icon: saveIcon,
                onClick: handleSave,
                disabled: !scenarioData,
                shortcut: "Ctrl+S",
              },
              {
                label: "Export JSON",
                icon: exportIcon,
                onClick: handleExport,
                disabled: !scenarioData,
              },
              { label: "Share", icon: shareIcon, onClick: handleShare, disabled: !scenarioData },
            ]}
          />
          <SoundToggle />
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
            className="absolute top-16 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-[var(--accent-faint)] bg-[var(--surface-secondary)] px-4 py-2 text-sm text-[var(--text-secondary)] shadow-xl backdrop-blur-xl"
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
            className="absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--accent-faint)] bg-[var(--surface-secondary)] px-4 py-2 text-sm text-[var(--violet-text)] shadow-xl backdrop-blur-xl"
          >
            <Spinner className="h-4 w-4" />
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
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[var(--surface-overlay)]"
          >
            {/* Vortex animation */}
            <div className="relative mb-6 h-28 w-28">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 3 + i * 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
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

      {/* Error state */}
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
              nodeColor="var(--accent-soft, rgba(139, 92, 246, 0.4))"
              maskColor="var(--minimap-mask, rgba(5, 5, 16, 0.8))"
              className="!rounded-xl !border !border-[var(--accent-border)] !bg-[var(--minimap-bg)]"
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
            className="fixed inset-0 z-40 bg-[var(--backdrop)] sm:hidden"
            onClick={() => setSelectedNodeId(null)}
          />
        )}
      </AnimatePresence>

      <DetailPanel
        node={selectedNode}
        realHistory={scenarioData?.realHistory || ""}
        onClose={() => setSelectedNodeId(null)}
        onExpand={handleExpand}
        onCollapse={handleCollapseRequest}
        isExpanding={!!expandingNodeId}
        hasChildren={selectedNode ? selectedNode.branches.length > 0 : false}
      />

      {/* Collapse confirmation */}
      <ConfirmDialog
        isOpen={!!collapseConfirmNodeId}
        title="Collapse Branches?"
        message="This will remove all sub-branches from this node. You can undo this with Ctrl+Z."
        confirmLabel="Collapse"
        variant="danger"
        onConfirm={handleCollapseConfirm}
        onCancel={() => setCollapseConfirmNodeId(null)}
      />

      {/* Paradox results panel */}
      <AnimatePresence>
        {showParadoxPanel && paradoxes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-14 left-4 z-50 max-h-[70vh] w-80 overflow-y-auto rounded-2xl border border-red-500/20 bg-[var(--surface-secondary)] p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-red-400">
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                {paradoxes.length} Paradox{paradoxes.length > 1 ? "es" : ""} Found
              </h3>
              <button
                onClick={() => {
                  setShowParadoxPanel(false);
                  setParadoxes([]);
                  setParadoxNodeIds(new Set());
                }}
                className="cursor-pointer rounded-lg p-1 text-[var(--text-faint)] transition-colors hover:text-[var(--text-secondary)]"
                aria-label="Close paradox panel"
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
            <div className="space-y-3">
              {paradoxes.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-xl border p-3 ${
                    p.severity === "critical"
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-yellow-500/20 bg-yellow-500/5"
                  }`}
                >
                  <span
                    className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                      p.severity === "critical"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-yellow-500/15 text-yellow-400"
                    }`}
                  >
                    {p.severity}
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-tertiary)]">
                    {p.description}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard shortcuts help (bottom) */}
      {scenarioData && !isGenerating && (
        <div className="absolute right-4 bottom-4 z-30 hidden text-xs text-[var(--text-invisible)] lg:block">
          Ctrl+F Search · Ctrl+Z Undo · Ctrl+S Save · Ctrl+E Export
        </div>
      )}
    </div>
  );
}

function TimelineLoading() {
  return (
    <div className="relative z-10 flex h-screen w-screen items-center justify-center">
      <div className="h-16 w-16 animate-spin rounded-full border-2 border-[var(--accent-faint)] border-t-[var(--accent)]" />
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

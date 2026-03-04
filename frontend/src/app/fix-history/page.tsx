"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { streamFixHistory } from "@/lib/game-stream";
import { buildTreeLayout } from "@/lib/tree-layout";
import { findNodeById, collectAllNodes } from "@/lib/tree-utils";
import { soundManager } from "@/lib/sounds";
import { addFixHistoryScore, getFixHistoryScores } from "@/lib/game-storage";
import type { FixHistoryResponse, FixHistoryScore } from "@/lib/types";

const nodeTypes = { timelineNode: TimelineNodeComponent };

function FixHistoryContent() {
  const router = useRouter();

  const [data, setData] = useState<FixHistoryResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<FixHistoryScore[]>([]);
  const [moveNumber, setMoveNumber] = useState(1);
  const [wrongNodeIds, setWrongNodeIds] = useState<Set<string>>(new Set());
  const [correctFound, setCorrectFound] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [flashNodeId, setFlashNodeId] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const handleSelect = useCallback((nodeId: string) => {
    soundManager?.playClick();
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleExpand = useCallback(() => {}, []);

  const startGeneration = useCallback(() => {
    abortRef.current?.abort();
    setError(null);
    setIsGenerating(true);
    setStreamText("");
    setData(null);
    setSelectedNodeId(null);
    setMoveNumber(1);
    setWrongNodeIds(new Set());
    setCorrectFound(false);
    setGameOver(false);
    setLastScore(null);
    setFlashNodeId(null);
    soundManager?.playPortalOpen();

    const abort = new AbortController();
    abortRef.current = abort;

    streamFixHistory(
      (text) => setStreamText(text),
      (result) => {
        setData(result);
        setIsGenerating(false);
        setStreamText("");
        soundManager?.playSuccess();
        showToast("Find and cut the branch that caused the dystopia!");
      },
      (err) => {
        setError(err);
        setIsGenerating(false);
        soundManager?.playError();
      },
      abort.signal
    );
  }, [showToast]);

  const handleCutBranch = useCallback(async () => {
    if (!data || !selectedNodeId || correctFound || gameOver || isEvaluating) return;

    // Don't allow cutting the root node
    const selectedNode = findNodeById(data.dystopianTimeline, selectedNodeId);
    if (!selectedNode) return;
    const isRoot = data.dystopianTimeline.id === selectedNodeId;
    if (isRoot) {
      showToast("You can't cut the root event!");
      return;
    }

    // Don't allow cutting a node that was already guessed wrong
    if (wrongNodeIds.has(selectedNodeId)) {
      showToast("You already tried this branch!");
      return;
    }

    setIsEvaluating(true);

    try {
      const response = await fetch("/api/fix-history/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedNodeId,
          correctNodeId: data.correctNodeId,
          moveNumber,
          maxMoves: data.maxMoves,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        showToast(err?.error || "Evaluation failed");
        setIsEvaluating(false);
        return;
      }

      const result = await response.json();

      if (result.success) {
        // Correct!
        setCorrectFound(true);
        setLastScore(result.score);
        setFlashNodeId(selectedNodeId);
        soundManager?.playSuccess();
        showToast(result.feedback);

        addFixHistoryScore({
          scenario: data.scenario,
          score: result.score,
          movesUsed: moveNumber,
          timestamp: Date.now(),
        });

        // Clear flash after animation
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlashNodeId(null), 2000);
      } else {
        const movesLeft = data.maxMoves - moveNumber;

        if (movesLeft <= 0) {
          // Game over - out of moves
          setGameOver(true);
          soundManager?.playError();
          showToast(result.feedback);
        } else {
          // Wrong but moves remaining
          setWrongNodeIds((prev) => new Set([...prev, selectedNodeId]));
          setFlashNodeId(selectedNodeId);
          soundManager?.playError();
          showToast(result.feedback);
          setMoveNumber((prev) => prev + 1);

          // Clear flash after animation
          if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
          flashTimerRef.current = setTimeout(() => {
            setFlashNodeId(null);
            setSelectedNodeId(null);
          }, 1000);
        }
      }
    } catch {
      showToast("Failed to evaluate. Please try again.");
    } finally {
      setIsEvaluating(false);
    }
  }, [
    data,
    selectedNodeId,
    correctFound,
    gameOver,
    isEvaluating,
    moveNumber,
    wrongNodeIds,
    showToast,
  ]);

  // Build tree layout with custom styling for game state
  useEffect(() => {
    if (!data) return;
    const { nodes: layoutNodes, edges: layoutEdges } = buildTreeLayout(
      data.dystopianTimeline,
      null,
      selectedNodeId,
      handleExpand,
      handleSelect
    );

    // Apply game-state styling to nodes
    const styledNodes = layoutNodes.map((node) => {
      const nodeId = node.id;
      const isWrong = wrongNodeIds.has(nodeId);
      const isCorrectNode = nodeId === data.correctNodeId;
      const isFlashing = nodeId === flashNodeId;
      const showCorrect = (correctFound && isCorrectNode) || (gameOver && isCorrectNode);
      const showWrongFlash = isFlashing && isWrong;
      const showCorrectFlash = isFlashing && correctFound && isCorrectNode;

      let className = node.className || "";
      if (showCorrectFlash || showCorrect) {
        className += " fix-history-correct";
      } else if (showWrongFlash) {
        className += " fix-history-wrong";
      } else if (isWrong) {
        className += " fix-history-wrong-dim";
      }

      return { ...node, className: className.trim() };
    });

    setNodes(styledNodes);
    setEdges(layoutEdges);
  }, [
    data,
    selectedNodeId,
    handleExpand,
    handleSelect,
    setNodes,
    setEdges,
    wrongNodeIds,
    flashNodeId,
    correctFound,
    gameOver,
  ]);

  // Initialize
  useEffect(() => {
    startGeneration();
    return () => {
      abortRef.current?.abort();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedNodeId(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const selectedNode = useMemo(() => {
    if (!data || !selectedNodeId) return null;
    return findNodeById(data.dystopianTimeline, selectedNodeId);
  }, [data, selectedNodeId]);

  const isRootSelected = useMemo(() => {
    if (!data || !selectedNodeId) return true;
    return data.dystopianTimeline.id === selectedNodeId;
  }, [data, selectedNodeId]);

  const totalNodes = useMemo(() => {
    if (!data) return 0;
    return collectAllNodes(data.dystopianTimeline).length;
  }, [data]);

  const canCut =
    selectedNodeId &&
    !isRootSelected &&
    !correctFound &&
    !gameOver &&
    !wrongNodeIds.has(selectedNodeId) &&
    !isEvaluating;

  const btnClass =
    "cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]";

  return (
    <div className="relative z-10 h-screen w-screen" role="main">
      {/* Game state CSS */}
      <style jsx global>{`
        .fix-history-correct > div > div {
          box-shadow:
            0 0 20px rgba(34, 197, 94, 0.5),
            0 0 40px rgba(34, 197, 94, 0.2) !important;
          border-color: rgba(34, 197, 94, 0.6) !important;
          animation: fix-history-pulse-green 1.5s ease-in-out infinite;
        }
        .fix-history-wrong > div > div {
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.5) !important;
          border-color: rgba(239, 68, 68, 0.6) !important;
          animation: fix-history-flash-red 0.3s ease-in-out 3;
        }
        .fix-history-wrong-dim > div > div {
          opacity: 0.5;
          border-color: rgba(239, 68, 68, 0.3) !important;
        }
        @keyframes fix-history-pulse-green {
          0%,
          100% {
            box-shadow:
              0 0 20px rgba(34, 197, 94, 0.5),
              0 0 40px rgba(34, 197, 94, 0.2);
          }
          50% {
            box-shadow:
              0 0 30px rgba(34, 197, 94, 0.7),
              0 0 60px rgba(34, 197, 94, 0.3);
          }
        }
        @keyframes fix-history-flash-red {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
          }
          50% {
            box-shadow: 0 0 35px rgba(239, 68, 68, 0.8);
            transform: scale(1.02);
          }
        }
      `}</style>

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
          <span className="rounded-full bg-gradient-to-r from-red-500 to-rose-600 px-3 py-1 text-xs font-bold text-white">
            Fix History
          </span>
          {data && !isGenerating && (
            <span className="text-sm font-semibold text-rose-400">
              Move {Math.min(moveNumber, data.maxMoves)} of {data.maxMoves}
            </span>
          )}
          {lastScore !== null && (
            <span className="text-sm font-bold text-green-400">Score: {lastScore}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setLeaderboard(getFixHistoryScores());
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

      {/* Scenario description and ideal outcome */}
      {data && !isGenerating && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-16 left-1/2 z-30 max-w-xl -translate-x-1/2 rounded-xl border border-rose-500/20 bg-[var(--surface-secondary)] px-5 py-3 shadow-xl backdrop-blur-xl"
        >
          <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">{data.scenario}</p>
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-xs text-[var(--text-faint)]">
              <span className="font-semibold text-green-400">Ideal outcome:</span>{" "}
              {data.idealOutcome}
            </p>
          </div>
          {!correctFound && !gameOver && (
            <p className="mt-1 text-[10px] tracking-wider text-[var(--text-faint)] uppercase">
              Find and cut the branch that led to this dystopia ({totalNodes} nodes to examine)
            </p>
          )}
          {correctFound && (
            <p className="mt-1 text-xs font-semibold text-green-400">
              You fixed history! The correct branch has been cut.
            </p>
          )}
          {gameOver && !correctFound && (
            <p className="mt-1 text-xs font-semibold text-red-400">
              Out of moves. The correct branch is now highlighted in green.
            </p>
          )}
        </motion.div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-40 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-rose-500/30 bg-[var(--surface-secondary)] px-4 py-2 text-sm text-rose-300 shadow-xl backdrop-blur-xl"
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
                    borderColor: `rgba(244, 63, 94, ${0.15 + i * 0.1})`,
                    opacity: 0.4 + i * 0.15,
                  }}
                />
              ))}
            </div>
            <h2 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">
              Generating dystopian timeline...
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint)]">
              Creating a history gone wrong for you to fix
            </p>
            {streamText && (
              <div className="mx-auto max-h-48 max-w-xl overflow-y-auto rounded-xl border border-rose-500/10 bg-[var(--accent-ghost)] p-4">
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
              Timeline corrupted!
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint)]">{error}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={startGeneration}
                className="cursor-pointer rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500"
              >
                Try again
              </button>
              <button
                onClick={() => router.push("/")}
                className="cursor-pointer rounded-xl border border-[var(--accent-faint)] px-6 py-2.5 text-sm font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-secondary)]"
              >
                Go home
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
            <Background color="rgba(244, 63, 94, 0.05)" gap={40} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor="rgba(244, 63, 94, 0.4)"
              maskColor="var(--minimap-mask)"
              className="!rounded-xl !border !border-rose-500/20 !bg-[var(--minimap-bg)]"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
      )}

      {/* Bottom toolbar: Cut this branch button */}
      <AnimatePresence>
        {data && !isGenerating && selectedNodeId && !correctFound && !gameOver && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-6 left-1/2 z-40 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-[var(--surface-secondary)] px-4 py-3 shadow-2xl backdrop-blur-xl">
              <div className="text-sm text-[var(--text-muted)]">
                {selectedNode ? (
                  <span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {selectedNode.year}:
                    </span>{" "}
                    {selectedNode.title}
                  </span>
                ) : (
                  "Select a node"
                )}
              </div>
              <button
                onClick={handleCutBranch}
                disabled={!canCut}
                className="flex cursor-pointer items-center gap-2 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:from-red-400 hover:to-rose-500 hover:shadow-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isEvaluating ? (
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
                      d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
                    />
                  </svg>
                )}
                Cut this branch
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success / Game Over overlay */}
      <AnimatePresence>
        {(correctFound || gameOver) && data && !isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-6 left-1/2 z-40 -translate-x-1/2"
          >
            <div className="flex flex-col items-center gap-3 rounded-xl border border-rose-500/20 bg-[var(--surface-secondary)] px-6 py-4 shadow-2xl backdrop-blur-xl sm:flex-row">
              {correctFound && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                    <svg
                      className="h-6 w-6 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-400">History Fixed!</p>
                    <p className="text-xs text-[var(--text-faint)]">
                      Score: {lastScore} | Moves used: {moveNumber}
                    </p>
                  </div>
                </div>
              )}
              {gameOver && !correctFound && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                    <svg
                      className="h-6 w-6 text-red-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-400">Game Over</p>
                    <p className="text-xs text-[var(--text-faint)]">
                      The correct branch is highlighted in green
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={startGeneration}
                className="cursor-pointer rounded-lg bg-gradient-to-r from-red-500 to-rose-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:from-red-400 hover:to-rose-500"
              >
                New Puzzle
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="mx-4 w-full max-w-md rounded-2xl border border-rose-500/20 bg-[var(--surface-secondary)] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 text-lg font-semibold text-rose-400">Fix History Leaderboard</h3>
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
                        className={`text-lg font-bold ${i === 0 ? "text-rose-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-rose-600" : "text-[var(--text-faint)]"}`}
                      >
                        #{i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[var(--text-secondary)]">
                          {entry.scenario}
                        </p>
                        <p className="text-xs text-[var(--text-faint)]">
                          {entry.movesUsed} move{entry.movesUsed !== 1 ? "s" : ""} used
                        </p>
                      </div>
                      <span className="text-lg font-bold text-rose-400">{entry.score}</span>
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

function FixHistoryLoading() {
  return (
    <div className="relative z-10 flex h-screen w-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export default function FixHistoryPage() {
  return (
    <Suspense fallback={<FixHistoryLoading />}>
      <ReactFlowProvider>
        <FixHistoryContent />
      </ReactFlowProvider>
    </Suspense>
  );
}

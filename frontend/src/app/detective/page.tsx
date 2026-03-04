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
import DetailPanel from "@/components/DetailPanel";
import Spinner from "@/components/Spinner";
import ErrorIcon from "@/components/ErrorIcon";
import ThemeToggle from "@/components/ThemeToggle";
import SoundToggle from "@/components/SoundToggle";
import { streamDetective } from "@/lib/game-stream";
import { buildTreeLayout } from "@/lib/tree-layout";
import { findNodeById } from "@/lib/tree-utils";
import { soundManager } from "@/lib/sounds";
import { addDetectiveScore, getDetectiveScores } from "@/lib/game-storage";
import type {
  DetectiveResponse,
  DetectiveCheckResponse,
  DetectiveHint,
  DetectiveScore,
} from "@/lib/types";

const nodeTypes = { timelineNode: TimelineNodeComponent };

const HINT_PENALTY = 20;

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "from-green-500 to-emerald-600",
  medium: "from-yellow-500 to-amber-600",
  hard: "from-red-500 to-rose-600",
};

function DetectiveContent() {
  const router = useRouter();

  // Puzzle state
  const [data, setData] = useState<DetectiveResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Game state
  const [guess, setGuess] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<DetectiveCheckResponse | null>(null);
  const [revealedHints, setRevealedHints] = useState<DetectiveHint[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showTimeline, setShowTimeline] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);

  // UI state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<DetectiveScore[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const btnClass =
    "cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]";

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

  const availableHints = useMemo(() => {
    if (!data) return [];
    return data.hints.filter((h) => !revealedHints.some((rh) => rh.level === h.level));
  }, [data, revealedHints]);

  const finalScore = useMemo(() => {
    if (!checkResult) return 0;
    const penalty = hintsUsed * HINT_PENALTY;
    return Math.max(0, checkResult.score - penalty);
  }, [checkResult, hintsUsed]);

  const startGeneration = useCallback(() => {
    abortRef.current?.abort();
    setError(null);
    setIsGenerating(true);
    setStreamText("");
    setData(null);
    setGuess("");
    setCheckResult(null);
    setRevealedHints([]);
    setHintsUsed(0);
    setShowTimeline(false);
    setGameEnded(false);
    setScoreSaved(false);
    setSelectedNodeId(null);
    soundManager?.playPortalOpen();

    const abort = new AbortController();
    abortRef.current = abort;

    streamDetective(
      (text) => setStreamText(text),
      (result) => {
        setData(result);
        setIsGenerating(false);
        setStreamText("");
        soundManager?.playSuccess();
        showToast("Mystery generated! Can you deduce what happened?");
      },
      (err) => {
        setError(err);
        setIsGenerating(false);
        soundManager?.playError();
      },
      abort.signal
    );
  }, [showToast]);

  const handleRevealHint = useCallback(() => {
    if (!data || availableHints.length === 0) return;
    const nextHint = availableHints.sort((a, b) => a.level - b.level)[0];
    setRevealedHints((prev) => [...prev, nextHint]);
    setHintsUsed((prev) => prev + 1);
    soundManager?.playClick();
    showToast(`Hint ${nextHint.level} revealed! (-${HINT_PENALTY} points)`);
  }, [data, availableHints, showToast]);

  const handleSubmitGuess = useCallback(async () => {
    if (!data || !guess.trim() || isChecking) return;
    setIsChecking(true);
    soundManager?.playClick();

    try {
      const response = await fetch("/api/detective/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guess: guess.trim(),
          correctAnswer: data.correctAnswer,
          finalOutcome: data.finalOutcome,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Failed to check guess");
      }

      const result: DetectiveCheckResponse = await response.json();
      setCheckResult(result);

      if (result.isCorrect) {
        soundManager?.playSuccess();
      } else {
        soundManager?.playError();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to check guess");
      soundManager?.playError();
    } finally {
      setIsChecking(false);
    }
  }, [data, guess, isChecking, showToast]);

  const handleRevealTimeline = useCallback(() => {
    setShowTimeline(true);
    setGameEnded(true);
    soundManager?.playPortalOpen();
  }, []);

  // Save score when game ends
  useEffect(() => {
    if (gameEnded && checkResult && data && !scoreSaved) {
      setScoreSaved(true);
      addDetectiveScore({
        scenario: data.finalOutcome.slice(0, 100),
        score: finalScore,
        hintsUsed,
        timestamp: Date.now(),
      });
      showToast(`Final score: ${finalScore}!`);
    }
  }, [gameEnded, checkResult, data, scoreSaved, finalScore, hintsUsed, showToast]);

  // Build tree layout when timeline is revealed
  useEffect(() => {
    if (!data || !showTimeline) return;
    const { nodes: layoutNodes, edges: layoutEdges } = buildTreeLayout(
      data.fullTimeline,
      null,
      selectedNodeId,
      handleExpand,
      handleSelect
    );
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [data, showTimeline, selectedNodeId, handleExpand, handleSelect, setNodes, setEdges]);

  // Initialize on mount
  useEffect(() => {
    startGeneration();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedNodeId) setSelectedNodeId(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedNodeId]);

  const selectedNode = useMemo(() => {
    if (!data || !selectedNodeId) return null;
    return findNodeById(data.fullTimeline, selectedNodeId);
  }, [data, selectedNodeId]);

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
          <span className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1 text-xs font-bold text-white">
            History Detective
          </span>
          {data && (
            <span
              className={`rounded-full bg-gradient-to-r ${DIFFICULTY_COLORS[data.difficulty] || DIFFICULTY_COLORS.medium} px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase`}
            >
              {data.difficulty}
            </span>
          )}
          {checkResult && gameEnded && (
            <span className="text-sm font-semibold text-emerald-400">Score: {finalScore}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setLeaderboard(getDetectiveScores());
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

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-emerald-500/30 bg-[var(--surface-secondary)] px-4 py-2 text-sm text-emerald-300 shadow-xl backdrop-blur-xl"
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
                    borderColor: `rgba(16, 185, 129, ${0.15 + i * 0.1})`,
                    opacity: 0.4 + i * 0.15,
                  }}
                />
              ))}
            </div>
            <h2 className="mb-2 text-xl font-semibold text-[var(--text-primary)]">
              Constructing the mystery...
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint)]">
              Building an alternate history puzzle for you to solve
            </p>
            {streamText && (
              <div className="mx-auto max-h-48 max-w-xl overflow-y-auto rounded-xl border border-emerald-500/10 bg-[var(--accent-ghost)] p-4">
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
              Mystery unsolvable!
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint)]">{error}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={startGeneration}
                className="cursor-pointer rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
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

      {/* Main game UI (when puzzle loaded and timeline NOT shown) */}
      {data && !isGenerating && !error && !showTimeline && (
        <div className="flex h-full w-full items-start justify-center overflow-y-auto pt-20 pb-10">
          <div className="mx-auto w-full max-w-2xl px-4">
            {/* Mystery card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8 overflow-hidden rounded-2xl border border-emerald-500/20 bg-[var(--surface-secondary)] shadow-2xl"
            >
              {/* Card header */}
              <div className="border-b border-emerald-500/10 bg-gradient-to-r from-emerald-500/10 to-teal-600/10 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <h2 className="text-sm font-semibold tracking-wider text-emerald-400 uppercase">
                      The Mystery
                    </h2>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-300 tabular-nums">
                    {data.finalYear}
                  </span>
                </div>
              </div>

              {/* Card body — the final outcome */}
              <div className="px-6 py-8">
                <p className="text-center text-lg leading-relaxed font-medium text-[var(--text-primary)]">
                  &ldquo;{data.finalOutcome}&rdquo;
                </p>
              </div>

              {/* Card footer */}
              <div className="border-t border-emerald-500/10 px-6 py-3">
                <p className="text-center text-xs text-[var(--text-faint)]">
                  What historical divergence led to this outcome?
                </p>
              </div>
            </motion.div>

            {/* Revealed hints */}
            <AnimatePresence>
              {revealedHints.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mb-6 space-y-2"
                >
                  {revealedHints
                    .sort((a, b) => a.level - b.level)
                    .map((hint) => (
                      <motion.div
                        key={hint.level}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-xl border border-teal-500/20 bg-teal-500/5 px-4 py-3"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-bold text-teal-400 uppercase">
                            Hint {hint.level}
                          </span>
                          <span className="text-[10px] text-red-400">-{HINT_PENALTY} pts</span>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">{hint.text}</p>
                      </motion.div>
                    ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Guess input area (only if not yet checked) */}
            {!checkResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-6"
              >
                <label
                  htmlFor="detective-guess"
                  className="mb-2 block text-sm font-medium text-[var(--text-secondary)]"
                >
                  Your guess: What event changed history?
                </label>
                <textarea
                  id="detective-guess"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="Describe the historical event you think caused this outcome..."
                  rows={4}
                  maxLength={1000}
                  className="w-full resize-none rounded-xl border border-[var(--accent-faint)] bg-[var(--surface-primary)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] transition-colors outline-none focus:border-emerald-500/50"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-[var(--text-faint)]">{guess.length}/1000</span>
                  {hintsUsed > 0 && (
                    <span className="text-xs text-red-400">
                      Hint penalty: -{hintsUsed * HINT_PENALTY} pts
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleSubmitGuess}
                    disabled={!guess.trim() || isChecking}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:from-emerald-400 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isChecking ? (
                      <>
                        <Spinner className="h-4 w-4" />
                        Checking...
                      </>
                    ) : (
                      "Submit Guess"
                    )}
                  </button>

                  <button
                    onClick={handleRevealHint}
                    disabled={availableHints.length === 0}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-teal-500/30 px-4 py-3 text-sm font-medium text-teal-400 transition-colors hover:bg-teal-500/10 disabled:cursor-not-allowed disabled:opacity-40"
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
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    Hint ({availableHints.length} left)
                  </button>
                </div>
              </motion.div>
            )}

            {/* Check result */}
            <AnimatePresence>
              {checkResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-6 overflow-hidden rounded-2xl border border-emerald-500/20 bg-[var(--surface-secondary)] shadow-xl"
                >
                  {/* Score header */}
                  <div
                    className={`px-6 py-5 text-center ${
                      checkResult.isCorrect
                        ? "bg-gradient-to-r from-emerald-500/20 to-teal-600/20"
                        : "bg-gradient-to-r from-amber-500/10 to-orange-500/10"
                    }`}
                  >
                    <div
                      className={`mb-1 text-4xl font-bold ${
                        checkResult.isCorrect ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {finalScore}
                    </div>
                    <div className="text-xs tracking-wider text-[var(--text-faint)] uppercase">
                      {checkResult.isCorrect ? "Correct!" : "Not quite..."}
                      {hintsUsed > 0 && (
                        <span className="ml-2 text-red-400">
                          ({hintsUsed} hint{hintsUsed !== 1 ? "s" : ""} used, -
                          {hintsUsed * HINT_PENALTY} pts)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Feedback */}
                  <div className="space-y-4 px-6 py-5">
                    <div>
                      <h4 className="mb-1 text-xs font-semibold tracking-wider text-[var(--text-faint)] uppercase">
                        Feedback
                      </h4>
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                        {checkResult.feedback}
                      </p>
                    </div>
                    <div>
                      <h4 className="mb-1 text-xs font-semibold tracking-wider text-[var(--text-faint)] uppercase">
                        The Answer
                      </h4>
                      <p className="text-sm leading-relaxed font-medium text-emerald-400">
                        {checkResult.correctAnswer}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 border-t border-[var(--accent-ghost)] px-6 py-4">
                    {!gameEnded && (
                      <button
                        onClick={handleRevealTimeline}
                        className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:from-emerald-400 hover:to-teal-500"
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
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        Reveal Timeline
                      </button>
                    )}
                    <button
                      onClick={startGeneration}
                      className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-500/30 px-4 py-2.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10"
                    >
                      New Puzzle
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* React Flow timeline (revealed after game ends) */}
      {data && showTimeline && !isGenerating && (
        <>
          {/* Score overlay at top */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 rounded-xl border border-emerald-500/20 bg-[var(--surface-secondary)] px-5 py-2.5 shadow-xl backdrop-blur-xl"
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{finalScore}</div>
              <div className="text-[10px] tracking-wider text-[var(--text-faint)] uppercase">
                Score
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--accent-ghost)]" />
            <div className="text-center">
              <div className="text-lg font-bold text-teal-400">{hintsUsed}</div>
              <div className="text-[10px] text-[var(--text-faint)]">Hints</div>
            </div>
            <div className="h-8 w-px bg-[var(--accent-ghost)]" />
            <div className="text-center">
              <div
                className={`text-lg font-bold ${checkResult?.isCorrect ? "text-emerald-400" : "text-amber-400"}`}
              >
                {checkResult?.isCorrect ? "Yes" : "No"}
              </div>
              <div className="text-[10px] text-[var(--text-faint)]">Correct</div>
            </div>
            <div className="h-8 w-px bg-[var(--accent-ghost)]" />
            <button
              onClick={startGeneration}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
            >
              New Puzzle
            </button>
          </motion.div>

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
              <Background color="rgba(16, 185, 129, 0.05)" gap={40} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor="rgba(16, 185, 129, 0.4)"
                maskColor="var(--minimap-mask)"
                className="!rounded-xl !border !border-emerald-500/20 !bg-[var(--minimap-bg)]"
                pannable
                zoomable
              />
            </ReactFlow>
          </div>
        </>
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
              className="mx-4 w-full max-w-md rounded-2xl border border-emerald-500/20 bg-[var(--surface-secondary)] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 text-lg font-semibold text-emerald-400">Detective Leaderboard</h3>
              {leaderboard.length === 0 ? (
                <p className="text-sm text-[var(--text-faint)]">
                  No scores yet. Solve a mystery to add yours!
                </p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, i) => (
                    <div
                      key={entry.timestamp}
                      className="flex items-center gap-3 rounded-xl border border-[var(--accent-ghost)] bg-[var(--surface-primary)] p-3"
                    >
                      <span
                        className={`text-lg font-bold ${
                          i === 0
                            ? "text-emerald-400"
                            : i === 1
                              ? "text-gray-300"
                              : i === 2
                                ? "text-teal-600"
                                : "text-[var(--text-faint)]"
                        }`}
                      >
                        #{i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-[var(--text-secondary)]">
                          {entry.scenario}
                        </p>
                        <p className="text-xs text-[var(--text-faint)]">
                          {entry.hintsUsed} hint{entry.hintsUsed !== 1 ? "s" : ""} used
                        </p>
                      </div>
                      <span className="text-lg font-bold text-emerald-400">{entry.score}</span>
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

function DetectiveLoading() {
  return (
    <div className="relative z-10 flex h-screen w-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export default function DetectivePage() {
  return (
    <Suspense fallback={<DetectiveLoading />}>
      <ReactFlowProvider>
        <DetectiveContent />
      </ReactFlowProvider>
    </Suspense>
  );
}

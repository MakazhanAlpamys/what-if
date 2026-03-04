"use client";

import { useEffect, useRef, useState, useCallback, startTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TimelineNode } from "@/lib/types";
import { IMPACT_COLORS } from "@/lib/constants";
import { soundManager } from "@/lib/sounds";
import Spinner from "@/components/Spinner";

interface DetailPanelProps {
  node: TimelineNode | null;
  realHistory: string;
  onClose: () => void;
  onExpand: (nodeId: string) => void;
  onCollapse: (nodeId: string) => void;
  isExpanding: boolean;
  hasChildren: boolean;
}

export default function DetailPanel({
  node,
  realHistory,
  onClose,
  onExpand,
  onCollapse,
  isExpanding,
  hasChildren,
}: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!node) return;
    panelRef.current?.focus();
  }, [node]);

  // Stop TTS when node changes or panel closes
  useEffect(() => {
    startTransition(() => setIsSpeaking(false));
    soundManager?.stopSpeaking();
  }, [node]);

  const handleSpeak = useCallback(() => {
    if (!node) return;
    if (isSpeaking) {
      soundManager?.stopSpeaking();
      setIsSpeaking(false);
    } else {
      const text = `${node.year}. ${node.title}. ${node.description}`;
      soundManager?.speak(text);
      setIsSpeaking(true);
      // Reset when speech ends
      if (typeof speechSynthesis !== "undefined") {
        const checkInterval = setInterval(() => {
          if (!speechSynthesis.speaking) {
            setIsSpeaking(false);
            clearInterval(checkInterval);
          }
        }, 500);
      }
    }
  }, [node, isSpeaking]);

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x > 100) onClose();
          }}
          role="dialog"
          aria-label="Event details"
          ref={panelRef}
          tabIndex={-1}
          className="fixed top-0 right-0 z-50 flex h-full w-[85%] max-w-96 flex-col border-l border-[var(--accent-border)] bg-[var(--surface-secondary)] backdrop-blur-xl outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--accent-ghost)] px-6 py-4">
            <h2 className="text-sm font-medium tracking-wider text-[var(--text-tertiary)] uppercase">
              Event Details
            </h2>
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="cursor-pointer rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Year + Impact */}
            <div className="mb-4 flex items-center gap-3">
              <span
                className="rounded-lg px-3 py-1 text-lg font-bold"
                style={{
                  backgroundColor: `${IMPACT_COLORS[node.impact]}20`,
                  color: IMPACT_COLORS[node.impact],
                }}
              >
                {node.year}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wider uppercase"
                style={{
                  backgroundColor: `${IMPACT_COLORS[node.impact]}15`,
                  color: IMPACT_COLORS[node.impact],
                }}
              >
                {node.impact} impact
              </span>
            </div>

            {/* Title */}
            <h3 className="mb-4 text-xl leading-tight font-bold text-[var(--text-primary)]">
              {node.title}
            </h3>

            {/* Description */}
            <p className="mb-3 text-sm leading-relaxed text-[var(--text-tertiary)]">
              {node.description}
            </p>

            {/* Read aloud button */}
            <button
              onClick={handleSpeak}
              className="mb-6 flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--violet-text)]"
              aria-label={isSpeaking ? "Stop reading" : "Read aloud"}
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                {isSpeaking ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M10 9v6 M14 9v6"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                )}
              </svg>
              {isSpeaking ? "Stop" : "Read aloud"}
            </button>

            {/* Action buttons */}
            <div className="mb-6 flex flex-col gap-2">
              {!hasChildren && (
                <button
                  onClick={() => onExpand(node.id)}
                  disabled={isExpanding}
                  className="w-full cursor-pointer rounded-xl border border-[var(--accent-faint)] bg-[var(--accent-ghost)] px-4 py-3 text-sm font-medium text-[var(--violet-text)] transition-all hover:border-[var(--accent-muted)] hover:bg-[var(--accent-faint)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isExpanding ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner className="h-4 w-4" />
                      K2 is thinking...
                    </span>
                  ) : (
                    "Explore deeper — generate sub-branches"
                  )}
                </button>
              )}
              {hasChildren && (
                <button
                  onClick={() => onCollapse(node.id)}
                  className="w-full cursor-pointer rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-500 transition-all hover:border-red-500/30 hover:bg-red-500/10 dark:text-red-300/70"
                >
                  Collapse branches
                </button>
              )}
            </div>

            {/* Sub-branches preview */}
            {node.branches.length > 0 && (
              <div className="mb-6">
                <h4 className="mb-3 text-xs font-medium tracking-wider text-[var(--text-faint)] uppercase">
                  Branches ({node.branches.length})
                </h4>
                <div className="space-y-2">
                  {node.branches.map((branch) => (
                    <div
                      key={branch.id}
                      className="rounded-lg border border-[var(--accent-ghost)] bg-[var(--accent-ghost)] p-3"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className="text-xs font-bold"
                          style={{ color: IMPACT_COLORS[branch.impact] }}
                        >
                          {branch.year}
                        </span>
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          {branch.title}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs text-[var(--text-faint)]">
                        {branch.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="mb-4 border-t border-[var(--accent-ghost)]" />

            {/* Real history */}
            <div className="rounded-xl border border-[var(--accent-faint)] bg-[var(--accent-ghost)] p-4">
              <h4 className="mb-2 text-xs font-medium tracking-wider text-[var(--text-muted)] uppercase">
                What actually happened
              </h4>
              <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">{realHistory}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

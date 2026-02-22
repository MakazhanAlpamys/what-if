"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TimelineNode } from "@/lib/types";
import { IMPACT_COLORS } from "@/lib/constants";
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

  useEffect(() => {
    if (!node) return;
    panelRef.current?.focus();
  }, [node]);

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
            <p className="mb-6 text-sm leading-relaxed text-[var(--text-tertiary)]">
              {node.description}
            </p>

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
                  className="w-full cursor-pointer rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-300/70 transition-all hover:border-red-500/30 hover:bg-red-500/10"
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
            <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-4">
              <h4 className="mb-2 text-xs font-medium tracking-wider text-blue-300/60 uppercase">
                What actually happened
              </h4>
              <p className="text-xs leading-relaxed text-blue-200/40">{realHistory}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

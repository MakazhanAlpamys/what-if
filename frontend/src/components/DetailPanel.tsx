"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TimelineNode } from "@/lib/types";
import { IMPACT_COLORS } from "@/lib/constants";

interface DetailPanelProps {
  node: TimelineNode | null;
  realHistory: string;
  scenario: string;
  onClose: () => void;
  onExpand: (nodeId: string) => void;
  isExpanding: boolean;
  hasChildren: boolean;
}

export default function DetailPanel({
  node,
  realHistory,
  scenario,
  onClose,
  onExpand,
  isExpanding,
  hasChildren,
}: DetailPanelProps) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          role="dialog"
          aria-label="Event details"
          className="fixed top-0 right-0 z-50 flex h-full w-full flex-col border-l border-violet-500/15 bg-[rgba(8,8,25,0.95)] backdrop-blur-xl sm:w-96"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-violet-500/10 px-6 py-4">
            <h2 className="text-sm font-medium tracking-wider text-white/50 uppercase">
              Event Details
            </h2>
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="cursor-pointer rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
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
            <h3 className="mb-4 text-xl leading-tight font-bold text-white">{node.title}</h3>

            {/* Description */}
            <p className="mb-6 text-sm leading-relaxed text-white/60">{node.description}</p>

            {/* Expand button */}
            {!hasChildren && (
              <button
                onClick={() => onExpand(node.id)}
                disabled={isExpanding}
                className="mb-6 w-full cursor-pointer rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-300 transition-all hover:border-violet-500/40 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isExpanding ? (
                  <span className="flex items-center justify-center gap-2">
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
                    K2 is thinking...
                  </span>
                ) : (
                  "Explore deeper — generate sub-branches"
                )}
              </button>
            )}

            {/* Sub-branches preview */}
            {node.branches.length > 0 && (
              <div className="mb-6">
                <h4 className="mb-3 text-xs font-medium tracking-wider text-white/30 uppercase">
                  Branches ({node.branches.length})
                </h4>
                <div className="space-y-2">
                  {node.branches.map((branch) => (
                    <div
                      key={branch.id}
                      className="rounded-lg border border-violet-500/10 bg-violet-500/5 p-3"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className="text-xs font-bold"
                          style={{ color: IMPACT_COLORS[branch.impact] }}
                        >
                          {branch.year}
                        </span>
                        <span className="text-xs font-medium text-white/70">{branch.title}</span>
                      </div>
                      <p className="line-clamp-2 text-xs text-white/30">{branch.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="mb-4 border-t border-violet-500/10" />

            {/* Real history */}
            <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-4">
              <h4 className="mb-2 text-xs font-medium tracking-wider text-blue-300/60 uppercase">
                What actually happened
              </h4>
              <p className="text-xs leading-relaxed text-blue-200/40">{realHistory}</p>
            </div>

            {/* Scenario */}
            <div className="mt-4 rounded-xl border border-violet-500/10 bg-violet-500/5 p-4">
              <h4 className="mb-2 text-xs font-medium tracking-wider text-violet-300/50 uppercase">
                Original scenario
              </h4>
              <p className="text-xs text-violet-200/40 italic">&ldquo;{scenario}&rdquo;</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

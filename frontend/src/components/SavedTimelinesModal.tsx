"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getSavedTimelines, deleteSavedTimeline, type SavedTimeline } from "@/lib/storage";
import { collectAllNodes } from "@/lib/tree-utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SavedTimelinesModal({ isOpen, onClose }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Read from localStorage whenever the modal is open and refreshKey changes
  const timelines: SavedTimeline[] = useMemo(() => {
    if (!isOpen) return [];
    return getSavedTimelines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, refreshKey]);

  const handleLoad = (id: string) => {
    router.push(`/timeline?load=${encodeURIComponent(id)}`);
    onClose();
  };

  const handleDelete = (id: string) => {
    deleteSavedTimeline(id);
    setRefreshKey((k) => k + 1);
    setConfirmDeleteId(null);
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[var(--backdrop)] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 z-[61] w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--accent-border)] bg-[var(--surface-secondary)] shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--accent-ghost)] px-6 py-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Saved Timelines</h2>
              <button
                onClick={onClose}
                className="cursor-pointer rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
                aria-label="Close"
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
            <div className="max-h-80 overflow-y-auto px-6 py-4">
              {timelines.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                  No saved timelines yet. Create a scenario and press Ctrl+S to save.
                </p>
              ) : (
                <div className="space-y-2">
                  {timelines.map((tl) => {
                    const nodeCount = collectAllNodes(tl.data.timeline).length;
                    return (
                      <div
                        key={tl.id}
                        className="group rounded-xl border border-[var(--accent-ghost)] p-3 transition-colors hover:border-[var(--accent-border)]"
                      >
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <p className="line-clamp-1 text-sm font-medium text-[var(--text-primary)]">
                            {tl.scenario}
                          </p>
                          <span className="shrink-0 text-xs text-[var(--text-ghost)]">
                            {formatDate(tl.savedAt)}
                          </span>
                        </div>
                        <p className="mb-2 text-xs text-[var(--text-muted)]">
                          {nodeCount} node{nodeCount !== 1 ? "s" : ""}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLoad(tl.id)}
                            className="cursor-pointer rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-violet-500"
                          >
                            Load
                          </button>
                          {confirmDeleteId === tl.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDelete(tl.id)}
                                className="cursor-pointer rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="cursor-pointer rounded-lg border border-[var(--accent-border)] px-3 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(tl.id)}
                              className="cursor-pointer rounded-lg border border-red-500/20 px-3 py-1 text-xs text-red-400/60 transition-colors hover:border-red-500/40 hover:text-red-400"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

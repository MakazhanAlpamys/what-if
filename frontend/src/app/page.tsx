"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";
import ThemeToggle from "@/components/ThemeToggle";
import SavedTimelinesModal from "@/components/SavedTimelinesModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { getHistory, clearHistory, type HistoryEntry } from "@/lib/storage";

const MAX_SCENARIO_LENGTH = 2000;

const EXAMPLE_SCENARIOS = [
  "What if the Roman Empire never fell?",
  "What if the Library of Alexandria was never destroyed?",
  "What if humans never landed on the Moon?",
  "What if the Internet was invented in 1950?",
  "What if Napoleon won at Waterloo?",
  "What if the USSR won the Space Race?",
];

function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    return getHistory();
  });
  return { history, setHistory };
}

export default function Home() {
  const [scenario, setScenario] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSavedTimelines, setShowSavedTimelines] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { history, setHistory } = useHistory();
  const router = useRouter();

  const navigateToScenario = (text: string) => {
    setScenario(text);
    setIsLoading(true);
    router.push(`/timeline?q=${encodeURIComponent(text)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenario.trim() || isLoading || scenario.length > MAX_SCENARIO_LENGTH) return;
    navigateToScenario(scenario.trim());
  };

  useEffect(() => {
    const resetLoading = () => setIsLoading(false);
    window.addEventListener("pageshow", resetLoading);
    return () => window.removeEventListener("pageshow", resetLoading);
  }, []);

  return (
    <main
      className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4"
      role="main"
    >
      {/* Theme toggle + Saved timelines */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={() => setShowSavedTimelines(true)}
          aria-label="Saved timelines"
          title="Saved timelines"
          className="cursor-pointer rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]"
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </button>
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-2xl text-center"
      >
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="mb-2 text-4xl font-bold tracking-tight sm:text-6xl md:text-7xl"
        >
          <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            What If...?
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-1 text-lg font-medium tracking-widest text-[var(--violet-text)] uppercase"
        >
          Heritage on K2 Think V2
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mx-auto mb-10 max-w-md text-base text-[var(--text-muted)]"
        >
          Explore alternate realities. Enter a what-if scenario and watch branching timelines of
          consequences unfold.
        </motion.p>

        {/* Input */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="relative mb-8"
        >
          <div className="portal-glow rounded-2xl">
            <textarea
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="What if...?"
              rows={3}
              maxLength={MAX_SCENARIO_LENGTH}
              aria-label="Enter your what-if scenario"
              className="w-full resize-none rounded-2xl border border-[var(--accent-faint)] bg-[var(--surface-primary)] px-4 py-3 text-base text-[var(--text-primary)] placeholder-[var(--text-faint)] backdrop-blur-sm transition-colors outline-none focus:border-[var(--accent-soft)] focus:ring-2 focus:ring-[var(--accent-muted)] sm:px-6 sm:py-4 sm:text-lg"
            />
          </div>
          {/* Character counter */}
          <div className="mt-1 flex justify-end px-1">
            <span
              className={`text-xs transition-colors ${
                scenario.length > MAX_SCENARIO_LENGTH * 0.9
                  ? scenario.length >= MAX_SCENARIO_LENGTH
                    ? "text-red-400"
                    : "text-yellow-400/60"
                  : "text-[var(--text-ghost)]"
              }`}
            >
              {scenario.length}/{MAX_SCENARIO_LENGTH}
            </span>
          </div>
          <button
            type="submit"
            disabled={!scenario.trim() || isLoading || scenario.length > MAX_SCENARIO_LENGTH}
            className="mt-2 w-full cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                Opening portal...
              </span>
            ) : (
              "Create Reality"
            )}
          </button>
        </motion.form>

        {/* Examples */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
          <p className="mb-3 text-sm text-[var(--text-faint)]">Or try an example:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLE_SCENARIOS.map((example) => (
              <button
                key={example}
                onClick={() => navigateToScenario(example)}
                className="cursor-pointer rounded-lg border border-[var(--accent-ghost)] bg-[var(--accent-ghost)] px-3 py-1.5 text-sm text-[var(--violet-text-muted)] transition-all hover:border-[var(--accent-muted)] hover:bg-[var(--accent-ghost)] hover:text-[var(--violet-text)]"
              >
                {example}
              </button>
            ))}
          </div>
        </motion.div>

        {/* History */}
        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="mt-8"
          >
            <div className="mb-3 flex items-center justify-center gap-3">
              <p className="text-sm text-[var(--text-faint)]">Recent scenarios:</p>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="cursor-pointer text-xs text-[var(--text-ghost)] transition-colors hover:text-[var(--text-muted)]"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {history.slice(0, 6).map((entry) => (
                <button
                  key={entry.timestamp}
                  onClick={() => navigateToScenario(entry.scenario)}
                  className="max-w-[200px] cursor-pointer truncate rounded-lg border border-[var(--accent-ghost)] bg-[var(--accent-ghost)] px-3 py-1.5 text-sm text-[var(--indigo-text-muted)] transition-all hover:border-[var(--accent-muted)] hover:bg-[var(--accent-ghost)] hover:text-[var(--violet-text)]"
                  title={entry.scenario}
                >
                  {entry.scenario}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Keyboard shortcut hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-6 text-xs text-[var(--text-invisible)]"
        >
          Press Enter to submit
        </motion.p>
      </motion.div>

      {/* Saved Timelines Modal */}
      <SavedTimelinesModal
        isOpen={showSavedTimelines}
        onClose={() => setShowSavedTimelines(false)}
      />

      {/* Clear History Confirmation */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear History?"
        message="This will remove all your recent scenarios. This action cannot be undone."
        confirmLabel="Clear All"
        variant="danger"
        onConfirm={() => {
          clearHistory();
          setHistory([]);
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </main>
  );
}

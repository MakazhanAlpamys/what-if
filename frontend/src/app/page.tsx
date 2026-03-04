"use client";

import { useState, useEffect, useRef, startTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";
import ThemeToggle from "@/components/ThemeToggle";
import SoundToggle from "@/components/SoundToggle";
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

const GAME_MODES = [
  {
    id: "butterfly",
    title: "Butterfly Effect",
    description:
      "Enter a tiny change and watch it cascade into world-altering events. Score by impact!",
    icon: (
      <svg
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3c-1.5 2-4 3-6 2.5C5 8 7 11 12 12c5-1 7-4 6-6.5-2 .5-4.5-.5-6-2.5zM12 12c-1.5 2-4 3-6 2.5C5 17 7 20 12 21c5-1 7-4 6-6.5-2 .5-4.5-.5-6-2.5z"
        />
      </svg>
    ),
    color: "from-amber-500 to-orange-600",
    bgGlow: "rgba(245, 158, 11, 0.15)",
    href: "/butterfly",
    needsInput: true,
    placeholder: "Napoleon overslept by 2 hours...",
  },
  {
    id: "detective",
    title: "History Detective",
    description:
      "See the final outcome, guess the cause. Reverse detective — from effect to cause!",
    icon: (
      <svg
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
    ),
    color: "from-emerald-500 to-teal-600",
    bgGlow: "rgba(16, 185, 129, 0.15)",
    href: "/detective",
    needsInput: false,
  },
  {
    id: "fix-history",
    title: "Fix History",
    description:
      "A dystopian timeline awaits. Find the wrong turn and fix reality in minimum moves!",
    icon: (
      <svg
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.42 15.17l-5.073-5.073a2.121 2.121 0 113-3l5.073 5.073M16.5 9l1.5-1.5M2 2l20 20"
        />
      </svg>
    ),
    color: "from-red-500 to-rose-600",
    bgGlow: "rgba(239, 68, 68, 0.15)",
    href: "/fix-history",
    needsInput: false,
  },
  {
    id: "compare",
    title: "Reality vs Alternative",
    description: "Split-screen comparison of real history vs your alternate timeline.",
    icon: (
      <svg
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
        />
      </svg>
    ),
    color: "from-blue-500 to-cyan-600",
    bgGlow: "rgba(59, 130, 246, 0.15)",
    href: "/compare",
    needsInput: true,
    placeholder: "What if the Library of Alexandria survived?",
  },
  {
    id: "map",
    title: "World Map",
    description: "Visualize how changes ripple across the globe with an interactive impact map.",
    icon: (
      <svg
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.777.515-3.434 1.404-4.832"
        />
      </svg>
    ),
    color: "from-purple-500 to-violet-600",
    bgGlow: "rgba(139, 92, 246, 0.15)",
    href: "/map",
    needsInput: true,
    placeholder: "What if the Silk Road never existed?",
  },
  {
    id: "editor",
    title: "Timeline Editor",
    description: "Build your own timeline from scratch. AI critiques your historical plausibility!",
    icon: (
      <svg
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
        />
      </svg>
    ),
    color: "from-pink-500 to-fuchsia-600",
    bgGlow: "rgba(236, 72, 153, 0.15)",
    href: "/editor",
    needsInput: false,
  },
] as const;

function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    startTransition(() => setHistory(getHistory()));
  }, []);
  return { history, setHistory };
}

export default function Home() {
  const [scenario, setScenario] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMode, setLoadingMode] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSavedTimelines, setShowSavedTimelines] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const [selectedMode, setSelectedMode] = useState<(typeof GAME_MODES)[number] | null>(null);
  const [modeInput, setModeInput] = useState("");
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

  const handleModeClick = (mode: (typeof GAME_MODES)[number]) => {
    if (mode.needsInput) {
      setSelectedMode(mode);
      setModeInput("");
    } else {
      setLoadingMode(mode.id);
      router.push(mode.href);
    }
  };

  const handleModeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMode || !modeInput.trim()) return;
    setLoadingMode(selectedMode.id);
    router.push(`${selectedMode.href}?q=${encodeURIComponent(modeInput.trim())}`);
  };

  useEffect(() => {
    const resetLoading = () => {
      setIsLoading(false);
      setLoadingMode(null);
    };
    window.addEventListener("pageshow", resetLoading);
    return () => window.removeEventListener("pageshow", resetLoading);
  }, []);

  return (
    <main
      className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12"
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
        <SoundToggle />
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-4xl text-center"
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
          className="mx-auto mb-8 max-w-md text-base text-[var(--text-muted)]"
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
          className="relative mx-auto mb-8 max-w-2xl"
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
              ref={textareaRef}
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mx-auto max-w-2xl"
        >
          <p className="mb-3 text-sm text-[var(--text-faint)]">Or try an example:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLE_SCENARIOS.map((example) => (
              <button
                key={example}
                onClick={() => {
                  setScenario(example);
                  textareaRef.current?.focus();
                  textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="cursor-pointer rounded-lg border border-[var(--accent-ghost)] bg-[var(--accent-ghost)] px-3 py-1.5 text-sm text-[var(--violet-text-muted)] transition-all hover:border-[var(--accent-muted)] hover:bg-[var(--accent-ghost)] hover:text-[var(--violet-text)]"
              >
                {example}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Game Modes Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
          className="mt-12"
        >
          <button
            onClick={() => setShowModes(!showModes)}
            className="mx-auto mb-6 flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--violet-text)] transition-colors hover:text-[var(--text-secondary)]"
          >
            <svg
              className={`h-4 w-4 transition-transform ${showModes ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            Game Modes
            <svg
              className={`h-4 w-4 transition-transform ${showModes ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {showModes && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {GAME_MODES.map((mode, i) => (
                    <motion.button
                      key={mode.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleModeClick(mode)}
                      disabled={loadingMode === mode.id}
                      className="group cursor-pointer rounded-2xl border border-[var(--accent-ghost)] bg-[var(--surface-primary)] p-5 text-left backdrop-blur-sm transition-all hover:border-[var(--accent-muted)] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        boxShadow: `0 0 20px ${mode.bgGlow}`,
                      }}
                    >
                      <div
                        className={`mb-3 inline-flex rounded-xl bg-gradient-to-r ${mode.color} p-2.5 text-white`}
                      >
                        {mode.icon}
                      </div>
                      <h3 className="mb-1 text-base font-semibold text-[var(--text-primary)]">
                        {mode.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-[var(--text-muted)]">
                        {mode.description}
                      </p>
                      {loadingMode === mode.id && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--violet-text)]">
                          <Spinner className="h-3 w-3" /> Loading...
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Mode input modal */}
        <AnimatePresence>
          {selectedMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop)] backdrop-blur-sm"
              onClick={() => setSelectedMode(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--accent-faint)] bg-[var(--surface-secondary)] p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`inline-flex rounded-xl bg-gradient-to-r ${selectedMode.color} p-2.5 text-white`}
                  >
                    {selectedMode.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                      {selectedMode.title}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)]">{selectedMode.description}</p>
                  </div>
                </div>
                <form onSubmit={handleModeSubmit}>
                  <textarea
                    value={modeInput}
                    onChange={(e) => setModeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleModeSubmit(e);
                      }
                    }}
                    placeholder={
                      "placeholder" in selectedMode
                        ? selectedMode.placeholder
                        : "Enter your scenario..."
                    }
                    rows={3}
                    maxLength={MAX_SCENARIO_LENGTH}
                    autoFocus
                    className="w-full resize-none rounded-xl border border-[var(--accent-faint)] bg-[var(--surface-primary)] px-4 py-3 text-base text-[var(--text-primary)] placeholder-[var(--text-faint)] outline-none focus:border-[var(--accent-soft)] focus:ring-2 focus:ring-[var(--accent-muted)]"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMode(null)}
                      className="cursor-pointer rounded-lg border border-[var(--accent-faint)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!modeInput.trim() || !!loadingMode}
                      className={`cursor-pointer rounded-lg bg-gradient-to-r ${selectedMode.color} px-6 py-2 text-sm font-medium text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {loadingMode ? (
                        <span className="flex items-center gap-2">
                          <Spinner className="h-3 w-3" /> Loading...
                        </span>
                      ) : (
                        "Start"
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
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
          transition={{ delay: 1.7 }}
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

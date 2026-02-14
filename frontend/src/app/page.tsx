"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";
import ThemeToggle from "@/components/ThemeToggle";
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
  const { history, setHistory } = useHistory();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenario.trim() || isLoading || scenario.length > MAX_SCENARIO_LENGTH) return;
    setIsLoading(true);
    router.push(`/timeline?q=${encodeURIComponent(scenario.trim())}`);
  };

  const handleExample = (example: string) => {
    setScenario(example);
    setIsLoading(true);
    router.push(`/timeline?q=${encodeURIComponent(example)}`);
  };

  const handleHistoryClick = (entry: HistoryEntry) => {
    setScenario(entry.scenario);
    setIsLoading(true);
    router.push(`/timeline?q=${encodeURIComponent(entry.scenario)}`);
  };

  return (
    <main
      className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4"
      role="main"
    >
      {/* Theme toggle */}
      <div className="absolute top-4 right-4">
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
          className="mb-1 text-lg font-medium tracking-widest text-violet-300/70 uppercase"
        >
          Heritage on K2 Think V2
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mx-auto mb-10 max-w-md text-base text-white/40"
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
              className="w-full resize-none rounded-2xl border border-violet-500/20 bg-[rgba(15,15,40,0.9)] px-4 py-3 text-base text-white placeholder-white/30 backdrop-blur-sm transition-colors outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/30 sm:px-6 sm:py-4 sm:text-lg"
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
                  : "text-white/20"
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
          <p className="mb-3 text-sm text-white/30">Or try an example:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLE_SCENARIOS.map((example) => (
              <button
                key={example}
                onClick={() => handleExample(example)}
                className="cursor-pointer rounded-lg border border-violet-500/10 bg-violet-500/5 px-3 py-1.5 text-sm text-violet-300/60 transition-all hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-300"
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
              <p className="text-sm text-white/30">Recent scenarios:</p>
              <button
                onClick={() => {
                  clearHistory();
                  setHistory([]);
                }}
                className="cursor-pointer text-xs text-white/20 transition-colors hover:text-white/40"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {history.slice(0, 6).map((entry) => (
                <button
                  key={entry.timestamp}
                  onClick={() => handleHistoryClick(entry)}
                  className="max-w-[200px] cursor-pointer truncate rounded-lg border border-indigo-500/10 bg-indigo-500/5 px-3 py-1.5 text-sm text-indigo-300/60 transition-all hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-300"
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
          className="mt-6 text-xs text-white/15"
        >
          Press Enter to submit
        </motion.p>
      </motion.div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Spinner from "@/components/Spinner";

const EXAMPLE_SCENARIOS = [
  "What if the Roman Empire never fell?",
  "What if the Library of Alexandria was never destroyed?",
  "What if humans never landed on the Moon?",
  "What if the Internet was invented in 1950?",
  "What if Napoleon won at Waterloo?",
  "What if the USSR won the Space Race?",
];

export default function Home() {
  const [scenario, setScenario] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenario.trim() || isLoading) return;
    setIsLoading(true);
    router.push(`/timeline?q=${encodeURIComponent(scenario.trim())}`);
  };

  const handleExample = (example: string) => {
    setScenario(example);
  };

  return (
    <main
      className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4"
      role="main"
    >
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
              aria-label="Enter your what-if scenario"
              className="w-full resize-none rounded-2xl border border-violet-500/20 bg-[rgba(15,15,40,0.9)] px-4 py-3 text-base text-white placeholder-white/30 backdrop-blur-sm transition-colors outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/30 sm:px-6 sm:py-4 sm:text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={!scenario.trim() || isLoading}
            className="mt-4 w-full cursor-pointer rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3.5 text-base font-semibold text-white transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
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
      </motion.div>
    </main>
  );
}

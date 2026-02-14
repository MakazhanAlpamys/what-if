"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#050510] text-[#e0e0ff] antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="mb-4">
              <svg
                className="inline h-12 w-12 text-red-400/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white/70">Reality collapsed</h2>
            <p className="mb-6 text-sm text-white/30">
              {error.message || "An unexpected error tore through the timeline."}
            </p>
            <button
              onClick={reset}
              className="cursor-pointer rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            >
              Try to restore reality
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

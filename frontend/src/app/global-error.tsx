"use client";

import ErrorIcon from "@/components/ErrorIcon";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[var(--background,#050510)] text-[var(--foreground,#e0e0ff)] antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="mb-4">
              <ErrorIcon className="inline h-12 w-12" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-[var(--text-secondary,rgba(255,255,255,0.7))]">
              Reality collapsed
            </h2>
            <p className="mb-6 text-sm text-[var(--text-faint,rgba(255,255,255,0.3))]">
              An unexpected error tore through the timeline. Please try again.
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

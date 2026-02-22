import Link from "next/link";

export default function NotFound() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-2 bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-8xl font-bold text-transparent">
          404
        </h1>
        <h2 className="mb-4 text-xl font-semibold text-[var(--text-secondary)]">
          This reality doesn&apos;t exist
        </h2>
        <p className="mb-8 text-sm text-[var(--text-faint)]">
          The timeline you&apos;re looking for may have diverged into an alternate dimension.
        </p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3 text-sm font-semibold text-white transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-violet-500/25"
        >
          Return to origin reality
        </Link>
      </div>
    </div>
  );
}

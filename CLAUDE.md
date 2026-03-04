# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"What If...? Heritage" — an interactive alternate history simulator styled after Marvel's "What If...?". Users input a historical "what-if" scenario, and the K2 Think V2 reasoning model generates branching consequence trees visualized as an interactive timeline.

## Commands

All commands run from the `frontend/` directory:

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint (flat config, v9)
npm start        # Start production server
npx vitest run   # Run tests (Vitest)
npx prettier --check .  # Format check
npx tsc --noEmit        # Type check
```

## Architecture

```
User → Next.js Frontend (React Flow tree) → Next.js API Routes → K2 Think V2 API (SSE)
```

**All application code lives in `frontend/`**. There is no separate backend — Next.js API routes proxy requests to the K2 API, keeping the API key server-side via `.env.local`.

### Key directories

- `frontend/src/app/` — Pages and API routes (Next.js App Router)
- `frontend/src/app/not-found.tsx` — Custom 404 page
- `frontend/src/app/global-error.tsx` — Custom error page
- `frontend/src/components/` — React components:
  - `TimelineNode.tsx` — React Flow custom node with particle burst animation, paradox indicator
  - `DetailPanel.tsx` — Slide-in panel with event details, expand/collapse controls, TTS read-aloud
  - `SearchBar.tsx` — Timeline search with Ctrl+F shortcut
  - `SavedTimelinesModal.tsx` — Modal for loading/deleting saved timelines from localStorage
  - `SoundToggle.tsx` — Mute/unmute toggle for sound system
  - `ToolbarMenu.tsx` — Responsive mobile dropdown menu for toolbar actions
  - `ConfirmDialog.tsx` — Reusable confirmation modal (danger/default variants)
  - `Starfield.tsx` — Canvas-based parallax starfield background with mouse tracking
  - `ThemeToggle.tsx` — Dark/light mode toggle button
  - `ErrorBoundary.tsx` — Global error boundary (sanitized error messages)
  - `ErrorIcon.tsx` — SVG error/warning icon component
  - `Spinner.tsx` — Reusable loading spinner
- `frontend/src/lib/` — Shared utilities:
  - `types.ts` — Core types (`TimelineNode`, `ScenarioResponse`, `ExpandResponse`, `Paradox`, `ParadoxResponse`)
  - `stream.ts` — Client-side SSE stream handlers using shared `streamSSE()` helper with `AbortSignal` support, and `extractJSON` parser for K2 output
  - `tree-layout.ts` — Recursive tree → React Flow layout algorithm
  - `tree-utils.ts` — Tree manipulation utilities (`findNodeById`, `findChainToNode`, `addBranchesToNode`, `collapseNode`, `collectAllNodes`)
  - `sse.ts` — Shared server-side SSE streaming helper for API routes
  - `k2-api.ts` — K2 API abstraction (`getClientIP`, `getK2Config`, `validateScenario`, `fetchFromK2`, `streamFromK2`)
  - `rate-limit.ts` — In-memory rate limiter for API routes (with serverless caveats documented)
  - `validate.ts` — Runtime type guards for K2 API responses (including paradox validation)
  - `constants.ts` — Shared constants (`IMPACT_COLORS`, `IMPACT_LABELS`, `MAX_TREE_DEPTH`)
  - `storage.ts` — localStorage persistence (save timelines, scenario history, JSON export)
  - `export-image.ts` — PNG/SVG export via `html-to-image` (2x pixel ratio, filters UI controls)
  - `share.ts` — Timeline compression/sharing with `lz-string` (encode, decode, generate share URL, clipboard)
  - `sounds.ts` — Web Audio API sound manager (ambient drone, click, whoosh, portal, success, error, paradox, TTS)
  - `use-theme.ts` — Dark/light theme hook with localStorage persistence

### Data flow

1. Home page (`app/page.tsx`) takes scenario input (with character counter, history, auto-submit examples), routes to `/timeline?q=<scenario>`
2. Timeline page (`app/timeline/page.tsx`) calls `streamGenerate()` which POSTs to `/api/generate`
3. API route streams SSE from K2 Think V2 with a system prompt enforcing structured JSON output
4. Client collects streamed text, extracts JSON via regex fallback (model may wrap in markdown/thinking)
5. Response is validated with `isScenarioResponse()` / `isExpandResponse()` type guards
6. `buildTreeLayout()` converts the recursive `TimelineNode` tree into React Flow nodes/edges
7. Clicking a node opens DetailPanel; "Explore deeper" triggers `streamExpand()` → `/api/expand` to generate sub-branches
8. "Collapse branches" removes sub-branches from a node (with undo support)
9. Tree expansion is limited to `MAX_TREE_DEPTH` (5) levels to prevent performance issues
10. Timeline can be saved to localStorage, exported as JSON/PNG/SVG, shared via URL, and searched with Ctrl+F
11. Paradox detection (`/api/paradox`) analyzes timelines for logical contradictions (cause-effect violations, temporal impossibilities)
12. Sound manager provides audio feedback: ambient drone, click sounds, whoosh for new branches, portal/success/error/paradox tones, TTS read-aloud

### Core data types

`TimelineNode` is a recursive tree: each node has `id`, `year`, `title`, `description`, `impact` (critical/high/medium/low), and `branches: TimelineNode[]`. The API response types are:
- `ScenarioResponse` — wraps root timeline + realHistory
- `ExpandResponse` — new branches array
- `Paradox` — `id`, `nodeIds[]`, `description`, `severity` (critical/minor)
- `ParadoxResponse` — `{ paradoxes: Paradox[] }`

### SSE streaming pattern

Both API routes (`/api/generate`, `/api/expand`) use the shared `createSSEStream()` helper from `lib/sse.ts`. It reads K2's SSE response, extracts content deltas, and forwards them to the client. The client-side `stream.ts` uses a shared `streamSSE()` generic helper (deduplicated from the previous separate implementations). Both `streamGenerate` and `streamExpand` accept an optional `AbortSignal` for cancellation — the timeline page uses `AbortController` to cancel in-flight requests on unmount.

### Security

- **Rate limiting**: API routes use in-memory rate limiting (`lib/rate-limit.ts`): 10 req/min for generate, 20 req/min for expand, 5 req/min for paradox. Rate limit responses include `retryAfter` for client feedback. Note: in-memory store resets on serverless cold starts — consider Redis/Upstash for production.
- **IP extraction**: Uses first entry from `x-forwarded-for` (split on comma) to mitigate IP spoofing via proxy chains.
- **Input validation**: Scenario max length 2000 chars (with client-side counter); chain array validated for structure and max depth 20
- **Security headers**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Content-Security-Policy (without `unsafe-eval`) configured in `next.config.ts`
- **Response validation**: K2 responses are validated with runtime type guards before use
- **API key protection**: K2 API key is server-side only via `.env.local`, never exposed to client
- **Error sanitization**: K2 API errors are logged server-side but generic messages returned to client. ErrorBoundary and global-error show sanitized messages only.
- **ErrorBoundary**: Wraps the entire app to catch React rendering errors gracefully

### Keyboard Shortcuts

- `Ctrl+F` — Search timeline events
- `Ctrl+Z` — Undo last change
- `Ctrl+Shift+Z` / `Ctrl+Y` — Redo
- `Ctrl+S` — Save timeline to localStorage
- `Ctrl+E` — Export timeline as JSON
- `Escape` — Close detail panel / search

## Tech Stack

- **Next.js 16** with App Router and React Compiler enabled (`reactCompiler: true` in next.config.ts)
- **React 19** with hooks-based state management (no external state library)
- **TypeScript 5** (strict mode, `@/*` path alias → `./src/*`)
- **@xyflow/react** (React Flow) for interactive tree visualization with MiniMap
- **Framer Motion** for animations
- **Tailwind CSS 4** via `@tailwindcss/postcss`
- **html-to-image** for PNG/SVG export of timelines
- **lz-string** for timeline compression/sharing via URL
- **K2 Think V2** (`MBZUAI-IFM/K2-Think-v2`) as the AI reasoning model
- **Vitest** for testing
- **Prettier** (with `prettier-plugin-tailwindcss`) for formatting
- **Husky + lint-staged** for pre-commit hooks (lint + format)
- **GitHub Actions** CI pipeline (lint, format check, typecheck, test, build)

## Environment Variables

Required in `frontend/.env.local` (see `.env.example` for template):
- `K2_API_KEY` — API key for K2 Think V2
- `K2_API_URL` — API endpoint (https://api.k2think.ai/v1/chat/completions)
- `K2_MODEL` — Model identifier (MBZUAI-IFM/K2-Think-v2)

## Testing

Tests live alongside source files as `*.test.ts`. Current test coverage (54 tests):
- `lib/validate.test.ts` — Type guard validation (10 tests)
- `lib/rate-limit.test.ts` — Rate limiter behavior (3 tests)
- `lib/tree-layout.test.ts` — Tree layout algorithm (7 tests)
- `lib/stream.test.ts` — `extractJSON` parser: direct JSON, `<think>` blocks, markdown fences, brace scanning (13 tests)
- `lib/sse.test.ts` — SSE stream forwarding, malformed chunk handling (6 tests)
- `lib/tree-utils.test.ts` — Tree manipulation: findNodeById, findChainToNode, addBranchesToNode, collectAllNodes, collapseNode (11 tests)
- `lib/storage.test.ts` — localStorage persistence: save timelines, history, deduplication (4 tests)

Run with: `npx vitest run` from `frontend/`

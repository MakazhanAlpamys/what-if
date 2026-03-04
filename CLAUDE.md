# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"What If...? Heritage" — an interactive alternate history simulator styled after Marvel's "What If...?". Users input a historical "what-if" scenario, and the K2 Think V2 reasoning model generates branching consequence trees visualized as an interactive timeline. The app features 6 game modes beyond free exploration: Butterfly Effect, History Detective, Fix History, Reality vs Alternative, World Map, and Timeline Editor.

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

Docker:
```bash
docker compose up        # Start with Docker (from repo root)
docker compose up --build  # Rebuild and start
```

## Architecture

```
User → Next.js Frontend (React Flow tree) → Next.js API Routes → K2 Think V2 API (SSE)
```

**All application code lives in `frontend/`**. There is no separate backend — Next.js API routes proxy requests to the K2 API, keeping the API key server-side via `.env.local`.

### Key directories

- `frontend/src/app/` — Pages and API routes (Next.js App Router)
  - `page.tsx` — Home page with scenario input + game mode selector
  - `timeline/page.tsx` — Free exploration timeline visualization
  - `butterfly/page.tsx` — Butterfly Effect game mode
  - `detective/page.tsx` — History Detective game mode
  - `fix-history/page.tsx` — Fix History game mode
  - `compare/page.tsx` — Reality vs Alternative split-screen
  - `map/page.tsx` — World Map geographic visualization
  - `editor/page.tsx` — Timeline Editor (user-built timelines)
  - `not-found.tsx` — Custom 404 page
  - `global-error.tsx` — Custom error page
- `frontend/src/app/api/` — API routes:
  - `generate/route.ts` — Generate initial timeline (SSE streaming)
  - `expand/route.ts` — Expand a branch deeper (SSE streaming)
  - `paradox/route.ts` — Detect paradoxes (non-streaming)
  - `butterfly/generate/route.ts` — Generate butterfly cascade (SSE)
  - `detective/generate/route.ts` — Generate detective puzzle (SSE)
  - `detective/check/route.ts` — Evaluate detective guess (non-streaming)
  - `fix-history/generate/route.ts` — Generate dystopian timeline (SSE)
  - `fix-history/evaluate/route.ts` — Evaluate fix attempt (non-streaming)
  - `compare/generate/route.ts` — Generate dual timelines (SSE)
  - `editor/critique/route.ts` — AI critique of user timeline (non-streaming)
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
  - `types.ts` — Core types + game mode types (see Core data types below)
  - `stream.ts` — Client-side SSE stream handlers for explore mode (`streamGenerate`, `streamExpand`)
  - `game-stream.ts` — Client-side SSE handlers for game modes (`streamButterfly`, `streamDetective`, `streamFixHistory`, `streamCompare`)
  - `tree-layout.ts` — Recursive tree → React Flow layout algorithm
  - `tree-utils.ts` — Tree manipulation utilities (`findNodeById`, `findChainToNode`, `addBranchesToNode`, `collapseNode`, `collectAllNodes`)
  - `sse.ts` — Shared server-side SSE streaming helper for API routes
  - `k2-api.ts` — K2 API abstraction (`getClientIP`, `getK2Config`, `validateScenario`, `fetchFromK2`, `streamFromK2`)
  - `rate-limit.ts` — In-memory rate limiter for API routes
  - `validate.ts` — Runtime type guards for core K2 API responses
  - `game-validate.ts` — Runtime type guards for game mode responses
  - `constants.ts` — Shared constants (`IMPACT_COLORS`, `IMPACT_LABELS`, `MAX_TREE_DEPTH`)
  - `storage.ts` — localStorage persistence (save timelines, scenario history, JSON export)
  - `game-storage.ts` — Game mode leaderboard persistence (butterfly/detective/fix-history scores)
  - `export-image.ts` — PNG/SVG export via `html-to-image`
  - `share.ts` — Timeline compression/sharing with `lz-string`
  - `sounds.ts` — Web Audio API sound manager (ambient drone, click, whoosh, portal, success, error, paradox, TTS)
  - `use-theme.ts` — Dark/light theme hook with localStorage persistence

### Game Modes

1. **Free Explore** (`/timeline?q=...`) — Original mode. Generate and explore branching timelines freely.
2. **Butterfly Effect** (`/butterfly?q=...`) — Enter a tiny change, AI maximizes cascade. Score = critical×20 + high×10 + medium×5. Leaderboard in localStorage.
3. **History Detective** (`/detective`) — AI generates a puzzle: shows final outcome, player guesses the cause. 3 hints available (-20 pts each). AI evaluates guess similarity (0-100).
4. **Fix History** (`/fix-history`) — AI generates dystopian timeline with one "wrong turn". Player clicks nodes to find and cut the bad branch in limited moves.
5. **Reality vs Alternative** (`/compare?q=...`) — Split-screen dual React Flow instances showing real vs alternate history with divergence/convergence points.
6. **World Map** (`/map?q=...`) — SVG world map with regions highlighted by event impact. Toggle between map and tree view. Region inference from event text.
7. **Timeline Editor** (`/editor`) — User builds timeline manually (add/edit/delete nodes). AI critique via `/api/editor/critique` scores plausibility (0-100) with specific issues.

### Data flow

1. Home page (`app/page.tsx`) takes scenario input + game mode selection via expandable card grid
2. Each mode routes to its own page: `/timeline`, `/butterfly`, `/detective`, `/fix-history`, `/compare`, `/map`, `/editor`
3. API routes stream SSE from K2 Think V2 with mode-specific system prompts enforcing structured JSON output
4. Client collects streamed text, extracts JSON via regex fallback (model may wrap in markdown/thinking)
5. Response is validated with mode-specific type guards (`isScenarioResponse`, `isButterflyResponse`, etc.)
6. `buildTreeLayout()` converts the recursive `TimelineNode` tree into React Flow nodes/edges
7. Game-specific interactions: scoring, hints, move counting, split-screen, map visualization, manual editing

### Core data types

`TimelineNode` is a recursive tree: each node has `id`, `year`, `title`, `description`, `impact` (critical/high/medium/low), `branches: TimelineNode[]`, and optional `region: string`.

Core response types:
- `ScenarioResponse` — `{ scenario, realHistory, timeline }`
- `ExpandResponse` — `{ branches: TimelineNode[] }`
- `ParadoxResponse` — `{ paradoxes: Paradox[] }`

Game mode response types:
- `ButterflyResponse` — `{ scenario, smallChange, timeline, butterflyScore }`
- `DetectiveResponse` — `{ finalOutcome, finalYear, correctAnswer, hints[], fullTimeline, difficulty }`
- `DetectiveCheckResponse` — `{ score, isCorrect, feedback, correctAnswer }`
- `FixHistoryResponse` — `{ scenario, dystopianTimeline, correctNodeId, idealOutcome, maxMoves }`
- `CompareResponse` — `{ scenario, realTimeline, altTimeline, divergencePoints[], convergencePoints[] }`
- `EditorCritiqueResponse` — `{ overall, score, issues[], suggestions[] }`

Score types (localStorage): `ButterflyScore`, `DetectiveScore`, `FixHistoryScore`

### SSE streaming pattern

All streaming API routes use the shared `createSSEStream()` helper from `lib/sse.ts`. Client-side uses `streamSSE()` generic helpers in `stream.ts` (explore mode) and `game-stream.ts` (game modes). All accept optional `AbortSignal` for cancellation.

### Security

- **Rate limiting**: 10 req/min for generate/butterfly/detective/fix-history/compare, 20 req/min for expand/detective-check/fix-eval, 5 req/min for paradox/editor-critique. In-memory store resets on serverless cold starts.
- **IP extraction**: Uses first entry from `x-forwarded-for` (split on comma)
- **Input validation**: Scenario max 2000 chars; chain array validated for structure and max depth 20
- **Security headers**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP (without `unsafe-eval`) in `next.config.ts`
- **Response validation**: Runtime type guards validate all K2 API responses before use
- **API key protection**: K2 API key is server-side only via `.env.local`, never exposed to client
- **Error sanitization**: K2 errors logged server-side, generic messages returned to client
- **ErrorBoundary**: Wraps the entire app to catch React rendering errors

### Keyboard Shortcuts

- `Ctrl+F` — Search timeline events
- `Ctrl+Z` — Undo last change
- `Ctrl+Shift+Z` / `Ctrl+Y` — Redo
- `Ctrl+S` — Save timeline to localStorage
- `Ctrl+E` — Export timeline as JSON
- `Delete` — Delete selected node (editor mode)
- `Escape` — Close detail panel / search / modals

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
- **Docker** — Dockerfile + docker-compose.yml for containerized deployment

## Environment Variables

Required in `frontend/.env.local` (see `.env.example` for template):
- `K2_API_KEY` — API key for K2 Think V2
- `K2_API_URL` — API endpoint (https://api.k2think.ai/v1/chat/completions)
- `K2_MODEL` — Model identifier (MBZUAI-IFM/K2-Think-v2)

## Testing

Tests live alongside source files as `*.test.ts`. Current test coverage (103 tests):
- `lib/validate.test.ts` — Type guard validation for core responses (10 tests)
- `lib/game-validate.test.ts` — Type guard validation for game mode responses (38 tests)
- `lib/rate-limit.test.ts` — Rate limiter behavior (3 tests)
- `lib/tree-layout.test.ts` — Tree layout algorithm (7 tests)
- `lib/stream.test.ts` — `extractJSON` parser: direct JSON, `<think>` blocks, markdown fences, brace scanning (13 tests)
- `lib/sse.test.ts` — SSE stream forwarding, malformed chunk handling (6 tests)
- `lib/tree-utils.test.ts` — Tree manipulation: findNodeById, findChainToNode, addBranchesToNode, collectAllNodes, collapseNode (11 tests)
- `lib/storage.test.ts` — localStorage persistence: save timelines, history, deduplication (4 tests)
- `lib/game-storage.test.ts` — Game leaderboard persistence: butterfly/detective/fix-history scores, sorting, limits (11 tests)

Run with: `npx vitest run` from `frontend/`

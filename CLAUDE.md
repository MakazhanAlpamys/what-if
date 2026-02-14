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
- `frontend/src/components/` — React components (TimelineNode, DetailPanel, ErrorBoundary)
- `frontend/src/lib/` — Shared utilities:
  - `types.ts` — Core types (`TimelineNode`, `ScenarioResponse`, `ExpandResponse`)
  - `stream.ts` — Client-side SSE stream handlers (`streamGenerate`, `streamExpand`)
  - `tree-layout.ts` — Recursive tree → React Flow layout algorithm
  - `sse.ts` — Shared server-side SSE streaming helper for API routes
  - `rate-limit.ts` — In-memory rate limiter for API routes
  - `validate.ts` — Runtime type guards for K2 API responses
  - `constants.ts` — Shared constants (`IMPACT_COLORS`, `IMPACT_LABELS`, `MAX_TREE_DEPTH`)

### Data flow

1. Home page (`app/page.tsx`) takes scenario input, routes to `/timeline?q=<scenario>`
2. Timeline page (`app/timeline/page.tsx`) calls `streamGenerate()` which POSTs to `/api/generate`
3. API route streams SSE from K2 Think V2 with a system prompt enforcing structured JSON output
4. Client collects streamed text, extracts JSON via regex fallback (model may wrap in markdown/thinking)
5. Response is validated with `isScenarioResponse()` / `isExpandResponse()` type guards
6. `buildTreeLayout()` converts the recursive `TimelineNode` tree into React Flow nodes/edges
7. Clicking a node opens DetailPanel; "Explore deeper" triggers `streamExpand()` → `/api/expand` to generate sub-branches
8. Tree expansion is limited to `MAX_TREE_DEPTH` (5) levels to prevent performance issues

### Core data type

`TimelineNode` is a recursive tree: each node has `id`, `year`, `title`, `description`, `impact` (critical/high/medium/low), and `branches: TimelineNode[]`. The two API response types are `ScenarioResponse` (wraps root timeline + realHistory) and `ExpandResponse` (new branches array).

### SSE streaming pattern

Both API routes (`/api/generate`, `/api/expand`) use the shared `createSSEStream()` helper from `lib/sse.ts`. It reads K2's SSE response, extracts content deltas, and forwards them to the client. The client-side `stream.ts` buffers lines, parses `data:` prefixed SSE events, accumulates full text, then extracts and validates JSON on `[DONE]`.

### Security

- **Rate limiting**: Both API routes use in-memory rate limiting (`lib/rate-limit.ts`): 10 req/min for generate, 20 req/min for expand
- **Security headers**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy configured in `next.config.ts`
- **Response validation**: K2 responses are validated with runtime type guards before use
- **API key protection**: K2 API key is server-side only via `.env.local`, never exposed to client
- **ErrorBoundary**: Wraps the entire app to catch React rendering errors gracefully

## Tech Stack

- **Next.js 16** with App Router and React Compiler enabled (`reactCompiler: true` in next.config.ts)
- **React 19** with hooks-based state management (no external state library)
- **TypeScript 5** (strict mode, `@/*` path alias → `./src/*`)
- **@xyflow/react** (React Flow) for interactive tree visualization
- **Framer Motion** for animations
- **Tailwind CSS 4** via `@tailwindcss/postcss`
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

Tests live alongside source files as `*.test.ts`. Current test coverage:
- `lib/validate.test.ts` — Type guard validation (10 tests)
- `lib/rate-limit.test.ts` — Rate limiter behavior (3 tests)
- `lib/tree-layout.test.ts` — Tree layout algorithm (4 tests)

Run with: `npx vitest run` from `frontend/`

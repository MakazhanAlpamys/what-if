# What If...? Heritage

Interactive alternate history simulator styled after Marvel's "What If...?". Enter a historical what-if scenario and watch branching timelines of consequences unfold, powered by K2 Think V2.

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your K2 API credentials
```

### Development

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm run format     # Prettier format
npm run test       # Run tests
```

## Architecture

```
User → Next.js Frontend (React Flow tree) → Next.js API Routes → K2 Think V2 API (SSE)
```

All application code lives in `frontend/`. Next.js API routes proxy requests to the K2 API, keeping the API key server-side.

### Key directories

| Directory         | Purpose                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| `src/app/`        | Pages and API routes (Next.js App Router)                                 |
| `src/components/` | React components (TimelineNode, DetailPanel, ErrorBoundary, Spinner)      |
| `src/lib/`        | Shared types, SSE stream handling, tree layout, validation, rate limiting |

### Data flow

1. Home page takes scenario input, routes to `/timeline?q=<scenario>`
2. Timeline page streams generation from `/api/generate` via SSE (with `AbortController` for cancellation)
3. API route validates input (max 2000 chars), rate-limits, and proxies to K2 Think V2
4. Client collects streamed text, extracts and validates JSON (handles `<think>` blocks, markdown fences)
5. `buildTreeLayout()` converts the recursive tree into React Flow nodes/edges
6. Clicking a node opens DetailPanel (with focus trap + Escape to close); "Explore deeper" generates sub-branches via `/api/expand`
7. Tree expansion is limited to `MAX_TREE_DEPTH` (5) levels to prevent performance issues

## Tech Stack

- **Next.js 16** (App Router, React Compiler)
- **React 19**
- **TypeScript 5** (strict mode)
- **@xyflow/react** (React Flow) — interactive tree visualization
- **Framer Motion** — animations
- **Tailwind CSS 4**
- **Vitest** — testing
- **K2 Think V2** — AI reasoning model

## Security

- **Rate limiting**: 10 req/min (generate), 20 req/min (expand) per IP
- **Input validation**: Scenario max 2000 chars; chain array validated for structure and depth
- **Security headers**: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **API key protection**: Server-side only, never exposed to client
- **Error sanitization**: Internal errors logged server-side, generic messages returned to client
- **Response validation**: Runtime type guards validate all K2 API responses

## Testing

```bash
npx vitest run           # 36 tests across 5 test files
npx tsc --noEmit         # Type check
npx prettier --check .   # Format check
```

Test coverage:

- `validate.test.ts` — Type guards (10 tests)
- `stream.test.ts` — JSON extraction from LLM output (13 tests)
- `sse.test.ts` — SSE stream forwarding (6 tests)
- `tree-layout.test.ts` — Tree layout algorithm (4 tests)
- `rate-limit.test.ts` — Rate limiter behavior (3 tests)

## Environment Variables

See `.env.example` for required variables.

## License

Private

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
| `src/components/` | React components (TimelineNode, DetailPanel, ErrorBoundary)               |
| `src/lib/`        | Shared types, SSE stream handling, tree layout, validation, rate limiting |

### Data flow

1. Home page takes scenario input, routes to `/timeline?q=<scenario>`
2. Timeline page streams generation from `/api/generate` via SSE
3. API route proxies to K2 Think V2 with structured JSON system prompt
4. Client collects streamed text, extracts and validates JSON
5. `buildTreeLayout()` converts the recursive tree into React Flow nodes/edges
6. Clicking a node opens DetailPanel; "Explore deeper" generates sub-branches via `/api/expand`

## Tech Stack

- **Next.js 16** (App Router, React Compiler)
- **React 19**
- **TypeScript 5** (strict mode)
- **@xyflow/react** (React Flow) — interactive tree visualization
- **Framer Motion** — animations
- **Tailwind CSS 4**
- **Vitest** — testing
- **K2 Think V2** — AI reasoning model

## Environment Variables

See `.env.example` for required variables.

## License

Private

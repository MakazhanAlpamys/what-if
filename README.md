# What If...? Heritage

> Interactive alternate history simulator styled after Marvel's "What If...?"

Enter a historical what-if scenario and watch branching timelines of consequences unfold — powered by [K2 Think V2](https://k2think.ai) reasoning model. Features 6 game modes for different ways to explore alternate history.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-Private-red)

## How It Works

1. **Enter a scenario** — "What if the Roman Empire never fell?" or any historical what-if
2. **AI generates a timeline tree** — K2 Think V2 reasons through cause-and-effect chains and produces branching consequences
3. **Explore interactively** — Click nodes to see details, expand branches to go deeper (up to 5 levels)
4. **Compare with reality** — Each scenario includes what actually happened in real history
5. **Detect paradoxes** — AI analyzes your timeline for logical contradictions and impossible sequences
6. **Save & share** — Save timelines, export as JSON/PNG/SVG, or share via URL
7. **Play game modes** — Butterfly Effect, History Detective, Fix History, Reality vs Alternative, World Map, Timeline Editor

## Game Modes

| Mode | Description | Input |
|------|-------------|-------|
| **Free Explore** | Generate and explore branching timelines freely | Scenario text |
| **Butterfly Effect** | Enter a tiny change, watch it cascade into world-altering events. Scored by impact! | Small change text |
| **History Detective** | AI shows a surprising final outcome — guess what initial event caused it | Auto-generated |
| **Fix History** | Dystopian timeline puzzle — find and cut the wrong branch in minimum moves | Auto-generated |
| **Reality vs Alternative** | Split-screen comparison of real history vs your alternate timeline | Scenario text |
| **World Map** | Geographic impact visualization on an interactive SVG world map | Scenario text |
| **Timeline Editor** | Build your own timeline from scratch, AI critiques plausibility | Manual creation |

## Features

- **Branching timeline tree** — Interactive visualization with zoom, pan, and minimap
- **6 game modes** — Butterfly Effect, History Detective, Fix History, Compare, World Map, Editor
- **Real-time AI streaming** — SSE streaming shows the timeline as it generates
- **Scoring & leaderboards** — Game modes track scores in localStorage
- **Paradox detection** — AI-powered analysis of logical contradictions in alternate timelines
- **Split-screen compare** — Dual React Flow instances for reality vs alternative
- **Geographic visualization** — SVG world map with region-based impact display
- **Timeline editor** — Manual creation with AI plausibility critique
- **Sound system** — Ambient audio, click sounds, whoosh effects, portal tones, TTS read-aloud
- **Image export** — Export timeline as PNG or SVG
- **Timeline sharing** — Compress and share timelines via URL (lz-string encoding)
- **Dark / light theme** — Toggle between themes, persisted in localStorage
- **Starfield background** — Canvas-based parallax animation with mouse tracking
- **Timeline search** — Filter nodes by keyword with Ctrl+F
- **Undo / redo** — Full undo/redo stack for branch expansions and collapses
- **Save & export** — Save timelines to localStorage, export as JSON/PNG/SVG
- **Scenario history** — Previously explored scenarios shown on the home page
- **Mobile-optimized** — Responsive toolbar menu for smaller screens
- **Keyboard shortcuts** — Ctrl+F (search), Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo), Ctrl+S (save), Ctrl+E (export), Escape (close panels)

## Architecture

```
User → Next.js Frontend (React Flow tree) → Next.js API Routes → K2 Think V2 API (SSE)
```

All application code lives in [`frontend/`](frontend/). There is no separate backend — Next.js API routes proxy requests to the K2 API, keeping the API key server-side.

### Project Structure

```
what-if/
├── .claude/                        # Claude Code settings
├── .github/workflows/ci.yml       # CI pipeline (lint, format, typecheck, test, build)
├── CLAUDE.md                       # AI assistant guidance
├── Dockerfile                      # Docker containerization
├── docker-compose.yml              # Docker Compose config
├── frontend/
│   ├── .env.example                # Required environment variables template
│   ├── next.config.ts              # Next.js config (React Compiler, security headers, CSP)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                  # Home — scenario input + game mode selector
│   │   │   ├── timeline/page.tsx         # Free Explore — interactive tree visualization
│   │   │   ├── butterfly/page.tsx        # Butterfly Effect — cascade scoring game
│   │   │   ├── detective/page.tsx        # History Detective — reverse-detective puzzle
│   │   │   ├── fix-history/page.tsx      # Fix History — dystopian timeline repair
│   │   │   ├── compare/page.tsx          # Reality vs Alternative — split-screen
│   │   │   ├── map/page.tsx              # World Map — geographic visualization
│   │   │   ├── editor/page.tsx           # Timeline Editor — manual creation + AI critique
│   │   │   ├── api/generate/route.ts     # POST — generate initial timeline (SSE)
│   │   │   ├── api/expand/route.ts       # POST — expand a branch deeper (SSE)
│   │   │   ├── api/paradox/route.ts      # POST — detect paradoxes
│   │   │   ├── api/butterfly/generate/   # POST — butterfly cascade (SSE)
│   │   │   ├── api/detective/generate/   # POST — detective puzzle (SSE)
│   │   │   ├── api/detective/check/      # POST — evaluate guess
│   │   │   ├── api/fix-history/generate/ # POST — dystopian timeline (SSE)
│   │   │   ├── api/fix-history/evaluate/ # POST — evaluate fix attempt
│   │   │   ├── api/compare/generate/     # POST — dual timelines (SSE)
│   │   │   ├── api/editor/critique/      # POST — AI critique of user timeline
│   │   │   ├── not-found.tsx             # Custom 404
│   │   │   └── global-error.tsx          # Global error boundary
│   │   ├── components/
│   │   │   ├── TimelineNode.tsx      # Custom React Flow node with particle burst
│   │   │   ├── DetailPanel.tsx       # Side panel with event details + TTS
│   │   │   ├── SearchBar.tsx         # Timeline search with Ctrl+F
│   │   │   ├── SavedTimelinesModal.tsx # Load/delete saved timelines
│   │   │   ├── SoundToggle.tsx       # Mute/unmute sound system
│   │   │   ├── ToolbarMenu.tsx       # Responsive mobile toolbar menu
│   │   │   ├── ConfirmDialog.tsx     # Reusable confirmation modal
│   │   │   ├── Starfield.tsx         # Canvas parallax starfield background
│   │   │   ├── ThemeToggle.tsx       # Dark/light mode toggle
│   │   │   ├── ErrorBoundary.tsx     # React error boundary
│   │   │   ├── ErrorIcon.tsx         # SVG error icon
│   │   │   └── Spinner.tsx           # Shared loading spinner
│   │   └── lib/
│   │       ├── types.ts              # Core types + game mode types
│   │       ├── stream.ts             # Client-side SSE handlers (explore mode)
│   │       ├── game-stream.ts        # Client-side SSE handlers (game modes)
│   │       ├── sse.ts                # Server-side SSE streaming helper
│   │       ├── k2-api.ts             # K2 API abstraction
│   │       ├── tree-layout.ts        # Recursive tree → React Flow layout
│   │       ├── tree-utils.ts         # Tree manipulation utilities
│   │       ├── storage.ts            # localStorage persistence + JSON export
│   │       ├── game-storage.ts       # Game leaderboard persistence
│   │       ├── validate.ts           # Runtime type guards (core)
│   │       ├── game-validate.ts      # Runtime type guards (game modes)
│   │       ├── export-image.ts       # PNG/SVG export
│   │       ├── share.ts              # Timeline compression/sharing
│   │       ├── sounds.ts             # Web Audio API sound manager + TTS
│   │       ├── rate-limit.ts         # In-memory rate limiter
│   │       ├── use-theme.ts          # Dark/light theme hook
│   │       └── constants.ts          # Impact colors/labels, MAX_TREE_DEPTH
│   └── public/
│       └── favicon.svg
└── README.md                       # ← You are here
```

## Quick Start

### Prerequisites

- **Node.js 18+** and **npm**
- **K2 Think V2 API key** — get one at [k2think.ai](https://k2think.ai)

### Setup

```bash
cd frontend
npm install
cp .env.example .env.local
```

Edit `frontend/.env.local` with your credentials:

```env
K2_API_KEY=your-api-key-here
K2_API_URL=https://api.k2think.ai/v1/chat/completions
K2_MODEL=MBZUAI-IFM/K2-Think-v2
```

### Run

```bash
npm run dev        # Start dev server → http://localhost:3000
```

### Docker

```bash
# From repo root
docker compose up --build    # Build and start → http://localhost:3000
```

Make sure to set environment variables in `docker-compose.yml` or via `.env` file at the repo root.

### Other Commands

```bash
npm run build      # Production build
npm start          # Start production server
npm run lint       # ESLint
npm run format     # Prettier format
npm test           # Run tests (Vitest)
```

## Tech Stack

| Layer           | Technology                     | Purpose                                   |
| --------------- | ------------------------------ | ----------------------------------------- |
| Framework       | Next.js 16 (App Router)        | SSR, API routes, React Compiler           |
| UI              | React 19 + TypeScript 5        | Strict mode, hooks-based state            |
| Visualization   | @xyflow/react (React Flow)     | Interactive tree with zoom/pan            |
| Animation       | Framer Motion                  | Smooth transitions, node appearance       |
| Styling         | Tailwind CSS 4                 | Dark cosmic theme                         |
| Export          | html-to-image                  | PNG/SVG timeline export                   |
| Sharing         | lz-string                      | Timeline compression for URL sharing      |
| AI Model        | K2 Think V2                    | Chain-of-thought reasoning, structured JSON |
| Testing         | Vitest                         | 103 tests across 9 test files             |
| Code Quality    | ESLint 9 + Prettier            | Flat config, Tailwind plugin              |
| Git Hooks       | Husky + lint-staged            | Pre-commit lint & format                  |
| CI              | GitHub Actions                 | Lint → format → typecheck → test → build  |
| Container       | Docker + Docker Compose        | Containerized deployment                  |

## Security

- **Rate limiting** — Per-IP limits: 10/min (generate, game modes), 20/min (expand, evaluations), 5/min (paradox, critique)
- **Input validation** — Scenario max 2000 chars; chain array validated for structure and depth (max 20)
- **Security headers** — CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **API key protection** — Server-side only via `.env.local`, never exposed to client
- **Error sanitization** — K2 errors logged server-side, generic messages returned to client
- **Response validation** — Runtime type guards validate all K2 API responses before use
- **Accessibility** — Keyboard navigation, ARIA labels, focus trap on detail panel

## Testing

```bash
cd frontend
npx vitest run           # 103 tests
npx tsc --noEmit         # Type check
npx prettier --check .   # Format check
```

| Test File                 | What it covers                                                | Tests |
| ------------------------- | ------------------------------------------------------------- | ----- |
| `validate.test.ts`        | Type guards for ScenarioResponse, ExpandResponse, Paradox     | 10    |
| `game-validate.test.ts`   | Type guards for all game mode responses (7 validators)        | 38    |
| `stream.test.ts`          | `extractJSON` — direct JSON, `<think>` blocks, markdown fences | 13    |
| `tree-utils.test.ts`      | Tree manipulation: find, chain, expand, collapse, collect     | 11    |
| `game-storage.test.ts`    | Game leaderboards: butterfly/detective/fix-history scores      | 11    |
| `tree-layout.test.ts`     | Tree layout algorithm, edge generation, selected state        | 7     |
| `sse.test.ts`             | SSE stream forwarding, malformed chunk handling               | 6     |
| `storage.test.ts`         | localStorage persistence, history, JSON export                | 4     |
| `rate-limit.test.ts`      | Rate limiter allow/block/remaining behavior                   | 3     |

## Core Data Model

`TimelineNode` — a recursive tree structure:

```typescript
interface TimelineNode {
  id: string;
  year: number;
  title: string;
  description: string;
  impact: "critical" | "high" | "medium" | "low";
  branches: TimelineNode[];
  region?: string;  // Geographic region for map mode
}
```

The K2 model returns different response types per mode:

**Core:**
- `ScenarioResponse` — `{ scenario, realHistory, timeline: TimelineNode }`
- `ExpandResponse` — `{ branches: TimelineNode[] }`
- `ParadoxResponse` — `{ paradoxes: Paradox[] }`

**Game modes:**
- `ButterflyResponse` — `{ scenario, smallChange, timeline, butterflyScore }`
- `DetectiveResponse` — `{ finalOutcome, finalYear, correctAnswer, hints[], fullTimeline, difficulty }`
- `CompareResponse` — `{ scenario, realTimeline, altTimeline, divergencePoints[], convergencePoints[] }`
- `FixHistoryResponse` — `{ scenario, dystopianTimeline, correctNodeId, idealOutcome, maxMoves }`
- `EditorCritiqueResponse` — `{ overall, score, issues[], suggestions[] }`

## CI/CD

GitHub Actions runs on every push and PR to `main`:

1. Install dependencies
2. Lint (ESLint)
3. Format check (Prettier)
4. Type check (TypeScript)
5. Test (Vitest)
6. Build (Next.js production)

## License

Private

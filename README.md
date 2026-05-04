# Agora - AI-Powered Debate Platform

A real-time web application for competitive academic debates against AI opponents. Supports multiple debate formats (AP & BP), live audio I/O, AI adjudication, and comprehensive performance analytics.

## What is Agora?

**Agora** is a full-stack debate platform that simulates real academic debate tournaments with:
- **AI Opponents**: Groq-powered LLMs debating in real-time
- **Multiple Formats**: Asian Parliamentary (AP) and British Parliamentary (BP)
- **Live Audio**: Real-time microphone capture and AI voice synthesis via Deepgram
- **AI Adjudication**: 5-phase evaluation pipeline matching WUDC (World Universities Debating Championship) standards
- **Analytics Dashboard**: Comprehensive performance tracking and debate history

Users compete in structured debates, receive detailed scoring from an AI Chief Adjudicator, and track their debate skills over time.

---

## Core Features

### 1. **Multi-Format Debate Support**
- **AP (Asian Parliamentary)**: 6 speakers (PM, LO, DPM, DLO, Gov Whip, Opp Whip)
- **BP (British Parliamentary)**: 8 speakers (Opening/Closing teams with Members)
- Format-specific rules and scoring automatically enforced

### 2. **AI-Powered Opponent**
- Debates against human users in real-time
- Forced stance injection (affirm/negate based on team assignment)
- WUDC-aligned role constraints (PM sets frame, Whips weigh clashes, etc.)
- Streamed speech via WebSocket (token-by-token rendering with typewriter effect)

### 3. **Case Preparation Module**
- AI generates debate case brief before live match
- Includes arguments, counter-arguments, and sourced evidence
- Mirrors real-world tournament prep (15-30 min review period)
- Gives human debater strategic advantage vs. cold match

### 4. **Live Debate Arena**
- **Real-time audio streaming**: 250ms chunks via MediaRecorder
- **Turn-based speaking**: Automated turn management with role indicators
- **Progressive text rendering**: AI speech appears word-by-word as it generates
- **Points of Information (POI)**: Accept/decline POI offers mid-speech
- **Audio controls**: Play, pause, skip, progress bar with animation
- **Live transcript**: Full debate log visible to user
- **Auto-redirect**: Results appear ~40-60 seconds after debate conclusion

### 5. **AI Adjudication Pipeline** (5-Phase)
**Phase 1 - Clash Extraction**: Identifies 3-5 macro-clashes (core themes)
**Phase 2 - Weighted Matrix**: Assigns weight (importance) and delta (winner) to each clash
**Phase 3 - Logic Scoring**: Calculates net logic score from clash weights
**Phase 4 - WUDC Pillars**: Grades debate on Matter, Manner, Method, Role (each /25)
**Phase 5 - Summary**: Outputs final adjudication statement + key decisions

Scoring includes anti-affirmative-bias guardrails and quote-based speaker feedback.

### 6. **User Dashboard & Analytics**
- **Quick stats**: Total debates, wins, losses, win rate, avg score, best score
- **Recent matches**: Last 5 debates (both formats)
- **Per-speaker grades**: Argument, evidence, responsiveness, structure, persona scores
- **Trend tracking**: Win rate and performance over time

### 7. **Full Match History**
- Complete record of all debates (up to 50+ matches)
- Filterable by format (AP/BP)
- Status indicators (completed, in-progress, awaiting adjudication)
- Sortable by date with local timezone

### 8. **User Profiles**
- Display name, institution, country, avatar
- Personal statistics and performance trends
- Edit/update profile information
- Secure logout

### 9. **Authentication**
- Email/password login
- OAuth (Google, GitHub)
- Supabase-powered session management
- JWT-based API authorization
- SSR middleware protection

---

## User Journey

```
LANDING PAGE
    ↓
SIGNUP / LOGIN (Supabase Auth)
    ↓
DASHBOARD (view stats, recent matches)
    ↓
DEBATE SETUP
    ├─ Choose format (AP or BP)
    ├─ Select role (determines team: Government/Opposition)
    ├─ Enter motion (debate topic)
    └─ Choose difficulty level
    ↓
CASE PREPARATION
    ├─ AI generates brief
    ├─ Review arguments & evidence
    └─ Click "Enter the Arena"
    ↓
LIVE DEBATE ARENA
    ├─ Toggle microphone to speak
    ├─ Receive AI opponent responses (streaming)
    ├─ Accept/decline Points of Information
    ├─ View live transcript
    └─ Continue turns until match ends
    ↓
RESULTS & ADJUDICATION
    ├─ View clash analysis
    ├─ See WUDC pillar breakdown
    ├─ Read speaker scores & feedback
    ├─ Read chief adjudicator's summary
    └─ Return to dashboard
```

---

## Pages/Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page with product overview |
| `/auth/login` | Email/OAuth login |
| `/auth/signup` | Account creation |
| `/auth/callback` | OAuth callback handler |
| `/dashboard` | User hub (stats, recent matches, quick actions) |
| `/debate/setup` | Debate configuration (format, role, motion, difficulty) |
| `/debate/[matchId]/prep` | Case preparation review |
| `/debate/[matchId]` | **Live arena** (real-time debate) |
| `/results/[matchId]` | Adjudication + scoring breakdown |
| `/history` | Full match history with filters |
| `/profile` | User profile + settings |

---

## Tech Stack

**Frontend Framework**
- Next.js 16 (App Router, SSR)
- React 19 (functional components)
- TypeScript

**State & Data**
- Zustand (WebSocket + audio queue management)
- Supabase SSR client (authentication)
- React Hooks

**UI & Styling**
- Tailwind CSS 4
- shadcn/ui component library
- Radix UI (accessible primitives)
- Framer Motion (animations)
- Lucide React (icons)

**Media & Real-time**
- Web Audio API (audio playback queue)
- MediaRecorder API (microphone capture)
- WebSocket (live debate streaming)
- Deepgram (speech synthesis)

**Backend Integration**
- REST API (match setup, results)
- WebSocket (live debate + AI tokens)
- Supabase Auth (JWT tokens)

---

## Key Architectural Patterns

### **Thick Client State** 
WebSocket and audio queues live in Zustand (`arenaStore.ts`), decoupled from React component lifecycle. This prevents audio loss or connection drops when navigating away from the debate page.

### **Client-Only Live Arena**
The debate page uses `"use client"` because it requires browser APIs (`navigator.mediaDevices`, `window.AudioContext`) unavailable in SSR.

### **Progressive Text Rendering**
AI responses stream token-by-token. Frontend appends each word immediately without waiting for the full response, creating a natural typewriter effect.

### **Audio Queue Management**
Multiple audio buffers from the backend are queued sequentially and played without clipping or gaps. Queue processing happens via `window.AudioContext.createBufferSource()`.

### **SSR Middleware Protection**
`middleware.ts` intercepts all routes and blocks unauthenticated access to private pages via Supabase JWT verification.

---

## File Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # Landing page
│   ├── auth/                    # Authentication routes
│   ├── dashboard/               # User dashboard
│   ├── debate/
│   │   ├── setup/              # Debate configuration
│   │   └── [matchId]/          # Live arena + case prep
│   ├── results/[matchId]/       # Adjudication results
│   ├── history/                # Match history
│   ├── profile/                # User profile
│   └── layout.tsx              # Root layout with providers
│
├── components/
│   ├── ui/                      # shadcn/ui components (buttons, cards, etc.)
│   └── providers/               # Context wrappers (AuthProvider)
│
├── store/
│   └── arenaStore.ts           # Zustand global state (WebSocket, audio)
│
├── lib/
│   ├── api.ts                  # HTTP client for REST endpoints
│   ├── supabase/               # Supabase client & utilities
│   └── utils.ts                # Helper functions
│
├── hooks/
│   └── useArena.ts             # Custom hook for arena state
│
└── middleware.ts                # SSR auth middleware
```

---

## Development

### Installation

```bash
npm install
npm run dev
```

### Environment Variables (`.env.local`)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Scripts

- `npm run dev` — Start development server (`http://localhost:3000`)
- `npm run build` — Build production bundle + type check
- `npm start` — Run production server
- `npm run lint` — Run ESLint

### Live Debate Data Flow

```
User Microphone
    ↓ (MediaRecorder captures 250ms chunks)
WebSocket.send(binary)
    ↓ (Backend processes → AI responds)
WebSocket.onmessage(binary audio)
    ↓ (Frontend queues audio)
Web Audio API
    ↓ (Sequential playback via BufferSource)
User Speakers
```

---

## Architecture Highlights

### **State Management**
- Global: Zustand (`arenaStore`) for WebSocket + audio
- Local: React hooks for form inputs, UI toggles
- Server: Next.js SSR for auth context

### **Authentication Flow**
1. User signs up/logs in via Supabase
2. JWT token stored in secure httpOnly cookie
3. Middleware validates token on every request
4. API calls include JWT in Authorization header

### **Live Debate Flow**
1. Frontend connects WebSocket with JWT
2. Backend streams debate state (`TURN_STARTED`, `AI_TOKEN`, `TURN_ENDED`)
3. Frontend renders tokens progressively + manages audio queue
4. User microphone input streamed to backend in 250ms chunks
5. Debate concludes → results auto-redirect after adjudication

---

## Deployment

Optimized for Vercel (auto-detects Next.js):

```bash
npm run build
vercel deploy
```

Environment variables must be set in Vercel dashboard. Requires backend API and Supabase project already running.

---

## Documentation

- `agora-frontend-architecture.md` — Detailed system design, rebuild guide, execution flow
- `CLAUDE.md` / `AGENTS.md` — Custom agent configurations for code generation

---

## Tech Requirements

- Node.js 18+
- npm or yarn
- Modern browser with WebSocket support (Chrome, Firefox, Safari, Edge)
- Microphone + speakers (for live debate)

---

## License

Proprietary. All rights reserved.

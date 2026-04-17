# Agora Frontend – Production Architecture & Rebuild Guide

This document provides a comprehensive, FAANG-grade architectural analysis of the **Agora Frontend** repository built with Next.js and React. It details how the web application functions internally, how it interacts with the broader distributed system, and provides a step-by-step rebuilding guide.

---

## 1. Repository Role in Overall System

The `agora-frontend` provides the **visual interface, real-time client state management, and media-capture bridge** for the Agora real-time debate platform. Where the Go Gateway handles multiplexing and the Python Engine processes intelligence, the Next.js frontend physically connects the human speaker to the cloud.

### Pipeline Context
`User Microphone (MediaRecorder API) → [ THIS NEXT.JS FRONTEND ] → WebSocket (BinaryBlobs) → Go Gateway → STT`
`Go Gateway (TTS Audio) → WebSocket (BinaryBlobs) → [ THIS NEXT.JS FRONTEND ] → User Speakers (Web Audio API)`

### Core Responsibilities
1. **Real-time DOM Rendering**: Subscribes dynamically to inbound Websocket JSON text tokens (`AI_TOKEN`) and progressively displays them (Typewriter effect) via React state architectures.
2. **Streaming Audio Ingress**: Captures local device microphones and streams 250ms byte chunks through the active WSS connection without storing locally.
3. **Sequential Audio Egress**: Receives and decodes inbound arrays of binary audio buffers. Uses the Web Audio API to create a queue, ensuring back-to-back AI voice playback without audio clipping.
4. **Session Authentication Hooks**: Connects strictly to Supabase Auth. Appends JWT bearer signatures on both HTTPS API calls and WebSocket connection URLs.

### Data Contracts
- **Inputs**: User Interaction (Clicks, Microphones, Routing Context).
- **Outputs**: Authenticated JWT tokens, Rest POST payloads, live Websocket events.

---

## 2. Full Folder & File Breakdown

### Root Directory
- `middleware.ts`: Next.js middleware trapping all ingress edge-requests. Confirms `@supabase/ssr` contexts to block unauthenticated views to private routes.
- `package.json` / `components.json`: Node dependencies and component metadata.

### `src/` - Application Core

#### `src/app/` - Next.js App Router Structure
- `page.tsx`: Marketing landing page (`/`).
- `auth/`: Native login/signup layout routes redirecting tokens.
- `debate/setup/`: Configuration route posting debate schemas (Motion, Side, Format).
- `debate/[matchId]/`: The **Live Arena**. Contains the `page.tsx` UI displaying the transcript and audio control dashboard.
- `results/`: End-of-match page calling `GET /api/v1/debates/{id}/results`.

#### `src/store/` - UI State Management
- `arenaStore.ts`: Global application state manager (Zustand). Encapsulates the entire complexity of the WebSocket connection and JSON buffer mapping ensuring React unmounts do not sever the active debate.

#### `src/hooks/` & `src/lib/` 
- `lib/api.ts`: Consolidated fetch actions interacting directly with `process.env.NEXT_PUBLIC_API_BASE_URL` (The Go proxy!).
- `lib/supabase/`: Web clients executing JWT retrievals.

#### `src/components/` - Presentational Layers
- `ui/`: Standardized, tailwind-styled atom components (Buttons, Badges).
- `providers/`: Context wrappers (specifically `AuthProvider`) syncing layout logic with Supabase verification.

---

## 3. Internal Architecture

The application adopts a **Thick Client / Decoupled Socket** pattern:

1. **Zustand Over Local State**: The WebSocket lifecycle is disconnected from the React Component Lifecycle. By elevating the `socket` and `audioQueue` instances to the Zustand `useArenaStore`, navigating away from a UI element doesn't arbitrarily abort a live streaming connection or drop audio chunks mid-sentence.
2. **Server-Side Routing / Client-Side Streaming**: Uses SSR (Server Side Rendering) where beneficial (auth and dashboard pages) while isolating the `<LiveArenaPage>` strictly to Client Components (`"use client"`) due to dependencies on the browser's native `navigator.mediaDevices` context scope.
3. **Framer-Motion Transitions**: Employs mathematically modeled spring animations to shift the Document Object Model fluidly as AI text generates instead of allowing raw CSS heights to snap violently.

---

## 4. Execution Flow (Step-by-Step)

### A. Entering the Match
1. Authenticated user clicks "Start Match" on `/debate/setup`.
2. `lib/api.ts` POSTs to `/api/v1/matches`. 
3. User is routed dynamically to `/debate/[matchId]`.
4. `useArenaStore.connect()` is fired within `useEffect`, passing the match ID and JWT.
5. Socket `onopen` automatically publishes `{"action": "START_MATCH"}` into the websocket immediately.

### B. The AI Generates (Frontend Display)
1. Store intercepts incoming string. `JSON.parse` identifies `{"event": "AI_TOKEN", "text": "word"}`.
2. Store mutates state: `aiBufferedText += "word"`.
3. React evaluates state change and injects DOM updates natively inside the Framer Motion shimmer blocks.
4. Concurrently, the WebSocket yields a `Blob`. 
5. The `onmessage` hook extracts the `.arrayBuffer()` and pushes it to `audioQueue`.
6. Store triggers `processAudioQueue()`, which leverages `window.AudioContext` to construct buffer playback sequential links to system speakers.

### C. The Human Reacts (Streaming Out)
1. User clicks the Mic Button (`toggleMic()`).
2. Frontend triggers browser hardware prompt `navigator.mediaDevices.getUserMedia`.
3. Initiates `MediaRecorder` targeting `audio/webm`. Streams data availability at 250ms chunks (`recorder.start(250)`).
4. Forwards exact chunks recursively over the socket via `socket.send(e.data)`.
5. Human issues POI via "Offer POI" button. Triggers `window.prompt` and fires JSON `{"action": "POI_OFFERED", "text": "..."}`.

### D. Concluding Turns
1. User taps "End Turn". `MediaRecorder` halts track processes natively to free hardware binding.
2. Websocket blasts `{"action": "END_TURN"}` JSON command back to the Go Gateway tracking service.

---

## 5. Data Flow & State Management

**Strict Interface Typings (`arenaStore.ts`)**:
```typescript
export interface ArenaEvent {
  event: EventType;
  speaker?: "ai" | "human";
  text?: string;
}
```
State flows perfectly top-down. The React UI never commands the state machine directly without using encapsulated actions (`sendEvent`, `addTranscriptEntry`). 
The `transcript: TranscriptEntry[]` array maintains full history for rendering, while `aiBufferedText` specifically scopes the volatile real-time generation text. 

---

## 6. Real-Time Streaming Logic

**Web Audio Context Processing**:
The web browser needs a rigorous audio pipeline because chunked AI voice pieces overlap. The store uses linked promises:
```typescript
processAudioQueue: () => {
    // Escape if busy or empty
    if (state.isPlayingAudio || state.audioQueue.length === 0) return;
    set({ isPlayingAudio: true });

    // Decode and route directly to speakers
    audioCtx.decodeAudioData(buffer, (decodedData) => {
      // ...
      source.onended = () => { // Pop array, recursive chain call
        set((s) => ({ audioQueue: s.slice(1), isPlayingAudio: false }));
        get().processAudioQueue();
      };
      source.start();
    })
}
```
This is a FAANG-grade approach. It guarantees smooth TTS synthesis playback to the user, completely decoupling Network-Time from Play-Time.

---

## 7. Integration Points

- **Go Gateway API**: Targets `NEXT_PUBLIC_API_BASE_URL/api/v1/...` for standard REST payloads. Triggers Nginx/Gateway rules correctly linking out to the backend.
- **Go Gateway WSS**: Targets `NEXT_PUBLIC_WS_BASE_URL/ws/live` bridging directly to the handler engine.
- **Supabase Edge Services**: Validates users natively at edge-level inside `middleware.ts` without incurring costly application re-renders.

---

## 8. Code Deep Dive: `LiveArenaPage -> toggleMic()`

The most critical interaction handler:
1. `navigator.mediaDevices` checks browser policies (Requires HTTPS locally or production!).
2. Initializing `MediaRecorder` with `mimeType: "audio/webm"` strictly standardizes encoder structures avoiding Deepgram confusion. 
3. The hook `recorder.ondataavailable` acts as an event trap. It executes continuously in the background parsing `e.data` binaries directly to the raw binary websocket. 
4. The hook stops all parent tracks precisely upon manual termination, protecting user privacy limits. 

---

## 9. Industry Practices Used

- **Zustand over Context**: Scaling contexts for 10ms-delta updates crushes React performance. Zustand writes to isolated store memory outside the React loop, binding via custom hooks exactly where needed. 
- **Next.js Server-Side Middleware**: Traps token anomalies centrally before Next.js even begins shipping massive Javascript bundles to users. 
- **Graceful DOM Unmounting**: `useEffect` cleanup hook functions correctly execute `disconnect()` mitigating zombie connections dangling on Chrome instances.

---

## 10. Missing / Weak Areas

- **Bottlenecks/Risks**: 
  1. The Web Audio context API occasionally enters a suspended state on browser auto-play policies (Safari heavily restricts audio until the DOM receives a valid physical click event natively triggering context). If a match starts on AI's turn immediately, Safari might legally silence the audio buffers.
  2. The `MediaRecorder` utilizes `audio/webm` strictly. iOS Safari notoriously lacks native generic WebM encoding capabilities inside the `MediaRecorder` scope without specific shims, which might break ingestion on iPhones.
- **Error Handling**: Store errors (`[Arena] Unknown message:`) are logged lightly via `console.warn` but do not bubble up into visual toast notifications. If an Audio block decode structurally fails, error recovery is brute-force `audioQueue.slice(1)`.

---

## 11. Phase-by-Phase Rebuild Guide

If you need to replicate this repository's behavior from a blank NextJS directory:

### Phase 1: Engine Initialization & Dependencies
1. `npx create-next-app@latest`
2. Configure Tailwind CSS and add `framer-motion`, `zustand`, `lucide-react`, and `@supabase/ssr`.

### Phase 2: Supabase Architecture
1. Configure `lib/supabase` context fetcher.
2. Build `middleware.ts` at the root intercepting invalid cookies.
3. Build `providers/AuthProvider` exposing the `.getUser()` globally to all deep sub-routes.

### Phase 3: The Universal State Store
1. Build `store/arenaStore.ts` defining JSON payload interfaces.
2. Scaffold WebSocket handlers mapping arrays of events against local properties (`transcript`, `audioQueue`).
3. Deploy the recursive audio queue extraction model using `audioCtx.decodeAudioData`. 

### Phase 4: API Clients
1. Bind `.env` definitions mapping Go reverse-proxies.
2. Implement synchronous REST fetch triggers inside `lib/api.ts` (ex. `createMatch`). 

### Phase 5: The Glassmorphism UI
1. Scaffold `app/debate/[matchId]/page.tsx`. Provide heavy Tailwind `absolute` blobs mapping blurred background gradients.
2. Bind transcript arrays referencing `framer-motion` `<motion.div>` objects enabling layout springs when arrays grow.
3. Deploy `MediaRecorder` APIs intercepting user clicks inside `toggleMic()`. 
4. Polish with loading states testing component responsiveness across desktop and mobile structures.

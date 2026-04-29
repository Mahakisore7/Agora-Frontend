import { create } from "zustand";

export type EventType =
  | "AI_TOKEN"
  | "HUMAN_TRANSCRIPT"
  | "POI_ACCEPTED"
  | "POI_DECLINED"
  | "AI_ERROR"
  | "AI_THOUGHT_COMPLETE"
  | "MATCH_COMPLETE"
  | "TURN_CHANGED"
  | "TURN_STARTED"
  | "ADJUDICATION_STARTED"
  | "ADJUDICATION_COMPLETE"
  | "ADJUDICATION_ERROR";

export interface ArenaEvent {
  event: EventType;
  speaker?: "ai" | "human";
  role?: string;
  text?: string;
  response?: string;
  error_message?: string;
  winning_team?: string;
  gov_total_score?: number;
  opp_total_score?: number;
  overall_analysis?: string;
}

export interface TranscriptEntry {
  speaker: "AI" | "Human";
  role?: string;
  content: string;
  timestamp: Date;
}

// ─── Module-level audio state ───────────────────────────────────────────────
// These live OUTSIDE Zustand because Web Audio API objects are mutable singletons
// that cannot be serialized into immutable state. Keeping them here lets us
// reliably stop/close them on disconnect without racing with React re-renders.
let _audioCtx: AudioContext | null = null;
let _activeSource: AudioBufferSourceNode | null = null;

/**
 * Immediately kill all in-flight and queued audio playback.
 * Called by disconnect() and connect() to guarantee silence on session change.
 */
function _stopAllAudio() {
  // 1. Stop the currently-playing buffer source (this fires onended, but we
  //    guard against re-processing in processAudioQueue via the connected check).
  if (_activeSource) {
    try { _activeSource.stop(); } catch { /* already stopped */ }
    _activeSource = null;
  }

  // 2. Close the AudioContext entirely. This releases all system audio
  //    resources and ensures nothing can resume playback from this context.
  if (_audioCtx) {
    try { _audioCtx.close(); } catch { /* already closed */ }
    _audioCtx = null;
  }
}

interface ArenaState {
  socket: WebSocket | null;
  connected: boolean;
  matchId: string | null;

  currentSpeaker: "ai" | "human" | null;
  currentSpeakerRole: string | null;
  aiBufferedText: string;        // Accumulates AI_TOKEN events into a full sentence
  aiThoughtComplete: boolean;    // Whether the AI has finished generating text
  transcript: TranscriptEntry[]; // Full debate transcript shown in the UI
  isMatchComplete: boolean;
  verdict: ArenaEvent | null;
  audioQueue: ArrayBuffer[];
  isPlayingAudio: boolean;

  // Adjudication state — set when the 5-phase pipeline finishes
  adjudicationComplete: boolean;
  adjudicationMessage: string | null; // "Phase 1/5: Extracting clashes..." etc.

  // Actions
  connect: (matchId: string, token: string) => void;
  disconnect: () => void;
  stopAllAudio: () => void;
  getSocket: () => WebSocket | null
  sendEvent: (event: object) => void;
  appendAiToken: (token: string) => void;
  addTranscriptEntry: (entry: TranscriptEntry) => void;
  setMatchComplete: (verdict: ArenaEvent) => void;
  processAudioQueue: () => void;
  checkAiTurnComplete: () => void;
}

export const useArenaStore = create<ArenaState>((set, get) => ({
  socket: null,
  connected: false,
  matchId: null,
  currentSpeaker: null,
  currentSpeakerRole: null,
  aiBufferedText: "",
  aiThoughtComplete: false,
  transcript: [],
  isMatchComplete: false,
  verdict: null,
  audioQueue: [],
  isPlayingAudio: false,
  adjudicationComplete: false,
  adjudicationMessage: null,

  connect: (matchId, token) => {
    // Tear down previous session completely: socket + audio + state
    get().disconnect();
    set({
      matchId,
      transcript: [],
      audioQueue: [],
      isPlayingAudio: false,
      aiBufferedText: "",
      aiThoughtComplete: false,
      currentSpeaker: null,
      currentSpeakerRole: null,
      isMatchComplete: false,
      verdict: null,
      adjudicationComplete: false,
      adjudicationMessage: null,
    });

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_BASE_URL}/ws/live?match_id=${matchId}&token=${token}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("[Arena] WebSocket connected — waiting for user to start match.");
      if (get().socket === socket) {
        set({ connected: true });
        socket.send(JSON.stringify({ action: "START_MATCH" }));
      }
    };

    socket.onmessage = (event) => {
      // Binary = TTS audio from Voicebox — play it
      if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((buffer) => {
          set((state) => ({ audioQueue: [...state.audioQueue, buffer] }));
          get().processAudioQueue();
        });
        return;
      }

      // Text = JSON event
      try {
        const data: ArenaEvent = JSON.parse(event.data);
        const { appendAiToken, addTranscriptEntry, setMatchComplete } = get();

        if (data.event === "AI_TOKEN" && data.text) {
          appendAiToken(data.text);
        } else if (data.event === "HUMAN_TRANSCRIPT" && data.text) {
          addTranscriptEntry({ speaker: "Human", role: get().currentSpeakerRole || undefined, content: data.text, timestamp: new Date() });
        } else if (data.event === "POI_ACCEPTED" || data.event === "POI_DECLINED") {
          console.log("[Arena] POI outcome:", data);
        } else if (data.event === "TURN_STARTED" && data.speaker) {
          // If the AI just finished, flush its entire streamed block to the final transcript
          if (data.speaker === "human" && get().aiBufferedText.trim().length > 0) {
            addTranscriptEntry({ speaker: "AI", role: get().currentSpeakerRole || undefined, content: get().aiBufferedText.trim(), timestamp: new Date() });
            set({ aiBufferedText: "" });
          }
          set({ currentSpeaker: data.speaker, currentSpeakerRole: data.role || null, aiThoughtComplete: false });
        } else if (data.event === "AI_THOUGHT_COMPLETE") {
           // Fallback flush
           if (get().aiBufferedText.trim().length > 0) {
              addTranscriptEntry({ speaker: "AI", role: get().currentSpeakerRole || undefined, content: get().aiBufferedText.trim(), timestamp: new Date() });
              set({ aiBufferedText: "" });
           }
           set({ aiThoughtComplete: true });
           get().checkAiTurnComplete();
        } else if (data.event === "MATCH_COMPLETE") {
          setMatchComplete(data);
          set({ adjudicationMessage: "All speeches done. AI adjudication starting..." });
        } else if (data.event === "ADJUDICATION_STARTED") {
          console.log("[Arena] Adjudication pipeline started.");
          set({ adjudicationMessage: "AI is deliberating... (Phase 1/5)" });
        } else if (data.event === "ADJUDICATION_COMPLETE") {
          console.log("[Arena] Adjudication complete! Verdict:", (data as any).verdict);
          set({ adjudicationComplete: true, adjudicationMessage: null });
        } else if (data.event === "ADJUDICATION_ERROR") {
          console.error("[Arena] Adjudication failed:", (data as any).error);
          set({ adjudicationMessage: "Adjudication encountered an error." });
        } else if (data.event === "AI_ERROR") {
          console.error("[Arena] AI Error:", data.error_message);
        }
      } catch {
        console.warn("[Arena] Unknown message:", event.data);
      }
    };

    socket.onerror = (e) => console.error("[Arena] WS Error:", e);
    socket.onclose = () => {
      console.log("[Arena] WebSocket disconnected — stopping audio.");
      if (get().socket === socket) {
        // Kill audio immediately when the WebSocket drops
        _stopAllAudio();
        set({ connected: false, socket: null, audioQueue: [], isPlayingAudio: false });
      }
    };

    set({ socket, matchId });
  },

  disconnect: () => {
    // 1. Stop all audio playback immediately
    _stopAllAudio();

    // 2. Close the WebSocket
    const { socket } = get();
    if (socket) {
      socket.close();
    }

    // 3. Wipe all transient state
    set({ 
      socket: null, 
      connected: false,
      audioQueue: [],
      isPlayingAudio: false,
      aiBufferedText: "",
      aiThoughtComplete: false,
    });
  },

  stopAllAudio: () => {
    _stopAllAudio();
    set({ audioQueue: [], isPlayingAudio: false });
  },

  getSocket: () => {
    return get().socket;
  },

  sendEvent: (event) => {
    const { socket } = get();
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  },

  appendAiToken: (token) => {
    const current = get().aiBufferedText + token;
    set({ aiBufferedText: current });
  },

  addTranscriptEntry: (entry) => {
    set((state) => ({ transcript: [...state.transcript, entry] }));
  },

  setMatchComplete: (verdict) => {
    set({ isMatchComplete: true, verdict });
  },

  processAudioQueue: () => {
    const state = get();

    // Guard: don't play if already playing, nothing queued, or disconnected
    if (state.isPlayingAudio || state.audioQueue.length === 0) return;
    if (!state.connected && !state.socket) {
      // Session is over — flush remaining queue silently
      set({ audioQueue: [], isPlayingAudio: false });
      return;
    }

    set({ isPlayingAudio: true });
    const buffer = state.audioQueue[0];

    // Lazily create a single AudioContext for the entire session
    if (!_audioCtx || _audioCtx.state === "closed") {
      _audioCtx = new window.AudioContext();
    }

    const ctx = _audioCtx;

    ctx.decodeAudioData(buffer).then((decodedData) => {
      // Double-check we're still connected (generation may have been cancelled
      // while we were decoding)
      if (!get().connected && !get().socket) {
        _stopAllAudio();
        set({ audioQueue: [], isPlayingAudio: false });
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = decodedData;
      source.connect(ctx.destination);
      _activeSource = source;
      
      source.onended = () => {
        _activeSource = null;
        set((s) => ({
          audioQueue: s.audioQueue.slice(1),
          isPlayingAudio: false,
        }));
        // Chain to next chunk
        get().processAudioQueue();
        // Check if AI turn is fully complete
        get().checkAiTurnComplete();
      };
      
      source.start();
    }).catch((err) => {
      console.error("[Arena] Failed to decode audio block:", err);
      _activeSource = null;
      set((s) => ({
        audioQueue: s.audioQueue.slice(1),
        isPlayingAudio: false,
      }));
      get().processAudioQueue();
      get().checkAiTurnComplete();
    });
  },

  checkAiTurnComplete: () => {
    const state = get();
    // Only automatically end the turn if it's the AI's turn, text generation is done, 
    // and there is no more audio queued or playing.
    if (
      state.currentSpeaker === "ai" &&
      state.aiThoughtComplete &&
      state.audioQueue.length === 0 &&
      !state.isPlayingAudio
    ) {
      console.log("[Arena] AI audio queue exhausted and thought complete. Ending AI turn automatically.");
      state.sendEvent({ action: "END_TURN" });
    }
  },
}));

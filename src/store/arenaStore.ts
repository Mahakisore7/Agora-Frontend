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
let _activeSourceStartTime: number = 0;  // ctx.currentTime when source.start() was called
let _activeBufferDuration: number = 0;   // duration of current audio chunk in seconds

let _totalTurnAudioDuration: number = 0; // sum of all decoded chunk durations for the current turn
let _totalTurnAudioPlayed: number = 0;   // sum of durations of all COMPLETED chunks for the current turn

/**
 * Immediately kill all in-flight and queued audio playback.
 * Called by disconnect() and connect() to guarantee silence on session change.
 */
function _stopAllAudio() {
  if (_activeSource) {
    try { _activeSource.onended = null; _activeSource.stop(); } catch { /* ignore */ }
    _activeSource = null;
  }
  if (_audioCtx) {
    try { _audioCtx.close(); } catch { /* already closed */ }
    _audioCtx = null;
  }
  _activeSourceStartTime = 0;
  _activeBufferDuration = 0;
  _totalTurnAudioDuration = 0;
  _totalTurnAudioPlayed = 0;
}

/**
 * Get current audio playback progress (0-1) and elapsed seconds across the ENTIRE turn.
 * Called from UI via requestAnimationFrame to animate the progress bar.
 */
export function getAudioProgress(): { progress: number; elapsed: number; duration: number } {
  if (!_audioCtx || !_activeSource || _activeBufferDuration === 0) {
    return { progress: 0, elapsed: _totalTurnAudioPlayed, duration: _totalTurnAudioDuration };
  }
  const currentChunkElapsed = Math.min(_audioCtx.currentTime - _activeSourceStartTime, _activeBufferDuration);
  const totalElapsed = _totalTurnAudioPlayed + currentChunkElapsed;
  const progress = _totalTurnAudioDuration > 0 ? Math.min(totalElapsed / _totalTurnAudioDuration, 1) : 0;
  
  return { progress, elapsed: totalElapsed, duration: _totalTurnAudioDuration };
}

interface ArenaState {
  socket: WebSocket | null;
  connected: boolean;
  matchId: string | null;

  currentSpeaker: "ai" | "human" | null;
  currentSpeakerRole: string | null;
  aiBufferedText: string;        // Accumulates AI_TOKEN events into a full sentence
  humanBufferedText: string;     // Accumulates HUMAN_TRANSCRIPT_CHUNK events
  aiThoughtComplete: boolean;    // Whether the AI has finished generating text
  transcript: TranscriptEntry[]; // Full debate transcript shown in the UI
  isMatchComplete: boolean;
  verdict: ArenaEvent | null;
  audioQueue: ArrayBuffer[];
  isPlayingAudio: boolean;
  isAudioPaused: boolean;
  audioProgress: number;       // 0-1 progress through current audio chunk
  audioChunkDuration: number;  // duration of current chunk in seconds
  pendingAudioBlobs: number;   // number of Blobs currently being read by FileReader

  // Adjudication state — set when the 5-phase pipeline finishes
  adjudicationComplete: boolean;
  adjudicationMessage: string | null; // "Phase 1/5: Extracting clashes..." etc.

  // Timing tracking
  aiSpeechStartTime: number | null;
  humanTurnStartTime: number | null;

  // Actions
  connect: (matchId: string, token: string) => void;
  disconnect: () => void;
  stopAllAudio: () => void;
  pauseAudio: () => void;
  resumeAudio: () => void;
  skipAiSpeech: () => void;
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
  humanBufferedText: "",
  aiThoughtComplete: false,
  transcript: [],
  isMatchComplete: false,
  verdict: null,
  audioQueue: [],
  isPlayingAudio: false,
  isAudioPaused: false,
  audioProgress: 0,
  audioChunkDuration: 0,
  pendingAudioBlobs: 0,
  adjudicationComplete: false,
  adjudicationMessage: null,
  aiSpeechStartTime: null,
  humanTurnStartTime: null,

  connect: (matchId, token) => {
    // Tear down previous session completely: socket + audio + state
    get().disconnect();
    set({
      matchId,
      transcript: [],
      audioQueue: [],
      isPlayingAudio: false,
      aiBufferedText: "",
      humanBufferedText: "",
      aiThoughtComplete: false,
      currentSpeaker: null,
      currentSpeakerRole: null,
      isMatchComplete: false,
      verdict: null,
      adjudicationComplete: false,
      adjudicationMessage: null,
      aiSpeechStartTime: null,
      humanTurnStartTime: null,
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
        // Binary message = Deepgram audio chunk
        set((state) => ({ pendingAudioBlobs: state.pendingAudioBlobs + 1 }));
        const reader = new FileReader();
        reader.onload = function () {
          set((state) => ({ pendingAudioBlobs: Math.max(0, state.pendingAudioBlobs - 1) }));
          if (this.result) {
            set((state) => ({ audioQueue: [...state.audioQueue, this.result as ArrayBuffer] }));
            get().processAudioQueue();
          } else {
            get().checkAiTurnComplete(); // Check if this was the last blob and it failed
          }
        };
        reader.onerror = function () {
          set((state) => ({ pendingAudioBlobs: Math.max(0, state.pendingAudioBlobs - 1) }));
          get().checkAiTurnComplete();
        };
        reader.readAsArrayBuffer(event.data);
        return;
      }

      // Text = JSON event
      try {
        const data: ArenaEvent = JSON.parse(event.data);
        const { appendAiToken, addTranscriptEntry, setMatchComplete } = get();

        if (data.event === "AI_TOKEN" && data.text) {
          appendAiToken(data.text);
        } else if (data.event === "HUMAN_TRANSCRIPT_CHUNK" && data.text) {
          const current = get().humanBufferedText;
          set({ humanBufferedText: current + (current ? " " : "") + data.text });
        } else if (data.event === "HUMAN_TRANSCRIPT" && data.text) {
          addTranscriptEntry({ speaker: "Human", role: get().currentSpeakerRole || undefined, content: data.text, timestamp: new Date() });
        } else if (data.event === "POI_ACCEPTED" || data.event === "POI_DECLINED") {
          console.log("[Arena] POI outcome:", data);
        } else if (data.event === "TURN_STARTED" && data.speaker) {
          // If the AI just finished, flush its entire streamed block to the final transcript
          if (get().aiBufferedText.trim().length > 0) {
            addTranscriptEntry({ speaker: "AI", role: get().currentSpeakerRole || undefined, content: get().aiBufferedText.trim(), timestamp: new Date() });
            set({ aiBufferedText: "" });
          }
          // If a human just finished, flush their streamed block to the final transcript
          if (get().humanBufferedText.trim().length > 0) {
            addTranscriptEntry({ speaker: "Human", role: get().currentSpeakerRole || undefined, content: get().humanBufferedText.trim(), timestamp: new Date() });
            set({ humanBufferedText: "" });
          }
          // Initialize timing for the new speaker
          const newHumanTurnStartTime = data.speaker === "human" ? Date.now() : null;
          _totalTurnAudioDuration = 0;
          _totalTurnAudioPlayed = 0;
          
          set({ 
            currentSpeaker: data.speaker, 
            currentSpeakerRole: data.role || null, 
            aiThoughtComplete: false, 
            aiSpeechStartTime: null,
            humanTurnStartTime: newHumanTurnStartTime 
          });
        } else if (data.event === "AI_THOUGHT_COMPLETE") {
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

    socket.onerror = (e) => console.warn("[Arena] WS Error (harmless if during unmount):", e);
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
      humanBufferedText: "",
      aiThoughtComplete: false,
      aiSpeechStartTime: null,
      humanTurnStartTime: null,
    });
  },

  stopAllAudio: () => {
    _stopAllAudio();
    set({ audioQueue: [], isPlayingAudio: false, isAudioPaused: false, audioProgress: 0, audioChunkDuration: 0 });
  },

  pauseAudio: () => {
    if (_audioCtx && _audioCtx.state === "running") {
      _audioCtx.suspend();
      set({ isAudioPaused: true });
    }
  },

  resumeAudio: () => {
    if (_audioCtx && _audioCtx.state === "suspended") {
      _audioCtx.resume();
      set({ isAudioPaused: false });
    }
  },

  skipAiSpeech: () => {
    // Stop all audio, flush AI text to transcript, signal turn complete
    _stopAllAudio();
    const state = get();
    if (state.aiBufferedText.trim().length > 0) {
      state.addTranscriptEntry({
        speaker: "AI",
        role: state.currentSpeakerRole || undefined,
        content: state.aiBufferedText.trim(),
        timestamp: new Date(),
      });
      set({ aiBufferedText: "" });
    }
    set({
      audioQueue: [],
      isPlayingAudio: false,
      isAudioPaused: false,
      audioProgress: 0,
      audioChunkDuration: 0,
      aiThoughtComplete: true,
    });
    // Trigger the auto end-turn check
    get().checkAiTurnComplete();
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
      _activeBufferDuration = decodedData.duration;
      _totalTurnAudioDuration += decodedData.duration; // Add to global total
      
      source.onended = () => {
        _totalTurnAudioPlayed += _activeBufferDuration; // Mark this chunk as fully played
        _activeSource = null;
        _activeSourceStartTime = 0;
        _activeBufferDuration = 0;
        set((s) => ({
          audioQueue: s.audioQueue.slice(1),
          isPlayingAudio: false,
          audioProgress: 0,
          audioChunkDuration: 0,
        }));
        // Chain to next chunk
        get().processAudioQueue();
        // Check if AI turn is fully complete
        get().checkAiTurnComplete();
      };
      
      // Capture the exact moment the FIRST audio chunk starts playing
      if (get().currentSpeaker === "ai" && !get().aiSpeechStartTime) {
        set({ aiSpeechStartTime: Date.now() });
      }

      _activeSourceStartTime = ctx.currentTime;
      set({ audioChunkDuration: decodedData.duration });
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
    // there are no blobs waiting to be decoded, and there is no more audio queued or playing.
    if (
      state.currentSpeaker === "ai" &&
      state.aiThoughtComplete &&
      state.pendingAudioBlobs === 0 &&
      state.audioQueue.length === 0 &&
      !state.isPlayingAudio
    ) {
      console.log("[Arena] AI audio queue exhausted and thought complete. Ending AI turn automatically.");
      
      const endTime = Date.now();
      const startTime = state.aiSpeechStartTime || endTime; // Fallback if no audio played
      const durationMs = endTime - startTime;

      state.sendEvent({ 
        action: "END_TURN",
        ai_speech_start_time_utc: new Date(startTime).toISOString(),
        ai_speech_end_time_utc: new Date(endTime).toISOString(),
        ai_speech_duration_ms: durationMs
      });
    }
  },
}));

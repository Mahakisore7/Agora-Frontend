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
  | "TURN_STARTED";

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

interface ArenaState {
  socket: WebSocket | null;
  connected: boolean;
  matchId: string | null;

  currentSpeaker: "ai" | "human" | null;
  currentSpeakerRole: string | null;
  aiBufferedText: string;        // Accumulates AI_TOKEN events into a full sentence
  transcript: TranscriptEntry[]; // Full debate transcript shown in the UI
  isMatchComplete: boolean;
  verdict: ArenaEvent | null;
  audioQueue: ArrayBuffer[];
  isPlayingAudio: boolean;

  // Actions
  connect: (matchId: string, token: string) => void;
  disconnect: () => void;
  getSocket: () => WebSocket | null
  sendEvent: (event: object) => void;
  appendAiToken: (token: string) => void;
  addTranscriptEntry: (entry: TranscriptEntry) => void;
  setMatchComplete: (verdict: ArenaEvent) => void;
  processAudioQueue: () => void;
}

export const useArenaStore = create<ArenaState>((set, get) => ({
  socket: null,
  connected: false,
  matchId: null,
  currentSpeaker: null,
  currentSpeakerRole: null,
  aiBufferedText: "",
  transcript: [],
  isMatchComplete: false,
  verdict: null,
  audioQueue: [],
  isPlayingAudio: false,

  connect: (matchId, token) => {
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_BASE_URL}/ws/live?match_id=${matchId}&token=${token}`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("[Arena] WebSocket connected");
      set({ connected: true });
      // Immediately kick off the debate
      socket.send(JSON.stringify({ action: "START_MATCH" }));
    };

    socket.onmessage = (event) => {
      // Binary = audio from ElevenLabs — play it
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
          set({ currentSpeaker: data.speaker, currentSpeakerRole: data.role || null });
        } else if (data.event === "AI_THOUGHT_COMPLETE") {
           // Fallback flush
           if (get().aiBufferedText.trim().length > 0) {
              addTranscriptEntry({ speaker: "AI", role: get().currentSpeakerRole || undefined, content: get().aiBufferedText.trim(), timestamp: new Date() });
              set({ aiBufferedText: "" });
           }
        } else if (data.event === "MATCH_COMPLETE") {
          setMatchComplete(data);
        } else if (data.event === "AI_ERROR") {
          console.error("[Arena] AI Error:", data.error_message);
        }
      } catch {
        console.warn("[Arena] Unknown message:", event.data);
      }
    };

    socket.onerror = (e) => console.error("[Arena] WS Error:", e);
    socket.onclose = () => {
      console.log("[Arena] WebSocket disconnected");
      set({ connected: false, socket: null });
    };

    set({ socket, matchId });
  },

  disconnect: () => {
    get().socket?.close();
    set({ socket: null, connected: false });
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
    if (state.isPlayingAudio || state.audioQueue.length === 0) return;

    set({ isPlayingAudio: true });
    const buffer = state.audioQueue[0];

    const audioCtx = new window.AudioContext();
    audioCtx.decodeAudioData(buffer, (decodedData) => {
      const source = audioCtx.createBufferSource();
      source.buffer = decodedData;
      source.connect(audioCtx.destination);
      
      source.onended = () => {
        set((s) => ({
          audioQueue: s.audioQueue.slice(1),
          isPlayingAudio: false,
        }));
        get().processAudioQueue();
      };
      
      source.start();
    }).catch((err) => {
      console.error("[Arena] Failed to decode audio block:", err);
      set((s) => ({
        audioQueue: s.audioQueue.slice(1),
        isPlayingAudio: false,
      }));
      get().processAudioQueue();
    });
  },
}));

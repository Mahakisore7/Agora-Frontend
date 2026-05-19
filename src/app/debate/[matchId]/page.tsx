"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useArenaStore } from "@/store/arenaStore";
import { getAudioProgress } from "@/store/arenaStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileDrawer } from "@/components/ui/profile-drawer";
import { Mic, SkipForward, Hand, Users, Target, LogOut, X, AlertTriangle, Play, Pause, FastForward, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FORMAT_ROLES, ROLE_LABELS, ROLE_TO_SIDE, ROLE_TO_TEAM_LABEL, DebateFormat } from "@/lib/api";

/** Map human-readable role name → side for WhatsApp-style layout */
function getSideFromRole(role?: string): "government" | "opposition" | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r.includes("opposition") || r.includes("opp")) return "opposition";
  return "government";
}

function ArenaInner() {
  const { matchId } = useParams<{ matchId: string }>();
  const searchParams = useSearchParams();
  const format = (searchParams.get("format") as DebateFormat) || "ap";
  
  const { session, user } = useAuth();
  const router = useRouter();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  
  // Microphone Tracking
  const [isRecording, setIsRecording] = useState(false);
  const [isEndingTurn, setIsEndingTurn] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showEndDebateModal, setShowEndDebateModal] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  const {
    connect, disconnect, sendEvent, getSocket,
    connected, transcript, aiBufferedText, humanBufferedText, aiThoughtComplete,
    isMatchComplete, currentSpeaker, currentSpeakerRole,
    adjudicationComplete, adjudicationMessage,
    isPlayingAudio, isAudioPaused, pauseAudio, resumeAudio, skipAiSpeech,
    // ===== REJOIN FEATURE =====
    isOffline, offlineDuration, timeRemainingSeconds, updateTimer
  } = useArenaStore();

  // Audio progress bar animation


  useEffect(() => {
    if (session?.access_token && matchId) {
      connect(matchId, session.access_token);
    }
    return () => disconnect();
  }, [matchId, session?.access_token]);

  // Reset isEndingTurn when currentSpeaker actually updates from the backend
  useEffect(() => {
    setIsEndingTurn(false);
  }, [currentSpeaker]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [transcript, aiBufferedText]);

  // When the AI adjudication pipeline finishes (~40-60s after match ends),
  // redirect to the results dashboard with the format param preserved.
  useEffect(() => {
    if (adjudicationComplete) {
      router.push(`/results/${matchId}?format=${format}`);
    }
  }, [adjudicationComplete, matchId, format, router]);

  // Fallback: if match ends but adjudication takes too long, redirect after 90s
  useEffect(() => {
    if (!isMatchComplete) return;
    const timer = setTimeout(() => {
      router.push(`/results/${matchId}?format=${format}`);
    }, 90000);
    return () => clearTimeout(timer);
  }, [isMatchComplete, matchId, format, router]);

  // ===== REJOIN FEATURE: Timer countdown =====
  // Decrement timer every 1s when connected and not offline
  useEffect(() => {
    if (!connected || isOffline) return;
    
    const timerInterval = setInterval(() => {
      updateTimer();
    }, 1000);
    
    return () => clearInterval(timerInterval);
  }, [connected, isOffline, updateTimer]);

  // Production-Grade MediaRecorder Streaming
  const toggleMic = async () => {
    if (isRecording) {
      mediaRecorder.current?.stop();
      mediaRecorder.current?.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      try {
        sendEvent({ action: "STOP_MIC" });
      } catch (err) {
        console.error("Failed to send STOP_MIC", err);
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        const socket = getSocket();
        if (e.data.size > 0 && socket?.readyState === WebSocket.OPEN) {
          socket.send(e.data); // Streams binary blob to Deepgram!
        }
      };
      
      recorder.start(250); // Slice and send every 250ms
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Please allow microphone permissions in your browser.");
    }
  };

  const handleEndTurn = () => {
    if (isEndingTurn) return;
    setIsEndingTurn(true);
    console.log("[Arena] Requesting end turn...");
    try {
      const store = useArenaStore.getState();
      const endTime = Date.now();
      const startTime = store.humanTurnStartTime || endTime;
      const durationMs = endTime - startTime;

      sendEvent({ 
        action: "END_TURN",
        human_speech_start_time_utc: new Date(startTime).toISOString(),
        human_speech_end_time_utc: new Date(endTime).toISOString(),
        human_speech_duration_ms: durationMs
      });
    } catch (err) {
      console.error("[Arena] Failed to send END_TURN event", err);
    }
    
    if (isRecording) {
      try {
        toggleMic();
      } catch (err) {
        console.error("[Arena] Error stopping mic silently ignored", err);
      }
    }
  };

  const roles = FORMAT_ROLES[format] || FORMAT_ROLES.ap;

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/30 blur-[120px] rounded-full pointer-events-none" />

      {/* ── Adjudication Overlay ─────────────────────────────────────── */}
      {/* Shows after all speeches finish while the 5-phase pipeline runs (~40-60s) */}
      <AnimatePresence>
        {isMatchComplete && !adjudicationComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#050510]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-6 text-center px-6"
          >
            {/* Spinner ring */}
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-2 border-indigo-900" />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-t-indigo-400 border-r-transparent border-b-transparent border-l-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M5.636 5.636l1.414 1.414m9.9 9.9 1.414 1.414M3 12h2m14 0h2M5.636 18.364l1.414-1.414m9.9-9.9 1.414-1.414" />
                </svg>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-black text-white mb-2">AI Adjudicator Deliberating</h2>
              <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                {adjudicationMessage || "All speeches complete. The 5-phase evaluation pipeline is running..."}
              </p>
            </div>

            {/* Phase progress pills */}
            <div className="flex gap-2 flex-wrap justify-center">
              {["Clashes", "WCM Matrix", "WUDC Pillars", "Speakers", "Verdict"].map((phase, i) => (
                <motion.div
                  key={phase}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-xs px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-950/40 text-indigo-300"
                >
                  {i + 1}. {phase}
                </motion.div>
              ))}
            </div>

            <p className="text-xs text-slate-600 mt-2">You will be redirected automatically when results are ready</p>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="border-b border-indigo-500/20 bg-indigo-950/40 backdrop-blur-3xl p-5 flex items-center justify-between z-20 shadow-2xl relative">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.6)]">
            <Hand className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent drop-shadow-md">Agora Arena</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest border-indigo-500/50 text-indigo-300 bg-indigo-950/50">
                {format.toUpperCase()} FORMAT
              </Badge>
              <span className="text-xs font-semibold text-indigo-300/80 uppercase tracking-widest">Live Match</span>
            </div>
          </div>
        </div>
        <Badge variant={connected ? "default" : "destructive"} className={`hidden sm:flex px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${connected ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50" : "bg-red-500/20 text-red-400 border border-red-500/50"}`}>
          {connected ? "● Server Active" : "○ Disconnected"}
        </Badge>

        {/* Profile Avatar Button */}
        <button
          onClick={() => setProfileOpen(true)}
          className="w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-500/40
            hover:border-indigo-400/70 transition-all shadow-[0_0_12px_rgba(99,102,241,0.3)]
            hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] flex-shrink-0 bg-indigo-950 flex items-center justify-center"
          title="Open Profile"
        >
          {user?.user_metadata?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={user.user_metadata.avatar_url} 
              alt="Profile" 
              className="w-full h-full object-cover"
              onError={(e) => {
                // If external blob/URL fails, fallback to initials
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = `<span class="text-xs font-black text-white">${(user?.user_metadata?.display_name || user?.email || "?").substring(0, 2).toUpperCase()}</span>`;
              }} 
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600
              flex items-center justify-center text-xs font-black text-white">
              {(user?.user_metadata?.display_name || user?.email || "?").substring(0, 2).toUpperCase()}
            </div>
          )}
        </button>
      </header>

      {/* ===== REJOIN: OFFLINE BANNER ===== */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-amber-950/80 border-b border-amber-600/40 px-4 py-3 flex items-center justify-center gap-3 backdrop-blur-sm"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-amber-200">
                Connection lost. Reconnecting...
              </span>
              <span className="text-xs text-amber-300 font-mono">
                {Math.floor(offlineDuration)}s
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden z-10 w-full">
        
        {/* Left Sidebar: Debate Schedule */}
        <aside className="hidden lg:flex w-72 flex-col border-r border-indigo-500/20 bg-indigo-950/20 backdrop-blur-xl p-6 overflow-y-auto scrollbar-hide">
          <h2 className="text-sm font-black uppercase tracking-widest text-indigo-300 mb-6 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Speaker Schedule
          </h2>
          
          {/* ===== REJOIN: TIMER DISPLAY ===== */}
          <div className={`mb-6 p-4 rounded-xl border-2 text-center transition-all ${
            isOffline 
              ? 'bg-amber-950/40 border-amber-600/50' 
              : 'bg-indigo-950/40 border-indigo-600/50'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isOffline ? 'text-amber-300' : 'text-indigo-300'}`}>
              Time Remaining
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-black text-white font-mono">
                {String(Math.floor(timeRemainingSeconds / 60)).padStart(2, '0')}:{String(Math.floor(timeRemainingSeconds % 60)).padStart(2, '0')}
              </span>
              {isOffline && <Pause className="w-5 h-5 text-amber-400 animate-pulse" />}
            </div>
          </div>
          
          <div className="space-y-2 relative">
            {/* Vertical timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500/30 via-purple-500/20 to-transparent" />
            {roles.map((roleKey, index) => {
              const isCurrent = currentSpeakerRole 
                 ? currentSpeakerRole.toLowerCase().replace(/ /g, "_") === roleKey 
                 : index === Math.min(Math.max(0, Math.floor(transcript.length)), roles.length - 1);
                 
              const isPast = index < Math.min(transcript.length, roles.length - 1);
              const side = ROLE_TO_SIDE[roleKey];
              const isGov = side === "government";

              return (
                <div key={roleKey} className="relative flex items-center gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 shrink-0 z-10 ${
                      isCurrent 
                        ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]' 
                        : isPast 
                          ? 'bg-indigo-950 border-indigo-700' 
                          : 'bg-slate-900 border-slate-700'
                    }`}>
                    <span className={`text-xs font-bold ${isCurrent ? 'text-white' : 'text-slate-500'}`}>{index + 1}</span>
                  </div>
                  
                  <div className={`flex-1 p-3 rounded-xl border transition-all ${
                      isCurrent 
                        ? 'bg-indigo-900/40 border-indigo-500/50 shadow-lg' 
                        : isPast
                          ? 'bg-indigo-950/20 border-indigo-900/30 opacity-60'
                          : 'bg-black/30 border-slate-800/50 opacity-40'
                    }`}>
                    <span className={`text-[11px] font-bold uppercase tracking-wider leading-tight block ${isGov ? 'text-blue-400' : 'text-rose-400'}`}>
                      {ROLE_LABELS[roleKey]}
                    </span>
                    <span className={`text-[10px] uppercase tracking-widest ${isGov ? 'text-blue-500/50' : 'text-rose-500/50'}`}>
                      {format === 'bp' ? ROLE_TO_TEAM_LABEL[roleKey] : (isGov ? 'Government' : 'Opposition')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main Transcript Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 scrollbar-hide">
            {transcript.length === 0 && !currentSpeakerRole && (
              <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-4">
                <Target className="w-16 h-16 text-indigo-500/50" />
                <p className="text-xl font-medium text-slate-400 tracking-wide text-center">Waiting for the match to begin...</p>
                <Button variant="outline" className="border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20" onClick={() => sendEvent({ action: "START_MATCH" })}>
                  Force Start Match
                </Button>
              </div>
            )}
            <AnimatePresence>
              {transcript.map((entry, i) => {
                const side = getSideFromRole(entry.role);
                const isGov = side === "government";
                return (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className={`flex items-end gap-3 ${isGov ? "justify-start" : "justify-end"}`}
                >
                  {isGov && (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-lg border border-blue-400/30 flex-shrink-0">
                      <span className="text-[10px] font-bold text-white">{entry.speaker === "AI" ? "AI" : "You"}</span>
                    </div>
                  )}
                  
                  <div className={`max-w-[70%] rounded-2xl p-5 shadow-xl backdrop-blur-md ${
                    isGov
                      ? "bg-blue-950/50 border border-blue-500/25 text-blue-50 rounded-bl-sm"
                      : "bg-rose-950/40 border border-rose-500/25 text-rose-50 rounded-br-sm"
                  }`}>
                    <p className={`text-[10px] font-black mb-2 tracking-widest uppercase flex items-center gap-2 ${isGov ? "text-blue-400" : "text-rose-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isGov ? 'bg-blue-400' : 'bg-rose-400'}`} />
                      {entry.role || entry.speaker}
                      {entry.speaker === "Human" && <span className="text-white/40 font-normal normal-case tracking-normal">(You)</span>}
                    </p>
                    <p className="leading-relaxed text-sm font-medium tracking-wide opacity-90 whitespace-pre-wrap">{entry.content}</p>
                  </div>

                  {!isGov && (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-pink-700 flex items-center justify-center shadow-lg border border-rose-400/30 flex-shrink-0">
                      <span className="text-[10px] font-bold text-white">{entry.speaker === "AI" ? "AI" : "You"}</span>
                    </div>
                  )}
                </motion.div>
              );
              })}
            </AnimatePresence>

            {/* Activity Indicator (Thinking or Preparing) */}
            {currentSpeaker === "ai" && !aiBufferedText && (() => {
              const thinkSide = getSideFromRole(currentSpeakerRole || undefined);
              const thinkGov = thinkSide === "government";
              return (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-3 ${thinkGov ? 'justify-start' : 'justify-end'}`}>
                 {thinkGov && <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-lg border border-gray-600/50 animate-pulse flex-shrink-0">
                    <span className="text-[10px] font-bold text-gray-400">AI</span>
                  </div>}
                <div className="max-w-[70%] rounded-2xl p-5 bg-gray-900/60 border border-gray-700/50 text-gray-300 rounded-bl-sm shadow-xl backdrop-blur-md relative overflow-hidden">
                   <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite]" />
                  <p className="text-[10px] font-black mb-2 tracking-widest uppercase text-gray-400 flex items-center gap-2">
                    {aiThoughtComplete
                      ? `${ROLE_LABELS[roles[Math.min(transcript.length, roles.length - 1)]]} is Taking Notes`
                      : (currentSpeakerRole ? `${currentSpeakerRole} is Thinking` : "AI is Thinking")}
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>●</motion.span>
                  </p>
                  <p className="leading-relaxed text-sm italic font-medium text-gray-500">
                    {aiThoughtComplete
                      ? "Listening to the current speech and preparing a response..."
                      : "Preparing arguments and gathering evidence..."}
                  </p>
                </div>
                {!thinkGov && <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-lg border border-gray-600/50 animate-pulse flex-shrink-0">
                    <span className="text-[10px] font-bold text-gray-400">AI</span>
                  </div>}
              </motion.div>
            );})()}

            {/* AI Streaming Text */}
            {aiBufferedText && (() => {
              const streamSide = getSideFromRole(currentSpeakerRole || undefined);
              const streamGov = streamSide === "government";
              return (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={`flex items-end gap-3 ${streamGov ? 'justify-start' : 'justify-end'}`}>
                  {streamGov && <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-blue-400/50 flex-shrink-0 animate-pulse">
                      <span className="text-[10px] font-bold text-white">AI</span>
                  </div>}
                <div className={`max-w-[70%] rounded-2xl p-5 shadow-xl backdrop-blur-md ${streamGov ? 'bg-blue-950/50 border border-blue-400/40 text-blue-50 rounded-bl-sm' : 'bg-rose-950/40 border border-rose-400/40 text-rose-50 rounded-br-sm'}`}>
                  <p className={`text-[10px] font-black mb-2 tracking-widest uppercase flex items-center gap-2 ${streamGov ? 'text-blue-400' : 'text-rose-400'}`}>
                    {currentSpeakerRole ? `${currentSpeakerRole} is Speaking` : "AI is Speaking"}
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>●</motion.span>
                  </p>
                  <p className="leading-relaxed text-sm font-medium tracking-wide opacity-90 whitespace-pre-wrap">{aiBufferedText}</p>
                  
                  {/* Audio Controls — Play/Pause, Progress Bar, Skip */}
                  {isPlayingAudio && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={isAudioPaused ? resumeAudio : pauseAudio}
                        className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all flex-shrink-0"
                      >
                        {isAudioPaused
                          ? <Play className="w-3.5 h-3.5 text-white ml-0.5" />
                          : <Pause className="w-3.5 h-3.5 text-white" />}
                      </button>
                      <div className="flex-1 flex items-center justify-center gap-[3px] h-6 px-4 overflow-hidden opacity-80">
                        {[...Array(40)].map((_, i) => {
                          const heightValues = isAudioPaused ? ['15%'] : ['15%', `${40 + ((i * 17) % 60)}%`, '15%'];
                          return (
                            <motion.div
                              key={i}
                              className={`w-1 rounded-full ${streamGov ? 'bg-blue-400' : 'bg-rose-400'}`}
                              animate={{ height: heightValues }}
                              transition={{
                                repeat: isAudioPaused ? 0 : Infinity,
                                duration: 0.5 + (i % 4) * 0.15,
                                ease: "easeInOut",
                                delay: (i % 5) * 0.1
                              }}
                              style={{ height: '15%' }}
                            />
                          );
                        })}
                      </div>
                      {aiThoughtComplete ? (
                        <button
                          onClick={skipAiSpeech}
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all flex-shrink-0"
                          title="Skip AI audio"
                        >
                          <FastForward className="w-3.5 h-3.5 text-white" />
                        </button>
                      ) : (
                        <div className="w-7 h-7 flex items-center justify-center">
                          <Loader2 className="w-3.5 h-3.5 text-white/50 animate-spin" />
                        </div>
                      )}
                    </div>
                  )}
                  {/* Skip button even if not playing audio yet */}
                  {!isPlayingAudio && currentSpeaker === 'ai' && aiBufferedText && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={skipAiSpeech}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${streamGov ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'}`}
                      >
                        <FastForward className="w-3 h-3" />
                        Skip
                      </button>
                    </div>
                  )}
                </div>
                  {!streamGov && <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-pink-700 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.5)] border border-rose-400/50 flex-shrink-0 animate-pulse">
                      <span className="text-[10px] font-bold text-white">AI</span>
                  </div>}
              </motion.div>
            );})()}

            {/* Human Streaming Text (Live STT) */}
            {currentSpeaker === 'human' && (() => {
              const humanSide = getSideFromRole(currentSpeakerRole || undefined);
              const humanGov = humanSide === "government";
              return (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className={`flex items-end gap-3 ${humanGov ? 'justify-start' : 'justify-end'}`}>
                {humanGov && <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-blue-400/50 flex-shrink-0 animate-pulse">
                  <span className="text-[10px] font-bold text-white">You</span>
                </div>}
                <div className={`max-w-[70%] rounded-2xl p-5 shadow-xl backdrop-blur-md ${humanGov ? 'bg-blue-950/50 border border-blue-400/40 text-blue-50 rounded-bl-sm' : 'bg-rose-950/40 border border-rose-400/40 text-rose-50 rounded-br-sm'}`}>
                  <p className={`text-[10px] font-black mb-2 tracking-widest uppercase flex items-center gap-2 ${humanGov ? 'text-blue-400' : 'text-rose-400'}`}>
                    {currentSpeakerRole ? `${currentSpeakerRole} (You)` : "You are Speaking"}
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>●</motion.span>
                  </p>
                  <p className="leading-relaxed text-sm font-medium tracking-wide opacity-90 whitespace-pre-wrap">
                    {humanBufferedText || <span className="italic opacity-50">Listening...</span>}
                  </p>
                </div>
                {!humanGov && <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-pink-700 flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.5)] border border-rose-400/50 flex-shrink-0 animate-pulse">
                  <span className="text-[10px] font-bold text-white">You</span>
                </div>}
              </motion.div>
            );})()}
            <div ref={transcriptEndRef} className="h-24" />
          </div>
          
          {/* Control Deck */}
          <footer className="mt-auto border-t border-indigo-500/20 bg-black/80 backdrop-blur-3xl p-4 z-20 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4">
              
              {/* Left Action: POI */}
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  disabled={currentSpeaker !== 'ai'}
                  onClick={() => {
                    const poiText = window.prompt("Enter your Point of Information:");
                    if (poiText) sendEvent({ action: "POI_OFFERED", text: poiText });
                  }}
                  className={`h-12 px-5 rounded-xl font-bold tracking-wide transition-all flex-1 sm:flex-initial ${
                    currentSpeaker !== 'ai'
                      ? 'bg-transparent border-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                      : 'bg-orange-500/10 border-orange-500/50 text-orange-400 hover:bg-orange-500/20'
                  }`}
                >
                  <Hand className="w-4 h-4 mr-2" />
                  POI
                </Button>

                {/* End Debate */}
                <Button 
                  variant="outline" 
                  onClick={() => setShowEndDebateModal(true)}
                  className="h-12 px-5 rounded-xl font-bold tracking-wide bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 flex-1 sm:flex-initial"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  End Debate
                </Button>
              </div>

              {/* Microphone */}
              <div className="flex-[2] flex justify-center w-full relative">
                {isRecording && (
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0.8 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="absolute inset-0 m-auto w-14 h-14 bg-emerald-500 rounded-full z-0"
                    />
                )}
                
                <Button 
                  size="lg" 
                  onClick={toggleMic}
                  disabled={currentSpeaker === 'ai'}
                  className={`relative z-10 h-14 px-10 rounded-full shadow-2xl transition-all duration-300 font-black tracking-widest text-xs uppercase w-full sm:w-auto ${
                    currentSpeaker === 'ai' 
                      ? 'bg-indigo-950/40 text-indigo-400/50 border border-indigo-900/50 cursor-not-allowed scale-95' 
                      : isRecording
                      ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-2 border-red-400 shadow-[0_0_40px_rgba(239,68,68,0.7)] hover:scale-105'
                      : 'bg-gradient-to-r from-emerald-400 to-emerald-600 text-black border-none shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-105'
                  }`}
                >
                  {currentSpeaker === 'ai' ? (
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                      </span>
                      AI holds floor
                    </div>
                  ) : isRecording ? (
                    <>
                      <Mic className="w-5 h-5 mr-2 animate-pulse" />
                      Listening...
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5 mr-2" />
                      Tap to Speak
                    </>
                  )}
                </Button>
              </div>

              {/* Right Action: End Turn */}
              <div className="flex-1 flex justify-end w-full sm:w-auto">
                 <Button 
                  variant="outline" 
                  disabled={currentSpeaker === 'ai' || isEndingTurn}
                  onClick={handleEndTurn}
                  className={`h-12 px-5 rounded-xl font-bold tracking-wide transition-all w-full sm:w-auto ${
                    currentSpeaker === 'ai'
                      ? 'bg-transparent border-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                      : 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                  }`}
                >
                  End My Turn
                  <SkipForward className="w-4 h-4 ml-2 text-emerald-400" />
                </Button>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* ── End Debate Confirmation Modal ──────────────────────────── */}
      <AnimatePresence>
        {showEndDebateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowEndDebateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">End Debate Early?</h3>
                  <p className="text-sm text-slate-400">This will save all progress so far.</p>
                </div>
                <button onClick={() => setShowEndDebateModal(false)} className="ml-auto text-slate-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                Your debate transcript and any completed turns will be saved to the database. 
                You can review partial results or start a new debate from the dashboard.
              </p>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    disconnect();
                    router.push('/dashboard');
                  }}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl"
                >
                  Save & Go to Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowEndDebateModal(false)}
                  className="w-full h-12 border-slate-700 text-slate-300 hover:bg-slate-800 font-bold rounded-xl"
                >
                  Continue Debating
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Slide-out Drawer */}
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

export default function LiveArenaPage() {
  return (
    <Suspense fallback={
      <div className="h-[100dvh] bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ArenaInner />
    </Suspense>
  );
}

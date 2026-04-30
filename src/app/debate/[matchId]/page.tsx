"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useArenaStore } from "@/store/arenaStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileDrawer } from "@/components/ui/profile-drawer";
import { Mic, SkipForward, Hand, Users, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FORMAT_ROLES, ROLE_LABELS, ROLE_TO_SIDE, ROLE_TO_TEAM_LABEL, DebateFormat } from "@/lib/api";

function ArenaInner() {
  const { matchId } = useParams<{ matchId: string }>();
  const searchParams = useSearchParams();
  const format = (searchParams.get("format") as DebateFormat) || "ap";
  
  const { session, user } = useAuth();
  const router = useRouter();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  
  // Microphone Tracking
  const [isRecording, setIsRecording] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  const {
    connect, disconnect, sendEvent, getSocket,
    connected, transcript, aiBufferedText, aiThoughtComplete,
    isMatchComplete, currentSpeaker, currentSpeakerRole,
    adjudicationComplete, adjudicationMessage
  } = useArenaStore();

  useEffect(() => {
    if (session?.access_token && matchId) {
      connect(matchId, session.access_token);
    }
    return () => disconnect();
  }, [matchId, session?.access_token]);

    // START_MATCH is now handled natively within arenaStore upon successful WebSocket onopen.
    // We no longer trigger it here to avoid React StrictMode duplicate events.

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

  // Production-Grade MediaRecorder Streaming
  const toggleMic = async () => {
    if (isRecording) {
      mediaRecorder.current?.stop();
      mediaRecorder.current?.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
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
    console.log("[Arena] Requesting end turn...");
    try {
      sendEvent({ action: "END_TURN" });
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

      <div className="flex-1 flex overflow-hidden z-10 w-full max-w-7xl mx-auto">
        
        {/* Left Sidebar: Debate Schedule */}
        <aside className="hidden lg:flex w-72 flex-col border-r border-indigo-500/20 bg-indigo-950/20 backdrop-blur-xl p-6 overflow-y-auto scrollbar-hide">
          <h2 className="text-sm font-black uppercase tracking-widest text-indigo-300 mb-6 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Speaker Schedule
          </h2>
          
          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-500/20 before:via-purple-500/20 before:to-transparent">
            {roles.map((roleKey, index) => {
              const isCurrent = currentSpeakerRole 
                 ? currentSpeakerRole.toLowerCase().replace(/ /g, "_") === roleKey 
                 : index === Math.min(Math.max(0, Math.floor(transcript.length)), roles.length - 1);
                 
              const isPast = index < Math.min(transcript.length, roles.length - 1);
              const side = ROLE_TO_SIDE[roleKey];
              const isGov = side === "government";

              return (
                <div key={roleKey} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${
                      isCurrent 
                        ? 'bg-indigo-600 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] z-10' 
                        : isPast 
                          ? 'bg-indigo-950 border-indigo-800' 
                          : 'bg-black border-slate-800'
                    }`}>
                    <span className={`text-xs font-bold ${isCurrent ? 'text-white' : 'text-slate-500'}`}>{index + 1}</span>
                  </div>
                  
                  <div className={`w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-xl border ${
                      isCurrent 
                        ? 'bg-indigo-900/40 border-indigo-500/50 shadow-lg glow' 
                        : isPast
                          ? 'bg-indigo-950/20 border-indigo-900/30 opacity-70'
                          : 'bg-black/40 border-slate-800 opacity-50'
                    }`}>
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${isGov ? 'text-blue-400' : 'text-red-400'}`}>
                        {ROLE_LABELS[roleKey]}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest">
                        {format === 'bp' ? ROLE_TO_TEAM_LABEL[roleKey] : (isGov ? 'Government' : 'Opposition')}
                      </span>
                    </div>
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
              {transcript.map((entry, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 15, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className={`flex items-end gap-3 ${entry.speaker === "AI" ? "justify-start" : "justify-end"}`}
                >
                  {entry.speaker === "AI" && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center shadow-lg border border-purple-400/30 flex-shrink-0">
                      <span className="text-xs font-bold text-white text-center leading-none">{entry.role ? entry.role[0] : "A"}</span>
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-6 shadow-2xl backdrop-blur-md ${
                    entry.speaker === "AI"
                      ? "bg-indigo-950/50 border border-indigo-500/30 text-indigo-50 rounded-bl-sm"
                      : "bg-blue-600/30 border border-blue-400/40 text-blue-50 rounded-br-sm"
                  }`}>
                    <p className={`text-xs font-black mb-3 tracking-widest uppercase flex items-center gap-2 ${entry.speaker === "AI" ? "text-purple-300" : "text-blue-300"}`}>
                      {entry.role || entry.speaker}
                    </p>
                    <p className="leading-relaxed text-sm sm:text-[15px] font-medium tracking-wide opacity-90 whitespace-pre-wrap">{entry.content}</p>
                  </div>

                  {entry.speaker === "Human" && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg border border-blue-400/30 flex-shrink-0">
                      <Hand className="w-5 h-5 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Activity Indicator (Thinking or Preparing) */}
            {currentSpeaker === "ai" && !aiBufferedText && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-3 justify-start">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-lg border border-gray-600/50 animate-pulse flex-shrink-0">
                    <span className="text-xs font-bold text-gray-400">
                      {aiThoughtComplete ? "..." : "AI"}
                    </span>
                  </div>
                <div className="max-w-[85%] rounded-3xl p-6 bg-gray-900/60 border border-gray-700/50 text-gray-300 rounded-bl-sm shadow-2xl backdrop-blur-md relative overflow-hidden">
                   {/* Shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite]" />
                  <p className="text-xs font-black mb-3 tracking-widest uppercase text-gray-400 flex items-center gap-2">
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
              </motion.div>
            )}

            {/* AI Streaming Text */}
            {aiBufferedText && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex items-end gap-3 justify-start">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center shadow-[0_0_15px_rgba(147,51,234,0.5)] border border-purple-400/50 flex-shrink-0 animate-pulse">
                      <span className="text-xs font-bold text-white">AI</span>
                  </div>
                <div className="max-w-[85%] rounded-3xl p-6 bg-indigo-950/50 border border-indigo-400/50 text-indigo-50 rounded-bl-sm shadow-[0_4px_30px_rgba(79,70,229,0.2)] backdrop-blur-md">
                  <p className="text-xs font-black mb-3 tracking-widest uppercase text-purple-300 flex items-center gap-2">
                    {currentSpeakerRole ? `${currentSpeakerRole} is Speaking` : "AI is Speaking"}
                    <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>●</motion.span>
                  </p>
                  <p className="leading-relaxed text-sm sm:text-[15px] font-medium tracking-wide opacity-90">{aiBufferedText}</p>
                </div>
              </motion.div>
            )}
            <div ref={transcriptEndRef} className="h-24" />
          </div>
          
          {/* Control Deck */}
          <footer className="mt-auto border-t border-indigo-500/20 bg-black/80 backdrop-blur-3xl p-6 z-20 pb-10 support-safe-area shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
              
              {/* Left Action: POI */}
              <div className="flex-1 flex justify-start w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  disabled={currentSpeaker !== 'ai'}
                  onClick={() => {
                    const poiText = window.prompt("Enter your Point of Information (e.g. 'On that point, wasn't the study proven flawed?'):");
                    if (poiText) {
                        sendEvent({ action: "POI_OFFERED", text: poiText });
                    }
                  }}
                  className={`h-14 px-6 rounded-2xl font-bold tracking-wide transition-all w-full sm:w-auto shadow-lg ${
                    currentSpeaker !== 'ai'
                      ? 'bg-transparent border-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                      : 'bg-orange-500/10 border-orange-500/50 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                  }`}
                >
                  <Hand className="w-5 h-5 mr-2" />
                  Offer POI
                </Button>
              </div>

              {/* Microphone */}
              <div className="flex-[2] flex justify-center w-full relative">
                {isRecording && (
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0.8 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="absolute inset-0 m-auto w-16 h-16 bg-emerald-500 rounded-full z-0"
                    />
                )}
                
                <Button 
                  size="lg" 
                  onClick={toggleMic}
                  disabled={currentSpeaker === 'ai'}
                  className={`relative z-10 h-16 px-12 rounded-full shadow-2xl transition-all duration-300 font-black tracking-widest text-sm uppercase w-full sm:w-auto ${
                    currentSpeaker === 'ai' 
                      ? 'bg-indigo-950/40 text-indigo-400/50 border border-indigo-900/50 cursor-not-allowed scale-95' 
                      : isRecording
                      ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-2 border-red-400 shadow-[0_0_40px_rgba(239,68,68,0.7)] hover:scale-105 active:scale-95'
                      : 'bg-gradient-to-r from-emerald-400 to-emerald-600 text-black border-none shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:shadow-[0_0_40px_rgba(16,185,129,0.7)] hover:scale-105 active:scale-95'
                  }`}
                >
                  {currentSpeaker === 'ai' ? (
                    <div className="flex items-center gap-3">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                      </span>
                      AI holds floor
                    </div>
                  ) : isRecording ? (
                    <>
                      <Mic className="w-6 h-6 mr-3 animate-pulse" />
                      Listening... (Tap to Pause)
                    </>
                  ) : (
                    <>
                      <Mic className="w-6 h-6 mr-3" />
                      Your Turn — Tap to Speak
                    </>
                  )}
                </Button>
              </div>

              {/* Right Action: End Turn */}
              <div className="flex-1 flex justify-end w-full sm:w-auto">
                 <Button 
                  variant="outline" 
                  disabled={currentSpeaker === 'ai'}
                  onClick={handleEndTurn}
                  className={`h-14 px-6 rounded-2xl font-bold tracking-wide transition-all w-full sm:w-auto shadow-lg ${
                    currentSpeaker === 'ai'
                      ? 'bg-transparent border-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                      : 'bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                  }`}
                >
                  End My Turn
                  <SkipForward className="w-5 h-5 ml-2 text-emerald-400" />
                </Button>
              </div>
            </div>
          </footer>
        </main>
      </div>

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

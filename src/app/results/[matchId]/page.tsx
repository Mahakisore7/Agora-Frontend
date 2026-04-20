"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { getDebateResults, getAdjudicationStatus, DebateFormat } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, ChevronDown, ChevronUp, Share2,
  ArrowLeft, RotateCcw, Gavel, Brain,
  Target, Mic2, BookOpen, Users, TrendingUp, TrendingDown, Minus
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface MacroClash {
  id: number;
  theme: string;
  description: string;
  government_position: string;
  opposition_position: string;
}

interface WCMEntry {
  clash_id: number;
  clash_theme: string;
  weight: number;
  weight_reasoning: string;
  delta: number;
  delta_reasoning: string;
  weighted_score: number;
}

interface PillarScore {
  definition: string;
  government_score: number;
  opposition_score: number;
  reasoning: string;
}

interface PillarBreakdown {
  matter: PillarScore;
  manner: PillarScore;
  method: PillarScore;
  role: PillarScore;
  pillar_reasoning: string;
}

interface SpeakerScore {
  role: string;
  side: string;
  score: number;
  argument_quality: number;
  evidence_usage: number;
  responsiveness: number;
  structure: number;
  persona: number;
  feedback: string;
}

interface AdjudicationSummary {
  adjudication: string;
  key_decision_1: string;
  key_decision_2: string;
  key_decision_3?: string;
}

interface AdjudicationResult {
  clashes: MacroClash[];
  wcm_matrix: WCMEntry[];
  net_logic_score: number;
  pillar_breakdown: PillarBreakdown;
  speaker_scores: SpeakerScore[];
  summary: AdjudicationSummary;
  session_id: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pillarTotal(pb: PillarBreakdown, side: "government" | "opposition") {
  return (
    pb.matter[`${side}_score`] +
    pb.manner[`${side}_score`] +
    pb.method[`${side}_score`] +
    pb.role[`${side}_score`]
  );
}

function winnerFromPillars(pb: PillarBreakdown): "Government" | "Opposition" | "Tie" {
  const g = pillarTotal(pb, "government");
  const o = pillarTotal(pb, "opposition");
  if (g > o) return "Government";
  if (o > g) return "Opposition";
  return "Tie";
}

// Animated counting number
function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); return; }
      setDisplay(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display}</>;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PillarBar({ label, govScore, oppScore, reasoning }: {
  label: string; govScore: number; oppScore: number; reasoning: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const govPct = (govScore / 25) * 100;
  const oppPct = (oppScore / 25) * 100;
  const govWins = govScore >= oppScore;

  const ICONS: Record<string, React.ReactNode> = {
    Matter: <Brain className="w-4 h-4" />,
    Manner: <Mic2 className="w-4 h-4" />,
    Method: <BookOpen className="w-4 h-4" />,
    Role: <Users className="w-4 h-4" />,
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 flex-shrink-0">
          {ICONS[label]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-200 uppercase tracking-wider">{label}</span>
            <span className="text-xs text-slate-500">/25 each</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Gov bar */}
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${govPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
              />
            </div>
            <div className="flex items-center gap-1 text-xs font-mono w-16 justify-center">
              <span className="text-blue-400 font-bold">{govScore}</span>
              <span className="text-slate-600">vs</span>
              <span className="text-rose-400 font-bold">{oppScore}</span>
            </div>
            {/* Opp bar */}
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden flex justify-end">
              <motion.div
                className="h-full bg-gradient-to-l from-rose-600 to-rose-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${oppPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
              />
            </div>
          </div>
        </div>
        <div className="flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-0 text-sm text-slate-400 leading-relaxed border-t border-white/5 mt-0 pt-3">
              <span className={`font-semibold ${govWins ? "text-blue-400" : "text-rose-400"}`}>
                {govWins ? "Government" : "Opposition"}
              </span>{" "}
              wins this pillar — {reasoning}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WCMRow({ entry }: { entry: WCMEntry }) {
  const [expanded, setExpanded] = useState(false);
  const govWins = entry.delta > 0;
  const tie = entry.delta === 0;

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${
      tie ? "border-slate-700 bg-slate-900/40" :
      govWins ? "border-blue-800/40 bg-blue-950/20" : "border-rose-800/40 bg-rose-950/20"
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:brightness-110 transition-all text-left"
      >
        {/* Weight dots */}
        <div className="flex gap-1 flex-shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i < entry.weight ? "bg-amber-400" : "bg-white/10"}`} />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-200 text-sm leading-snug">{entry.clash_theme}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Delta badge */}
          <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-mono font-bold ${
            tie ? "bg-slate-700 text-slate-400" :
            govWins ? "bg-blue-900/50 text-blue-300" : "bg-rose-900/50 text-rose-300"
          }`}>
            {tie ? <Minus className="w-3 h-3" /> : govWins ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {entry.delta > 0 ? "+" : ""}{entry.delta}
          </div>
          {/* Score */}
          <div className={`text-sm font-black font-mono w-8 text-right ${
            tie ? "text-slate-400" : govWins ? "text-blue-400" : "text-rose-400"
          }`}>
            {entry.weighted_score > 0 ? "+" : ""}{entry.weighted_score}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 border-t border-white/5 pt-3 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Weight Reasoning</p>
              <p className="text-sm text-slate-400">{entry.weight_reasoning}</p>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-3">Winner Reasoning</p>
              <p className="text-sm text-slate-400">{entry.delta_reasoning}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SpeakerCard({ speaker, index }: { speaker: SpeakerScore; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const isGov = speaker.side === "Government";
  const subScores = [
    { label: "Argument", key: "argument_quality", icon: "🧠" },
    { label: "Evidence", key: "evidence_usage", icon: "📊" },
    { label: "Response", key: "responsiveness", icon: "⚡" },
    { label: "Structure", key: "structure", icon: "📐" },
    { label: "Persona", key: "persona", icon: "🎭" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`rounded-xl border overflow-hidden ${
        isGov ? "border-blue-800/30 bg-blue-950/10" : "border-rose-800/30 bg-rose-950/10"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center gap-4 hover:brightness-110 transition-all"
      >
        {/* Rank circle */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
          isGov ? "bg-blue-900/50 text-blue-300" : "bg-rose-900/50 text-rose-300"
        }`}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-bold text-slate-200 text-sm">{speaker.role}</p>
          <p className={`text-xs font-semibold uppercase tracking-widest ${
            isGov ? "text-blue-500" : "text-rose-500"
          }`}>{speaker.side}</p>
        </div>
        {/* Score ring */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-2xl font-black text-white">{speaker.score}</span>
          <span className="text-sm text-slate-500">/100</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-600 ml-1" /> : <ChevronDown className="w-4 h-4 text-slate-600 ml-1" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
              {/* Sub-score bars */}
              <div className="grid grid-cols-5 gap-2">
                {subScores.map((s) => {
                  const val = (speaker as unknown as Record<string, number>)[s.key] ?? 0;
                  return (
                    <div key={s.key} className="text-center">
                      <div className="text-lg mb-1">{s.icon}</div>
                      <div className="relative h-20 flex items-end justify-center mb-1">
                        <motion.div
                          className={`w-6 rounded-t-md ${isGov ? "bg-blue-500/60" : "bg-rose-500/60"}`}
                          initial={{ height: 0 }}
                          animate={{ height: `${(val / 10) * 100}%` }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                        />
                      </div>
                      <p className="text-xs font-bold text-white">{val}/10</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</p>
                    </div>
                  );
                })}
              </div>
              {/* Feedback */}
              <div className={`rounded-lg p-4 border ${
                isGov ? "bg-blue-950/30 border-blue-800/20" : "bg-rose-950/30 border-rose-800/20"
              }`}>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">AI Coach Feedback</p>
                <p className="text-sm text-slate-300 leading-relaxed italic">&ldquo;{speaker.feedback}&rdquo;</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Loading / Polling State ──────────────────────────────────────────────────

function AdjudicationLoading({ phase }: { phase: string }) {
  const phases = [
    "Phase 1/5: Extracting macro-clashes...",
    "Phase 2/5: Building Weighted Clash Matrix...",
    "Phase 3/5: Analyzing WUDC pillars...",
    "Phase 4/5: Grading individual speakers...",
    "Phase 5/5: Writing adjudication statement...",
  ];
  const [currentPhase, setCurrentPhase] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCurrentPhase(p => Math.min(p + 1, phases.length - 1)), 10000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-900/15 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-900/15 blur-[120px] rounded-full" />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 text-center max-w-md px-6"
      >
        <div className="w-20 h-20 rounded-full border-2 border-indigo-500/30 flex items-center justify-center mx-auto mb-6 relative">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
          <Gavel className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-3">AI Adjudicator Deliberating</h2>
        <p className="text-slate-400 mb-6 leading-relaxed">
          The 5-phase evaluation pipeline is running. This typically takes 40–60 seconds.
        </p>
        <div className="space-y-2 mb-8">
          {phases.map((p, i) => (
            <div key={i} className={`flex items-center gap-3 text-sm py-2 px-4 rounded-lg transition-all ${
              i < currentPhase ? "bg-green-900/20 text-green-400" :
              i === currentPhase ? "bg-indigo-900/30 text-indigo-300 ring-1 ring-indigo-500/30" :
              "text-slate-600"
            }`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                i < currentPhase ? "bg-green-500" :
                i === currentPhase ? "bg-indigo-400 animate-pulse" : "bg-slate-600"
              }`} />
              {p}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-600">Page will refresh automatically when results are ready.</p>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ResultsInner() {
  const { matchId } = useParams<{ matchId: string }>();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const router = useRouter();

  const format = (searchParams.get("format") as DebateFormat) || "ap";

  const [results, setResults] = useState<AdjudicationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchResults = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const data = await getDebateResults(matchId, session.access_token, format);
      setResults(data);
      setLoading(false);
      setPolling(false);
    } catch {
      // Not ready yet — start polling the status endpoint
      setPolling(true);
    }
  }, [matchId, session?.access_token, format]);

  // Poll status every 4 seconds when results aren't ready yet
  useEffect(() => {
    if (!session?.access_token || !matchId) return;
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    if (!polling || !session?.access_token) return;
    const interval = setInterval(async () => {
      try {
        const status = await getAdjudicationStatus(matchId, session.access_token, format);
        if (status.status === "completed") {
          clearInterval(interval);
          fetchResults();
        } else if (status.status === "error") {
          clearInterval(interval);
          setError("Adjudication failed. Please try again.");
          setLoading(false);
          setPolling(false);
        }
      } catch { /* keep polling */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [polling, session?.access_token, matchId, format, fetchResults]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && polling) return <AdjudicationLoading phase="" />;

  if (loading) return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center">
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }}
        className="text-slate-400 text-lg">Loading results...</motion.div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-rose-400">{error}</p>
        <Button onClick={() => router.push("/dashboard")} variant="outline">Back to Dashboard</Button>
      </div>
    </div>
  );

  if (!results) return null;

  const pb = results.pillar_breakdown;
  const winner = winnerFromPillars(pb);
  const govTotal = pillarTotal(pb, "government");
  const oppTotal = pillarTotal(pb, "opposition");
  const netScore = results.net_logic_score;
  const isGovWin = winner === "Government";

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay }
  });

  return (
    <div className="min-h-screen bg-[#050510] text-white relative overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute top-0 left-1/4 w-[600px] h-[400px] blur-[140px] rounded-full opacity-20 ${
          isGovWin ? "bg-blue-700" : "bg-rose-700"
        }`} />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] bg-purple-900/30 blur-[120px] rounded-full" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050510]/80 backdrop-blur-xl px-6 py-3 flex items-center justify-between">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>
        <div className="flex items-center gap-2">
          <Gavel className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-bold text-slate-300 uppercase tracking-widest">Adjudication Results</span>
          <Badge variant="outline" className="ml-2 text-xs border-indigo-500/30 text-indigo-400">
            {format.toUpperCase()} Format
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleShare} variant="outline" size="sm"
            className="border-white/10 bg-white/[0.03] text-slate-300 hover:text-white text-xs gap-2">
            <Share2 className="w-3 h-3" />
            {copied ? "Copied!" : "Share"}
          </Button>
          <Button asChild size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-2">
            <Link href="/debate/setup">
              <RotateCcw className="w-3 h-3" />
              Debate Again
            </Link>
          </Button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-10 relative z-10">

        {/* ── Section 1: Score Banner ─────────────────────────────────── */}
        <motion.section {...fadeUp(0)} className="text-center space-y-6">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
            className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl border text-2xl font-black ${
              isGovWin
                ? "bg-blue-500/10 border-blue-500/30 text-blue-300 shadow-[0_0_60px_rgba(59,130,246,0.15)]"
                : winner === "Tie"
                  ? "bg-slate-500/10 border-slate-500/30 text-slate-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-[0_0_60px_rgba(239,68,68,0.15)]"
            }`}
          >
            <Trophy className="w-7 h-7" />
            {winner} Wins
          </motion.div>

          {/* Score cards */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            {/* Government */}
            <motion.div {...fadeUp(0.2)}
              className={`rounded-2xl border p-6 text-center ${
                isGovWin
                  ? "border-blue-500/40 bg-blue-950/20 shadow-[0_0_40px_rgba(59,130,246,0.1)]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">Government</p>
              <p className="text-6xl font-black text-white tabular-nums">
                <AnimatedNumber value={govTotal} />
              </p>
              <p className="text-slate-500 text-sm mt-1">/ 100</p>
              {isGovWin && (
                <Badge className="mt-3 bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">Winner</Badge>
              )}
            </motion.div>
            {/* Opposition */}
            <motion.div {...fadeUp(0.25)}
              className={`rounded-2xl border p-6 text-center ${
                !isGovWin && winner !== "Tie"
                  ? "border-rose-500/40 bg-rose-950/20 shadow-[0_0_40px_rgba(239,68,68,0.1)]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-2">Opposition</p>
              <p className="text-6xl font-black text-white tabular-nums">
                <AnimatedNumber value={oppTotal} />
              </p>
              <p className="text-slate-500 text-sm mt-1">/ 100</p>
              {!isGovWin && winner !== "Tie" && (
                <Badge className="mt-3 bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs">Winner</Badge>
              )}
            </motion.div>
          </div>
        </motion.section>

        {/* ── Section 2: Adjudication Statement ──────────────────────── */}
        <motion.section {...fadeUp(0.3)}>
          <SectionHeader icon={<Gavel className="w-5 h-5" />} title="Adjudication Statement" />
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/10 p-6">
            <p className="text-slate-200 leading-relaxed text-[15px] mb-6">
              {results.summary.adjudication}
            </p>
            <div className="space-y-3">
              {[results.summary.key_decision_1, results.summary.key_decision_2, results.summary.key_decision_3]
                .filter(Boolean)
                .map((decision, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{decision}</p>
                  </div>
                ))}
            </div>
          </div>
        </motion.section>

        {/* ── Section 3: WUDC Pillar Breakdown ───────────────────────── */}
        <motion.section {...fadeUp(0.35)}>
          <SectionHeader icon={<Target className="w-5 h-5" />} title="WUDC Pillar Breakdown" subtitle="Each pillar is scored 0–25. Total = 100." />
          <div className="space-y-2">
            {[
              { label: "Matter", data: pb.matter },
              { label: "Manner", data: pb.manner },
              { label: "Method", data: pb.method },
              { label: "Role",   data: pb.role   },
            ].map(({ label, data }) => (
              <PillarBar
                key={label}
                label={label}
                govScore={data.government_score}
                oppScore={data.opposition_score}
                reasoning={data.reasoning}
              />
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] px-5 py-3 text-xs text-slate-500 italic">
            {pb.pillar_reasoning}
          </div>
        </motion.section>

        {/* ── Section 4: Weighted Clash Matrix ────────────────────────── */}
        <motion.section {...fadeUp(0.4)}>
          <SectionHeader icon={<Brain className="w-5 h-5" />} title="Weighted Clash Matrix" subtitle={`Net Logic Score: ${netScore >= 0 ? "+" : ""}${netScore} → ${netScore > 0 ? "Government" : netScore < 0 ? "Opposition" : "Tied"} logical win`} />
          <div className="space-y-2">
            {results.wcm_matrix.map((entry) => (
              <WCMRow key={entry.clash_id} entry={entry} />
            ))}
          </div>
          {/* Net score summary */}
          <div className={`mt-3 rounded-xl border px-5 py-3 flex items-center justify-between ${
            netScore > 0 ? "border-blue-700/30 bg-blue-950/10" :
            netScore < 0 ? "border-rose-700/30 bg-rose-950/10" :
            "border-slate-700/30 bg-slate-900/10"
          }`}>
            <span className="text-sm text-slate-400 font-medium">Net Logic Score</span>
            <div className="flex items-center gap-2">
              {netScore > 0 ? <TrendingUp className="w-4 h-4 text-blue-400" /> :
               netScore < 0 ? <TrendingDown className="w-4 h-4 text-rose-400" /> :
               <Minus className="w-4 h-4 text-slate-400" />}
              <span className={`text-xl font-black tabular-nums ${
                netScore > 0 ? "text-blue-400" : netScore < 0 ? "text-rose-400" : "text-slate-400"
              }`}>
                {netScore > 0 ? "+" : ""}{netScore}
              </span>
            </div>
          </div>
        </motion.section>

        {/* ── Section 5: Speaker Scores ────────────────────────────────── */}
        <motion.section {...fadeUp(0.45)}>
          <SectionHeader icon={<Mic2 className="w-5 h-5" />} title="Speaker Performance" subtitle="Graded on Argument, Evidence, Responsiveness, Structure, Persona (each 0–10)" />
          <div className="space-y-3">
            {results.speaker_scores.map((s, i) => (
              <SpeakerCard key={s.role} speaker={s} index={i} />
            ))}
          </div>
        </motion.section>

        {/* ── Footer CTA ──────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.5)} className="flex justify-center gap-4 pt-4 pb-12">
          <Button asChild variant="outline" className="border-white/10 bg-white/[0.03] text-slate-300 hover:text-white h-12 px-8 gap-2">
            <Link href="/history"><Users className="w-4 h-4" />Match History</Link>
          </Button>
          <Button asChild className="h-12 px-8 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-[0_0_24px_rgba(79,70,229,0.4)]">
            <Link href="/debate/setup"><RotateCcw className="w-4 h-4" />Debate Again</Link>
          </Button>
        </motion.div>

      </div>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-black text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050510] flex items-center justify-center">
        <div className="text-slate-400 animate-pulse">Loading...</div>
      </div>
    }>
      <ResultsInner />
    </Suspense>
  );
}

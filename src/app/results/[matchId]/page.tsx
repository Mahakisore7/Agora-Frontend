"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { getDebateResults } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ResultsPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { session } = useAuth();
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.access_token) return;
    getDebateResults(matchId, session.access_token)
      .then(setResults)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [matchId, session?.access_token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground animate-pulse">Loading results...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">{error}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-8 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent pb-2">Debate Results</h1>
          <Badge variant="outline" className={`text-xl px-6 py-2 border-2 ${results?.winning_team === "Government" ? "bg-blue-500/10 border-blue-500/50 text-blue-300" : "bg-red-500/10 border-red-500/50 text-red-300"} shadow-lg`}>
            {results?.winning_team} Wins 🏆
          </Badge>
          <p className="text-indigo-200/80 max-w-2xl mx-auto text-lg leading-relaxed mt-4">{results?.overall_analysis}</p>
        </div>

        {/* Score summary */}
        <div className="grid grid-cols-2 gap-6">
          <Card className={`border-border/50 bg-card/60 backdrop-blur-xl ${results?.winning_team === "Government" ? "ring-2 ring-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.2)]" : ""}`}>
            <CardHeader className="text-center">
              <CardTitle className="text-blue-400 uppercase tracking-widest text-sm font-bold">Government</CardTitle>
              <CardDescription className="text-5xl font-black text-white mt-2">
                {results?.gov_total_score}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className={`border-border/50 bg-card/60 backdrop-blur-xl ${results?.winning_team === "Opposition" ? "ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]" : ""}`}>
            <CardHeader className="text-center">
              <CardTitle className="text-red-400 uppercase tracking-widest text-sm font-bold">Opposition</CardTitle>
              <CardDescription className="text-5xl font-black text-white mt-2">
                {results?.opp_total_score}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Speaker scores */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Speaker Scores</CardTitle>
            <CardDescription>Individual WUDC-style speaker breakdowns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results?.speaker_scores?.map((s: any) => (
              <div key={s.speaker_role} className="border border-white/10 bg-black/40 rounded-xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                  <div>
                    <p className="font-bold text-lg text-slate-200">{s.speaker_role}</p>
                    <p className={`text-xs font-bold uppercase tracking-widest ${s.speaker_side === "Government" ? "text-blue-400" : "text-red-400"}`}>{s.speaker_side}</p>
                  </div>
                  <div className="text-3xl font-black text-white">{s.total_score}<span className="text-base font-normal text-muted-foreground">/100</span></div>
                </div>
                <div className="grid grid-cols-5 gap-4 text-sm mt-4">
                  {["content", "strategy", "style", "structure", "poi"].map((k) => (
                    <div key={k} className="text-center bg-white/5 rounded-lg py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{k}</p>
                      <p className="font-bold text-lg text-slate-300">{s[`${k}_score`]}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 bg-indigo-950/30 border border-indigo-500/20 p-4 rounded-lg">
                  <p className="text-sm text-indigo-200/90 italic leading-relaxed">&quot;{s.coaching_feedback}&quot;</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Clash Table */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Clash Analysis</CardTitle>
            <CardDescription>Key argument clashes and who won them</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results?.clash_table?.map((clash: any, i: number) => (
                <div key={i} className="border border-white/10 bg-black/40 rounded-xl p-5">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <p className="font-bold text-slate-200 leading-tight">{clash.argument}</p>
                    <Badge variant="outline" className={`shrink-0 ${
                      clash.winner === "Draw" ? "border-slate-500 text-slate-400" :
                      clash.winner === "Government" ? "border-blue-500/50 bg-blue-500/10 text-blue-400" :
                      "border-red-500/50 bg-red-500/10 text-red-400"
                    }`}>
                      {clash.winner}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{clash.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4 pt-4">
          <Button asChild variant="outline" className="h-12 px-8 border-slate-700 hover:bg-slate-800 bg-transparent text-white">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
          <Button asChild className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)]">
            <Link href="/debate/setup">Debate Again</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

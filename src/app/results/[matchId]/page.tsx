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
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Debate Results</h1>
          <Badge variant="default" className="text-lg px-4 py-1">
            {results?.winning_team} Wins 🏆
          </Badge>
          <p className="text-muted-foreground">{results?.overall_analysis}</p>
        </div>

        {/* Score summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card className={results?.winning_team === "Government" ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle>Government</CardTitle>
              <CardDescription className="text-3xl font-bold text-foreground">
                {results?.gov_total_score}
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className={results?.winning_team === "Opposition" ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle>Opposition</CardTitle>
              <CardDescription className="text-3xl font-bold text-foreground">
                {results?.opp_total_score}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Speaker scores */}
        <Card>
          <CardHeader><CardTitle>Speaker Scores</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {results?.speaker_scores?.map((s: any) => (
              <div key={s.speaker_role} className="border rounded p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{s.speaker_role}</p>
                    <p className="text-sm text-muted-foreground">{s.speaker_side}</p>
                  </div>
                  <div className="text-2xl font-bold">{s.total_score}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
                </div>
                <div className="grid grid-cols-5 gap-2 text-sm">
                  {["content", "strategy", "style", "structure", "poi"].map((k) => (
                    <div key={k} className="text-center">
                      <p className="text-muted-foreground capitalize">{k}</p>
                      <p className="font-semibold">{s[`${k}_score`]}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground italic">&quot;{s.coaching_feedback}&quot;</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Clash Table */}
        <Card>
          <CardHeader>
            <CardTitle>Clash Analysis</CardTitle>
            <CardDescription>Key argument clashes and who won them</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results?.clash_table?.map((clash: any, i: number) => (
                <div key={i} className="border rounded p-3">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-medium">{clash.argument}</p>
                    <Badge variant={clash.winner === "Draw" ? "secondary" : "default"}>
                      {clash.winner}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{clash.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4">
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
          <Button asChild>
            <Link href="/debate/setup">Debate Again</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

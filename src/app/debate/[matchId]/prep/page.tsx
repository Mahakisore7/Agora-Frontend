"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { getCasePrep, CasePrepData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CasePrepPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [prep, setPrep] = useState<CasePrepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.access_token || !matchId) return;

    getCasePrep(matchId, session.access_token)
      .then(setPrep)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [matchId, session?.access_token]);

  // ── Early return: Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse text-lg">
          Loading your case preparation...
        </p>
      </div>
    );
  }

  // ── Early return: Error ──
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Main render: Case Prep Review ──
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Your Case Prep</h1>
          <Badge variant="default" className="text-lg px-4 py-1 capitalize">
            {prep?.side}
          </Badge>
          <p className="text-muted-foreground">
            Review your arguments before entering the arena
          </p>
        </div>

        {/* Arguments Section */}
        <Card>
          <CardHeader>
            <CardTitle>Arguments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {prep?.arguments.map((arg, i) => (
              <div key={i} className="border rounded p-4 space-y-1">
                <p className="font-medium">Argument {i + 1}</p>
                <p><strong>Claim:</strong> {arg.claim}</p>
                {arg.warrant && <p><strong>Warrant:</strong> {arg.warrant}</p>}
                {arg.impact && <p><strong>Impact:</strong> {arg.impact}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Counter-Arguments Section */}
        <Card>
          <CardHeader>
            <CardTitle>Counter-Arguments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {prep?.counter_arguments.map((ca, i) => (
              <div key={i} className="border rounded p-4">
                <p>{typeof ca === "string" ? ca : JSON.stringify(ca)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Evidence Section */}
        <Card>
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {prep?.evidence.map((ev, i) => (
              <div key={i} className="border rounded p-4">
                <p>{typeof ev === "string" ? ev : JSON.stringify(ev)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Action Button */}
        <div className="flex justify-center pt-4">
          <Button size="lg" onClick={() => router.push(`/debate/${matchId}`)}>
            I'm Ready — Enter the Arena →
          </Button>
        </div>

      </div>
    </div>
  );
}
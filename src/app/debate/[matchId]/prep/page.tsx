"use client";

/**
 * CASE PREP PAGE — /debate/[matchId]/prep?format=ap
 *
 * WHAT THIS PAGE DOES:
 * After creating a match, the user is sent here to review their
 * AI-generated case preparation before entering the live arena.
 *
 * HOW IT WORKS:
 * 1. Reads `matchId` from the URL path and `format` from query params
 * 2. Calls GET /api/v1/{format}/matches/{matchId}/case-prep
 * 3. Backend returns: { arguments, counter_arguments, evidence }
 * 4. User reviews these, then clicks "Enter the Arena"
 * 5. Navigates to /debate/{matchId}?format={format} (the live arena)
 *
 * WHY CASE PREP MATTERS:
 * In real debate tournaments, teams get 15-30 minutes to prepare.
 * The AI gives the user structured arguments so they're not debating blind.
 * This mirrors real-world debate preparation flow.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { getCasePrep, CasePrepData, DebateFormat } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CasePrepPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const router = useRouter();

  /**
   * Read the format from the URL query param.
   * e.g. /debate/abc-123/prep?format=ap → format = "ap"
   *
   * This was set by the setup page when it redirected here.
   * We default to "ap" if not present (backwards compatibility).
   */
  const format = (searchParams.get("format") as DebateFormat) || "ap";

  const [prep, setPrep] = useState<CasePrepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.access_token || !matchId) return;

    /**
     * Fetch case prep from the format-specific endpoint:
     * GET /api/v1/ap/matches/{matchId}/case-prep   (if AP)
     * GET /api/v1/bp/matches/{matchId}/case-prep   (if BP)
     */
    getCasePrep(format, matchId, session.access_token)
      .then(setPrep)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [matchId, session?.access_token, format]);

  // ── Early return: Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground animate-pulse text-lg">
            Generating your case preparation...
          </p>
          <p className="text-sm text-muted-foreground">
            Our AI is building arguments, counter-arguments, and evidence for
            you.
          </p>
        </div>
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
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Your Case Prep</h1>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-sm">
              {format.toUpperCase()}
            </Badge>
            <Badge variant="default" className="text-lg px-4 py-1 capitalize">
              {prep?.side}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Review your arguments before entering the arena
          </p>
        </div>

        {/* Arguments Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 text-xs font-bold flex items-center justify-center">
                1
              </span>
              Arguments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {prep?.arguments.map((arg, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-2">
                <p className="font-medium text-sm text-muted-foreground">
                  Argument {i + 1}
                </p>
                <p>
                  <strong>Claim:</strong> {arg.claim}
                </p>
                {arg.warrant && (
                  <p>
                    <strong>Warrant:</strong> {arg.warrant}
                  </p>
                )}
                {arg.impact && (
                  <p>
                    <strong>Impact:</strong> {arg.impact}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Counter-Arguments Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-500 text-xs font-bold flex items-center justify-center">
                2
              </span>
              Counter-Arguments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {prep?.counter_arguments.map((ca, i) => (
              <div key={i} className="border rounded-lg p-4">
                <p>{typeof ca === "string" ? ca : JSON.stringify(ca)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Evidence Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-500 text-xs font-bold flex items-center justify-center">
                3
              </span>
              Evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {prep?.evidence.map((ev, i) => (
              <div key={i} className="border rounded-lg p-4">
                <p>{typeof ev === "string" ? ev : JSON.stringify(ev)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Action Button */}
        <div className="flex justify-center pt-4">
          <Button
            size="lg"
            className="h-14 px-12 text-base font-bold"
            onClick={() =>
              router.push(`/debate/${matchId}?format=${format}`)
            }
          >
            I&apos;m Ready — Enter the Arena →
          </Button>
        </div>
      </div>
    </div>
  );
}
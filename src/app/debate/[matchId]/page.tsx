"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useArenaStore } from "@/store/arenaStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function LiveArenaPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [poiText, setPoiText] = useState("");
  const [poiOpen, setPoiOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds elapsed in current speech

  const {
    connect, disconnect, sendEvent,
    connected, transcript, aiBufferedText,
    isMatchComplete, verdict,
  } = useArenaStore();

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (session?.access_token && matchId) {
      connect(matchId, session.access_token);
    }
    return () => disconnect();
  }, [matchId, session?.access_token]);

  // Track elapsed time for POI window
  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, aiBufferedText]);

  // Redirect to results when match complete
  useEffect(() => {
    if (isMatchComplete) {
      setTimeout(() => router.push(`/results/${matchId}`), 2000);
    }
  }, [isMatchComplete]);

  const handleEndTurn = () => sendEvent({ action: "END_TURN" });

  const handleOfferPOI = () => {
    if (!poiText.trim()) return;
    sendEvent({ action: "POI_OFFERED", text: poiText, elapsed_seconds: elapsed });
    setPoiText("");
    setPoiOpen(false);
  };

  // POI window open between 60s and 240s
  const poiWindowOpen = elapsed >= 60 && elapsed <= 240;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold">Live Debate</h1>
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Connected" : "Connecting..."}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl mx-auto w-full">
        {transcript.map((entry, i) => (
          <div key={i} className={`flex ${entry.speaker === "AI" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-lg p-4 ${
              entry.speaker === "AI"
                ? "bg-muted text-foreground"
                : "bg-primary text-primary-foreground"
            }`}>
              <p className="text-xs font-medium mb-1 opacity-70">{entry.speaker}</p>
              <p>{entry.content}</p>
            </div>
          </div>
        ))}

        {/* AI streaming token buffer */}
        {aiBufferedText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-4 bg-muted text-foreground">
              <p className="text-xs font-medium mb-1 opacity-70">AI (typing...)</p>
              <p>{aiBufferedText}<span className="animate-pulse">|</span></p>
            </div>
          </div>
        )}

        {isMatchComplete && (
          <div className="text-center py-8">
            <p className="text-xl font-semibold">Debate Complete!</p>
            <p className="text-muted-foreground">Redirecting to results...</p>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Action bar */}
      <div className="border-t p-4 flex items-center gap-3 max-w-4xl mx-auto w-full">
        {/* POI offer */}
        {poiWindowOpen && (
          poiOpen ? (
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Type your POI question (max 15 words)..."
                value={poiText}
                onChange={(e) => setPoiText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOfferPOI()}
                maxLength={100}
              />
              <Button variant="outline" onClick={() => setPoiOpen(false)}>Cancel</Button>
              <Button onClick={handleOfferPOI}>Send POI</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setPoiOpen(true)}>
              🖐 Offer POI
            </Button>
          )
        )}

        <Button onClick={handleEndTurn} className="ml-auto">
          End Turn →
        </Button>
      </div>
    </div>
  );
}

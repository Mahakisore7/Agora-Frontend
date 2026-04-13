"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { createMatch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const SAMPLE_MOTIONS = [
  "This house believes that AI will do more harm than good",
  "This house would ban social media for under 18s",
  "This house believes that democracy is in decline",
];

export default function MatchSetupPage() {
  const { session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [motion, setMotion] = useState("");
  const [side, setSide] = useState<"government" | "opposition">("government");
  const [format, setFormat] = useState<"ap" | "bp">("ap");
  const [skillLevel, setSkillLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!motion.trim()) {
      toast({ title: "Missing Motion", description: "Please enter or choose a motion.", variant: "destructive" });
      return;
    }
    if (!session?.access_token) {
      toast({ title: "Not logged in", description: "Please log in again.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const result = await createMatch(
        { motion_text: motion, side, format, skill_level: skillLevel },
        session.access_token
      );
      router.push(`/debate/${result.match_id}`);
    } catch (err) {
      toast({ title: "Failed to create match", description: String(err), variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Set Up Your Debate</CardTitle>
          <CardDescription>Choose your motion, side, and format</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Motion */}
          <div className="space-y-2">
            <Label>Motion</Label>
            <Input
              placeholder="This house believes that..."
              value={motion}
              onChange={(e) => setMotion(e.target.value)}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {SAMPLE_MOTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMotion(m)}
                  className="text-xs bg-muted px-2 py-1 rounded hover:bg-primary/20 transition-colors text-left"
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Side */}
          <div className="space-y-2">
            <Label>Your Side</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["government", "opposition"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSide(s)}
                  className={`p-3 rounded border text-sm font-medium capitalize transition-colors
                    ${side === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
                >
                  {s === "government" ? "🏛 Government" : "⚖️ Opposition"}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setFormat("ap")}
                className={`p-3 rounded border text-sm font-medium transition-colors
                  ${format === "ap" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                Asian Parliamentary (AP)
              </button>
              <button onClick={() => setFormat("bp")}
                className={`p-3 rounded border text-sm font-medium transition-colors
                  ${format === "bp" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                British Parliamentary (BP)
              </button>
            </div>
          </div>

          {/* Skill Level */}
          <div className="space-y-2">
            <Label>Skill Level</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["beginner", "intermediate", "advanced"] as const).map((l) => (
                <button key={l} onClick={() => setSkillLevel(l)}
                  className={`p-3 rounded border text-sm font-medium capitalize transition-colors
                    ${skillLevel === l ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={handleStart} disabled={loading}>
            {loading ? "Creating match..." : "Start Debate →"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

/**
 * DEBATE SETUP PAGE — /debate/setup
 *
 * This is WHERE the user configures their debate before creating it.
 *
 * FLOW:
 * 1. User picks a format (AP or BP)
 * 2. User picks a role (PM, LO, DPM, etc.)
 *    → The SIDE is auto-determined from the role
 *    → e.g. picking "Prime Minister" auto-selects "Government"
 * 3. User enters or picks a motion (debate topic)
 * 4. Clicks "Start Debate"
 * 5. Frontend calls POST /api/v1/{format}/matches
 * 6. Backend creates Motion + CasePrep + DebateSession + Redis state
 * 7. Frontend redirects to /debate/{matchId}/prep?format={format}
 *
 * WHY ROLE SELECTION MATTERS:
 * The backend builds an 6-speaker (AP) or 8-speaker (BP) schedule.
 * The role tells the backend which turn slot is "human" vs "ai".
 * Without it, the backend doesn't know when the user should speak.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  createMatch,
  ROLE_TO_SIDE,
  ROLE_LABELS,
  FORMAT_ROLES,
  DebateFormat,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Info } from "lucide-react";

const SAMPLE_MOTIONS = [
  "This house believes that AI will do more harm than good",
  "This house would ban social media for under 18s",
  "This house believes that democracy is in decline",
];

/** Format metadata for display */
const FORMAT_INFO = {
  ap: {
    label: "Asian Parliamentary",
    shortLabel: "AP",
    speakers: 6,
    teams: 2,
    description: "3 speakers per side. Government vs Opposition.",
  },
  bp: {
    label: "British Parliamentary",
    shortLabel: "BP",
    speakers: 8,
    teams: 4,
    description:
      "Opening & Closing teams on each side. 8 speakers total.",
  },
};

export default function MatchSetupPage() {
  const { session } = useAuth();
  const router = useRouter();

  // Step 1: Format
  const [format, setFormat] = useState<DebateFormat>("ap");
  // Step 2: Role (side is derived automatically)
  const [role, setRole] = useState<string>("prime_minister");
  // Step 3: Motion
  const [motion, setMotion] = useState("");
  const [motionInfo, setMotionInfo] = useState("");
  const [isAiMotion, setIsAiMotion] = useState(false);
  const [motionCategory, setMotionCategory] = useState("Global");
  const [generatingMotion, setGeneratingMotion] = useState(false);

  // Step 4: Difficulty
  const [difficulty, setDifficulty] = useState<string>("medium");
  // Loading state
  const [loading, setLoading] = useState(false);

  const generateMotion = async () => {
    if (!session?.access_token) return;
    setGeneratingMotion(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/motions/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ category: motionCategory, format }),
      });
      if (!res.ok) throw new Error("Failed to generate motion");
      const data = await res.json();
      setMotion(data.data.motion);
      setMotionInfo(data.data.info);
    } catch (err) {
      toast.error("Failed to generate motion");
    } finally {
      setGeneratingMotion(false);
    }
  };

  // Derived: side is determined by role selection
  const side = ROLE_TO_SIDE[role] || "government";

  // When format changes, reset role to first available role for that format
  const handleFormatChange = (newFormat: DebateFormat) => {
    setFormat(newFormat);
    setRole(FORMAT_ROLES[newFormat][0]); // Default to first role
  };

  const handleStart = async () => {
    if (!motion.trim()) {
      toast.warning("Missing Motion", {
        description: "Please enter or choose a motion.",
      });
      return;
    }
    if (!session?.access_token) {
      toast.error("Not logged in", {
        description: "Please log in again.",
      });
      return;
    }

    setLoading(true);
    try {
      /**
       * THIS IS THE CRITICAL API CALL.
       *
       * createMatch() sends:
       *   POST /api/v1/{format}/matches
       *   Body: { motion: "...", side: "government", role: "prime_minister" }
       *
       * The Go gateway validates the JWT, extracts user_id,
       * then forwards to Python which creates:
       *   1. Motion record (the debate topic)
       *   2. CasePrep record (empty, AI will fill it)
       *   3. DebateSession record (the match itself)
       *   4. Redis state (the 6/8 speaker schedule)
       *   5. Calls OpenAI to generate case prep arguments
       *
       * Returns: { session_id, case_prep_id, message }
       */
      const result = await createMatch(
        format,
        { motion, side, role, difficulty },
        session.access_token
      );

      /**
       * Navigate to the Case Prep review page.
       * We pass `format` as a query parameter so the prep page
       * knows which endpoint to call for fetching case prep.
       */
      router.push(`/debate/${result.match_id}/prep?format=${format}`);
    } catch (err) {
      toast.error("Failed to create match", { description: String(err) });
      setLoading(false);
    }
  };

  // Get available roles for current format
  const availableRoles = FORMAT_ROLES[format];
  const formatInfo = FORMAT_INFO[format];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 flex items-center justify-center">
      <Card className="w-full max-w-2xl border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-3xl font-bold">
            Set Up Your Debate
          </CardTitle>
          <CardDescription className="text-base">
            Choose your format, role, and motion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-4">
          {/* ────────── STEP 1: FORMAT ────────── */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Step 1 — Debate Format
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {(["ap", "bp"] as const).map((f) => {
                const info = FORMAT_INFO[f];
                const isActive = format === f;
                return (
                  <button
                    key={f}
                    onClick={() => handleFormatChange(f)}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                      isActive
                        ? "bg-primary/10 border-primary shadow-sm"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-base">
                        {info.label}
                      </span>
                      <Badge
                        variant={isActive ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {info.shortLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {info.speakers} speakers · {info.teams} teams
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {info.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ────────── STEP 2: ROLE ────────── */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Step 2 — Your Speaking Role
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Pick which speaker you want to be. Your side (
              {side === "government" ? "Government" : "Opposition"}) is
              determined by your role.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {availableRoles.map((r, index) => {
                const isActive = role === r;
                const roleSide = ROLE_TO_SIDE[r];
                const isGov = roleSide === "government";
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`p-3 rounded-lg border-2 text-left transition-all duration-200 ${
                      isActive
                        ? isGov
                          ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400"
                          : "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {ROLE_LABELS[r]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        #{index + 1}
                      </span>
                    </div>
                    <span
                      className={`text-xs ${
                        isGov ? "text-blue-500" : "text-red-500"
                      }`}
                    >
                      {isGov ? "Government" : "Opposition"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ────────── STEP 3: MOTION ────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Step 3 — Debate Motion
              </Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <div className={`relative w-9 h-5 rounded-full transition-colors ${isAiMotion ? 'bg-indigo-500' : 'bg-muted border border-border'}`}>
                    <div className={`absolute top-[1px] left-[1px] w-4 h-4 bg-white rounded-full transition-transform ${isAiMotion ? 'translate-x-4' : ''} ${!isAiMotion ? 'bg-slate-400' : ''}`} />
                  </div>
                  AI Generated
                  <input type="checkbox" className="hidden" checked={isAiMotion} onChange={(e) => {
                    setIsAiMotion(e.target.checked);
                    if (e.target.checked && !motion) generateMotion();
                  }} />
                </label>
                {isAiMotion && (
                  <select 
                    value={motionCategory} 
                    onChange={(e) => setMotionCategory(e.target.value)}
                    className="bg-muted border border-border text-sm px-2 py-1 rounded-md text-foreground outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="Global">Global</option>
                    <option value="Tournament">Tournament</option>
                    <option value="Technology">Technology</option>
                    <option value="Economics">Economics</option>
                    <option value="Philosophy">Philosophy</option>
                    <option value="Social Justice">Social Justice</option>
                    <option value="Pop Culture">Pop Culture</option>
                    <option value="Random">Random</option>
                  </select>
                )}
              </div>
            </div>

            <div className="relative">
              <textarea
                placeholder="This house believes that..."
                value={motion}
                onChange={(e) => setMotion(e.target.value)}
                readOnly={isAiMotion && generatingMotion}
                className="w-full text-base min-h-[80px] p-3 rounded-xl border border-border bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-all"
              />
              {isAiMotion && generatingMotion && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
                  <span className="text-sm font-medium animate-pulse text-indigo-400">Generating Motion...</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {!isAiMotion ? (
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_MOTIONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMotion(m)}
                      className="text-xs bg-muted px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors text-left"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex w-full justify-end items-center">
                  <div className="flex gap-2">
                    {motionInfo && (
                      <button
                        onClick={() => toast.custom((t) => (
                          <div className="w-[350px] bg-[#0b1120] border border-blue-900/50 shadow-2xl rounded-xl p-4 flex flex-col gap-3 relative">
                            <div className="flex gap-3">
                              <div className="mt-0.5 text-blue-500">
                                <Info className="w-5 h-5" />
                              </div>
                              <div className="flex-1 space-y-1">
                                <p className="text-sm font-bold text-blue-400">Motion Info</p>
                                <p className="text-[13px] leading-relaxed text-slate-300">{motionInfo}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => toast.dismiss(t)}
                              className="absolute top-4 right-4 text-xs font-semibold bg-white text-black px-2.5 py-1 rounded hover:bg-slate-200 transition-colors"
                            >
                              Close
                            </button>
                          </div>
                        ), { duration: Infinity })}
                        className="text-xs border border-white/10 bg-white/5 text-slate-300 px-3 py-1.5 rounded-md hover:bg-white/10 hover:text-white transition-all flex items-center gap-1.5 font-medium"
                      >
                        <Info className="w-3.5 h-3.5" /> Show Info
                      </button>
                    )}
                    <button
                      onClick={generateMotion}
                      disabled={generatingMotion}
                      className="text-xs border border-emerald-500/20 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-md hover:bg-emerald-500/20 hover:text-emerald-300 transition-all flex items-center gap-1.5 font-medium disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${generatingMotion ? 'animate-spin' : ''}`} /> Reroll
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ────────── STEP 4: DIFFICULTY ────────── */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Step 4 — AI Difficulty
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Choose how challenging the AI debaters will be.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["easy", "medium", "hard"] as const).map((lvl) => {
                const isActive = difficulty === lvl;
                return (
                  <button
                    key={lvl}
                    onClick={() => setDifficulty(lvl)}
                    className={`p-3 rounded-lg border-2 text-center transition-all duration-200 capitalize font-medium text-sm ${
                      isActive
                        ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    }`}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ────────── SUMMARY & START ────────── */}
          <div className="pt-2 space-y-4">
            {/* Summary bar */}
            <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
              <Badge variant="outline">{formatInfo.shortLabel}</Badge>
              <span>·</span>
              <span className="font-medium">{ROLE_LABELS[role]}</span>
              <span>·</span>
              <span
                className={
                  side === "government" ? "text-blue-500" : "text-red-500"
                }
              >
                {side === "government" ? "Government" : "Opposition"}
              </span>
            </div>

            <Button
              className="w-full h-14 text-base font-bold"
              size="lg"
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? "Creating match..." : "Start Debate →"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

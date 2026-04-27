import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Helpers ────────────────────────────────────────────────────────────────

function toLocalStr(iso: string) {
  // Backend sends UTC timestamps without 'Z'; add it so Date() treats it as UTC
  const fixed = iso.endsWith("Z") ? iso : iso + "Z";
  const d = new Date(fixed);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function statusColor(status: string) {
  if (status === "completed" || status === "FINISHED") return "text-emerald-400";
  if (status === "debate_in_progress" || status === "DEBATE_IN_PROGRESS") return "text-amber-400";
  return "text-slate-400";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    completed: "Completed",
    FINISHED: "Completed",
    debate_in_progress: "In Progress",
    DEBATE_IN_PROGRESS: "In Progress",
    awaiting_participants: "Awaiting",
  };
  return map[status] ?? status;
}

// ── Data Fetching ──────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const userMetadata = session.user.user_metadata || {};
  const displayName =
    userMetadata.display_name ||
    session.user.email?.split("@")[0] ||
    "Debater";
  const avatarUrl = userMetadata.avatar_url;
  const token = session.access_token;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  // ── Fetch recent matches (both formats) ───────────────────────────────────
  const fetchHistory = async (format: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/${format}/matches?skip=0&limit=10`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!res.ok) return { matches: [], total: 0 };
      const json = await res.json();
      const matches = json.data?.matches || json.matches || [];
      const total = json.data?.total ?? json.total ?? 0;
      return { matches: matches.map((m: any) => ({ ...m, format })), total };
    } catch {
      return { matches: [], total: 0 };
    }
  };

  // ── Fetch real aggregate stats ─────────────────────────────────────────────
  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/users/stats`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.data ?? null;
    } catch {
      return null;
    }
  };

  const [apRes, bpRes, userStats] = await Promise.all([
    fetchHistory("ap"),
    fetchHistory("bp"),
    fetchStats(),
  ]);

  const allMatches = [...apRes.matches, ...bpRes.matches].sort(
    (a, b) =>
      new Date(b.created_at.endsWith("Z") ? b.created_at : b.created_at + "Z").getTime() -
      new Date(a.created_at.endsWith("Z") ? a.created_at : a.created_at + "Z").getTime()
  );
  const recentMatches = allMatches.slice(0, 5);

  const totalDebates = apRes.total + bpRes.total;
  const wins = userStats?.wins ?? 0;
  const losses = userStats?.losses ?? 0;
  const winRate = userStats?.win_rate ?? 0;
  const avgScore = userStats?.avg_score ?? null;
  const bestScore = userStats?.best_score ?? null;
  const completedDebates = userStats?.completed_debates ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* ── Nav ── */}
      <nav className="border-b border-white/[0.06] px-6 py-3 flex items-center justify-between sticky top-0 bg-[#0a0a0f]/90 backdrop-blur-xl z-50">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-lg">⚖️</span>
            <span className="text-lg font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent tracking-tight">
              Agora
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-1">
            {[
              { href: "/dashboard", label: "Dashboard", active: true },
              { href: "/history", label: "History", active: false },
              { href: "/profile", label: "Profile", active: false },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  link.active
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/debate/setup">
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold transition-all duration-150 shadow-lg shadow-indigo-500/25">
              <span>+</span> New Debate
            </button>
          </Link>
          <Link href="/profile" className="flex items-center gap-2 group">
            <span className="text-sm font-medium text-slate-400 hidden sm:block group-hover:text-white transition-colors">
              {displayName}
            </span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-white/10 overflow-hidden shadow-lg shadow-indigo-500/20 shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-black text-white">
                  {displayName.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs text-slate-500 hover:text-white transition-colors px-2 py-1 rounded font-medium"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>

      {/* ── Main ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-10">

        {/* ── Hero header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Welcome back,{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                {displayName}
              </span>
            </h1>
            <p className="text-slate-400 mt-1 text-base">
              {totalDebates === 0
                ? "Ready to start your first debate?"
                : `${totalDebates} total debates · ${completedDebates} completed`}
            </p>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Debates",
              value: totalDebates.toString(),
              sub: "All formats",
              icon: "🎤",
              accent: "from-indigo-500/20 to-indigo-500/5",
              border: "border-indigo-500/20",
            },
            {
              label: "Win Rate",
              value: completedDebates > 0 ? `${winRate}%` : "—",
              sub: `${wins}W · ${losses}L`,
              icon: "🏆",
              accent: "from-emerald-500/20 to-emerald-500/5",
              border: "border-emerald-500/20",
            },
            {
              label: "Avg Score",
              value: avgScore !== null ? avgScore.toString() : "—",
              sub: avgScore !== null ? "Out of 100" : "No results yet",
              icon: "📊",
              accent: "from-violet-500/20 to-violet-500/5",
              border: "border-violet-500/20",
            },
            {
              label: "Best Score",
              value: bestScore !== null ? bestScore.toString() : "—",
              sub: bestScore !== null ? "Personal record" : "No results yet",
              icon: "⭐",
              accent: "from-amber-500/20 to-amber-500/5",
              border: "border-amber-500/20",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`relative overflow-hidden rounded-xl border ${stat.border} bg-gradient-to-br ${stat.accent} p-5 backdrop-blur-sm`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{stat.icon}</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                {stat.value}
              </p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                {stat.label}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Two‑column layout ── */}
        <div className="grid md:grid-cols-3 gap-8">

          {/* ── Recent matches ── */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tight">Recent Debates</h2>
              <Link
                href="/history"
                className="text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
              >
                View all →
              </Link>
            </div>

            {recentMatches.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] p-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto text-3xl">
                  🎤
                </div>
                <div>
                  <h3 className="text-lg font-bold">No debates yet</h3>
                  <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
                    Start your first debate against the AI to see history and scores here.
                  </p>
                </div>
                <Link href="/debate/setup">
                  <button className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold transition-all mt-2">
                    Start Debating →
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentMatches.map((match: any) => {
                  const isCompleted =
                    match.status === "completed" || match.status === "FINISHED";
                  const isGov = match.your_side === "government";
                  return (
                    <div
                      key={match.id}
                      className="group rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-150 p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        {/* Top row: badges + time */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white/10 text-slate-300 border border-white/10">
                            {match.format?.toUpperCase()}
                          </span>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${statusColor(match.status)}`}>
                            {statusLabel(match.status)}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-auto whitespace-nowrap">
                            {toLocalStr(match.created_at)}
                          </span>
                        </div>

                        {/* Motion */}
                        <p className="font-semibold text-sm text-white/90 truncate pr-4 leading-tight">
                          {match.motion}
                        </p>

                        {/* Role · Side */}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-slate-400 font-medium capitalize">
                            {match.your_role?.replace(/_/g, " ")}
                          </span>
                          <span className="text-slate-600 text-xs">·</span>
                          <span className={`text-xs font-bold uppercase tracking-wider ${isGov ? "text-blue-400" : "text-red-400"}`}>
                            {match.your_side}
                          </span>
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="shrink-0">
                        {isCompleted ? (
                          <Link href={`/results/${match.id}?format=${match.format}`}>
                            <button className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-all opacity-0 group-hover:opacity-100">
                              View Results →
                            </button>
                          </Link>
                        ) : (
                          <Link href={`/debate/${match.id}?format=${match.format}`}>
                            <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-500/20">
                              Rejoin →
                            </button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-5">

            {/* Quick start */}
            <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-600/10 to-purple-600/5 p-6">
              <h3 className="font-black text-base mb-1">Ready to debate?</h3>
              <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                Pick your format, role, and motion. The AI is waiting.
              </p>
              <Link href="/debate/setup" className="block">
                <button className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-black transition-all shadow-lg shadow-indigo-500/20">
                  + New Debate
                </button>
              </Link>
            </div>

            {/* How it works */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-5">
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">How It Works</h3>
              {[
                { n: "1", title: "Select Format", desc: "AP (6 speakers) or BP (8 speakers)." },
                { n: "2", title: "Pick Your Role", desc: "You pick a speaker slot; AI fills the rest." },
                { n: "3", title: "Case Prep", desc: "Review AI‑generated arguments before the match." },
                { n: "4", title: "Live Arena", desc: "Speak, rebut, and offer POIs in real‑time." },
                { n: "5", title: "AI Adjudication", desc: "5-phase WUDC‑standard verdict with scores." },
              ].map((s) => (
                <div key={s.n} className="flex gap-3 items-start">
                  <div className="w-6 h-6 shrink-0 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[11px] font-black flex items-center justify-center mt-0.5">
                    {s.n}
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight">{s.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Format breakdown */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-3">
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">Debate Breakdown</h3>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Asian Parliamentary</span>
                <span className="font-bold text-indigo-400">{apRes.total}</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full"
                  style={{ width: totalDebates > 0 ? `${(apRes.total / totalDebates) * 100}%` : "0%" }}
                />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">British Parliamentary</span>
                <span className="font-bold text-purple-400">{bpRes.total}</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5">
                <div
                  className="bg-purple-500 h-1.5 rounded-full"
                  style={{ width: totalDebates > 0 ? `${(bpRes.total / totalDebates) * 100}%` : "0%" }}
                />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

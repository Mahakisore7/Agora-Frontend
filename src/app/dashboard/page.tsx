import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/auth/login");

  const displayName = session.user.email?.split("@")[0] ?? "Debater";
  const token = session.access_token;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  // Let's fetch history for both formats
  const fetchHistory = async (format: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/${format}/matches?skip=0&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
        // Next.js fetch cache configuration: opt-out of static behavior
        cache: 'no-store'
      });
      if (!res.ok) return [];
      const data = await res.json();
      // append the format to each match so we know where it came from
      return (data.matches || []).map((m: any) => ({ ...m, format }));
    } catch {
      return [];
    }
  };

  const [apMatches, bpMatches] = await Promise.all([
    fetchHistory("ap"),
    fetchHistory("bp")
  ]);

  const allMatches = [...apMatches, ...bpMatches].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Compute real stats
  const totalDebates = allMatches.length;
  // TODO: Add actual scores when results API is fully hooked up
  // For now, we stub scores but show true debate counts
  const avgScore = totalDebates > 0 ? "—" : "—"; 
  const bestScore = totalDebates > 0 ? "—" : "—";

  const recentMatches = allMatches.slice(0, 5);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top navigation bar */}
      <nav className="border-b px-6 py-4 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur z-40">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xl font-black tracking-tighter">
            ⚖️ <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Agora</span>
          </Link>
          <div className="hidden sm:flex items-center gap-4 text-sm font-medium">
            <Link href="/dashboard" className="text-primary">Dashboard</Link>
            <Link href="/history" className="text-muted-foreground hover:text-foreground transition-colors">History</Link>
            <Link href="/profile" className="text-muted-foreground hover:text-foreground transition-colors">Profile</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-300 hidden sm:block">{session.user.email}</span>
          <form action="/auth/signout" method="post">
            <Button variant="secondary" size="sm" type="submit" className="font-bold">Sign out</Button>
          </form>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8">
        
        {/* Welcome header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Welcome, {displayName}</h1>
            <p className="text-muted-foreground mt-1 text-lg">Ready to enter the arena?</p>
          </div>
          <Button asChild size="lg" className="h-14 px-8 text-base font-bold shadow-lg shadow-indigo-500/20">
            <Link href="/debate/setup">+ New Debate</Link>
          </Button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Total Debates", value: totalDebates.toString(), description: "Matches created" },
            { label: "Avg Score", value: avgScore, description: "Across all completed debates" },
            { label: "Best Score", value: bestScore, description: "Personal best score" },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/40 shadow-sm bg-card/50">
              <CardHeader className="pb-2">
                <CardDescription className="font-semibold uppercase tracking-wider">{stat.label}</CardDescription>
                <CardTitle className="text-5xl font-black font-mono tracking-tighter">{stat.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground font-medium">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Recent debates feed */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Recent Debates</h2>
              <Button asChild variant="link" className="text-indigo-400">
                <Link href="/history">View all →</Link>
              </Button>
            </div>

            {recentMatches.length === 0 ? (
              <Card className="border-dashed border-2 bg-transparent">
                <CardContent className="text-center py-16 space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                     <span className="text-2xl">🎤</span>
                  </div>
                  <h3 className="text-xl font-bold">No debates yet</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Start your first debate against the AI engine to see your history and scores appear here.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/debate/setup">Start Debating →</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {recentMatches.map((match: any) => (
                  <Card key={match.id} className="transition-all hover:bg-card/80 hover:shadow-md border-border/50 group">
                    <CardContent className="p-5 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest">
                            {match.format}
                          </Badge>
                          <span className={`text-[10px] uppercase font-bold tracking-widest ${
                            match.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {match.status}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(match.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-semibold text-base truncate pr-4">{match.motion}</h4>
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <span className="font-medium">{match.your_role?.replace(/_/g, ' ')}</span>
                          <span>•</span>
                          <span className={match.your_side === 'government' ? 'text-blue-400/80' : 'text-red-400/80'}>
                            {match.your_side}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right flex flex-col items-end gap-2">
                        {match.status === 'completed' ? (
                          <Button asChild variant="secondary" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/results/${match.id}`}>View Results</Link>
                          </Button>
                        ) : (
                          <Button asChild className="bg-indigo-500 hover:bg-indigo-600 text-white">
                            <Link href={`/debate/${match.id}?format=${match.format}`}>Rejoin Match</Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* How it works Sidebar */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight">How Agora Works</h2>
            <Card className="bg-card/40 border-border/40">
              <CardContent className="p-6 space-y-6">
                {[
                  { step: "1", title: "Select Format", desc: "Choose AP (6 speakers) or BP (8 speakers)." },
                  { step: "2", title: "Pick Your Role", desc: "Decide which speaker you want to be. The AI handles the rest." },
                  { step: "3", title: "Case Prep", desc: "Review AI-generated arguments before the match starts." },
                  { step: "4", title: "Live Arena", desc: "Debate live. Speak your turn and offer POIs to the AI." },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-sm flex items-center justify-center border border-indigo-500/30">
                      {item.step}
                    </div>
                    <div>
                      <p className="font-bold text-sm tracking-tight">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

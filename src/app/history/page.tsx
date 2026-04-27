import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function HistoryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/auth/login");

  const userMetadata = session.user.user_metadata || {};
  const displayName = userMetadata.display_name || session.user.email?.split("@")[0] || "Debater";
  const avatarUrl = userMetadata.avatar_url;
  const token = session.access_token;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  // Fetch history for both formats (allow up to 50 for history page)
  const fetchHistory = async (format: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/${format}/matches?skip=0&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (!res.ok) return { matches: [], total: 0 };
      const json = await res.json();
      const matches = json.data?.matches || json.matches || [];
      const total = json.data?.total ?? json.total ?? 0;
      return { 
        matches: matches.map((m: any) => ({ ...m, format })),
        total 
      };
    } catch {
      return { matches: [], total: 0 };
    }
  };

  const [apRes, bpRes] = await Promise.all([
    fetchHistory("ap"),
    fetchHistory("bp")
  ]);

  const allMatches = [...apRes.matches, ...bpRes.matches].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const totalAll = apRes.total + bpRes.total;
  const apMatches = apRes.matches;
  const bpMatches = bpRes.matches;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top navigation bar */}
      <nav className="border-b px-6 py-4 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur z-40">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xl font-black tracking-tighter">
            ⚖️ <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Agora</span>
          </Link>
          <div className="hidden sm:flex items-center gap-4 text-sm font-medium">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/history" className="text-primary">History</Link>
            <Link href="/profile" className="text-muted-foreground hover:text-foreground transition-colors">Profile</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/profile" className="flex items-center gap-3 group">
            <span className="text-sm font-medium text-slate-300 hidden sm:block group-hover:text-white transition-colors">
              {displayName}
            </span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-white/10 overflow-hidden shadow-lg shadow-indigo-500/20">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">{displayName.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
          </Link>
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground hover:text-white font-bold h-8">
              Sign out
            </Button>
          </form>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Debate History</h1>
            <p className="text-muted-foreground mt-1 text-lg">Review your past matches and analyze your performance.</p>
          </div>
          <Button asChild size="lg" className="h-14 px-8 text-base font-bold shadow-lg shadow-indigo-500/20">
            <Link href="/debate/setup">+ New Debate</Link>
          </Button>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Matches ({totalAll})</TabsTrigger>
            <TabsTrigger value="ap">Asian Parliamentary ({apRes.total})</TabsTrigger>
            <TabsTrigger value="bp">British Parliamentary ({bpRes.total})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="m-0">
            <MatchList matches={allMatches} />
          </TabsContent>
          <TabsContent value="ap" className="m-0">
            <MatchList matches={apMatches} />
          </TabsContent>
          <TabsContent value="bp" className="m-0">
            <MatchList matches={bpMatches} />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}

function MatchList({ matches }: { matches: any[] }) {
  if (matches.length === 0) {
    return (
      <div className="text-center py-20 border-2 border-dashed rounded-xl border-border/50 bg-card/20">
        <p className="text-muted-foreground">No matches found for this filter.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {matches.map((match: any) => (
        <Card key={match.id} className="transition-all hover:bg-card/80 hover:shadow-md border-border/50 group">
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                  {new Date(match.created_at.endsWith('Z') ? match.created_at : match.created_at + 'Z').toLocaleDateString()} at {new Date(match.created_at.endsWith('Z') ? match.created_at : match.created_at + 'Z').toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              <h4 className="font-semibold text-lg truncate pr-4 text-foreground/90">{match.motion}</h4>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <span className="font-medium bg-secondary/50 px-2 py-0.5 rounded-md">{match.your_role?.replace(/_/g, ' ')}</span>
                <span>•</span>
                <span className={`font-semibold ${match.your_side === 'government' ? 'text-blue-400' : 'text-red-400'}`}>
                  {match.your_side.toUpperCase()}
                </span>
              </div>
            </div>
            
            <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-3 sm:gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
              {match.status === 'completed' ? (
                <>
                  <div className="flex items-center gap-4 sm:mb-1">
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Verdict</p>
                      <p className={`font-mono text-sm font-black ${
                        match.verdict === 'Government' ? 'text-blue-400' :
                        match.verdict === 'Opposition' ? 'text-red-400' : 'text-slate-400'
                      }`}>{match.verdict || '—'}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="border-indigo-500/30 text-indigo-300 hover:text-white hover:bg-indigo-900/40 text-xs gap-1">
                    <Link href={`/results/${match.id}?format=${match.format || 'ap'}`}>View Results →</Link>
                  </Button>
                </>
              ) : (
                <Button asChild className="bg-indigo-500 hover:bg-indigo-600 text-white w-full sm:w-auto">
                  <Link href={`/debate/${match.id}?format=${match.format || 'ap'}`}>Rejoin Arena</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

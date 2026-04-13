import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// SERVER COMPONENT — reads Supabase session directly from cookies
// No "use client" — this runs on the server before sending HTML to browser
export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Extra safety net (middleware already handles this, but belt-and-suspenders)
  if (!user) redirect("/auth/login");

  // Display name: use email, or fall back to "Debater"
  const displayName = user.email?.split("@")[0] ?? "Debater";

  return (
    <div className="min-h-screen bg-background">

      {/* Top navigation bar */}
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">⚖️ Agora</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <form action="/auth/signout" method="post">
            <Button variant="ghost" size="sm" type="submit">Sign out</Button>
          </form>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-8 space-y-8">

        {/* Welcome header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {displayName}</h1>
            <p className="text-muted-foreground mt-1">Ready to debate?</p>
          </div>
          <Button asChild size="lg">
            <Link href="/debate/setup">+ New Debate</Link>
          </Button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Debates", value: "—", description: "Debates completed" },
            { label: "Avg Score", value: "—", description: "Across all debates" },
            { label: "Best Score", value: "—", description: "Personal best" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-4xl">{stat.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent debates — stubbed until Results API is connected */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Debates</CardTitle>
            <CardDescription>Your debate history will appear here</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-16 space-y-3">
              <p className="text-4xl">🎤</p>
              <p className="font-medium">No debates yet</p>
              <p className="text-sm text-muted-foreground">
                Start your first debate to see your history here
              </p>
              <Button asChild className="mt-2">
                <Link href="/debate/setup">Start Debating →</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle>How Agora Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              {[
                { step: "1", title: "Choose a Motion", desc: "Pick a debate topic and your side" },
                { step: "2", title: "Debate the AI", desc: "Speak live against an AI opponent" },
                { step: "3", title: "Get Scored", desc: "Receive detailed WUDC-style feedback" },
              ].map((item) => (
                <div key={item.step} className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center mx-auto">
                    {item.step}
                  </div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

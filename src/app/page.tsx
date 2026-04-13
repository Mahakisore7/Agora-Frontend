import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
      <div className="max-w-3xl space-y-6">
        <h1 className="text-6xl font-bold tracking-tight">
          Debate Smarter.<br />
          <span className="text-primary">With AI.</span>
        </h1>
        <p className="text-xl text-muted-foreground">
          Agora puts you in a live parliamentary debate against an AI opponent.
          Get real-time feedback, scores, and coaching after every match.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/auth/signup">Start Debating</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

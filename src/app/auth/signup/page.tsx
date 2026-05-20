"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd"
      d="M12 2C6.477 2 2 6.463 2 11.97c0 4.404 2.865 8.14 6.839 9.458.5.092.682-.216.682-.48
      0-.236-.008-.864-.013-1.695-2.782.602-3.369-1.337-3.369-1.337-.454-1.151-1.11-1.458-1.11-1.458
      -.908-.618.069-.606.069-.606 1.003.07 1.531 1.027 1.531 1.027.892 1.524 2.341 1.084 2.91.828
      .092-.643.35-1.083.636-1.332-2.22-.251-4.555-1.107-4.555-4.927 0-1.088.39-1.979 1.029-2.675
      -.103-.252-.446-1.266.098-2.638 0 0 .84-.268 2.75 1.022A9.607 9.607 0 0 1 12 6.82c.85.004
      1.705.114 2.504.336 1.909-1.29 2.747-1.022 2.747-1.022.546 1.372.202 2.386.1 2.638.64.696
      1.028 1.587 1.028 2.675 0 3.83-2.339 4.673-4.566 4.92.359.307.678.915.678 1.846 0 1.332-.012
      2.407-.012 2.734 0 .267.18.577.688.48C19.138 20.107 22 16.373 22 11.969 22 6.463 17.522 2 12 2z"/>
  </svg>
);

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [done, setDone] = useState(false);
  const supabase = createClient();

  const redirectTo = typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : "/auth/callback";

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      toast.error(`${provider} signup failed`, { description: error.message });
      setOauthLoading(null);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          display_name: username
        }
      }
    });
    if (error) {
      toast.error("Signup Failed", { description: error.message });
      setLoading(false);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md text-center p-8">
          <CardTitle className="text-2xl mb-2">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account.
          </CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 relative overflow-hidden text-white">
      {/* Background ambient glow */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />

      <Card className="w-full max-w-md relative z-10 border-indigo-500/20 bg-indigo-950/40 backdrop-blur-3xl shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent pb-2">Create your account</CardTitle>
          <CardDescription className="text-indigo-300/80 font-medium">Start debating with AI today</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* OAuth buttons */}
          <div className="space-y-3">
            <Button variant="outline" className="w-full gap-3 h-12 bg-white/5 border-white/10 hover:bg-white/10 transition-colors text-slate-200"
              onClick={() => handleOAuth("google")} disabled={!!oauthLoading}>
              <GoogleIcon />
              {oauthLoading === "google" ? "Redirecting..." : "Continue with Google"}
            </Button>
            <Button variant="outline" className="w-full gap-3 h-12 bg-white/5 border-white/10 hover:bg-white/10 transition-colors text-slate-200"
              onClick={() => handleOAuth("github")} disabled={!!oauthLoading}>
              <GitHubIcon />
              {oauthLoading === "github" ? "Redirecting..." : "Continue with GitHub"}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-indigo-500/20" />
            </div>
            <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest">
              <span className="bg-indigo-950 px-3 text-indigo-400/60 rounded-full">Or sign up with email</span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-indigo-300">Username</Label>
              <Input id="username" type="text" value={username}
                onChange={(e) => setUsername(e.target.value)} required 
                className="bg-black/50 border-indigo-500/30 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-indigo-300">Email Address</Label>
              <Input id="email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} required 
                className="bg-black/50 border-indigo-500/30 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-indigo-300">Password</Label>
              <Input id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required 
                className="bg-black/50 border-indigo-500/30 text-white focus-visible:ring-indigo-500" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-indigo-300">Confirm Password</Label>
              <Input id="confirmPassword" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} required 
                className="bg-black/50 border-indigo-500/30 text-white focus-visible:ring-indigo-500" 
              />
            </div>
            <Button type="submit" className="w-full h-12 font-bold bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all mt-2" disabled={loading || !!oauthLoading}>
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-400 font-medium">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300 hover:underline font-bold">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { User, Mail, Building, Globe, Edit3, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { session, user } = useAuth();
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    displayName: "",
    institution: "",
    country: "",
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!session) {
      router.push("/auth/login");
      return;
    }

    if (user) {
      setFormData({
        displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || "",
        institution: user.user_metadata?.institution || "",
        country: user.user_metadata?.country || "",
      });
    }
  }, [session, user, router]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: formData.displayName,
          institution: formData.institution,
          country: formData.country
        }
      });

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar */}
      <nav className="border-b px-6 py-4 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur z-40">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xl font-black tracking-tighter">
            ⚖️ <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Agora</span>
          </Link>
          <div className="hidden sm:flex items-center gap-4 text-sm font-medium">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
            <Link href="/history" className="text-muted-foreground hover:text-foreground transition-colors">History</Link>
            <Link href="/profile" className="text-primary">Profile</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-300 hidden sm:block">{user.email}</span>
          <form action="/auth/signout" method="post">
            <Button variant="secondary" size="sm" type="submit" className="font-bold">Sign out</Button>
          </form>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-8 flex flex-col items-center">
        
        <div className="w-full mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight">Your Profile</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage your personal information and debating credentials.</p>
        </div>

        <div className="w-full grid md:grid-cols-3 gap-8">
          
          {/* Avatar / Summary Column */}
          <div className="md:col-span-1 space-y-6">
            <Card className="border-border/50 bg-card/60 backdrop-blur block items-center text-center p-6">
              <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20 text-4xl font-black text-white mb-4">
                {formData.displayName.substring(0, 1).toUpperCase() || "A"}
              </div>
              <h2 className="text-xl font-bold truncate px-2">{formData.displayName || "Debater"}</h2>
              <Badge variant="secondary" className="mt-2 text-xs uppercase tracking-widest">{formData.institution || "Independent"}</Badge>
            </Card>

            <Card className="border-border/50 bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Verification</span>
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Verified</Badge>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Joined</span>
                  <span className="font-medium">{new Date(user.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Edit Form Column */}
          <div className="md:col-span-2">
            <Card className="border-border/50 bg-card/60 backdrop-blur h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-400" />
                  Edit Profile
                </CardTitle>
                <CardDescription>
                  Update your public information. This will be shown to your opponents in the arena.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-muted-foreground">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input id="email" value={user.email} disabled className="pl-9 bg-muted/50 border-border/50 opacity-100" />
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Connected via Supabase Auth</p>
                </div>

                <Separator className="bg-border/50" />

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input 
                        id="displayName" 
                        value={formData.displayName}
                        onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                        className="pl-9"
                        placeholder="John Doe" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="institution">Institution / University</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input 
                        id="institution" 
                        value={formData.institution}
                        onChange={(e) => setFormData({...formData, institution: e.target.value})}
                        className="pl-9"
                        placeholder="Oxford Debating Union" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input 
                        id="country" 
                        value={formData.country}
                        onChange={(e) => setFormData({...formData, country: e.target.value})}
                        className="pl-9"
                        placeholder="United Kingdom" 
                      />
                    </div>
                  </div>
                </div>

                {message && (
                  <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {message.text}
                  </div>
                )}
              </CardContent>

              <CardFooter className="bg-background/20 border-t border-border/50 mt-6 py-4 flex justify-end">
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 font-bold px-8 shadow-lg shadow-indigo-600/20"
                >
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

      </main>
    </div>
  );
}

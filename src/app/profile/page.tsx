"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { User, Mail, Building, Globe, Edit3, Loader2, Camera, Shield, Star, BarChart3, Trophy, CheckCircle, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProfilePage() {
  const { session, user } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
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
      setAvatarUrl(user.user_metadata?.avatar_url || null);
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
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingPhoto(true);
    try {
      // Upload to Supabase Storage
      const filePath = `avatars/${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const url = publicData.publicUrl;
      setAvatarUrl(url);

      // Save to user metadata
      await supabase.auth.updateUser({ data: { avatar_url: url } });
      setMessage({ type: "success", text: "Photo successfully updated." });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      // Fallback: use local object URL if storage isn't configured
      const objectUrl = URL.createObjectURL(file);
      setAvatarUrl(objectUrl);
      setMessage({ type: "success", text: "Photo temporarily updated locally." });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = formData.displayName
    ? formData.displayName.substring(0, 2).toUpperCase()
    : user.email?.substring(0, 2).toUpperCase() || "??";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white flex flex-col relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-purple-600/20 rounded-full blur-[100px]" />
      </div>

      {/* Navbar */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 bg-background/50 backdrop-blur-xl z-40">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xl font-black tracking-tighter flex items-center gap-2 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <span className="text-2xl">⚖️</span>
            <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Agora</span>
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm font-bold tracking-wide">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/history" className="text-slate-400 hover:text-white transition-colors">History</Link>
            <Link href="/profile" className="text-indigo-400 border-b-2 border-indigo-400 pb-1">Profile</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-300 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 hidden sm:block">
            {user.email}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSignOut}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 sm:p-8 z-10 flex flex-col pt-12 pb-24">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent mb-2">
              Debater Profile
            </h1>
            <p className="text-indigo-200/60 text-lg font-medium">Manage your professional persona and debate metrics.</p>
          </div>
          
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold uppercase tracking-widest hidden md:flex">
            <Shield className="w-4 h-4 mr-2" />
            Verified Account
          </Badge>
        </motion.div>

        <div className="w-full grid md:grid-cols-12 gap-8">
          
          {/* Left Column: Avatar & Summary */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="md:col-span-4 space-y-6"
          >
            {/* Identity Card */}
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 flex flex-col items-center text-center relative overflow-hidden group">
              
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              
              {/* Avatar Upload */}
              <div className="relative cursor-pointer" onClick={() => fileRef.current?.click()}>
                <div className="w-36 h-36 mx-auto rounded-full overflow-hidden border-[3px] border-indigo-500/30 
                  bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center 
                  shadow-[0_0_40px_rgba(99,102,241,0.3)] group-hover:border-indigo-400 transition-all duration-300 z-10 relative">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-black text-white">{initials}</span>
                  )}
                </div>
                
                {/* Upload Overlay */}
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 backdrop-blur-sm">
                  {isUploadingPhoto 
                    ? <Loader2 className="w-8 h-8 text-white animate-spin" />
                    : <Camera className="w-8 h-8 text-white" />
                  }
                </div>
                
                {/* Status indicator bubble */}
                <div className="absolute bottom-1 right-3 w-6 h-6 bg-emerald-500 rounded-full border-4 border-gray-950 z-30 shadow-lg" />
              </div>
              
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />

              <h2 className="text-2xl font-black mt-6 tracking-tight">{formData.displayName || "Anonymous Debater"}</h2>
              <p className="text-indigo-300/80 text-sm font-medium mt-1 uppercase tracking-widest">{formData.institution || "Independent"}</p>
              
              <div className="flex gap-2 mt-6">
                <Badge className="bg-white/5 border border-white/10 text-slate-300 font-semibold px-4 flex gap-2">
                  <Star className="w-3.5 h-3.5 text-yellow-500" /> Pro
                </Badge>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Debate Statistics</h3>
              <div className="space-y-4">
                {[
                  { label: "Matches Played", value: "0", icon: BarChart3, color: "text-indigo-400" },
                  { label: "Win Rate", value: "0%", icon: Trophy, color: "text-yellow-400" },
                  { label: "Member Since", value: new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }), icon: Shield, color: "text-emerald-400" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex items-center justify-between group hover:bg-white/5 p-2 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-400">{label}</span>
                    </div>
                    <span className="font-bold">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Column: Edit Form */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="md:col-span-8"
          >
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-8 h-full flex flex-col relative overflow-hidden">
              
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Personal Information</h2>
                  <p className="text-sm text-slate-400 font-medium">This information will be displayed to your opponents.</p>
                </div>
              </div>

              <div className="space-y-6 flex-1">
                
                {/* Email Read-Only */}
                <div className="space-y-2 relative">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                    <Input 
                      value={user.email} 
                      disabled 
                      className="pl-12 h-12 bg-white/5 border-white/10 text-slate-400 rounded-xl font-medium" 
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  {/* Display Name */}
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Display Name</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                      <Input 
                        value={formData.displayName}
                        onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                        className="pl-12 h-12 bg-white/5 border-white/10 text-white rounded-xl font-bold placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-indigo-500/20 transition-all text-lg"
                        placeholder="John Doe" 
                      />
                    </div>
                  </div>

                  {/* Institution */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Institution</label>
                    <div className="relative group">
                      <Building className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                      <Input 
                        value={formData.institution}
                        onChange={(e) => setFormData({...formData, institution: e.target.value})}
                        className="pl-12 h-12 bg-white/5 border-white/10 text-white rounded-xl font-medium placeholder:text-slate-600 focus:border-purple-500/50 transition-all"
                        placeholder="Oxford Union" 
                      />
                    </div>
                  </div>

                  {/* Country */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Country</label>
                    <div className="relative group">
                      <Globe className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                      <Input 
                        value={formData.country}
                        onChange={(e) => setFormData({...formData, country: e.target.value})}
                        className="pl-12 h-12 bg-white/5 border-white/10 text-white rounded-xl font-medium placeholder:text-slate-600 focus:border-emerald-500/50 transition-all"
                        placeholder="United Kingdom" 
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Status Message */}
              <AnimatePresence>
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`mt-6 p-4 rounded-xl flex items-center gap-3 font-semibold text-sm ${
                      message.type === 'success' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="h-12 px-8 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all duration-300 text-base"
                >
                  {isSaving ? (
                    <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Saving Changes...</>
                  ) : (
                    <><Edit3 className="w-5 h-5 mr-3" /> Save Profile</>
                  )}
                </Button>
              </div>

            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  X, User, Mail, Building, Globe, Camera, Loader2,
  LogOut, Edit3, CheckCircle, Trophy, BarChart3, Settings,
  ChevronRight, Shield, Star
} from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Badge } from "./badge";
import { Separator } from "./separator";

interface ProfileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileDrawer({ open, onClose }: ProfileDrawerProps) {
  const { session, user } = useAuth();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"profile" | "stats" | "settings">("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    displayName: "",
    institution: "",
    country: "",
  });

  // Populate form when user loads
  useEffect(() => {
    if (user) {
      setFormData({
        displayName: user.user_metadata?.display_name || user.email?.split("@")[0] || "",
        institution: user.user_metadata?.institution || "",
        country: user.user_metadata?.country || "",
      });
      setAvatarUrl(user.user_metadata?.avatar_url || null);
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          display_name: formData.displayName,
          institution: formData.institution,
          country: formData.country,
        },
      });
      if (error) throw error;
      setMessage({ type: "success", text: "Profile saved!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Save failed." });
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
      setMessage({ type: "success", text: "Photo updated!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      // Fallback: use local object URL if storage isn't configured
      const objectUrl = URL.createObjectURL(file);
      setAvatarUrl(objectUrl);
      setMessage({ type: "success", text: "Photo updated locally." });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onClose();
    window.location.href = "/auth/login";
  };

  const initials = formData.displayName
    ? formData.displayName.substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || "??";

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-[380px] max-w-full z-50
              bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950
              border-l border-indigo-500/20 shadow-[−20px_0_60px_rgba(0,0,0,0.5)]
              flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="relative p-6 pb-0">
              <button
                onClick={onClose}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 
                  hover:bg-white/10 flex items-center justify-center transition-all
                  border border-white/10 hover:border-white/20"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>

              {/* Avatar Section */}
              <div className="flex flex-col items-center pt-4 pb-6">
                <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500/50
                    shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all group-hover:border-indigo-400">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600
                        flex items-center justify-center text-2xl font-black text-white">
                        {initials}
                      </div>
                    )}
                  </div>
                  {/* Camera overlay */}
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 
                    group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {isUploadingPhoto
                      ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                      : <Camera className="w-5 h-5 text-white" />
                    }
                  </div>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                <p className="text-[10px] text-indigo-400 mt-2 uppercase tracking-widest">
                  Click to change photo
                </p>

                <h2 className="text-xl font-black text-white mt-3">
                  {formData.displayName || "Debater"}
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">{user?.email}</p>

                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] uppercase tracking-widest">
                    <Shield className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                  {formData.institution && (
                    <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
                      {formData.institution}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tab Bar */}
              <div className="flex border-b border-white/10 -mx-6 px-6 gap-1">
                {(["profile", "stats", "settings"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-all
                      border-b-2 -mb-px ${
                        activeTab === tab
                          ? "border-indigo-400 text-indigo-300"
                          : "border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* PROFILE TAB */}
              {activeTab === "profile" && (
                <div className="space-y-4">
                  {/* Display Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                      Display Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <Input
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                        className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600
                          focus:border-indigo-500/50 focus:ring-indigo-500/20"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  {/* Email (read-only) */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <Input
                        value={user?.email || ""}
                        disabled
                        className="pl-9 bg-white/5 border-white/10 text-slate-500 opacity-70"
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 uppercase tracking-widest">
                      Managed by Supabase Auth
                    </p>
                  </div>

                  <Separator className="bg-white/5" />

                  {/* Institution */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                      Institution
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <Input
                        value={formData.institution}
                        onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                        className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600
                          focus:border-indigo-500/50"
                        placeholder="Oxford Debating Union"
                      />
                    </div>
                  </div>

                  {/* Country */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                      Country
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <Input
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600
                          focus:border-indigo-500/50"
                        placeholder="United Kingdom"
                      />
                    </div>
                  </div>

                  {message && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        message.type === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      {message.text}
                    </motion.div>
                  )}

                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold
                      shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]
                      transition-all duration-300 rounded-xl"
                  >
                    {isSaving
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                      : <><Edit3 className="w-4 h-4 mr-2" /> Save Changes</>
                    }
                  </Button>
                </div>
              )}

              {/* STATS TAB */}
              {activeTab === "stats" && (
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Debate Statistics</p>
                  {[
                    { label: "Matches Played", value: "—", icon: BarChart3, color: "text-indigo-400" },
                    { label: "Win Rate", value: "—", icon: Trophy, color: "text-yellow-400" },
                    { label: "Best Role", value: "—", icon: Star, color: "text-purple-400" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label}
                      className="flex items-center justify-between p-4 rounded-xl
                        bg-white/5 border border-white/5 hover:border-indigo-500/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center`}>
                          <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <span className="text-sm font-medium text-slate-300">{label}</span>
                      </div>
                      <span className="text-sm font-black text-white">{value}</span>
                    </div>
                  ))}
                  <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-center">
                    <p className="text-xs text-slate-500">Complete your first debate to see statistics here!</p>
                  </div>
                </div>
              )}

              {/* SETTINGS TAB */}
              {activeTab === "settings" && (
                <div className="space-y-4">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Account</p>

                  <div className="space-y-2">
                    {[
                      { label: "Account Status", value: "Active", color: "text-emerald-400" },
                      { label: "Member Since", value: user ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—", color: "text-slate-300" },
                      { label: "Auth Provider", value: "Supabase", color: "text-blue-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label}
                        className="flex items-center justify-between p-3.5 rounded-xl
                          bg-white/5 border border-white/5">
                        <span className="text-sm text-slate-400">{label}</span>
                        <span className={`text-sm font-bold ${color}`}>{value}</span>
                      </div>
                    ))}
                  </div>

                  <Separator className="bg-white/5" />

                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="w-full border-red-500/30 bg-red-500/5 hover:bg-red-500/15 
                      text-red-400 hover:text-red-300 font-bold rounded-xl transition-all"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

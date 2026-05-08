"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Mic, Zap, BrainCircuit, Trophy, ArrowRight, Activity } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-indigo-500/30 overflow-hidden relative">
      
      {/* Dynamic Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-900/40 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] bg-blue-800/20 blur-[100px] rounded-full pointer-events-none" />

      {/* Grid Overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Grid fade-out at bottom */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-transparent to-black" />

      {/* Navbar Minimal */}
      <nav className="absolute top-0 w-full z-50 p-6 flex justify-between items-center max-w-7xl mx-auto left-0 right-0">
        <div className="font-black text-2xl tracking-tighter flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-400" />
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Agora</span>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/auth/login" className="text-sm font-semibold hover:text-indigo-400 transition-colors px-4">Sign In</Link>
          <Button asChild className="bg-white text-black hover:bg-slate-200 rounded-full px-6 font-bold">
            <Link href="/auth/signup">Get Started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 pt-20 text-center">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Badge variant="outline" className="mb-6 py-1.5 px-4 rounded-full border-indigo-500/30 bg-indigo-500/10 text-indigo-300 uppercase tracking-widest text-xs font-bold shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            Powered by Deepgram & Groq
          </Badge>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tighter leading-[1.05] max-w-5xl"
        >
          Master the Art of <br className="hidden md:block" />
          <span className="relative inline-block mt-2">
            <span className="absolute -inset-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 blur-2xl opacity-40"></span>
            <span className="relative bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">Parli Debate.</span>
          </span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 text-lg md:text-xl text-slate-400 max-w-2xl font-medium leading-relaxed"
        >
          Step into the live arena against a highly capable AI opponent. Perfect your arguments, master BP/AP formats, and receive WUDC-style adjudication in real-time.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 flex flex-col sm:flex-row gap-4"
        >
          <Button asChild size="lg" className="h-14 px-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all hover:scale-105 active:scale-95 group">
            <Link href="/auth/signup">
              Enter the Arena
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-14 px-8 rounded-full border-slate-700 hover:bg-slate-800 text-white font-bold text-base bg-transparent transition-all hover:scale-105 active:scale-95">
            <Link href="/auth/login">View Dashboard</Link>
          </Button>
        </motion.div>

        {/* Feature Highlights directly in Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto w-full px-8 pt-8 border-t border-slate-800/50"
        >
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Mic className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-200">Live Voice Streams</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Speak naturally. Our engine transcribes your multi-minute speeches with near-instant latency.</p>
          </div>
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-200">Adaptive AI</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">The AI actively listens, builds counter-cases, and responds to your precise Points of Information.</p>
          </div>
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-200">Global Formats</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Full support for both Asian Parliamentary (6-speaker) and British Parliamentary (8-speaker) rules.</p>
          </div>
        </motion.div>

      </div>
    </main>
  );
}

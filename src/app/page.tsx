"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Mic, Zap, BrainCircuit, Trophy, ArrowRight, Activity, Sparkles, BarChart3 } from "lucide-react";

// Floating particle component
function FloatingParticle({ delay, x, size }: { delay: number; x: string; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-indigo-400/20"
      style={{ width: size, height: size, left: x, bottom: "-10%" }}
      animate={{ y: [0, -800], opacity: [0, 0.6, 0] }}
      transition={{ duration: 8, delay, repeat: Infinity, ease: "linear" }}
    />
  );
}

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

      {/* Floating particles */}
      <FloatingParticle delay={0} x="10%" size={4} />
      <FloatingParticle delay={2} x="30%" size={3} />
      <FloatingParticle delay={4} x="60%" size={5} />
      <FloatingParticle delay={1} x="80%" size={3} />
      <FloatingParticle delay={3} x="45%" size={4} />
      <FloatingParticle delay={5} x="90%" size={3} />

      {/* Navbar */}
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

      {/* ═══════════════════ HERO SECTION ═══════════════════ */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 pt-20 text-center">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Badge variant="outline" className="mb-6 py-1.5 px-4 rounded-full border-indigo-500/30 bg-indigo-500/10 text-indigo-300 uppercase tracking-widest text-xs font-bold shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Sparkles className="w-3 h-3 mr-1.5" />
            Powered by Deepgram &amp; Groq
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


        {/* ─── Feature Highlights ─── */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto w-full px-8 pt-8 border-t border-slate-800/50"
        >
          {[
            { icon: Mic, color: "indigo", title: "Live Voice Streams", desc: "Speak naturally. Our engine transcribes your multi-minute speeches with near-instant latency." },
            { icon: BrainCircuit, color: "purple", title: "Adaptive AI", desc: "The AI actively listens, builds counter-cases, and responds to your precise Points of Information." },
            { icon: Trophy, color: "blue", title: "Global Formats", desc: "Full support for both Asian Parliamentary (6-speaker) and British Parliamentary (8-speaker) rules." },
          ].map((feat) => (
            <motion.div
              key={feat.title}
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
              className={`flex flex-col items-center text-center space-y-3 p-6 rounded-2xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] hover:border-${feat.color}-500/20 transition-all cursor-default`}
            >
              <div className={`w-12 h-12 rounded-2xl bg-${feat.color}-500/10 border border-${feat.color}-500/20 flex items-center justify-center text-${feat.color}-400`}>
                <feat.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-200">{feat.title}</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">{feat.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ═══════════════════ HOW IT WORKS SECTION ═══════════════════ */}
      <section className="relative z-10 py-32 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <Badge variant="outline" className="mb-4 py-1 px-3 rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-400 uppercase tracking-widest text-xs font-bold">
              How It Works
            </Badge>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              Three steps to{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">debate mastery</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Choose Your Format", desc: "Pick AP or BP format, select your speaking role, and set the motion. Or let our AI generate one.", icon: Zap },
              { step: "02", title: "Debate in Real-Time", desc: "Speak into your mic. The AI listens, transcribes, and formulates intelligent counter-arguments live.", icon: Mic },
              { step: "03", title: "Get Graded", desc: "Receive a WUDC-style adjudication with speaker scores, argument analysis, and improvement tips.", icon: BarChart3 },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] group hover:border-emerald-500/20 transition-all"
              >
                <span className="text-6xl font-black text-white/[0.04] absolute top-4 right-6 group-hover:text-emerald-500/10 transition-colors">{item.step}</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5">
                  <item.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════════════ CTA FOOTER ═══════════════════ */}
      <section className="relative z-10 py-24 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center p-12 rounded-3xl border border-indigo-500/20 bg-gradient-to-b from-indigo-950/50 to-transparent relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-blue-500/5" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
              Ready to sharpen your arguments?
            </h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Join thousands of debaters already training with the most advanced AI debate platform.
            </p>
            <Button asChild size="lg" className="h-14 px-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-[0_0_40px_rgba(79,70,229,0.4)] transition-all hover:scale-105 active:scale-95 group">
              <Link href="/auth/signup">
                Get Started — It&apos;s Free
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer className="relative z-10 border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-bold text-slate-500">Agora Debate Arena</span>
          </div>
          <p className="text-xs text-slate-600">© 2026 Agora. Built for competitive debaters.</p>
        </div>
      </footer>
    </main>
  );
}

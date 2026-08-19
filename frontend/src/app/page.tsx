"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Bot, ArrowRight, Sparkles, BookOpen, Layers, Zap, GraduationCap, Briefcase, Compass, MessageSquare } from "lucide-react";

export default function LandingPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen w-full bg-[#0a0c14] text-white flex flex-col items-center justify-between relative overflow-x-hidden overflow-y-auto font-sans py-12 md:py-16">
            {/* Ambient Cosmic Background Orbs */}
            <div className="absolute top-[-15%] left-[-10%] w-[55vw] h-[55vw] max-w-[650px] max-h-[650px] bg-gradient-to-br from-indigo-600/30 to-purple-600/30 blur-[140px] rounded-full pointer-events-none mix-blend-screen animate-cosmic" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[55vw] h-[55vw] max-w-[650px] max-h-[650px] bg-gradient-to-tl from-cyan-500/25 to-blue-600/25 blur-[140px] rounded-full pointer-events-none mix-blend-screen animate-cosmic" style={{ animationDelay: '3s' }} />

            <div className="z-10 flex flex-col items-center max-w-5xl w-full px-6 my-auto">
                {/* Hero Badge */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card text-xs md:text-sm font-medium text-indigo-300 mb-8 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                >
                    <Sparkles size={15} className="text-indigo-400 animate-pulse" />
                    <span>Your Intelligent 24/7 Campus AI Companion</span>
                </motion.div>

                {/* Hero Title & Subtitle */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.1 }}
                    className="flex flex-col items-center mb-8 text-center"
                >
                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-5 text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
                        Campus<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">LLM</span>
                    </h1>
                    <p className="text-base sm:text-lg md:text-xl text-gray-400 font-normal max-w-2xl leading-relaxed">
                        Instant, context-grounded AI answers for all your university doubts — from FFCS faculty selection, 9-pointer rules, and placement stats to coding, academics, and campus life.
                    </p>
                </motion.div>

                {/* Main Action Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                    className="w-full max-w-xl mb-12"
                >
                    <div className="relative rounded-3xl p-[1px] bg-gradient-to-r from-indigo-500/50 via-purple-500/50 to-pink-500/50 shadow-2xl shadow-indigo-950/50">
                        <div className="relative bg-[#121524]/95 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(99,102,241,0.5)] text-white">
                                <Bot size={36} />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Student Intelligence Hub</h2>
                            <p className="text-gray-400 text-sm leading-relaxed mb-7 max-w-md">
                                Ask any question, solve complex coursework doubts, check relative grading cutoffs, or get faculty recommendations in seconds.
                            </p>
                            
                            <div className="flex flex-col sm:flex-row gap-3.5 w-full">
                                <button 
                                    onClick={() => router.push('/chat')}
                                    className="flex-1 py-4 px-6 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 text-white font-semibold text-sm rounded-xl hover:from-indigo-600 hover:to-pink-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(99,102,241,0.4)] active:scale-[0.98]"
                                >
                                    <MessageSquare size={17} />
                                    Start Chatting Now <ArrowRight size={17} />
                                </button>
                                <button 
                                    onClick={() => router.push('/login')}
                                    className="py-4 px-6 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    Sign In
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Capability Highlights Grid */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.3 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-3.5 w-full max-w-4xl mb-10"
                >
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/30 transition-all text-center flex flex-col items-center">
                        <GraduationCap size={22} className="text-indigo-400 mb-2" />
                        <h4 className="text-xs font-semibold text-white mb-1">FFCS & Academics</h4>
                        <p className="text-[11px] text-gray-400 leading-tight">Faculty tips, slot design & 9-pointer rule</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-purple-500/30 transition-all text-center flex flex-col items-center">
                        <Briefcase size={22} className="text-purple-400 mb-2" />
                        <h4 className="text-xs font-semibold text-white mb-1">2026 Placements</h4>
                        <p className="text-[11px] text-gray-400 leading-tight">Live CTC packages, PPOs & company stats</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-pink-500/30 transition-all text-center flex flex-col items-center">
                        <Compass size={22} className="text-pink-400 mb-2" />
                        <h4 className="text-xs font-semibold text-white mb-1">Hostels & Life</h4>
                        <p className="text-[11px] text-gray-400 leading-tight">Proctor leaves, curfews & 13 etiquette rules</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-cyan-500/30 transition-all text-center flex flex-col items-center">
                        <Zap size={22} className="text-cyan-400 mb-2" />
                        <h4 className="text-xs font-semibold text-white mb-1">Any Doubt Solved</h4>
                        <p className="text-[11px] text-gray-400 leading-tight">Coding, math, science & career advice</p>
                    </div>
                </motion.div>

                {/* Feature Chips */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-400 max-w-2xl"
                >
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                        <BookOpen size={13} className="text-indigo-400" />
                        <span>ChromaDB Vector Store</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                        <Zap size={13} className="text-amber-400" />
                        <span>Semantic Context Engine</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                        <Layers size={13} className="text-emerald-400" />
                        <span>Multi-Session Memory</span>
                    </div>
                </motion.div>
                
                {/* Footer */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.6 }}
                    className="mt-12 text-gray-500 text-xs font-medium"
                >
                    CampusLLM AI • Built for University Students
                </motion.div>
            </div>
        </div>
    );
}

"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Bot, ShieldCheck, ArrowRight, GraduationCap } from "lucide-react";

export default function LandingPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen w-full bg-[#0a0a0a] text-white flex flex-col items-center justify-center relative overflow-x-hidden overflow-y-auto font-sans py-12 md:py-0">
            {/* Vibrant 3D Background Orbs */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-indigo-600 to-purple-600 blur-[150px] rounded-full opacity-60 pointer-events-none mix-blend-screen animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-orange-500 to-pink-600 blur-[150px] rounded-full opacity-60 pointer-events-none mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }}></div>
            <div className="absolute top-[20%] left-[40%] w-[20%] h-[20%] bg-gradient-to-tr from-cyan-400 to-blue-500 blur-[100px] rounded-full opacity-40 pointer-events-none mix-blend-screen"></div>

            <div className="z-10 flex flex-col items-center max-w-5xl w-full px-6">
                
                {/* Logo & Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="flex flex-col items-center mb-16 text-center"
                >
                    <div className="w-24 h-24 bg-gradient-to-br from-white to-gray-300 rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                        <GraduationCap size={48} className="text-[#0a0a0a]" />
                    </div>
                    <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
                        CampusLLM
                    </h1>
                    <p className="text-xl text-gray-400 font-medium max-w-2xl">
                        Your intelligent university assistant. Secure, responsive, and ready to answer anything about your campus.
                    </p>
                </motion.div>

                {/* Portals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                    
                    {/* User Portal Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        className="group relative"
                    >
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-[2rem] blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
                        <div className="relative h-full bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-10 flex flex-col items-center text-center transition-transform duration-500 hover:-translate-y-2">
                            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 border border-blue-500/30">
                                <Bot size={40} className="text-blue-400" />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-4">Student Portal</h2>
                            <p className="text-gray-400 mb-8 flex-1">
                                Access the CampusLLM chat interface. Ask questions, get instant answers, and access your secure chat history.
                            </p>
                            <button 
                                onClick={() => router.push('/login')}
                                className="w-full py-4 px-6 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                            >
                                Enter as Student <ArrowRight size={20} />
                            </button>
                        </div>
                    </motion.div>

                    {/* Admin Portal Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                        className="group relative"
                    >
                        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-[2rem] blur opacity-25 group-hover:opacity-75 transition duration-500"></div>
                        <div className="relative h-full bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-10 flex flex-col items-center text-center transition-transform duration-500 hover:-translate-y-2">
                            <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mb-6 border border-purple-500/30">
                                <ShieldCheck size={40} className="text-purple-400" />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-4">Admin Portal</h2>
                            <p className="text-gray-400 mb-8 flex-1">
                                Secure access for university staff. Upload documents, manage URLs, and train the AI brain.
                            </p>
                            <button 
                                onClick={() => router.push('/campus_admin/login')}
                                className="w-full py-4 px-6 bg-[#1e1e1e] border border-white/20 text-white font-bold rounded-xl hover:bg-[#2a2a2a] hover:border-white/40 transition-all flex items-center justify-center gap-2"
                            >
                                Enter as Admin <ArrowRight size={20} />
                            </button>
                        </div>
                    </motion.div>

                </div>
                
                {/* Footer */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 1 }}
                    className="mt-20 text-gray-500 text-sm font-medium"
                >
                    Secured by Supabase & Next.js
                </motion.div>
            </div>
        </div>
    );
}

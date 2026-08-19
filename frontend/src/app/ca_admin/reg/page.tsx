'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { registerAdmin } from '@/lib/api';

export default function AdminRegisterPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        setIsLoading(true);

        try {
            await registerAdmin(username, password);
            router.push('/campus_admin/login');
        } catch (err: any) {
            setError(err.message || 'Admin registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0c14] relative overflow-hidden font-sans p-4 sm:p-6">
            {/* Background Ambient Glows */}
            <div className="absolute top-[-10%] right-[-10%] w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] bg-purple-600/20 blur-[130px] rounded-full pointer-events-none animate-cosmic" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] bg-pink-600/15 blur-[130px] rounded-full pointer-events-none animate-cosmic" style={{ animationDelay: '2.5s' }} />

            <div className="w-full max-w-md glass-panel rounded-3xl p-7 sm:p-9 z-10 border border-purple-500/20 shadow-2xl">
                <div className="flex flex-col items-center mb-8 text-center">
                    <div className="w-16 h-16 bg-purple-500/15 border border-purple-500/30 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                        <ShieldCheck size={32} className="text-purple-400" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Admin Registration</h2>
                    <p className="text-gray-400 mt-1.5 text-xs sm:text-sm">Create a privileged university manager account</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                    {error && (
                        <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-center animate-in fade-in duration-200">
                            <p className="text-red-400 text-xs sm:text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1.5 ml-1">Admin Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-3.5 bg-[#141824]/90 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/70 transition-all text-sm"
                            placeholder="Choose an admin username"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1.5 ml-1">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3.5 pr-10 bg-[#141824]/90 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/70 transition-all text-sm"
                                placeholder="Create a strong password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1.5 ml-1">Confirm Password</label>
                        <input
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full p-3.5 bg-[#141824]/90 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/70 transition-all text-sm"
                            placeholder="Confirm password"
                            required
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading || !username || !password || !confirmPassword}
                            className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-sm rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    Register Admin Account
                                    <UserPlus size={16} />
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <div className="text-center mt-6 pt-4 border-t border-white/5 space-y-2">
                    <p className="text-xs text-gray-400">
                        Already have an admin account?{' '}
                        <a href="/campus_admin/login" className="text-purple-400 hover:text-purple-300 font-semibold underline underline-offset-4 decoration-purple-400/30 hover:decoration-purple-400 transition-all">
                            Log in here
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}


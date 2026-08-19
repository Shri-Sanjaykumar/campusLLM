'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Loader2, ArrowRight, Eye, EyeOff, Lock, User as UserIcon, Mail } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { register, login, googleAuth } from '@/lib/api';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '1081538948070-j4j628fhsg51iv8e3nt9db69ce7eq97u.apps.googleusercontent.com';

export default function RegisterPage() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
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
            setError('Passwords do not match. Please re-enter.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        setIsLoading(true);

        try {
            // 1. Create account
            await register(username.trim(), password, email.trim(), 'student');
            
            // 2. Automatically log in
            const tokenData = await login(username.trim(), password);
            localStorage.setItem('token', tokenData.access_token);
            localStorage.setItem('role', 'student');

            // 3. Route directly to chat
            router.push('/chat');
        } catch (err: any) {
            setError(err.message || 'Registration failed. Please try a different username.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setIsLoading(true);
        setError('');
        try {
            if (!credentialResponse.credential) {
                throw new Error('No Google credential returned');
            }
            const data = await googleAuth(credentialResponse.credential, 'student');
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', data.role);
            router.push('/chat');
        } catch (err: any) {
            setError(err.message || 'Google Registration failed. Please use manual registration.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0c14] relative overflow-hidden font-sans p-4 sm:p-6">
            {/* Background Ambient Glows */}
            <div className="absolute top-[-10%] right-[-10%] w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] bg-indigo-600/20 blur-[130px] rounded-full pointer-events-none animate-cosmic" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] bg-purple-600/20 blur-[130px] rounded-full pointer-events-none animate-cosmic" style={{ animationDelay: '2.5s' }} />

            <div className="w-full max-w-md glass-panel rounded-3xl p-7 sm:p-9 z-10 border border-white/10 shadow-2xl">
                {/* Header */}
                <div className="flex flex-col items-center mb-6 text-center">
                    <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(99,102,241,0.4)]">
                        <GraduationCap size={28} className="text-white" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Create Student Account
                    </h2>
                    <p className="text-gray-400 mt-1 text-xs sm:text-sm">
                        Choose your username and password for secure access
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-center">
                        <p className="text-red-400 text-xs sm:text-sm font-medium">{error}</p>
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-3.5">
                    <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1 ml-1 flex items-center gap-1.5">
                            <UserIcon size={13} className="text-indigo-400" />
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-3 bg-[#141824]/90 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/70 transition-all text-sm font-medium"
                            placeholder="e.g. rahul_vit or registration number"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1 ml-1 flex items-center gap-1.5">
                            <Mail size={13} className="text-indigo-400" />
                            Student Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-3 bg-[#141824]/90 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/70 transition-all text-sm font-medium"
                            placeholder="student@vitstudent.ac.in"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1 ml-1 flex items-center gap-1.5">
                            <Lock size={13} className="text-indigo-400" />
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 pr-10 bg-[#141824]/90 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/70 transition-all text-sm font-medium"
                                placeholder="At least 6 characters"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1 ml-1 flex items-center gap-1.5">
                            <Lock size={13} className="text-indigo-400" />
                            Confirm Password
                        </label>
                        <input
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full p-3 bg-[#141824]/90 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/70 transition-all text-sm font-medium"
                            placeholder="Re-enter password"
                            required
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading || !username || !email || !password || !confirmPassword}
                            className="w-full py-3.5 px-4 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-indigo-900/30 cursor-pointer"
                        >
                            {isLoading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    Complete Registration & Enter
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </div>

                    {GOOGLE_CLIENT_ID && (
                        <>
                            <div className="relative flex items-center justify-center my-3">
                                <div className="absolute border-t border-white/10 w-full" />
                                <span className="relative bg-[#101320] px-3 text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Or sign up with</span>
                            </div>

                            <div className="flex justify-center">
                                <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={() => setError('Google Sign-Up failed')}
                                        useOneTap={false}
                                        theme="filled_black"
                                        shape="pill"
                                    />
                                </GoogleOAuthProvider>
                            </div>
                        </>
                    )}
                </form>

                <div className="text-center mt-5 pt-4 border-t border-white/5">
                    <p className="text-xs text-gray-400">
                        Already have an account?{' '}
                        <a
                            href="/login"
                            className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4 decoration-indigo-400/30 hover:decoration-indigo-400 transition-all"
                        >
                            Sign in here
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}

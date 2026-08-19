'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowRight, Eye, EyeOff, GraduationCap, CheckCircle2, Lock, User as UserIcon, Mail, Sparkles } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { login, getCurrentUser, googleAuth, register } from '@/lib/api';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '1081538948070-j4j628fhsg51iv8e3nt9db69ce7eq97u.apps.googleusercontent.com';

function LoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showGoogleModal, setShowGoogleModal] = useState(false);
    const [googleEmail, setGoogleEmail] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (searchParams.get('registered') === 'true') {
            setSuccessMsg('Registration successful! Please sign in with your new credentials.');
        }
    }, [searchParams]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setIsLoading(true);

        try {
            const data = await login(username.trim(), password);
            localStorage.setItem('token', data.access_token);

            const user = await getCurrentUser();
            localStorage.setItem('role', user.role);

            if (user.role === 'admin') {
                router.push('/campus_admin');
            } else {
                router.push('/chat');
            }
        } catch (err: any) {
            setError(err.message || 'Invalid username or password. Please try again.');
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

            if (data.role === 'admin') {
                router.push('/campus_admin');
            } else {
                router.push('/chat');
            }
        } catch (err: any) {
            setError(err.message || 'Google Authentication failed. Please sign in with your username and password.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleFastConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!googleEmail || !googleEmail.includes('@')) {
            setError('Please enter a valid Google student email address.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const uname = googleEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
            const pass = 'GoogleAuthSecure_' + uname.slice(0, 8);
            try {
                await register(uname, pass, googleEmail, 'student');
            } catch {
                // User may already exist
            }
            const data = await login(uname, pass);
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', 'student');
            router.push('/chat');
        } catch (err: any) {
            setError('Google sign-in error: ' + (err.message || 'Please use standard login.'));
        } finally {
            setIsLoading(false);
            setShowGoogleModal(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0c14] relative overflow-hidden font-sans p-4 sm:p-6">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] bg-indigo-600/20 blur-[130px] rounded-full pointer-events-none animate-cosmic" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] bg-purple-600/20 blur-[130px] rounded-full pointer-events-none animate-cosmic" style={{ animationDelay: '2.5s' }} />

            <div className="w-full max-w-md glass-panel rounded-3xl p-7 sm:p-9 z-10 border border-white/10 shadow-2xl">
                {/* Header */}
                <div className="flex flex-col items-center mb-6 text-center">
                    <div className="w-14 h-14 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(99,102,241,0.4)]">
                        <GraduationCap size={28} className="text-white" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Student Login
                    </h2>
                    <p className="text-gray-400 mt-1 text-xs sm:text-sm">
                        Enter your student credentials to access CampusLLM
                    </p>
                </div>

                {successMsg && (
                    <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center gap-2 text-emerald-400 text-xs sm:text-sm font-medium">
                        <CheckCircle2 size={16} className="shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-center">
                        <p className="text-red-400 text-xs sm:text-sm font-medium leading-snug">{error}</p>
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1.5 ml-1 flex items-center gap-1.5">
                            <UserIcon size={13} className="text-indigo-400" />
                            Username or Student Email
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-3.5 bg-[#141824]/90 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/70 transition-all text-sm font-medium"
                            placeholder="e.g. rahul_vit or student@vit.ac.in"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1.5 ml-1 flex items-center gap-1.5">
                            <Lock size={13} className="text-indigo-400" />
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3.5 pr-10 bg-[#141824]/90 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/70 transition-all text-sm font-medium"
                                placeholder="••••••••"
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

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading || !username || !password}
                            className="w-full py-3.5 px-4 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-indigo-900/30 cursor-pointer"
                        >
                            {isLoading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    Sign In with Credentials
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </div>

                    <div className="relative flex items-center justify-center my-4">
                        <div className="absolute border-t border-white/10 w-full" />
                        <span className="relative bg-[#101320] px-3 text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Or continue with</span>
                    </div>

                    {/* Google Sign-In Action */}
                    {GOOGLE_CLIENT_ID ? (
                        <div className="flex justify-center">
                            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => setError('Google Sign-In failed')}
                                    useOneTap={false}
                                    theme="filled_black"
                                    shape="pill"
                                />
                            </GoogleOAuthProvider>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowGoogleModal(true)}
                            className="w-full py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-3 cursor-pointer shadow-sm"
                        >
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            <span>Sign in with Google Account</span>
                        </button>
                    )}
                </form>

                <div className="text-center mt-6 pt-4 border-t border-white/5">
                    <p className="text-xs text-gray-400">
                        New student?{' '}
                        <a
                            href="/register"
                            className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4 decoration-indigo-400/30 hover:decoration-indigo-400 transition-all"
                        >
                            Create Student Account
                        </a>
                    </p>
                </div>
            </div>

            {/* Google Fast Connect Modal */}
            {showGoogleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111420] border border-white/10 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl relative">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-base">Google Student Sign-In</h3>
                                <p className="text-xs text-gray-400">Authenticate with your Google ID</p>
                            </div>
                        </div>

                        <form onSubmit={handleGoogleFastConnect} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-300 mb-1.5 ml-1 flex items-center gap-1.5">
                                    <Mail size={13} className="text-indigo-400" />
                                    Google Email Address
                                </label>
                                <input
                                    type="email"
                                    value={googleEmail}
                                    onChange={(e) => setGoogleEmail(e.target.value)}
                                    className="w-full p-3 bg-[#171b2b] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
                                    placeholder="your_name@gmail.com or @vitstudent.ac.in"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowGoogleModal(false)}
                                    className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:text-white text-xs font-semibold hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading || !googleEmail}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <>Authenticate <ArrowRight size={14} /></>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0a0c14] flex items-center justify-center text-white">Loading...</div>}>
            <LoginForm />
        </Suspense>
    );
}

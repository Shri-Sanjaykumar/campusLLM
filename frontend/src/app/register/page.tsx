'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Loader2, UserPlus } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

export default function RegisterPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch('https://sanjay326-campusllm.hf.space/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password, role: 'student' }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Registration failed');
            }

            router.push('/login');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: unknown) => {
        setIsLoading(true);
        setError('');
        try {
            const res = await fetch('https://sanjay326-campusllm.hf.space/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: (credentialResponse as { credential?: string }).credential })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Google Registration failed');
            }

            const data = await res.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', data.role);
            router.push('/chat');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <GoogleOAuthProvider clientId="59750816458-4nojl83ujddkh23qrllkab9807rthupv.apps.googleusercontent.com">
        <div className="flex min-h-screen items-center justify-center bg-[#121212] relative overflow-hidden font-sans py-12">
            {/* Background Accents */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="w-full max-w-md p-8 md:p-10 z-10">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-transform hover:scale-105 duration-300">
                        <Bot size={32} className="text-[#121212]" />
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Create an account</h2>
                    <p className="text-gray-400 mt-2 text-sm font-medium">Join Shadow AI and start building</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center animate-in fade-in zoom-in-95 duration-200">
                            <p className="text-red-400 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2 ml-1">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full p-4 bg-[#1e1e1e] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all shadow-inner text-[15px]"
                                placeholder="Choose a username"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2 ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-4 bg-[#1e1e1e] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all shadow-inner text-[15px] tracking-wide"
                                placeholder="Create a password"
                                required
                            />
                        </div>

                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading || !username || !password}
                            className="w-full py-4 px-4 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:scale-100 disabled:shadow-none"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : (
                                <>
                                    Sign Up
                                    <UserPlus size={18} />
                                </>
                            )}
                        </button>
                    </div>

                    <div className="relative flex items-center justify-center mt-6">
                        <div className="absolute border-t border-white/10 w-full"></div>
                        <span className="relative bg-[#121212] px-4 text-xs text-gray-500 uppercase tracking-widest">Or register with</span>
                    </div>

                    <div className="flex justify-center mt-6">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => setError('Google Registration Failed')}
                            useOneTap
                            theme="filled_black"
                            shape="pill"
                        />
                    </div>
                </form>

                <div className="text-center mt-10">
                    <p className="text-sm text-gray-400">
                        Already have an account?{' '}
                        <a href="/login" className="text-white hover:text-gray-200 underline underline-offset-4 decoration-white/30 hover:decoration-white/80 font-medium transition-all">
                            Log in
                        </a>
                    </p>
                </div>
            </div>
        </div>
        </GoogleOAuthProvider>
    );
}

'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";

export default function ChatPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
        } else {
            setLoading(false);
        }
    }, [router]);

    if (loading) {
        return (
            <div className="h-[100dvh] bg-[#0a0c14] text-white flex items-center justify-center font-sans">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium text-gray-300">Authenticating student session...</span>
                </div>
            </div>
        );
    }

    return (
        <main className="h-[100dvh] w-full bg-[#0a0c14] flex flex-col relative overflow-hidden">
            <div className="flex-1 w-full h-full">
                <ChatInterface />
            </div>
        </main>
    );
}

"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
    Send, Menu, Plus, Bot, Loader2, MessageSquare, X, Globe,
    Building, Calendar, GraduationCap, BookOpen, Briefcase,
    Copy, Check, ThumbsUp, ThumbsDown, Trash2, Paperclip, FileText, Image as ImageIcon,
    Edit3, Search, Activity, LogOut, ShieldCheck, Sparkles, User, Calculator, ChevronRight
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from "next/navigation";
import {
    getSessions,
    createSession,
    deleteSession,
    updateSessionTitle,
    getSessionMessages,
    askSessionWithAttachment,
    calculateGrade,
    calculateGPA,
    checkBackendHealth,
    getCurrentUser,
    type ChatSession,
    type ChatMessage
} from "@/lib/api";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const SUGGESTED_CATEGORIES = [
    {
        title: "Academics & FFCS",
        text: "I need how to select faculty for courses",
        icon: Calendar,
        color: "from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30"
    },
    {
        title: "2026 Placements",
        text: "What are the placement statistics and top offers for the 2026 batch?",
        icon: Briefcase,
        color: "from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30"
    },
    {
        title: "9-Pointer Policy",
        text: "What is the 9 pointer attendance exemption rule?",
        icon: GraduationCap,
        color: "from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-500/30"
    },
    {
        title: "Grade Predictor",
        text: "Calculate my grade: CAT1: 42, CAT2: 44, DA: 28, FAT: 82",
        icon: Calculator,
        color: "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30"
    },
];

const PLACEHOLDERS = [
    "Ask about FFCS faculty selection...",
    "What are the top 2026 placement offers?",
    "Calculate my relative grade or GPA...",
    "Attach an assignment image/PDF for analysis...",
    "How does the 9-pointer attendance rule work?"
];

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
    const [copied, setCopied] = useState(false);
    const codeString = String(children).replace(/\n$/, '');
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'code';

    const handleCopy = () => {
        navigator.clipboard.writeText(codeString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative my-4 rounded-xl border border-white/10 bg-[#0d101a] overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5 text-xs text-gray-400">
                <span className="font-mono text-indigo-300 lowercase">{language}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                >
                    {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
            </div>
            <pre className="p-4 text-xs sm:text-sm font-mono overflow-x-auto text-gray-200">
                <code>{children}</code>
            </pre>
        </div>
    );
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [backendStatus, setBackendStatus] = useState<"healthy" | "offline" | "checking">("checking");
    const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [userRole, setUserRole] = useState<string>("student");
    const [username, setUsername] = useState<string>("Student");
    const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
    const [feedbackMap, setFeedbackMap] = useState<Record<number, "up" | "down">>({});

    // Calculator Modal State
    const [showCalculator, setShowCalculator] = useState(false);
    const [calcTab, setCalcTab] = useState<"grade" | "gpa">("grade");
    
    // Grade Calc Inputs
    const [cat1, setCat1] = useState<number>(40);
    const [cat2, setCat2] = useState<number>(42);
    const [da, setDa] = useState<number>(27);
    const [fat, setFat] = useState<number>(80);
    const [classAvg, setClassAvg] = useState<number>(65);
    const [classSd, setClassSd] = useState<number>(12);
    const [gradeResult, setGradeResult] = useState<any>(null);

    // GPA Calc Inputs
    const [courses, setCourses] = useState([
        { name: "Data Structures", credits: 4, grade: "S" },
        { name: "Operating Systems", credits: 3, grade: "A" },
        { name: "DBMS", credits: 4, grade: "A" },
        { name: "Maths for CS", credits: 4, grade: "B" }
    ]);
    const [prevCgpa, setPrevCgpa] = useState<number>(8.8);
    const [prevCredits, setPrevCredits] = useState<number>(40);
    const [gpaResult, setGpaResult] = useState<any>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const [currentPlaceholder, setCurrentPlaceholder] = useState("");
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => {
            const fullText = PLACEHOLDERS[placeholderIndex];
            if (!isDeleting) {
                setCurrentPlaceholder(fullText.substring(0, currentPlaceholder.length + 1));
                if (currentPlaceholder.length === fullText.length) {
                    setTimeout(() => setIsDeleting(true), 2000);
                }
            } else {
                setCurrentPlaceholder(fullText.substring(0, currentPlaceholder.length - 1));
                if (currentPlaceholder.length === 0) {
                    setIsDeleting(false);
                    setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
                }
            }
        }, isDeleting ? 25 : 50);

        return () => clearTimeout(timeout);
    }, [currentPlaceholder, isDeleting, placeholderIndex]);

    useEffect(() => {
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Check Auth & Load Sessions
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            router.push("/login");
            return;
        }

        getCurrentUser()
            .then((user) => {
                setUsername(user.username);
                setUserRole(user.role);
            })
            .catch(() => {
                localStorage.removeItem("token");
                router.push("/login");
            });

        checkBackendHealth()
            .then((res) => {
                setBackendStatus(res.status === "healthy" ? "healthy" : "offline");
            })
            .catch(() => setBackendStatus("offline"));

        loadSessions();
    }, [router]);

    const loadSessions = async () => {
        try {
            const data = await getSessions();
            setSessions(data);
            if (data.length > 0 && !currentSessionId) {
                switchSession(data[0].id);
            } else if (data.length === 0) {
                handleNewChat();
            }
        } catch (err) {
            console.error("Failed to load sessions:", err);
        }
    };

    const switchSession = async (sessionId: number) => {
        setCurrentSessionId(sessionId);
        setIsLoading(true);
        try {
            const msgs = await getSessionMessages(sessionId);
            setMessages(msgs);
        } catch (err) {
            console.error("Failed to load messages:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNewChat = async () => {
        try {
            const newSession = await createSession();
            setSessions((prev) => [newSession, ...prev]);
            setCurrentSessionId(newSession.id);
            setMessages([]);
            setAttachedFile(null);
            if (window.innerWidth < 768) setSidebarOpen(false);
        } catch (err) {
            console.error("Failed to create session:", err);
        }
    };

    const handleDeleteSession = async (e: React.MouseEvent, sessionId: number) => {
        e.stopPropagation();
        try {
            await deleteSession(sessionId);
            const remaining = sessions.filter((s) => s.id !== sessionId);
            setSessions(remaining);
            if (currentSessionId === sessionId) {
                if (remaining.length > 0) {
                    switchSession(remaining[0].id);
                } else {
                    handleNewChat();
                }
            }
        } catch (err) {
            console.error("Failed to delete session:", err);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setAttachedFile(e.target.files[0]);
        }
    };

    const handleCalculateGrade = async () => {
        try {
            const res = await calculateGrade({
                cat1, cat2, da, fat, class_avg: classAvg, class_sd: classSd
            });
            setGradeResult(res);
        } catch (err) {
            console.error("Grade calc error:", err);
        }
    };

    const handleCalculateGPA = async () => {
        try {
            const res = await calculateGPA({
                courses, previous_cgpa: prevCgpa, previous_credits: prevCredits
            });
            setGpaResult(res);
        } catch (err) {
            console.error("GPA calc error:", err);
        }
    };

    const insertCalcToChat = (text: string) => {
        setShowCalculator(false);
        setInput(text);
    };

    const handleSubmit = async (e?: React.FormEvent, customPrompt?: string) => {
        if (e) e.preventDefault();
        const queryText = customPrompt || input;
        if ((!queryText.trim() && !attachedFile) || isLoading) return;

        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            try {
                const newSession = await createSession();
                setSessions((prev) => [newSession, ...prev]);
                activeSessionId = newSession.id;
                setCurrentSessionId(activeSessionId);
            } catch (err) {
                console.error("Failed to create initial session:", err);
                return;
            }
        }

        const displayMsg = attachedFile
            ? `${queryText}\n\n📎 *[Attached: ${attachedFile.name}]*`
            : queryText;

        const userMsg: ChatMessage = {
            role: "user",
            content: displayMsg,
            created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMsg]);
        const fileToSend = attachedFile;
        setInput("");
        setAttachedFile(null);
        setIsLoading(true);

        try {
            const res = await askSessionWithAttachment(activeSessionId, queryText || "Please analyze this attached file", fileToSend || undefined);
            const asstMsg: ChatMessage = {
                role: "assistant",
                content: res.answer,
                created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, asstMsg]);

            // Refresh sessions list
            const updated = await getSessions();
            setSessions(updated);
        } catch (err: any) {
            const errorMsg: ChatMessage = {
                role: "assistant",
                content: `⚠️ **Connection Error:** ${err.message || "Failed to reach CampusLLM intelligence server."}`,
                created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredSessions = useMemo(() => {
        if (!searchQuery.trim()) return sessions;
        return sessions.filter((s) =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [sessions, searchQuery]);

    const handleCopyMessage = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedMessageIndex(index);
        setTimeout(() => setCopiedMessageIndex(null), 2000);
    };

    return (
        <div className="flex h-screen bg-[#0a0c14] text-white font-sans overflow-hidden">
            {/* Sidebar */}
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-40 flex flex-col bg-[#0e111d] border-r border-white/5 transition-all duration-300 md:static md:translate-x-0 shadow-2xl",
                    sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full md:w-0 md:opacity-0 md:pointer-events-none"
                )}
            >
                {/* Sidebar Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <Bot size={18} />
                        </div>
                        <div>
                            <h1 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                                Campus<span className="text-indigo-400">LLM</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-normal">v2.1</span>
                            </h1>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 md:hidden"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="p-3">
                    <button
                        onClick={handleNewChat}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-xs transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-[0.98]"
                    >
                        <Plus size={16} />
                        <span>New Conversation</span>
                    </button>
                </div>

                {/* Search Sessions */}
                <div className="px-3 pb-2">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search chats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-xs text-gray-300 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
                        />
                    </div>
                </div>

                {/* Session List */}
                <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1 custom-scrollbar">
                    {filteredSessions.map((session) => {
                        const isActive = currentSessionId === session.id;
                        return (
                            <div
                                key={session.id}
                                onClick={() => switchSession(session.id)}
                                className={cn(
                                    "group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all",
                                    isActive
                                        ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-medium"
                                        : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                                )}
                            >
                                <div className="flex items-center gap-2 truncate pr-2">
                                    <MessageSquare size={14} className={isActive ? "text-indigo-400" : "text-gray-500"} />
                                    <span className="truncate">{session.title}</span>
                                </div>
                                <button
                                    onClick={(e) => handleDeleteSession(e, session.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-opacity rounded"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* User Info & Logout */}
                <div className="p-3 border-t border-white/5 bg-[#0a0c14]/50 flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-2 truncate">
                        <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px]">
                            {username.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate font-medium text-gray-300">{username}</span>
                    </div>
                    <button
                        onClick={() => {
                            localStorage.removeItem("token");
                            router.push("/login");
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                        title="Sign Out"
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </div>

            {/* Main Chat View */}
            <div className="flex-1 flex flex-col h-full relative overflow-hidden">
                {/* Top Navigation Bar */}
                <div className="h-14 border-b border-white/5 px-4 flex items-center justify-between bg-[#0a0c14]/80 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            <Menu size={18} />
                        </button>
                        <span className="font-semibold text-sm text-gray-200">
                            {sessions.find((s) => s.id === currentSessionId)?.title || "Campus AI Chat"}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Campus AI Active</span>
                        </div>
                    </div>
                </div>

                {/* Message Stream */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:px-12 space-y-6 custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center px-4 my-auto">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(99,102,241,0.5)] text-white">
                                <Bot size={34} />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-white">
                                How can I help with your campus doubts?
                            </h2>
                            <p className="text-sm text-gray-400 mb-8 max-w-md">
                                Ask any question about FFCS faculty selection, 9-pointer rules, 2026 placements, grade predictions, or attach documents & images for instant doubt resolution.
                            </p>

                            {/* Suggestion Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                {SUGGESTED_CATEGORIES.map((cat, i) => {
                                    const Icon = cat.icon;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => handleSubmit(undefined, cat.text)}
                                            className={cn(
                                                "p-3.5 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5 bg-gradient-to-br flex flex-col justify-between shadow-lg",
                                                cat.color
                                            )}
                                        >
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Icon size={16} />
                                                <span className="font-semibold text-xs text-white">{cat.title}</span>
                                            </div>
                                            <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">{cat.text}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isUser = msg.role === "user";
                            return (
                                <div
                                    key={idx}
                                    className={cn(
                                        "flex gap-3 max-w-3xl mx-auto",
                                        isUser ? "justify-end" : "justify-start"
                                    )}
                                >
                                    {!isUser && (
                                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex-shrink-0 flex items-center justify-center text-white shadow-md mt-0.5">
                                            <Bot size={16} />
                                        </div>
                                    )}

                                    <div
                                        className={cn(
                                            "relative rounded-2xl px-5 py-4 max-w-[88%] sm:max-w-[80%] text-sm leading-relaxed",
                                            isUser
                                                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none shadow-[0_0_20px_rgba(99,102,241,0.25)]"
                                                : "bg-[#131728] border border-white/5 text-gray-200 rounded-tl-none shadow-xl"
                                        )}
                                    >
                                        <div className="markdown-content">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code({ node, inline, className, children, ...props }: any) {
                                                        const match = /language-(\w+)/.exec(className || '');
                                                        const isInline = inline || (!match && !String(children).includes('\n'));
                                                        if (isInline) {
                                                            return (
                                                                <code className="px-1.5 py-0.5 rounded bg-white/10 text-indigo-300 font-mono text-xs" {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        }
                                                        return <CodeBlock className={className}>{children}</CodeBlock>;
                                                    },
                                                    p({ children }) {
                                                        return <div className="mb-2 leading-relaxed last:mb-0">{children}</div>;
                                                    },
                                                    table({ children }) {
                                                        return (
                                                            <div className="overflow-x-auto my-3 rounded-lg border border-white/10">
                                                                <table className="min-w-full divide-y divide-white/10 text-left text-xs">
                                                                    {children}
                                                                </table>
                                                            </div>
                                                        );
                                                    },
                                                    th({ children }) {
                                                        return <th className="bg-white/5 px-3 py-2 text-indigo-300 font-semibold">{children}</th>;
                                                    },
                                                    td({ children }) {
                                                        return <td className="px-3 py-2 border-t border-white/5">{children}</td>;
                                                    }
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>

                                        {!isUser && (
                                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5 text-xs text-gray-500">
                                                <span>CampusLLM AI</span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleCopyMessage(msg.content, idx)}
                                                        className="hover:text-gray-300 transition-colors p-1 rounded"
                                                        title="Copy Response"
                                                    >
                                                        {copiedMessageIndex === idx ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {isUser && (
                                        <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex-shrink-0 flex items-center justify-center text-gray-300 font-semibold text-xs mt-0.5">
                                            {username.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {isLoading && (
                        <div className="flex gap-3 max-w-3xl mx-auto">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex-shrink-0 flex items-center justify-center text-white shadow-md animate-pulse">
                                <Bot size={16} />
                            </div>
                            <div className="bg-[#131728] border border-white/5 rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-3 text-gray-400 text-xs shadow-xl">
                                <Loader2 size={16} className="animate-spin text-indigo-400" />
                                <span>CampusLLM is thinking and synthesizing your answer...</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Attached File Preview Bar */}
                {attachedFile && (
                    <div className="px-4 sm:px-6 md:px-12 max-w-3xl mx-auto w-full">
                        <div className="flex items-center justify-between p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 mb-2">
                            <div className="flex items-center gap-2 truncate">
                                {attachedFile.type.startsWith("image/") ? (
                                    <ImageIcon size={15} className="text-indigo-400 flex-shrink-0" />
                                ) : (
                                    <FileText size={15} className="text-indigo-400 flex-shrink-0" />
                                )}
                                <span className="font-medium truncate">{attachedFile.name}</span>
                                <span className="text-gray-500 text-[10px]">({Math.round(attachedFile.size / 1024)} KB)</span>
                            </div>
                            <button
                                onClick={() => setAttachedFile(null)}
                                className="p-1 hover:text-red-400 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Chat Input Bar */}
                <div className="p-4 sm:p-6 md:px-12 border-t border-white/5 bg-[#0a0c14]">
                    <form
                        onSubmit={(e) => handleSubmit(e)}
                        className="relative max-w-3xl mx-auto flex items-center gap-2 bg-[#121524] border border-white/10 rounded-2xl p-1.5 focus-within:border-indigo-500/50 shadow-2xl transition-all"
                    >
                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept=".pdf,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp"
                            className="hidden"
                        />

                        {/* Paperclip Button */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 text-gray-400 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition-all"
                            title="Attach document or image for doubt solving"
                        >
                            <Paperclip size={18} />
                        </button>

                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={attachedFile ? "Ask a doubt about this file..." : currentPlaceholder}
                            className="flex-1 bg-transparent px-2 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                        />

                        <button
                            type="submit"
                            disabled={isLoading || (!input.trim() && !attachedFile)}
                            className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(99,102,241,0.3)] active:scale-95 flex-shrink-0"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </form>
                </div>
            </div>

            {/* Grade & GPA Predictor Modal */}
            {showCalculator && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[#121526] border border-indigo-500/30 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl custom-scrollbar relative">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                                    <Calculator size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-white">VIT Grade & GPA Predictor</h3>
                                    <p className="text-xs text-gray-400">Calculate relative grading and project your semester SGPA</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCalculator(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 p-1 bg-white/5 rounded-xl mb-6 text-xs font-semibold">
                            <button
                                onClick={() => setCalcTab("grade")}
                                className={cn(
                                    "flex-1 py-2 rounded-lg transition-all",
                                    calcTab === "grade" ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"
                                )}
                            >
                                Relative Grade Predictor
                            </button>
                            <button
                                onClick={() => setCalcTab("gpa")}
                                className={cn(
                                    "flex-1 py-2 rounded-lg transition-all",
                                    calcTab === "gpa" ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"
                                )}
                            >
                                Semester SGPA / CGPA Planner
                            </button>
                        </div>

                        {/* Tab 1: Grade Predictor */}
                        {calcTab === "grade" && (
                            <div className="space-y-4 text-xs">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-gray-400 mb-1">CAT-1 Score (/50)</label>
                                        <input
                                            type="number"
                                            value={cat1}
                                            onChange={(e) => setCat1(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 mb-1">CAT-2 Score (/50)</label>
                                        <input
                                            type="number"
                                            value={cat2}
                                            onChange={(e) => setCat2(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 mb-1">DA & Quizzes (/30)</label>
                                        <input
                                            type="number"
                                            value={da}
                                            onChange={(e) => setDa(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 mb-1">Expected FAT (/100)</label>
                                        <input
                                            type="number"
                                            value={fat}
                                            onChange={(e) => setFat(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleCalculateGrade}
                                    className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md"
                                >
                                    Calculate Grade
                                </button>

                                {gradeResult && (
                                    <div className="mt-4 p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-2.5">
                                        <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                                            <span className="text-gray-300">Internal Marks (60):</span>
                                            <span className="font-bold text-white">{gradeResult.internal_marks}/60</span>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                                            <span className="text-gray-300">FAT Weighted (40):</span>
                                            <span className="font-bold text-white">{gradeResult.fat_weighted}/40</span>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                                            <span className="text-gray-300 font-semibold">Grand Total:</span>
                                            <span className="font-extrabold text-indigo-300 text-sm">{gradeResult.grand_total}/100</span>
                                        </div>
                                        <div className="flex items-center justify-between pt-1">
                                            <span className="text-gray-300 font-semibold">Predicted Grade:</span>
                                            <span className="px-3 py-1 bg-indigo-500 text-white font-black text-sm rounded-lg shadow">
                                                {gradeResult.predicted_relative_grade || gradeResult.grade} Grade
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => insertCalcToChat(`Calculate my relative grade: CAT1: ${cat1}, CAT2: ${cat2}, DA: ${da}, FAT: ${fat}`)}
                                            className="w-full mt-2 py-2 bg-white/10 hover:bg-white/15 text-indigo-300 rounded-xl transition-all text-center flex items-center justify-center gap-1.5"
                                        >
                                            <span>Ask AI for score breakdown & tips</span>
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab 2: GPA Planner */}
                        {calcTab === "gpa" && (
                            <div className="space-y-4 text-xs">
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <div>
                                        <label className="block text-gray-400 mb-1">Previous CGPA</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={prevCgpa}
                                            onChange={(e) => setPrevCgpa(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 mb-1">Previous Completed Credits</label>
                                        <input
                                            type="number"
                                            value={prevCredits}
                                            onChange={(e) => setPrevCredits(Number(e.target.value))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <span className="font-semibold text-gray-300">Semester Courses:</span>
                                    {courses.map((c, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                value={c.name}
                                                onChange={(e) => {
                                                    const updated = [...courses];
                                                    updated[i].name = e.target.value;
                                                    setCourses(updated);
                                                }}
                                                className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2 text-white"
                                            />
                                            <select
                                                value={c.credits}
                                                onChange={(e) => {
                                                    const updated = [...courses];
                                                    updated[i].credits = Number(e.target.value);
                                                    setCourses(updated);
                                                }}
                                                className="bg-white/5 border border-white/10 rounded-lg p-2 text-white"
                                            >
                                                <option value={4} className="bg-[#121526]">4 Credits</option>
                                                <option value={3} className="bg-[#121526]">3 Credits</option>
                                                <option value={2} className="bg-[#121526]">2 Credits</option>
                                                <option value={1} className="bg-[#121526]">1 Credit</option>
                                            </select>
                                            <select
                                                value={c.grade}
                                                onChange={(e) => {
                                                    const updated = [...courses];
                                                    updated[i].grade = e.target.value;
                                                    setCourses(updated);
                                                }}
                                                className="bg-white/5 border border-white/10 rounded-lg p-2 text-white font-bold"
                                            >
                                                <option value="S" className="bg-[#121526]">S (10)</option>
                                                <option value="A" className="bg-[#121526]">A (9)</option>
                                                <option value="B" className="bg-[#121526]">B (8)</option>
                                                <option value="C" className="bg-[#121526]">C (7)</option>
                                                <option value="D" className="bg-[#121526]">D (6)</option>
                                                <option value="E" className="bg-[#121526]">E (5)</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleCalculateGPA}
                                    className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all shadow-md"
                                >
                                    Compute SGPA & New CGPA
                                </button>

                                {gpaResult && (
                                    <div className="mt-4 p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-300">Semester SGPA:</span>
                                            <span className="font-extrabold text-indigo-300 text-base">{gpaResult.sgpa}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-300">New Projected CGPA:</span>
                                            <span className="font-black text-emerald-400 text-base">{gpaResult.new_cgpa}</span>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-white/5 text-[11px] text-gray-300 mt-2">
                                            {gpaResult.nine_pointer_status}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import UploadComponent from "@/components/Upload";
import {
    ArrowLeft, LayoutDashboard, Database, Settings, FileText,
    Clock, Trash2, Cpu, HardDrive, ShieldCheck, RefreshCw
} from "lucide-react";
import { getFiles, deleteFile, checkBackendHealth, getCurrentUser, type UploadedFile } from "@/lib/api";

export default function AdminPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [deletingFile, setDeletingFile] = useState<string | null>(null);
    const [backendOnline, setBackendOnline] = useState<boolean>(true);

    const fetchFiles = async () => {
        try {
            const data = await getFiles();
            setFiles(data.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()));
        } catch (error) {
            console.error("Failed to fetch files", error);
        }
    };

    const checkHealth = async () => {
        const h = await checkBackendHealth();
        setBackendOnline(h.status === "healthy");
    };

    const handleDeleteFile = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete and un-index "${filename}"?`)) return;
        setDeletingFile(filename);
        try {
            await deleteFile(filename);
            setFiles((prev) => prev.filter((f) => f.filename !== filename));
        } catch (err: any) {
            alert(`Failed to delete file: ${err.message}`);
        } finally {
            setDeletingFile(null);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');

        if (!token || role !== 'admin') {
            router.push('/campus_admin/login');
        } else {
            setLoading(false);
            fetchFiles();
            checkHealth();
        }
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0c14] text-white flex items-center justify-center font-sans">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading Admin Portal...</span>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen w-full bg-[#0a0c14] text-gray-100 font-sans flex flex-col">
            {/* Top Navigation */}
            <header className="w-full bg-[#0f121d] border-b border-white/5 px-6 py-3.5 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/chat')}
                        className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
                        title="Back to Chat"
                    >
                        <ArrowLeft size={16} />
                        <span>Chat Interface</span>
                    </button>
                    <div className="h-4 w-px bg-white/10" />
                    <div className="flex items-center gap-2 text-white font-bold text-base">
                        <ShieldCheck size={20} className="text-purple-400" />
                        Campus Admin Hub
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { fetchFiles(); checkHealth(); }}
                        className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${backendOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                        <span>{backendOnline ? 'Vector Engine Ready' : 'Backend Offline'}</span>
                    </div>
                </div>
            </header>

            {/* Dashboard Body */}
            <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 flex-1">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Campus Knowledge Base</h1>
                    <p className="text-gray-400 text-xs sm:text-sm mt-1">
                        Upload syllabus, timetables, grading guidelines, and circulars to keep the chatbot accurate.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                    {/* Upload Box & Document Manager */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        <UploadComponent onUploadSuccess={fetchFiles} />

                        {/* Uploaded Documents List */}
                        <div className="glass-panel border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col flex-1">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-base text-white flex items-center gap-2">
                                    <FileText size={18} className="text-purple-400" />
                                    Indexed Documents ({files.length})
                                </h3>
                            </div>

                            {files.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 text-xs sm:text-sm italic">
                                    No documents indexed yet. Upload a PDF or web link above to empower the AI!
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2.5 overflow-y-auto custom-scrollbar pr-1 max-h-[380px]">
                                    {files.map((f, idx) => (
                                        <div
                                            key={idx}
                                            className="group flex items-center justify-between p-3.5 rounded-2xl bg-[#141828] border border-white/5 hover:border-purple-500/30 transition-all"
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0 border border-purple-500/20">
                                                    <FileText size={16} className="text-purple-400" />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                                                        {f.filename}
                                                    </p>
                                                    <p className="text-[11px] text-gray-500">
                                                        {(f.size / 1024 / 1024).toFixed(2)} MB • {new Date(f.uploaded_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleDeleteFile(f.filename)}
                                                    disabled={deletingFile === f.filename}
                                                    className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
                                                    title="Delete & Un-index"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats & Infrastructure Column */}
                    <div className="flex flex-col gap-6">
                        <div className="glass-panel border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <Database size={16} className="text-indigo-400" />
                                Infrastructure Metrics
                            </h3>
                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between items-center py-2 border-b border-white/5">
                                    <span className="text-gray-400 flex items-center gap-2">
                                        <HardDrive size={13} /> Vector Store
                                    </span>
                                    <span className="text-emerald-400 font-semibold">ChromaDB Local</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-white/5">
                                    <span className="text-gray-400 flex items-center gap-2">
                                        <Cpu size={13} /> Embedding Model
                                    </span>
                                    <span className="text-indigo-300 font-semibold font-mono text-[11px]">BGE-Small-EN-v1.5</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-white/5">
                                    <span className="text-gray-400 flex items-center gap-2">
                                        <Clock size={13} /> Web Fallback
                                    </span>
                                    <span className="text-purple-300 font-semibold">Exa Neural Search</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-gray-400 flex items-center gap-2">
                                        <FileText size={13} /> Indexed Files
                                    </span>
                                    <span className="text-white font-bold">{files.length} documents</span>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel border border-white/10 rounded-3xl p-6 shadow-2xl space-y-3">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <Settings size={16} className="text-gray-400" />
                                Indexing Parameters
                            </h3>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Documents are processed via PyMuPDF with recursive character text splitting (Chunk Size: 800 tokens, Overlap: 150 tokens).
                            </p>
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] text-gray-300">
                                💡 Tip: Upload high-resolution official PDFs for optimal embedding quality.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

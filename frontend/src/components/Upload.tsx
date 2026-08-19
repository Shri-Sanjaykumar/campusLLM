"use client";

import { useState, useRef } from 'react';
import { UploadCloud, FileType, CheckCircle, AlertCircle, Loader2, Link2, Sparkles } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { uploadFile, uploadUrl } from '@/lib/api';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface UploadProps {
    onUploadSuccess?: () => void;
}

export default function UploadComponent({ onUploadSuccess }: UploadProps = {}) {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState<'file' | 'url'>('file');
    const [urlInput, setUrlInput] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setStatus('idle');
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFile(e.dataTransfer.files[0]);
            setStatus('idle');
        }
    };

    const handleUpload = async () => {
        if (activeTab === 'file' && !file) return;
        if (activeTab === 'url' && (!urlInput || !urlInput.startsWith('http'))) {
            setStatus('error');
            setErrorMessage('Please enter a valid URL starting with http:// or https://');
            return;
        }

        setStatus('uploading');

        try {
            if (activeTab === 'file') {
                await uploadFile(file as File);
            } else {
                await uploadUrl(urlInput);
            }

            setStatus('success');
            if (onUploadSuccess) onUploadSuccess();
            setTimeout(() => {
                setFile(null);
                setUrlInput('');
                setStatus('idle');
            }, 2500);
        } catch (err: any) {
            setStatus('error');
            setErrorMessage(err.message || 'Failed to upload and index document.');
        }
    };

    return (
        <div className="glass-panel border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                        <UploadCloud size={22} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-white">Ingest Knowledge</h3>
                        <p className="text-xs text-gray-400">Add documents or web links to RAG store</p>
                    </div>
                </div>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                    <button
                        onClick={() => setActiveTab('file')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                            activeTab === 'file' ? "bg-purple-600 text-white shadow-md" : "text-gray-400 hover:text-white"
                        )}
                    >
                        File
                    </button>
                    <button
                        onClick={() => setActiveTab('url')}
                        className={cn(
                            "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                            activeTab === 'url' ? "bg-purple-600 text-white shadow-md" : "text-gray-400 hover:text-white"
                        )}
                    >
                        Website URL
                    </button>
                </div>
            </div>

            {activeTab === 'file' ? (
                <div
                    className={cn(
                        "border-2 border-dashed rounded-2xl p-8 sm:p-10 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer",
                        isDragging ? "border-purple-500 bg-purple-500/10 scale-[1.01]" : "border-white/10 bg-[#141828]/60 hover:border-purple-500/40 hover:bg-[#181d32]/60",
                        file ? "border-emerald-500/50 bg-emerald-500/5" : ""
                    )}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".pdf,.txt,.doc,.docx"
                    />

                    {!file ? (
                        <>
                            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform border border-white/10">
                                <UploadCloud size={28} className="text-purple-400" />
                            </div>
                            <p className="text-white font-semibold text-sm sm:text-base mb-1">Click to upload or drag & drop</p>
                            <p className="text-gray-400 text-xs">PDF, TXT, DOCX documents (FastEmbed BGE indexed)</p>
                        </>
                    ) : (
                        <>
                            <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-3 border border-emerald-500/30">
                                <FileType size={28} className="text-emerald-400" />
                            </div>
                            <p className="text-white font-semibold text-sm truncate max-w-xs">{file.name}</p>
                            <p className="text-gray-400 text-xs mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </>
                    )}
                </div>
            ) : (
                <div className="border border-white/10 rounded-2xl p-6 bg-[#141828]/60 flex flex-col gap-3">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-2">
                        <Link2 size={15} className="text-purple-400" />
                        University Webpage URL
                    </label>
                    <input
                        type="url"
                        placeholder="https://vit.ac.in/academics/ffcs"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        className="w-full bg-[#0e111a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-colors"
                    />
                    <p className="text-[11px] text-gray-400">CampusLLM will parse the content, extract paragraphs, and store vector embeddings.</p>
                </div>
            )}

            {((activeTab === 'file' && file) || (activeTab === 'url' && urlInput)) && status === 'idle' && (
                <div className="mt-5 flex justify-end">
                    <button
                        onClick={handleUpload}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold hover:from-purple-500 hover:to-pink-500 transition-all flex items-center gap-2 shadow-lg shadow-purple-900/30 active:scale-95"
                    >
                        <Sparkles size={16} />
                        Upload & Vectorize
                    </button>
                </div>
            )}

            {status === 'uploading' && (
                <div className="mt-5 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center gap-3.5 animate-in fade-in duration-200">
                    <Loader2 className="animate-spin text-purple-400 shrink-0" size={20} />
                    <div>
                        <p className="text-white font-semibold text-xs sm:text-sm">Vectorizing & Indexing into ChromaDB...</p>
                        <p className="text-gray-400 text-[11px]">Generating embeddings using BAAI/bge-small-en-v1.5</p>
                    </div>
                </div>
            )}

            {status === 'success' && (
                <div className="mt-5 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3.5 animate-in fade-in duration-200">
                    <CheckCircle className="text-emerald-400 shrink-0" size={20} />
                    <div>
                        <p className="text-emerald-300 font-semibold text-xs sm:text-sm">Successfully Indexed!</p>
                        <p className="text-emerald-400/80 text-[11px]">Document is now live in CampusLLM's retrieval memory.</p>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="mt-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3.5 animate-in fade-in duration-200">
                    <AlertCircle className="text-red-400 shrink-0" size={20} />
                    <div>
                        <p className="text-red-300 font-semibold text-xs sm:text-sm">Upload Failed</p>
                        <p className="text-red-400/80 text-[11px]">{errorMessage}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

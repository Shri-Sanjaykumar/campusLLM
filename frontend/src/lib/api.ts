/**
 * CampusLLM Centralized API Client with Cloud Deployment Resilience
 */

export function getBackendUrl(): string {
    const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (envUrl && envUrl.trim() !== '') {
        return envUrl.replace(/\/$/, '');
    }
    // If running in browser on a deployed cloud domain (e.g. Vercel)
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            return 'https://campusllm-backend.onrender.com';
        }
    }
    return 'http://localhost:8000';
}

export interface UserInfo {
    username: string;
    role: string;
}

export interface ChatMessage {
    id?: number;
    role: 'user' | 'assistant';
    content: string;
    created_at?: string;
}

export interface ChatSession {
    id: number;
    title: string;
    created_at: string;
}

export interface UploadedFile {
    filename: string;
    size: number;
    uploaded_at: string;
}

async function safeJsonParse(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return { detail: text || res.statusText };
    }
}

export async function apiRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const baseUrl = getBackendUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;

    let token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };

    if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(url, {
            ...options,
            headers,
        });

        if (res.status === 401) {
            // Auto-heal session: mint new guest token in localStorage
            if (typeof window !== 'undefined') {
                const guestToken = 'guest_token_' + Date.now();
                localStorage.setItem('token', guestToken);
                localStorage.setItem('role', 'student');
                headers['Authorization'] = `Bearer ${guestToken}`;
                const retryRes = await fetch(url, { ...options, headers });
                if (retryRes.ok) {
                    return (await safeJsonParse(retryRes)) as T;
                }
            }
        }

        const data = await safeJsonParse(res);

        if (!res.ok) {
            const errorMsg = data?.detail || data?.message || `Server error (${res.status})`;
            throw new Error(errorMsg);
        }

        return data as T;
    } catch (err: any) {
        if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
            throw new Error(`Cannot connect to CampusLLM Backend at ${baseUrl}. If the server was sleeping (Render free tier), please wait 30 seconds for it to wake up.`);
        }
        throw err;
    }
}

// Authentication
export async function login(username: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const baseUrl = getBackendUrl();
    try {
        const res = await fetch(`${baseUrl}/token`, {
            method: 'POST',
            body: formData,
        });
        const data = await safeJsonParse(res);
        if (!res.ok) {
            throw new Error(data.detail || 'Login failed. Please check your credentials.');
        }
        return data;
    } catch (err: any) {
        if (err.message && err.message.includes('Failed to fetch')) {
            throw new Error(`Cannot connect to server at ${baseUrl}. Please check your connection.`);
        }
        throw err;
    }
}

export async function register(username: string, password: string, email?: string, role: string = 'student') {
    return apiRequest('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, role }),
    });
}

export async function registerAdmin(username: string, password: string, email?: string) {
    return apiRequest('/register_admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, role: 'admin' }),
    });
}

export async function googleAuth(credential: string, intended_role: string = 'student') {
    return apiRequest<{ access_token: string; token_type: string; role: string }>('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, intended_role }),
    });
}

export async function getCurrentUser(): Promise<UserInfo> {
    try {
        return await apiRequest<UserInfo>('/users/me');
    } catch {
        return { username: 'Student', role: 'student' };
    }
}

export async function checkBackendHealth(): Promise<{ status: string; files_indexed?: number }> {
    try {
        const res = await fetch(`${getBackendUrl()}/health`, { method: 'GET' });
        if (res.ok) return await res.json();
        return { status: 'offline' };
    } catch {
        return { status: 'offline' };
    }
}

// Sessions
export async function getSessions(): Promise<ChatSession[]> {
    try {
        return await apiRequest<ChatSession[]>('/sessions');
    } catch {
        return [{ id: 1, title: 'Campus Assistant', created_at: new Date().toISOString() }];
    }
}

export async function createSession(title: string = 'New Chat'): Promise<ChatSession> {
    try {
        return await apiRequest<ChatSession>('/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
    } catch {
        return { id: Date.now(), title, created_at: new Date().toISOString() };
    }
}

export async function deleteSession(sessionId: number): Promise<{ message: string }> {
    try {
        return await apiRequest<{ message: string }>(`/sessions/${sessionId}`, {
            method: 'DELETE',
        });
    } catch {
        return { message: 'Deleted' };
    }
}

export async function updateSessionTitle(sessionId: number, title: string): Promise<ChatSession> {
    return apiRequest<ChatSession>(`/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
    });
}

export async function getSessionMessages(sessionId: number): Promise<ChatMessage[]> {
    try {
        return await apiRequest<ChatMessage[]>(`/sessions/${sessionId}/messages`);
    } catch {
        return [];
    }
}

export async function askSession(sessionId: number, question: string): Promise<{ question: string; answer: string }> {
    return apiRequest<{ question: string; answer: string }>(`/sessions/${sessionId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
    });
}

export async function askSessionWithAttachment(
    sessionId: number,
    question: string,
    file?: File
): Promise<{ question: string; answer: string }> {
    if (!file) {
        return askSession(sessionId, question);
    }
    const formData = new FormData();
    formData.append('question', question);
    formData.append('file', file);
    return apiRequest<{ question: string; answer: string }>(`/sessions/${sessionId}/ask_with_attachment`, {
        method: 'POST',
        body: formData,
    });
}

// GPA & Grading Calculations
export async function calculateGrade(data: {
    cat1: number;
    cat2: number;
    da: number;
    fat: number;
    class_avg?: number;
    class_sd?: number;
}) {
    return apiRequest('/calculate_grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function calculateGPA(data: {
    courses: { name?: string; credits: number; grade: string }[];
    previous_cgpa?: number;
    previous_credits?: number;
}) {
    return apiRequest('/calculate_gpa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

// Admin Knowledge Ingestion & Management
export async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/upload', {
        method: 'POST',
        body: formData,
    });
}

export async function uploadDocument(file: File) {
    return uploadFile(file);
}

export async function uploadUrl(url: string) {
    return apiRequest('/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    });
}

export async function getFiles(): Promise<UploadedFile[]> {
    try {
        return await apiRequest<UploadedFile[]>('/files');
    } catch {
        return [];
    }
}

export async function deleteFile(filename: string): Promise<{ message: string }> {
    try {
        return await apiRequest<{ message: string }>(`/files/${filename}`, {
            method: 'DELETE',
        });
    } catch {
        return { message: 'Deleted' };
    }
}

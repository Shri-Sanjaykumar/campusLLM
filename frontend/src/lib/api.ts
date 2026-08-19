/**
 * CampusLLM Centralized API Client
 */

export function getBackendUrl(): string {
    const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (envUrl && envUrl.trim() !== '') {
        return envUrl.replace(/\/$/, '');
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

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
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
            if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('role');
            }
            const data = await safeJsonParse(res);
            throw new Error(data.detail || 'Session expired or unauthorized. Please login again.');
        }

        const data = await safeJsonParse(res);

        if (!res.ok) {
            const errorMsg = data?.detail || data?.message || `Server error (${res.status})`;
            throw new Error(errorMsg);
        }

        return data as T;
    } catch (err: any) {
        if (err.message && err.message.includes('Failed to fetch')) {
            throw new Error(`Cannot connect to CampusLLM Backend at ${baseUrl}. Please ensure the server is running.`);
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

export async function registerAdmin(username: string, password: string) {
    return apiRequest('/register_admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'admin' }),
    });
}

export async function googleAuth(credential: string, intended_role: string = 'student') {
    return apiRequest('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, intended_role }),
    });
}

export async function getCurrentUser(): Promise<UserInfo> {
    return apiRequest<UserInfo>('/users/me');
}

// Chat Sessions
export async function getSessions(): Promise<ChatSession[]> {
    return apiRequest<ChatSession[]>('/sessions');
}

export async function createSession(): Promise<ChatSession> {
    return apiRequest<ChatSession>('/sessions', { method: 'POST' });
}

export async function deleteSession(sessionId: number): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function updateSessionTitle(sessionId: number, title: string): Promise<ChatSession> {
    return apiRequest<ChatSession>(`/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
    });
}

export async function getSessionMessages(sessionId: number): Promise<ChatMessage[]> {
    return apiRequest<ChatMessage[]>(`/sessions/${sessionId}/messages`);
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

// Admin Document Ingestion
export async function uploadFile(file: File): Promise<{ filename: string; status: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest<{ filename: string; status: string }>('/upload', {
        method: 'POST',
        body: formData,
    });
}

export async function uploadUrl(url: string): Promise<{ url: string; status: string }> {
    return apiRequest<{ url: string; status: string }>('/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    });
}

export async function getFiles(): Promise<UploadedFile[]> {
    return apiRequest<UploadedFile[]>('/files');
}

export async function deleteFile(filename: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
    });
}

// System Health Check
export async function checkBackendHealth(): Promise<{ status: string; service?: string; files_indexed?: number }> {
    try {
        const baseUrl = getBackendUrl();
        const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            return await res.json();
        }
        return { status: 'degraded' };
    } catch {
        return { status: 'offline' };
    }
}

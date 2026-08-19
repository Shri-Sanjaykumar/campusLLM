import { apiRequest } from '../src/lib/api';

export async function askRag(question: string) {
  return apiRequest('/ask', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
}


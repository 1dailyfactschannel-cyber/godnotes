export function resolveApiBaseUrl(): string {
  const viteUrl = (() => {
    try {
      // eslint-disable-next-line no-eval
      const im: any = eval('import.meta');
      return im?.env?.VITE_API_URL;
    } catch {
      return undefined;
    }
  })();
  const envUrl = typeof process !== 'undefined' ? (process as any)?.env?.VITE_API_URL : undefined;
  return viteUrl || envUrl || 'http://localhost:5001/api';
}

export const API_BASE_URL = resolveApiBaseUrl();

export async function apiRequest(method: string, endpoint: string, body?: any) {
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Let the caller handle or authService handle it
    }
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}
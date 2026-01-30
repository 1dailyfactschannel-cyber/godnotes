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
  if (viteUrl || envUrl) return viteUrl || envUrl;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const port = typeof window !== 'undefined' ? window.location.port : '';

  // Treat localhost, loopback, and private network ranges as local dev
  const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname);
  const isPrivateNetwork = /^10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(hostname)
    || /^192\.168\.[0-9]{1,3}\.[0-9]{1,3}$/.test(hostname)
    || /^172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]{1,3}\.[0-9]{1,3}$/.test(hostname);
  const isLocalDev = isLocalHost || isPrivateNetwork;

  // In local development (Vite/Electron), always point to backend API via current origin proxy
  if (isLocalDev) {
    if (origin && origin.startsWith('http')) {
      return `${origin}/api`;
    }
    return 'http://localhost:5002/api';
  }

  if (origin && origin.startsWith('http')) {
    return `${origin}/api`;
  }
  return 'http://localhost:5002/api';
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
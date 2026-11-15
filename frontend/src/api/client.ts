import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

// Base URL of the API. Empty means "same origin": the Vite dev server proxies
// /api and /media to Django, and a production build can be served by Django or
// a reverse proxy on the same domain.
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('tg_access');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refresh = localStorage.getItem('tg_refresh');
  if (!refresh) return null;
  refreshPromise = (async () => {
    try {
      const { data } = await axios.post<{ access: string; refresh?: string }>(
        `${API_BASE_URL}/api/auth/refresh/`,
        { refresh },
      );
      localStorage.setItem('tg_access', data.access);
      if (data.refresh) localStorage.setItem('tg_refresh', data.refresh);
      return data.access;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
  if (
    error.response?.status === 401 &&
    original &&
    !original._retry &&
    !original.url?.includes('/api/auth/login/') &&
    localStorage.getItem('tg_refresh')
  ) {
    original._retry = true;
    const token = await refreshAccessToken();
    if (token && original.headers) {
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }
    localStorage.removeItem('tg_access');
    localStorage.removeItem('tg_refresh');
    window.dispatchEvent(new Event('tg:logout'));
  }
  return Promise.reject(error);
});

export function extractErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data.detail === 'string') return data.detail;
      const firstKey = Object.keys(data)[0];
      if (firstKey) {
        const value = data[firstKey];
        if (Array.isArray(value) && typeof value[0] === 'string') {
          return `${firstKey}: ${value[0]}`;
        }
        if (typeof value === 'string') return value;
      }
    }
    if (err.code === 'ERR_NETWORK') {
      return 'Cannot reach the TruthGuard backend. Make sure the Django server is running.';
    }
    return err.message;
  }
  return 'An unexpected error occurred.';
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
}

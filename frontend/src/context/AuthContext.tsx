import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type AuthTokens } from '../api/auth';
import { extractErrorMessage } from '../api/client';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  register: (payload: {
    full_name: string;
    username: string;
    email: string;
    department?: string;
    password: string;
    password2: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (payload: {
    full_name?: string;
    department?: string;
    bio?: string;
  }) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function storeTokens(tokens: AuthTokens) {
  localStorage.setItem('tg_access', tokens.access);
  localStorage.setItem('tg_refresh', tokens.refresh);
}

function clearTokens() {
  localStorage.removeItem('tg_access');
  localStorage.removeItem('tg_refresh');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const token = localStorage.getItem('tg_access');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await authApi.profile();
      setUser(profile);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const onForcedLogout = () => {
      clearTokens();
      setUser(null);
    };
    window.addEventListener('tg:logout', onForcedLogout);
    return () => window.removeEventListener('tg:logout', onForcedLogout);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const tokens = await authApi.login(identifier, password);
    storeTokens(tokens);
    setUser(tokens.user);
    return tokens.user;
  }, []);

  const register = useCallback(
    async (payload: Parameters<AuthContextValue['register']>[0]) => {
      const tokens = await authApi.register(payload);
      storeTokens(tokens);
      setUser(tokens.user);
      return tokens.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('tg_refresh');
    try {
      if (refresh) await authApi.logout(refresh);
    } catch (error) {
      // Blacklist failure should not block local logout.
      console.warn('Logout request failed:', extractErrorMessage(error));
    }
    clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await authApi.profile();
      setUser(profile);
    } catch {
      // keep current state
    }
  }, []);

  const updateProfile = useCallback(async (payload: Parameters<AuthContextValue['updateProfile']>[0]) => {
    const updated = await authApi.updateProfile(payload);
    setUser(updated);
    return updated;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
    }),
    [user, loading, login, register, logout, refreshUser, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

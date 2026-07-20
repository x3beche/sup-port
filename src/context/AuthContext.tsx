import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api';
import { clearCache, readJson, remove, writeJson } from '../lib/storage';
import type { AuthResponse, User } from '../types';

const SESSION_KEY = 'session';

type Session = { token: string; user: User };

type AuthState = {
  user: User | null;
  token: string | null;
  /** True until the stored session has been read from disk. */
  initialising: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await readJson<Session>(SESSION_KEY);
      if (!active) return;

      if (stored?.token) {
        // Show the stored session immediately, then confirm it is still valid.
        setSession(stored);
        setInitialising(false);
        try {
          const user = await apiRequest<User>('/api/auth/me', { token: stored.token });
          if (active) {
            const next = { token: stored.token, user };
            setSession(next);
            await writeJson(SESSION_KEY, next);
          }
        } catch (err) {
          // Only a rejected token logs the user out; a network blip must not.
          if (active && (err as { status?: number })?.status === 401) {
            await remove(SESSION_KEY);
            await clearCache();
            setSession(null);
          }
        }
        return;
      }

      setInitialising(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback(async (auth: AuthResponse) => {
    const next = { token: auth.access_token, user: auth.user };
    // Wipe any previous account's cached data before the new session renders.
    await clearCache();
    await writeJson(SESSION_KEY, next);
    setSession(next);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const auth = await apiRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      await persist(auth);
    },
    [persist],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const auth = await apiRequest<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), password },
      });
      await persist(auth);
    },
    [persist],
  );

  const logout = useCallback(async () => {
    await remove(SESSION_KEY);
    await clearCache();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      initialising,
      login,
      register,
      logout,
    }),
    [session, initialising, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}

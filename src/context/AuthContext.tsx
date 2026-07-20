import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import { apiRequest } from '../lib/api';
import { PREFIX, clearCache, readJson, remove, writeJson } from '../lib/storage';
import type { AuthResponse, User } from '../types';

const SESSION_KEY = 'session';
// AsyncStorage maps to localStorage on web, so cross-tab events carry this key.
const STORAGE_SESSION_KEY = `${PREFIX}${SESSION_KEY}`;

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

  /*
   * Bumped every time the session changes hands. A request that started before a
   * sign-out would otherwise resolve afterwards and resurrect the session — which
   * is exactly how a signed-out tab kept working and wrote the previous user's
   * data back to storage.
   */
  const epoch = useRef(0);

  const endSession = useCallback(() => {
    epoch.current += 1;
    setSession(null);
  }, []);

  useEffect(() => {
    let active = true;
    const startedAt = epoch.current;
    const current = () => active && epoch.current === startedAt;

    (async () => {
      const stored = await readJson<Session>(SESSION_KEY);
      if (!current()) return;

      if (!stored?.token) {
        setInitialising(false);
        return;
      }

      // Show the stored session immediately, then confirm it is still valid.
      setSession(stored);
      setInitialising(false);

      try {
        const user = await apiRequest<User>('/api/auth/me', { token: stored.token });
        if (!current()) return;
        const next = { token: stored.token, user };
        setSession(next);
        await writeJson(SESSION_KEY, next);
      } catch (err) {
        if (!current()) return;
        // Only a rejected token signs the user out; a network blip must not.
        if ((err as { status?: number })?.status === 401) {
          await remove(SESSION_KEY);
          await clearCache();
          endSession();
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [endSession]);

  // Signing out in one tab left the others fully authorised, still showing the
  // previous user's name and data.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_SESSION_KEY) return;
      // Null means another tab signed out; a different value means a different
      // account signed in there. Either way this tab's session is over.
      endSession();
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [endSession]);

  const persist = useCallback(async (auth: AuthResponse) => {
    const next = { token: auth.access_token, user: auth.user };
    // Wipe any previous account's cached data before the new session renders.
    await clearCache();
    await writeJson(SESSION_KEY, next);
    epoch.current += 1;
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
    const token = session?.token;

    // Clear locally first: the user asked to be signed out, and a failed network
    // call must never leave them signed in on this device.
    await remove(SESSION_KEY);
    await clearCache();
    endSession();

    if (token) {
      // Revoking server-side is what stops a copied token outliving logout.
      try {
        await apiRequest<void>('/api/auth/logout', { method: 'POST', token });
      } catch {
        // Offline sign-out still ends the session on this device.
      }
    }
  }, [endSession, session]);

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

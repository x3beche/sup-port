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
import { clearAuthBridge, configureAuthBridge } from '../lib/authBridge';
import { deleteSecret, getSecret, setSecret } from '../lib/secureStore';
import { PREFIX, clearCache, readJson, remove, writeJson } from '../lib/storage';
import type { AuthResponse, User } from '../types';

// Non-sensitive profile lives in AsyncStorage (drives instant cold-launch and,
// on web, the cross-tab logout event). The tokens live in secure storage.
const SESSION_KEY = 'session';
const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
// AsyncStorage maps to localStorage on web, so cross-tab events carry this key.
const STORAGE_SESSION_KEY = `${PREFIX}${SESSION_KEY}`;
// Web Locks name that serialises token refresh across browser tabs.
const REFRESH_LOCK = 'support:token-refresh';

type Session = { token: string; refreshToken: string; user: User };

type WebLockManager = { request: <T>(name: string, cb: () => Promise<T>) => Promise<T> };

/** The Web Locks API when available (modern browsers). Null on native/older web. */
function webLocks(): WebLockManager | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  const locks = (navigator as unknown as { locks?: WebLockManager }).locks;
  return locks ?? null;
}

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

async function loadStoredSession(): Promise<Session | null> {
  const [token, refreshToken, user] = await Promise.all([
    getSecret(ACCESS_KEY),
    getSecret(REFRESH_KEY),
    readJson<User>(SESSION_KEY),
  ]);
  // All three are required. A pre-refresh-token session (older app version) is
  // missing the secure-store tokens, so it resolves to null and asks for one
  // clean re-login — after which everything is stored the new way.
  if (!token || !refreshToken || !user) return null;
  return { token, refreshToken, user };
}

async function persistSession(session: Session): Promise<void> {
  await Promise.all([
    setSecret(ACCESS_KEY, session.token),
    setSecret(REFRESH_KEY, session.refreshToken),
    writeJson(SESSION_KEY, session.user),
  ]);
}

async function clearStoredSession(): Promise<void> {
  await Promise.all([
    deleteSecret(ACCESS_KEY),
    deleteSecret(REFRESH_KEY),
    remove(SESSION_KEY),
  ]);
}

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
  // The auth bridge callbacks are registered once but need the latest session,
  // so they read it from a ref rather than a captured value.
  const sessionRef = useRef<Session | null>(null);

  const applySession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const endSession = useCallback(() => {
    epoch.current += 1;
    applySession(null);
  }, [applySession]);

  const invalidate = useCallback(() => {
    // Refresh failed / token rejected: wipe everything and drop to the login screen.
    epoch.current += 1;
    void clearStoredSession();
    void clearCache();
    applySession(null);
  }, [applySession]);

  // Exchanges the refresh token for a fresh access+refresh pair. Returns the new
  // access token so api.ts can retry the request that hit 401, or null when the
  // session can no longer be renewed.
  const doRefresh = useCallback(async (): Promise<string | null> => {
    const startedWith = sessionRef.current?.refreshToken;
    if (!startedWith) return null;

    const run = async (): Promise<string | null> => {
      // Another tab may have rotated the token while we waited for the lock.
      // Refresh tokens are single-use: spending ours again after a sibling tab
      // already rotated it would look like theft and revoke the whole chain.
      const [latestRefresh, latestAccess] = await Promise.all([
        getSecret(REFRESH_KEY),
        getSecret(ACCESS_KEY),
      ]);
      if (latestRefresh && latestAccess && latestRefresh !== startedWith) {
        const user = (await readJson<User>(SESSION_KEY)) ?? sessionRef.current?.user;
        if (user) {
          // Adopt the session the other tab already refreshed.
          applySession({ token: latestAccess, refreshToken: latestRefresh, user });
          return latestAccess;
        }
      }
      try {
        const auth = await apiRequest<AuthResponse>('/api/auth/refresh', {
          method: 'POST',
          body: { refresh_token: latestRefresh ?? startedWith },
        });
        const next: Session = {
          token: auth.access_token,
          refreshToken: auth.refresh_token,
          user: auth.user,
        };
        await persistSession(next);
        applySession(next);
        return auth.access_token;
      } catch {
        return null;
      }
    };

    // On web, serialise refresh across tabs so two tabs never spend the same
    // refresh token at once. Native has no tabs; authBridge's in-process
    // single-flight already covers it, so run directly.
    const locks = webLocks();
    return locks ? locks.request(REFRESH_LOCK, run) : run();
  }, [applySession]);

  // Register the bridge before the boot effect below runs its /me check, so an
  // expired stored token is refreshed instead of signing the user out on launch.
  useEffect(() => {
    configureAuthBridge({ refresh: doRefresh, onInvalid: invalidate });
    return () => clearAuthBridge();
  }, [doRefresh, invalidate]);

  useEffect(() => {
    let active = true;
    const startedAt = epoch.current;
    const current = () => active && epoch.current === startedAt;

    (async () => {
      const stored = await loadStoredSession();
      if (!current()) return;

      if (!stored) {
        setInitialising(false);
        return;
      }

      // Show the stored session immediately, then confirm it is still valid.
      applySession(stored);
      setInitialising(false);

      try {
        // A 401 here is auto-refreshed by api.ts (bridge above); if that succeeds
        // sessionRef already holds the rotated tokens, so merge the user onto it.
        const user = await apiRequest<User>('/api/auth/me', { token: stored.token });
        if (!current()) return;
        const base = sessionRef.current ?? stored;
        const next: Session = { token: base.token, refreshToken: base.refreshToken, user };
        applySession(next);
        await persistSession(next);
      } catch (err) {
        if (!current()) return;
        // Only a rejected token signs the user out; a network blip must not.
        if ((err as { status?: number })?.status === 401) {
          invalidate();
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [applySession, invalidate]);

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

  const persist = useCallback(
    async (auth: AuthResponse) => {
      const next: Session = {
        token: auth.access_token,
        refreshToken: auth.refresh_token,
        user: auth.user,
      };
      // Wipe any previous account's cached data before the new session renders.
      await clearCache();
      await persistSession(next);
      epoch.current += 1;
      applySession(next);
    },
    [applySession],
  );

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
    const current = sessionRef.current;

    // Clear locally first: the user asked to be signed out, and a failed network
    // call must never leave them signed in on this device.
    await clearStoredSession();
    await clearCache();
    endSession();

    if (current?.token) {
      // Revoking server-side is what stops a copied token outliving logout. The
      // refresh token is sent too so this device's refresh chain is dropped,
      // without touching the user's sessions on other devices.
      try {
        await apiRequest<void>('/api/auth/logout', {
          method: 'POST',
          token: current.token,
          body: current.refreshToken ? { refresh_token: current.refreshToken } : undefined,
        });
      } catch {
        // Offline sign-out still ends the session on this device.
      }
    }
  }, [endSession]);

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

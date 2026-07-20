import { useCallback, useEffect, useRef, useState } from 'react';
import { readJson, writeJson } from './storage';

type State<T> = {
  data: T | null;
  /** True only while there is nothing to show yet — cached data renders instantly. */
  loading: boolean;
  /** True while a background refresh runs over already-visible data. */
  refreshing: boolean;
  error: string | null;
  fromCache: boolean;
};

/**
 * Stale-while-revalidate: paint the cached value immediately, then refresh from
 * the API and update. Keeps cold launches instant and offline usable.
 */
export function useCachedQuery<T>(
  cacheKey: string | null,
  fetcher: (signal: AbortSignal) => Promise<T>,
) {
  const [state, setState] = useState<State<T>>({
    data: null,
    loading: true,
    refreshing: false,
    error: null,
    fromCache: false,
  });

  // Keeping the fetcher in a ref lets callers pass an inline closure without
  // restarting the effect on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (signal: AbortSignal, { useCache }: { useCache: boolean }) => {
      if (!cacheKey) return;

      let hadCache = false;
      if (useCache) {
        const cached = await readJson<T>(cacheKey);
        if (cached !== null && !signal.aborted && mounted.current) {
          hadCache = true;
          setState({
            data: cached,
            loading: false,
            refreshing: true,
            error: null,
            fromCache: true,
          });
        }
      }

      if (!hadCache && mounted.current) {
        setState((prev) => ({ ...prev, refreshing: true }));
      }

      try {
        const fresh = await fetcherRef.current(signal);
        if (signal.aborted || !mounted.current) return;
        await writeJson(cacheKey, fresh);
        setState({
          data: fresh,
          loading: false,
          refreshing: false,
          error: null,
          fromCache: false,
        });
      } catch (err) {
        if (signal.aborted || !mounted.current) return;
        if ((err as Error)?.name === 'AbortError') return;
        setState((prev) => ({
          ...prev,
          // Cached data stays on screen; the error is shown as a banner instead.
          loading: false,
          refreshing: false,
          error: (err as Error)?.message ?? 'Bir şeyler ters gitti',
        }));
      }
    },
    [cacheKey],
  );

  useEffect(() => {
    if (!cacheKey) {
      setState({ data: null, loading: false, refreshing: false, error: null, fromCache: false });
      return;
    }
    const controller = new AbortController();
    void run(controller.signal, { useCache: true });
    return () => controller.abort();
  }, [cacheKey, run]);

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    await run(controller.signal, { useCache: false });
  }, [run]);

  const setData = useCallback(
    (updater: (current: T | null) => T | null) => {
      setState((prev) => {
        const next = updater(prev.data);
        if (next !== null && cacheKey) void writeJson(cacheKey, next);
        return { ...prev, data: next };
      });
    },
    [cacheKey],
  );

  return { ...state, refresh, setData };
}

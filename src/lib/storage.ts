import AsyncStorage from '@react-native-async-storage/async-storage';

export const PREFIX = 'support:';

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // A corrupt or unreadable cache entry must never block the screen.
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore quota/serialisation failures — the cache is an optimisation.
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to do; the value is already unreachable.
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX) && k !== PREFIX + 'session');
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // Best effort.
  }
}

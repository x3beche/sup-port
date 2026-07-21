import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4000;

/**
 * The S23 cannot reach "localhost" — that would be the phone itself. On device we
 * reuse the host Metro is already served from, which is the dev machine's LAN IP.
 */
function resolveBaseUrl(): string {
  // Explicit override always wins (one-off builds / CI).
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override.replace(/\/$/, '');

  // Web and Expo Go can discover the host they were served from, which keeps
  // dev and tests hitting the same machine regardless of what's configured.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;

  // A standalone APK has no host to discover, so it uses the address baked from
  // build-config.yaml (app.config.js -> extra.apiUrl).
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (configured) return configured.replace(/\/$/, '');

  if (__DEV__ === false) {
    console.warn('build-config.yaml içinde api adresi yok; bağlantı çözümlenemiyor.');
  }
  return `http://localhost:${API_PORT}`;
}

export const API_BASE = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  /**
   * Sayfa kapanırken/yenilenirken bile isteğin tamamlanmasını ister. Bekleyen
   * bir kayıt, kullanıcı yenilediği anda sessizce kaybolmasın diye.
   */
  keepalive?: boolean;
};

/*
 * Pydantic doğrulama metinleri İngilizce ve teknik: kullanıcı Türkçe bir
 * arayüzde "value is not a valid email address: An email address must have an
 * @-sign." görüyordu. Bilinen kalıplar Türkçeye çevriliyor, tanınmayanlar için
 * alana göre genel bir mesaj veriliyor.
 */
const VALIDATION_MESSAGES: Array<{ match: RegExp; text: string }> = [
  { match: /valid email address|@-sign/i, text: 'Geçerli bir e-posta adresi gir' },
  { match: /email address is too long/i, text: 'E-posta adresi çok uzun' },
  { match: /at least (\d+) character/i, text: 'Parola en az 8 karakter olmalı' },
  { match: /greater than 0|greater_than/i, text: 'Değer sıfırdan büyük olmalı' },
  { match: /less than or equal to/i, text: 'Değer izin verilen üst sınırın üstünde' },
  { match: /string_too_long|too long/i, text: 'Girdiğin metin çok uzun' },
  { match: /field required|missing/i, text: 'Zorunlu alan boş bırakılamaz' },
];

const FIELD_FALLBACKS: Record<string, string> = {
  email: 'E-posta adresi geçersiz',
  password: 'Parola geçersiz',
  name: 'İsim geçersiz',
  target: 'Hedef geçersiz',
};

function translateValidation(detail: Array<{ msg?: string; loc?: unknown[]; type?: string }>): string {
  const first = detail[0];
  const raw = `${first?.type ?? ''} ${first?.msg ?? ''}`;

  for (const { match, text } of VALIDATION_MESSAGES) {
    if (match.test(raw)) return text;
  }

  const field = Array.isArray(first?.loc) ? String(first.loc[first.loc.length - 1]) : '';
  return FIELD_FALLBACKS[field] ?? 'Girdiğin bilgiler geçersiz';
}

function messageFrom(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload) return payload;
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail;
    // The API's own messages are already Turkish and user-facing.
    if (typeof detail === 'string') return detail;
    // FastAPI validation errors arrive as a list of {loc, msg, type}.
    if (Array.isArray(detail) && detail.length) {
      return translateValidation(detail as Array<{ msg?: string; loc?: unknown[]; type?: string }>);
    }
  }
  return fallback;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, signal, keepalive } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      keepalive,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError('Sunucuya ulaşılamadı, bağlantını kontrol et', 0);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    throw new ApiError(messageFrom(payload, `İstek başarısız (${response.status})`), response.status);
  }
  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function todayIso(): string {
  // Local calendar day, not UTC — a habit logged at 01:00 belongs to that date.
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

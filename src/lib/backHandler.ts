import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Uygulama geneli "geri" yönetimi.
 *
 * Ekranlar ve açılır katmanlar (menü, sayaç, sayfalar) kendi geri davranışını
 * `useBackHandler` ile kaydeder. Geri tetiklendiğinde en son kaydedilen (en
 * içteki/en üstteki) işleyici önce çalışır (LIFO); biri `true` dönerse olay
 * tüketilir. Böylece Android donanım/gesture geri tuşu ekranlar ve mini-app'ler
 * arasında beklenildiği gibi çalışır, açık bir katman varsa önce onu kapatır.
 *
 * - **Native:** RN BackHandler'ın `hardwareBackPress` olayı beslenir.
 * - **Web:** S23 çerçevesindeki (public/s23.html) 3-tuşlu geri butonu iframe'e
 *   `postMessage({type:'sup-port-back'})` gönderir; burada dinlenir.
 */
type Handler = () => boolean;

const handlers: Handler[] = [];

function dispatch(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) return true;
  }
  return false;
}

let installed = false;
function install(): void {
  if (installed) return;
  installed = true;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('message', (event: MessageEvent) => {
      if (event?.data?.type === 'sup-port-back') dispatch();
    });
  } else {
    BackHandler.addEventListener('hardwareBackPress', dispatch);
  }
}

/**
 * Bileşen görünürken (enabled) bir geri işleyici kaydeder. İşleyici olayı
 * ele aldıysa `true`, geçmesine izin veriyorsa `false` dönmeli. `handler`
 * her render değişebilir; en güncel closure ref üzerinden okunur, kayıt sabit
 * kalır (kayıt sırası = önem sırası).
 */
export function useBackHandler(handler: Handler, enabled = true): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled) return;
    install();
    const wrapper: Handler = () => ref.current();
    handlers.push(wrapper);
    return () => {
      const index = handlers.indexOf(wrapper);
      if (index >= 0) handlers.splice(index, 1);
    };
  }, [enabled]);
}

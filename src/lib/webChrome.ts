import { Platform } from 'react-native';

/**
 * Web derlemesinde sağda tarayıcı kaydırma çubuğu görünüyor ve uygulama
 * "web sayfası" gibi duruyor. Kaydırma çalışmaya devam eder, yalnızca çubuk
 * gizlenir. Sayfa seviyesindeki çubuk React Native prop'larıyla kapatılamadığı
 * için stil enjekte ediliyor.
 */
export function hideScrollbars(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('support-hide-scrollbars')) return;

  const style = document.createElement('style');
  style.id = 'support-hide-scrollbars';
  style.textContent = `
    html, body, #root, #root * {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    html::-webkit-scrollbar,
    body::-webkit-scrollbar,
    #root ::-webkit-scrollbar {
      width: 0;
      height: 0;
      display: none;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Samsung Health'in koyu temasından esinlenen tasarım belirteçleri: saf siyah
 * zemin, hafif açık gri kartlar, yüksek kontrastlı metin ve modül başına canlı
 * kategori rengi.
 *
 * Renkler WCAG'e göre seçildi: metin kart üstünde >= 4.5:1, grafik/ikon >= 3:1.
 * Doğrulama testi: tests/contrast.spec.ts
 */
export const theme = {
  color: {
    bg: '#000000',
    card: '#19191B',
    cardRaised: '#242427',
    text: '#FFFFFF',
    textMuted: '#A1A1A6',
    textFaint: '#8A8A8F',
    accent: '#00C2F0',
    accentSoft: '#0E2A33',
    border: '#2C2C2E',
    track: '#2C2C2E',
    success: '#3DD68C',
    danger: '#FF6B81',
    errorBg: '#2A1319',
    warnBg: '#2A2113',
    warnText: '#E9B949',
    successBg: '#12271E',
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    pill: 999,
  },
  space: (n: number) => n * 4,
  font: {
    hero: 46,
    display: 34,
    title: 20,
    heading: 17,
    body: 15,
    label: 13,
    caption: 12,
    tiny: 11,
  },
  motion: {
    // Short enough to feel instant, long enough to read as motion rather than a
    // jump. Anything past ~300ms starts feeling sluggish on a habit tracker.
    fast: 160,
    normal: 240,
    slow: 420,
    /** easeOutQuint — decelerates hard, the "expensive" feel. */
    ease: [0.22, 1, 0.36, 1] as const,
    /** Distance a screen travels while sliding in. */
    slide: 28,
    /** Delay between consecutive grid tiles in the stagger. */
    stagger: 35,
  },
} as const;

/** Rakamların sayarken titrememesi için sabit genişlikli basamaklar. */
export const tabularNums = { fontVariant: ['tabular-nums' as const] };

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const ON_DARK = '#FFFFFF';
const ON_LIGHT = '#0A0A0B';

/**
 * Renkli bir zemin üstünde okunacak metin/ikon rengi. Sabit bir "onAccent"
 * değeri modül renkleri arasında dolaşınca kontrastı tutturamıyordu. Parlaklık
 * eşiği de yetmiyor: orta tonlarda (Uyku, Meditasyon) eşiğin doğru tarafı bile
 * 4.5:1'i geçmiyordu. Bu yüzden iki adaydan kontrastı yüksek olan seçiliyor.
 */
export function onColor(background: string): string {
  return contrastRatio(ON_LIGHT, background) >= contrastRatio(ON_DARK, background)
    ? ON_LIGHT
    : ON_DARK;
}

/**
 * Samsung Health'in koyu temasından esinlenen tasarım belirteçleri: neredeyse
 * siyah zemin, hafif yükseltilmiş koyu gri kartlar, yüksek kontrastlı metin ve
 * modül başına canlı kategori rengi.
 */
export const theme = {
  color: {
    bg: '#000000',
    card: '#19191B',
    cardRaised: '#242427',
    text: '#FFFFFF',
    textMuted: '#A1A1A6',
    textFaint: '#6E6E73',
    accent: '#00C2F0',
    accentSoft: '#0E2A33',
    border: '#2C2C2E',
    track: '#2C2C2E',
    success: '#3DD68C',
    danger: '#FF6B81',
    inputBg: '#12151A',
    errorBg: '#2A1319',
    warnBg: '#2A2113',
    warnText: '#E9B949',
    successBg: '#12271E',
    onAccent: '#04141A',
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    pill: 999,
  },
  space: (n: number) => n * 4,
  shadow: {
    // Shadows read as almost nothing on a dark canvas, so depth comes from the
    // card being lighter than the background rather than from a drop shadow.
    card: {
      shadowColor: '#000000',
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  },
  font: {
    display: 34,
    title: 20,
    body: 15,
    label: 13,
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

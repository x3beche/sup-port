import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Galaxy Health tarzı çizgi ikonlar. Emoji yerine vektör kullanılıyor: emoji
 * platforma göre farklı çiziliyor ve renk alamıyor, bunlar modülün rengini alır.
 */
export type IconName =
  | 'droplet'
  | 'meal'
  | 'brush'
  | 'language'
  | 'steps'
  | 'moon'
  | 'book'
  | 'lotus'
  | 'flame'
  | 'chart'
  | 'chevron-left'
  | 'check'
  | 'plus';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color = '#FFFFFF', strokeWidth = 1.7 }: Props) {
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderPaths(name, stroke, color)}
    </Svg>
  );
}

function renderPaths(name: IconName, stroke: object, color: string) {
  switch (name) {
    case 'droplet':
      return (
        <>
          <Path d="M12 3.2c0 0-6.2 6.6-6.2 10.6a6.2 6.2 0 0 0 12.4 0C18.2 9.8 12 3.2 12 3.2z" {...stroke} />
          <Path d="M9.2 14.4a2.8 2.8 0 0 0 2.8 2.8" {...stroke} strokeWidth={1.3} />
        </>
      );

    case 'meal':
      return (
        <>
          <Path d="M6.5 3v7.2a2.2 2.2 0 0 0 4.4 0V3" {...stroke} />
          <Path d="M8.7 10.4V21" {...stroke} />
          <Path d="M6.5 3v4.4M10.9 3v4.4" {...stroke} strokeWidth={1.3} />
          <Path d="M17 3c-1.6 1.1-2.4 3-2.4 5.4 0 1.9.8 3.1 2.4 3.4V21" {...stroke} />
        </>
      );

    case 'brush':
      return (
        <>
          <Path d="M9.6 12.6h4.8v6.2a2.4 2.4 0 0 1-2.4 2.4 2.4 2.4 0 0 1-2.4-2.4z" {...stroke} />
          <Path d="M10.6 12.6V8.4a1.4 1.4 0 0 1 2.8 0v4.2" {...stroke} />
          <Path d="M9.4 6.2h5.2M9.9 3.8h4.2" {...stroke} strokeWidth={1.4} />
        </>
      );

    case 'language':
      return (
        <>
          <Path d="M3.4 6.4h8.2M7.5 4.6v1.8" {...stroke} />
          <Path d="M9.6 6.4c0 3.4-2.4 6.4-6.2 7.6" {...stroke} />
          <Path d="M5.4 9.6c1 1.9 2.6 3.3 4.8 4.1" {...stroke} />
          <Path d="M12.6 20.2l4-9.6 4 9.6" {...stroke} />
          <Path d="M14.1 16.8h5" {...stroke} />
        </>
      );

    case 'steps':
      // Two footprints: a heel oval plus a toe cap, legible down to ~20px.
      return (
        <>
          <Path d="M7.2 9.6c1.7 0 2.8 1.3 2.8 3.1 0 2-1 4.9-2.8 4.9s-2.8-2.9-2.8-4.9c0-1.8 1.1-3.1 2.8-3.1z" {...stroke} />
          <Path d="M5.1 7.4c0-1.2.9-2.2 2.1-2.2s2.1 1 2.1 2.2c0 .8-.9 1.2-2.1 1.2s-2.1-.4-2.1-1.2z" {...stroke} strokeWidth={1.3} />
          <Path d="M16.8 12.2c1.7 0 2.8 1.3 2.8 3.1 0 2-1 4.9-2.8 4.9s-2.8-2.9-2.8-4.9c0-1.8 1.1-3.1 2.8-3.1z" {...stroke} />
          <Path d="M14.7 10c0-1.2.9-2.2 2.1-2.2s2.1 1 2.1 2.2c0 .8-.9 1.2-2.1 1.2s-2.1-.4-2.1-1.2z" {...stroke} strokeWidth={1.3} />
        </>
      );

    case 'moon':
      return (
        <>
          <Path d="M20 14.6A8.4 8.4 0 0 1 9.4 4 8.6 8.6 0 1 0 20 14.6z" {...stroke} />
          <Path d="M15.6 5.2l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z" {...stroke} strokeWidth={1.2} />
        </>
      );

    case 'book':
      return (
        <>
          <Path d="M12 6.6C10.3 5.2 8 4.6 4.2 4.6v12.6c3.8 0 6.1.6 7.8 2 1.7-1.4 4-2 7.8-2V4.6c-3.8 0-6.1.6-7.8 2z" {...stroke} />
          <Path d="M12 6.6v14" {...stroke} />
        </>
      );

    case 'lotus':
      // Meditating figure: head, arms resting outward, crossed legs.
      return (
        <>
          <Circle cx="12" cy="5" r="2.3" {...stroke} />
          <Path d="M12 8.2c-1.9 0-3.2 1.4-3.2 3.2v2.2h6.4v-2.2c0-1.8-1.3-3.2-3.2-3.2z" {...stroke} />
          <Path d="M8.8 10.6L5 13.4c-.7.5-.6 1.5.3 1.7l3.2.7" {...stroke} strokeWidth={1.4} />
          <Path d="M15.2 10.6L19 13.4c.7.5.6 1.5-.3 1.7l-3.2.7" {...stroke} strokeWidth={1.4} />
          <Path d="M12 13.6c-3 0-5.4 1.6-5.4 3.6 0 1.2 1 2 2.4 2h6c1.4 0 2.4-.8 2.4-2 0-2-2.4-3.6-5.4-3.6z" {...stroke} />
        </>
      );

    case 'flame':
      return (
        <Path
          d="M12 3.2s1 3.2-1.2 5.2C8.4 10.6 6.6 12.4 6.6 15A5.4 5.4 0 0 0 12 20.4 5.4 5.4 0 0 0 17.4 15c0-3.4-3-4.6-3-7.6 0 0-1.6 1-1.6 3.2 0 0-2-1.6-.8-7.4z"
          {...stroke}
        />
      );

    case 'chart':
      return (
        <>
          <Path d="M4 20h16" {...stroke} />
          <Path d="M7 20v-5.6M12 20V7.6M17 20v-8.8" {...stroke} />
        </>
      );

    case 'chevron-left':
      return <Path d="M15 5 L8 12 L15 19" {...stroke} />;

    case 'check':
      return <Path d="M5 12.5 L10 17.5 L19 7" {...stroke} />;

    case 'plus':
      return <Path d="M12 5 V19 M5 12 H19" {...stroke} />;

    default:
      return <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={1.7} fill="none" />;
  }
}

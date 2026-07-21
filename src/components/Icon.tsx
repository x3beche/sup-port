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
  | 'dumbbell'
  | 'moon'
  | 'book'
  | 'lotus'
  | 'flame'
  | 'chart'
  | 'chevron-left'
  | 'check'
  | 'plus'
  | 'menu'
  | 'store'
  | 'logout'
  | 'download'
  | 'shield'
  // Yakında (coming soon) modül ikonları
  | 'wind'
  | 'smile'
  | 'heart'
  | 'pen'
  | 'hands'
  | 'chat'
  | 'phone-off'
  | 'pill'
  | 'posture'
  | 'sun'
  | 'snowflake'
  | 'eye'
  | 'stretch'
  | 'timer'
  | 'code'
  | 'music'
  | 'abc'
  | 'wallet'
  | 'piggy'
  | 'coins'
  | 'note'
  // Okuma / kütüphane modülü
  | 'search'
  | 'barcode'
  | 'camera'
  | 'star'
  | 'star-filled'
  | 'trash'
  | 'x'
  // Profil + düzen
  | 'user'
  | 'layout';

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

    case 'dumbbell':
      // Yatay halter: iki uçta ağırlık blokları + orta bar.
      return (
        <>
          <Path d="M4 9v6M6.5 7.5v9M17.5 7.5v9M20 9v6" {...stroke} />
          <Path d="M6.5 12h11" {...stroke} />
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

    case 'menu':
      return <Path d="M4 7 H20 M4 12 H20 M4 17 H20" {...stroke} />;

    case 'store':
      // Storefront: awning + walls + doorway (marketplace).
      return (
        <>
          <Path d="M4 9.5 L5.4 5 H18.6 L20 9.5 Z" {...stroke} />
          <Path d="M5 9.5 V19.5 H19 V9.5" {...stroke} />
          <Path d="M10 19.5 V14 H14 V19.5" {...stroke} />
        </>
      );

    case 'logout':
      return (
        <>
          <Path d="M9.5 5 H6 A1 1 0 0 0 5 6 V18 A1 1 0 0 0 6 19 H9.5" {...stroke} />
          <Path d="M13 12 H20.5 M17.5 8.5 L21 12 L17.5 15.5" {...stroke} />
        </>
      );

    case 'download':
      return (
        <>
          <Path d="M12 4 V14 M8 10.5 L12 14.5 L16 10.5" {...stroke} />
          <Path d="M5 19 H19" {...stroke} />
        </>
      );

    case 'shield':
      // Güvenlik kalkanı + onay: indirme sonrası imza/bütünlük doğrulaması.
      return (
        <>
          <Path d="M12 3 L19 6 V11 C19 15.8 15.7 19.4 12 21 C8.3 19.4 5 15.8 5 11 V6 Z" {...stroke} />
          <Path d="M9 11.6 L11 13.6 L15 9.3" {...stroke} strokeWidth={1.7} />
        </>
      );

    case 'wind':
      // Rüzgâr/nefes: uçları kıvrılan yatay akış çizgileri.
      return (
        <>
          <Path d="M3 8h9a2.5 2.5 0 1 0-2.5-2.5" {...stroke} />
          <Path d="M3 12h13a2.7 2.7 0 1 1-2.7 2.7" {...stroke} />
          <Path d="M3 16h7" {...stroke} />
        </>
      );

    case 'smile':
      return (
        <>
          <Circle cx="12" cy="12" r="8.5" {...stroke} />
          <Path d="M8.5 14a4.5 4.5 0 0 0 7 0" {...stroke} />
          <Path d="M9.3 9.4v.9M14.7 9.4v.9" {...stroke} strokeWidth={1.6} />
        </>
      );

    case 'heart':
      return (
        <Path
          d="M12 20s-6.8-4.3-6.8-9.3A3.8 3.8 0 0 1 12 7.2a3.8 3.8 0 0 1 6.8 3.5C18.8 15.7 12 20 12 20z"
          {...stroke}
        />
      );

    case 'pen':
      return (
        <>
          <Path d="M5 19l1-4L16 5l3 3L9 18l-4 1z" {...stroke} />
          <Path d="M14 7l3 3" {...stroke} strokeWidth={1.4} />
        </>
      );

    case 'hands':
      // Nazik davranış: iki avuç arasında sarmalanan kalp.
      return (
        <>
          <Path
            d="M12 6c1-1.4 3.5-1.2 4.2.6.5 1.3-.2 2.6-1.3 3.5L12 13.4l-2.9-3.3c-1.1-.9-1.8-2.2-1.3-3.5C8.5 4.8 11 4.6 12 6z"
            {...stroke}
            strokeWidth={1.4}
          />
          <Path d="M4.5 15.5c2 2.4 4.6 3.7 7.5 3.7s5.5-1.3 7.5-3.7" {...stroke} />
        </>
      );

    case 'chat':
      return (
        <>
          <Path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5V15a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V6.5A1.5 1.5 0 0 1 5 5z" {...stroke} />
          <Path d="M9 10.9v.2M12 10.9v.2M15 10.9v.2" {...stroke} strokeWidth={1.8} />
        </>
      );

    case 'phone-off':
      return (
        <>
          <Path d="M8 3.5h8a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" {...stroke} />
          <Path d="M4 4l16 16" {...stroke} />
        </>
      );

    case 'pill':
      // Kapsül + ortadaki ayrım çizgisi.
      return (
        <>
          <Path d="M7 13l6-6a3.5 3.5 0 0 1 5 5l-6 6a3.5 3.5 0 0 1-5-5z" {...stroke} />
          <Path d="M10 10l4 4" {...stroke} strokeWidth={1.4} />
        </>
      );

    case 'posture':
      // Dik duran figür: baş + gövde + omuz + bacaklar.
      return (
        <>
          <Circle cx="12" cy="5" r="2" {...stroke} />
          <Path d="M12 7.2v8" {...stroke} />
          <Path d="M8.5 10.5h7" {...stroke} strokeWidth={1.4} />
          <Path d="M12 15.2l-2.5 4M12 15.2l2.5 4" {...stroke} />
        </>
      );

    case 'sun':
      return (
        <>
          <Circle cx="12" cy="12" r="4" {...stroke} />
          <Path
            d="M12 2.6v2.4M12 19v2.4M2.6 12H5M19 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"
            {...stroke}
            strokeWidth={1.4}
          />
        </>
      );

    case 'snowflake':
      return (
        <>
          <Path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" {...stroke} />
          <Path d="M12 6.4l-2-1.4M12 6.4l2-1.4M12 17.6l-2 1.4M12 17.6l2 1.4" {...stroke} strokeWidth={1.4} />
        </>
      );

    case 'eye':
      return (
        <>
          <Path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" {...stroke} />
          <Circle cx="12" cy="12" r="2.6" {...stroke} />
        </>
      );

    case 'stretch':
      // Esneyen figür: kollar yukarı açık, bacaklar ayrık.
      return (
        <>
          <Circle cx="12" cy="4.5" r="1.9" {...stroke} />
          <Path d="M12 6.4v6.1" {...stroke} />
          <Path d="M12 8.2l4-2.4M12 8.2L8 5.8" {...stroke} />
          <Path d="M12 12.5l-3.5 6M12 12.5l3.5 6" {...stroke} />
        </>
      );

    case 'timer':
      // Kronometre: üst düğme + akrep.
      return (
        <>
          <Circle cx="12" cy="13.5" r="7.3" {...stroke} />
          <Path d="M12 13.5V9.5" {...stroke} />
          <Path d="M9.5 3.6h5" {...stroke} strokeWidth={1.5} />
          <Path d="M12 3.6v2.5" {...stroke} strokeWidth={1.4} />
        </>
      );

    case 'code':
      return (
        <>
          <Path d="M8.5 8L4.5 12l4 4" {...stroke} />
          <Path d="M15.5 8l4 4-4 4" {...stroke} />
          <Path d="M13.6 6l-3 12" {...stroke} strokeWidth={1.4} />
        </>
      );

    case 'music':
      return (
        <>
          <Path d="M9 18V6l10-2v12" {...stroke} />
          <Path d="M9 9l10-2" {...stroke} strokeWidth={1.3} />
          <Circle cx="6.5" cy="18" r="2.5" {...stroke} />
          <Circle cx="16.5" cy="16" r="2.5" {...stroke} />
        </>
      );

    case 'abc':
      // Yeni kelime: "A" harfi + yeni anlamına gelen artı.
      return (
        <>
          <Path d="M4 18l4.5-11 4.5 11" {...stroke} />
          <Path d="M5.6 14.5h5.8" {...stroke} strokeWidth={1.4} />
          <Path d="M17 8.5v6M14 11.5h6" {...stroke} strokeWidth={1.5} />
        </>
      );

    case 'wallet':
      // Kapaklı cüzdan + kart yuvası.
      return (
        <>
          <Path d="M3.5 8.5h13.5A1.5 1.5 0 0 1 18.5 10v6A1.5 1.5 0 0 1 17 17.5H5A1.5 1.5 0 0 1 3.5 16z" {...stroke} />
          <Path d="M3.5 8.5V7A1.5 1.5 0 0 1 5 5.5h9" {...stroke} />
          <Path d="M15 13h3.5" {...stroke} strokeWidth={1.7} />
        </>
      );

    case 'piggy':
      // Kumbara: gövde + kulak + para yuvası + bacaklar + göz.
      return (
        <>
          <Path d="M4.5 13c0-3 3.1-5 7-5s7 2 7 5-3.1 5-7 5-7-2-7-5z" {...stroke} />
          <Path d="M10 8.3l1.6-2 1.5 2" {...stroke} strokeWidth={1.3} />
          <Path d="M11 8h2.2" {...stroke} strokeWidth={1.6} />
          <Path d="M18.4 12c1 0 1.6-.4 1.6-.4" {...stroke} strokeWidth={1.3} />
          <Path d="M7.6 17.6v1.6M15.4 17.6v1.6" {...stroke} />
          <Circle cx="8.3" cy="12.6" r="0.7" {...stroke} strokeWidth={1.2} />
        </>
      );

    case 'coins':
      // Para yığını: üç elips katmanı.
      return (
        <>
          <Path d="M5 7.5c0-1.1 2-2 4.5-2s4.5.9 4.5 2-2 2-4.5 2-4.5-.9-4.5-2z" {...stroke} />
          <Path d="M5 7.5v3c0 1.1 2 2 4.5 2s4.5-.9 4.5-2v-3" {...stroke} />
          <Path d="M14 12c.6.1 1.3.2 2 .2 2.5 0 4.5-.9 4.5-2" {...stroke} strokeWidth={1.3} />
          <Path d="M20 10.2c0-1.1-2-2-4.5-2-.9 0-1.7.1-2.4.3" {...stroke} strokeWidth={1.3} />
          <Path d="M10 14.4c.9.3 2.1.5 3.5.5 2.5 0 4.5-.9 4.5-2" {...stroke} strokeWidth={1.3} />
        </>
      );

    case 'note':
      // Kıvrık köşeli not kâğıdı + metin satırları.
      return (
        <>
          <Path d="M5.5 4.5a1 1 0 0 1 1-1H13.5L18 8V19.5a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1z" {...stroke} />
          <Path d="M13.5 3.5V7a1 1 0 0 0 1 1H18" {...stroke} strokeWidth={1.4} />
          <Path d="M8.5 11.5h6M8.5 14.5h6M8.5 17h3.5" {...stroke} strokeWidth={1.4} />
        </>
      );

    case 'search':
      return (
        <>
          <Circle cx="10.5" cy="10.5" r="6" {...stroke} />
          <Path d="M15 15l4.5 4.5" {...stroke} />
        </>
      );

    case 'barcode':
      // Barkod çubukları + tarama çerçevesi köşeleri.
      return (
        <>
          <Path d="M3.5 6.5V5.2A1.2 1.2 0 0 1 4.7 4H6.5M17.5 4h1.8A1.2 1.2 0 0 1 20.5 5.2V6.5M20.5 17.5v1.3A1.2 1.2 0 0 1 19.3 20H17.5M6.5 20H4.7A1.2 1.2 0 0 1 3.5 18.8V17.5" {...stroke} />
          <Path d="M7 8v8M10 8v8M13 8v8M16 8v8" {...stroke} strokeWidth={1.5} />
        </>
      );

    case 'camera':
      return (
        <>
          <Path d="M4 8h3l1.4-2h7.2L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" {...stroke} />
          <Circle cx="12" cy="13" r="3.2" {...stroke} />
        </>
      );

    case 'star':
      return (
        <Path
          d="M12 4.2l2.2 4.7 5.1.6-3.8 3.5 1 5-4.5-2.5-4.5 2.5 1-5L6.7 9.5l5.1-.6z"
          {...stroke}
        />
      );

    case 'star-filled':
      return (
        <Path
          d="M12 4.2l2.2 4.7 5.1.6-3.8 3.5 1 5-4.5-2.5-4.5 2.5 1-5L6.7 9.5l5.1-.6z"
          stroke={color}
          strokeWidth={1.2}
          strokeLinejoin="round"
          fill={color}
        />
      );

    case 'trash':
      return (
        <>
          <Path d="M5 6.5h14M9.5 6.5V5A1 1 0 0 1 10.5 4h3A1 1 0 0 1 14.5 5v1.5" {...stroke} />
          <Path d="M6.5 6.5l.8 12A1.2 1.2 0 0 0 8.5 19.7h7A1.2 1.2 0 0 0 16.7 18.5l.8-12" {...stroke} />
          <Path d="M10 10v6M14 10v6" {...stroke} strokeWidth={1.4} />
        </>
      );

    case 'x':
      return <Path d="M6 6l12 12M18 6L6 18" {...stroke} />;

    case 'user':
      // Kişi: baş + omuz.
      return (
        <>
          <Circle cx="12" cy="8" r="3.6" {...stroke} />
          <Path d="M5.5 19.5c0-3.4 2.9-5.8 6.5-5.8s6.5 2.4 6.5 5.8" {...stroke} />
        </>
      );

    case 'layout':
      // Düzen: çerçeve + bölme çizgileri (kart yerleşimi).
      return (
        <>
          <Path d="M4 5.5h16A0.5 0.5 0 0 1 20.5 6v12a0.5 0.5 0 0 1-.5.5H4A0.5 0.5 0 0 1 3.5 18V6A0.5 0.5 0 0 1 4 5.5z" {...stroke} />
          <Path d="M3.5 10h17M9 10v8.5" {...stroke} strokeWidth={1.4} />
        </>
      );

    default:
      return <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth={1.7} fill="none" />;
  }
}

import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../Icon';

/**
 * Kitap kapağı. Kaynak DAİMA covers.openlibrary.org URL'idir (gösterim izinli);
 * görselin bit'leri asla kopyalanmaz/saklanmaz — yalnızca uzak <Image> src.
 * Kapak yoksa (?default=false → 404) ya da yükleme hatasında, kitabın baş
 * harfini taşıyan nazik bir placeholder çizilir.
 */
export function BookCover({
  url,
  title,
  color,
  width = 56,
  radius = theme.radius.sm,
}: {
  url?: string | null;
  title: string;
  color: string;
  width?: number;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);
  const height = Math.round(width * 1.5);
  const letter = (title.trim()[0] ?? '?').toUpperCase();

  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        onError={() => setFailed(true)}
        style={[styles.cover, { width, height, borderRadius: radius }]}
        resizeMode="cover"
        accessibilityLabel={`${title} kapağı`}
      />
    );
  }

  return (
    <View
      style={[styles.placeholder, { width, height, borderRadius: radius, backgroundColor: `${color}22` }]}
      accessibilityLabel={`${title} — kapak yok`}
    >
      <Icon name="book" size={Math.round(width * 0.4)} color={`${color}CC`} />
      <Text style={[styles.letter, { color, fontSize: Math.max(12, width * 0.3) }]} numberOfLines={1}>
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: theme.color.cardRaised },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.color.border,
    gap: 2,
  },
  letter: { fontWeight: '800' },
});

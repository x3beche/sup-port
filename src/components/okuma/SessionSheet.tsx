import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiRequest, todayIso } from '../../lib/api';
import { useBackHandler } from '../../lib/backHandler';
import { onColor, theme } from '../../theme';
import type { LibraryBook } from '../../types';
import { Icon } from '../Icon';

const QUICK_MIN = [10, 20, 30, 45];

/**
 * Okuma oturumu kaydı. Araştırma §5: süre VEYA sayfa aralığı — en az biri
 * zorunlu. Süre günlük puana (dk), sayfa yıllık hedefe/istatistiğe akar.
 * "Şu an okuduğum" kitaplar hızlı seçim için listelenir (opsiyonel).
 */
export function SessionSheet({
  color,
  token,
  readingBooks,
  onClose,
  onSaved,
}: {
  color: string;
  token: string | null;
  readingBooks: LibraryBook[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [bookKey, setBookKey] = useState<string | null>(readingBooks[0]?.book_key ?? null);
  const [minutes, setMinutes] = useState<string>('');
  const [pagesFrom, setPagesFrom] = useState('');
  const [pagesTo, setPagesTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackHandler(() => {
    onClose();
    return true;
  });

  const min = parseInt(minutes, 10);
  const pf = parseInt(pagesFrom, 10);
  const pt = parseInt(pagesTo, 10);
  const hasMinutes = Number.isFinite(min) && min > 0;
  const hasPages = Number.isFinite(pf) && Number.isFinite(pt) && pt >= pf;
  const canSave = hasMinutes || hasPages;

  const save = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/okuma/sessions?date=${todayIso()}`, {
        method: 'POST',
        token,
        body: {
          book_key: bookKey,
          duration_min: hasMinutes ? min : null,
          pages_from: hasPages ? pf : null,
          pages_to: hasPages ? pt : null,
        },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error)?.message ?? 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }, [bookKey, canSave, hasMinutes, hasPages, min, onClose, onSaved, pf, pt, saving, token]);

  return (
    <View style={styles.overlay} testID="session-sheet">
      <View style={styles.header}>
        <Text style={styles.title}>Okuma kaydet</Text>
        <Pressable onPress={onClose} testID="session-close" accessibilityRole="button" style={styles.close}>
          <Text style={styles.closeText}>Kapat</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {readingBooks.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Kitap (opsiyonel)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bookChips}>
              <BookChip label="Genel" active={bookKey === null} color={color} onPress={() => setBookKey(null)} />
              {readingBooks.map((b) => (
                <BookChip key={b.book_key} label={b.title} active={bookKey === b.book_key} color={color} onPress={() => setBookKey(b.book_key)} />
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Süre (dakika)</Text>
        <View style={styles.quickRow}>
          {QUICK_MIN.map((m) => {
            const active = min === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMinutes(String(m))}
                accessibilityRole="button"
                style={[styles.quickChip, active ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border }]}
              >
                <Text style={[styles.quickChipText, active && { color: onColor(color) }]}>{m} dk</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={minutes}
          onChangeText={setMinutes}
          placeholder="Örn. 25"
          placeholderTextColor={theme.color.textFaint}
          keyboardType="numeric"
          style={styles.input}
          testID="session-minutes"
        />

        <Text style={styles.sectionLabel}>Sayfa aralığı (opsiyonel)</Text>
        <View style={styles.pagesRow}>
          <TextInput
            value={pagesFrom}
            onChangeText={setPagesFrom}
            placeholder="Baş."
            placeholderTextColor={theme.color.textFaint}
            keyboardType="numeric"
            style={[styles.input, styles.pageInput]}
            testID="session-pages-from"
          />
          <Text style={styles.pageDash}>—</Text>
          <TextInput
            value={pagesTo}
            onChangeText={setPagesTo}
            placeholder="Bitiş"
            placeholderTextColor={theme.color.textFaint}
            keyboardType="numeric"
            style={[styles.input, styles.pageInput]}
            testID="session-pages-to"
          />
          {hasPages ? <Text style={styles.pageCount}>{pt - pf} sayfa</Text> : null}
        </View>

        <Text style={styles.note}>
          Süre günlük hedefine, sayfalar yıllık hedefine ve istatistiklerine işlenir. En az birini gir.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <Pressable
        onPress={save}
        disabled={!canSave || saving}
        testID="session-save"
        accessibilityRole="button"
        style={[styles.saveBar, { backgroundColor: canSave ? color : theme.color.border }]}
      >
        <Icon name="check" size={18} strokeWidth={2.4} color={canSave ? onColor(color) : theme.color.textMuted} />
        <Text style={[styles.saveText, { color: canSave ? onColor(color) : theme.color.textMuted }]}>
          {saving ? 'Kaydediliyor…' : 'Oturumu kaydet'}
        </Text>
      </Pressable>
    </View>
  );
}

function BookChip({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.bookChip, active ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border }]}
    >
      <Text style={[styles.bookChipText, active && { color: onColor(color) }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.color.bg, zIndex: 30, paddingTop: theme.space(3) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.space(5), marginBottom: theme.space(2) },
  title: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text },
  close: { minHeight: 44, justifyContent: 'center', paddingLeft: theme.space(3) },
  closeText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.accent },
  content: { paddingHorizontal: theme.space(5), paddingBottom: theme.space(10) },
  sectionLabel: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text, marginTop: theme.space(5), marginBottom: theme.space(2) },
  bookChips: { gap: theme.space(2), paddingRight: theme.space(4) },
  bookChip: { maxWidth: 180, paddingHorizontal: theme.space(3), minHeight: 36, justifyContent: 'center', borderRadius: theme.radius.pill, borderWidth: 1 },
  bookChipText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text },
  quickRow: { flexDirection: 'row', gap: theme.space(2), marginBottom: theme.space(3), flexWrap: 'wrap' },
  quickChip: { paddingHorizontal: theme.space(4), minHeight: 40, justifyContent: 'center', borderRadius: theme.radius.pill, borderWidth: 1 },
  quickChipText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text },
  input: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: theme.space(4),
    minHeight: 50,
    fontSize: theme.font.heading,
    color: theme.color.text,
    ...({ fontVariant: ['tabular-nums'] } as const),
  },
  pagesRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  pageInput: { flex: 1, textAlign: 'center' },
  pageDash: { color: theme.color.textMuted, fontSize: theme.font.body },
  pageCount: { fontSize: theme.font.caption, color: theme.color.textMuted, fontWeight: '600', minWidth: 56 },
  note: { marginTop: theme.space(4), fontSize: theme.font.caption, color: theme.color.textMuted, lineHeight: 18 },
  error: { marginTop: theme.space(3), fontSize: theme.font.label, color: theme.color.danger, fontWeight: '600' },
  saveBar: {
    position: 'absolute',
    left: theme.space(5),
    right: theme.space(5),
    bottom: theme.space(5),
    minHeight: 54,
    borderRadius: theme.radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
  },
  saveText: { fontSize: theme.font.body, fontWeight: '800' },
});

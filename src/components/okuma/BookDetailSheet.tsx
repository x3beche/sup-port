import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '../../lib/api';
import { useBackHandler } from '../../lib/backHandler';
import { onColor, theme } from '../../theme';
import type { LibraryBook, Shelf } from '../../types';
import { Icon } from '../Icon';
import { BookCover } from './BookCover';

const SHELVES: { key: Shelf; label: string }[] = [
  { key: 'reading', label: 'Okuyorum' },
  { key: 'to_read', label: 'Okuyacağım' },
  { key: 'finished', label: 'Bitirdim' },
];

export function BookDetailSheet({
  book,
  color,
  token,
  onClose,
  onChanged,
}: {
  book: LibraryBook;
  color: string;
  token: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [shelf, setShelf] = useState<Shelf>(book.shelf);
  const [rating, setRating] = useState<number>(book.rating ?? 0);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useBackHandler(() => {
    onClose();
    return true;
  });

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      try {
        await apiRequest(`/api/okuma/books/${encodeURIComponent(book.book_key)}`, {
          method: 'PATCH',
          token,
          body,
        });
        onChanged();
      } finally {
        setBusy(false);
      }
    },
    [book.book_key, onChanged, token],
  );

  const changeShelf = useCallback(
    (next: Shelf) => {
      setShelf(next);
      void patch({ shelf: next });
    },
    [patch],
  );

  const rate = useCallback(
    (value: number) => {
      setRating(value);
      void patch({ rating: value });
    },
    [patch],
  );

  const remove = useCallback(async () => {
    setBusy(true);
    try {
      await apiRequest(`/api/okuma/books/${encodeURIComponent(book.book_key)}`, { method: 'DELETE', token });
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  }, [book.book_key, onChanged, onClose, token]);

  return (
    <View style={styles.overlay} testID="book-detail">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kitap</Text>
        <Pressable onPress={onClose} testID="detail-close" accessibilityRole="button" style={styles.close}>
          <Text style={styles.closeText}>Kapat</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <BookCover url={book.cover_url} title={book.title} color={color} width={92} />
          <View style={styles.topInfo}>
            <Text style={styles.title}>{book.title}</Text>
            {book.subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{book.subtitle}</Text> : null}
            <Text style={styles.author}>{book.authors.join(', ') || 'Bilinmeyen yazar'}</Text>
            <Text style={styles.meta}>
              {[book.publisher, book.published_year, book.page_count ? `${book.page_count} sf.` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Raf</Text>
        <View style={styles.shelfRow}>
          {SHELVES.map((s) => {
            const active = shelf === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => changeShelf(s.key)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.shelfChip, active ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border }]}
              >
                <Text style={[styles.shelfChipText, active && { color: onColor(color) }]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Puanın</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => rate(n)} disabled={busy} accessibilityRole="button" accessibilityLabel={`${n} yıldız`} hitSlop={6}>
              <Icon name={n <= rating ? 'star-filled' : 'star'} size={30} color={n <= rating ? color : theme.color.textFaint} />
            </Pressable>
          ))}
        </View>

        {book.description ? (
          <>
            <Text style={styles.sectionLabel}>Açıklama</Text>
            <Text style={styles.description}>{book.description}</Text>
          </>
        ) : null}

        {book.subjects.length ? (
          <View style={styles.subjects}>
            {book.subjects.slice(0, 6).map((s) => (
              <View key={s} style={[styles.subjectChip, { backgroundColor: `${color}1F` }]}>
                <Text style={[styles.subjectText, { color }]}>{s}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {confirmDelete ? (
          <View style={styles.deleteConfirm}>
            <Text style={styles.deleteText}>Bu kitabı kütüphanenden kaldır?</Text>
            <View style={styles.deleteBtns}>
              <Pressable onPress={() => setConfirmDelete(false)} style={styles.deleteCancel} accessibilityRole="button">
                <Text style={styles.deleteCancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable onPress={remove} disabled={busy} testID="confirm-delete" style={styles.deleteYes} accessibilityRole="button">
                <Text style={styles.deleteYesText}>Kaldır</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmDelete(true)} style={styles.removeBtn} accessibilityRole="button" testID="detail-delete">
            <Icon name="trash" size={17} color={theme.color.danger} />
            <Text style={styles.removeText}>Kütüphaneden kaldır</Text>
          </Pressable>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.color.bg, zIndex: 40, paddingTop: theme.space(3) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.space(5), marginBottom: theme.space(2) },
  headerTitle: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text },
  close: { minHeight: 44, justifyContent: 'center', paddingLeft: theme.space(3) },
  closeText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.accent },
  content: { paddingHorizontal: theme.space(5), paddingBottom: theme.space(6) },
  top: { flexDirection: 'row', gap: theme.space(4), marginTop: theme.space(2) },
  topInfo: { flex: 1 },
  title: { fontSize: theme.font.heading, fontWeight: '800', color: theme.color.text, lineHeight: 23 },
  subtitle: { marginTop: 2, fontSize: theme.font.label, color: theme.color.textMuted },
  author: { marginTop: theme.space(2), fontSize: theme.font.body, color: theme.color.text, fontWeight: '600' },
  meta: { marginTop: theme.space(2), fontSize: theme.font.caption, color: theme.color.textMuted },
  sectionLabel: { fontSize: theme.font.label, fontWeight: '800', color: theme.color.text, marginTop: theme.space(6), marginBottom: theme.space(3) },
  shelfRow: { flexDirection: 'row', gap: theme.space(2), flexWrap: 'wrap' },
  shelfChip: { paddingHorizontal: theme.space(4), minHeight: 40, justifyContent: 'center', borderRadius: theme.radius.pill, borderWidth: 1 },
  shelfChipText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text },
  stars: { flexDirection: 'row', gap: theme.space(2) },
  description: { fontSize: theme.font.label, color: theme.color.textMuted, lineHeight: 21 },
  subjects: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2), marginTop: theme.space(4) },
  subjectChip: { paddingHorizontal: theme.space(3), paddingVertical: theme.space(1), borderRadius: theme.radius.pill },
  subjectText: { fontSize: theme.font.caption, fontWeight: '700' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space(2), marginTop: theme.space(8), minHeight: 48 },
  removeText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.danger },
  deleteConfirm: { marginTop: theme.space(8), backgroundColor: theme.color.errorBg, borderRadius: theme.radius.md, padding: theme.space(4) },
  deleteText: { fontSize: theme.font.label, color: theme.color.text, fontWeight: '600', textAlign: 'center' },
  deleteBtns: { flexDirection: 'row', gap: theme.space(3), marginTop: theme.space(3) },
  deleteCancel: { flex: 1, minHeight: 44, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.cardRaised },
  deleteCancelText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text },
  deleteYes: { flex: 1, minHeight: 44, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.danger },
  deleteYesText: { fontSize: theme.font.label, fontWeight: '800', color: '#FFFFFF' },
});

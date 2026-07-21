import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, apiRequest } from '../../lib/api';
import { useBackHandler } from '../../lib/backHandler';
import { onColor, theme } from '../../theme';
import type { BookCandidate, SearchResponse, Shelf } from '../../types';
import { Icon } from '../Icon';
import { BarcodeScanner } from './BarcodeScanner';
import { BookCover } from './BookCover';

const SHELVES: { key: Shelf; label: string }[] = [
  { key: 'reading', label: 'Okuyorum' },
  { key: 'to_read', label: 'Okuyacağım' },
  { key: 'finished', label: 'Bitirdim' },
];

function isIsbnQuery(q: string): boolean {
  const digits = q.replace(/[^0-9Xx]/g, '');
  return digits.length === 13 || digits.length === 10;
}

export function BookSearchSheet({
  color,
  token,
  onClose,
  onAdded,
}: {
  color: string;
  token: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetShelf, setTargetShelf] = useState<Shelf>('to_read');
  const [scanning, setScanning] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  // Elle giriş
  const [manualOpen, setManualOpen] = useState(false);
  const [mTitle, setMTitle] = useState('');
  const [mAuthor, setMAuthor] = useState('');
  const [mIsbn, setMIsbn] = useState('');
  const [mPages, setMPages] = useState('');
  const [manualSaving, setManualSaving] = useState(false);

  const reqId = useRef(0);

  useBackHandler(() => {
    if (scanning) {
      setScanning(false);
      return true;
    }
    onClose();
    return true;
  });

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q) return;
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      setResults(null);
      try {
        if (isIsbnQuery(q)) {
          // Tam ISBN: kapaklı tek kayıt için özel lookup; bulunamazsa elle girişe düş.
          try {
            const book = await apiRequest<BookCandidate>(
              `/api/okuma/lookup?isbn=${encodeURIComponent(q)}`,
              { token },
            );
            if (id === reqId.current) setResults([book]);
            return;
          } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
              if (id === reqId.current) {
                setResults([]);
                setMIsbn(q.replace(/[^0-9Xx]/g, ''));
                setManualOpen(true);
                setError('Bu ISBN bulunamadı — kitabı elle ekleyebilirsin.');
              }
              return;
            }
            throw err;
          }
        }
        const res = await apiRequest<SearchResponse>(
          `/api/okuma/search?q=${encodeURIComponent(q)}&limit=15`,
          { token },
        );
        if (id === reqId.current) setResults(res.results);
      } catch (err) {
        if (id === reqId.current) setError((err as Error)?.message ?? 'Arama başarısız');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [token],
  );

  const onScanned = useCallback(
    (isbn: string) => {
      setScanning(false);
      setQuery(isbn);
      void runSearch(isbn);
    },
    [runSearch],
  );

  const addCandidate = useCallback(
    async (book: BookCandidate) => {
      const localKey = book.key ?? `${book.title}-${book.isbn13 ?? ''}`;
      if (addingKey || addedKeys.has(localKey)) return;
      setAddingKey(localKey);
      try {
        await apiRequest('/api/okuma/books', {
          method: 'POST',
          token,
          body: {
            isbn13: book.isbn13,
            isbn10: book.isbn10,
            title: book.title,
            subtitle: book.subtitle,
            authors: book.authors,
            cover_url: book.cover_url,
            cover_source: book.cover_source,
            page_count: book.page_count,
            published_year: book.published_year,
            publisher: book.publisher,
            subjects: book.subjects,
            language: book.language,
            source: book.source,
            shelf: targetShelf,
          },
        });
        setAddedKeys((prev) => new Set(prev).add(localKey));
        onAdded();
      } catch (err) {
        setError((err as Error)?.message ?? 'Eklenemedi');
      } finally {
        setAddingKey(null);
      }
    },
    [addingKey, addedKeys, onAdded, targetShelf, token],
  );

  const saveManual = useCallback(async () => {
    if (!mTitle.trim() || manualSaving) return;
    setManualSaving(true);
    setError(null);
    try {
      const pages = parseInt(mPages, 10);
      await apiRequest('/api/okuma/books', {
        method: 'POST',
        token,
        body: {
          title: mTitle.trim(),
          authors: mAuthor.trim() ? [mAuthor.trim()] : [],
          isbn13: mIsbn.replace(/[^0-9Xx]/g, '') || null,
          page_count: Number.isFinite(pages) && pages > 0 ? pages : null,
          source: 'manual',
          shelf: targetShelf,
        },
      });
      onAdded();
      onClose();
    } catch (err) {
      setError((err as Error)?.message ?? 'Eklenemedi');
    } finally {
      setManualSaving(false);
    }
  }, [mAuthor, mIsbn, mPages, mTitle, manualSaving, onAdded, onClose, targetShelf, token]);

  return (
    <View style={styles.overlay} testID="book-search">
      <View style={styles.header}>
        <Text style={styles.title}>Kitap ekle</Text>
        <Pressable onPress={onClose} testID="search-close" accessibilityRole="button" style={styles.close}>
          <Text style={styles.closeText}>Kapat</Text>
        </Pressable>
      </View>

      {/* Hedef raf seçimi — eklenen kitap bu rafa gider */}
      <View style={styles.shelfRow}>
        <Text style={styles.shelfLabel}>Rafa ekle:</Text>
        {SHELVES.map((s) => {
          const active = targetShelf === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setTargetShelf(s.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.shelfChip, active ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border }]}
            >
              <Text style={[styles.shelfChipText, active && { color: onColor(color) }]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Arama + barkod */}
      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Icon name="search" size={17} color={theme.color.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
            placeholder="Başlık, yazar ya da ISBN"
            placeholderTextColor={theme.color.textFaint}
            style={styles.input}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            testID="search-input"
          />
        </View>
        <Pressable
          onPress={() => setScanning(true)}
          testID="scan-open"
          accessibilityRole="button"
          accessibilityLabel="Barkod tara"
          style={[styles.scanBtn, { backgroundColor: `${color}26` }]}
        >
          <Icon name="barcode" size={22} color={color} />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={color} style={{ marginTop: theme.space(6) }} /> : null}

        {!loading && results?.length === 0 && !manualOpen ? (
          <Text style={styles.empty}>Sonuç yok. Aşağıdan elle ekleyebilirsin.</Text>
        ) : null}

        {(results ?? []).map((book, i) => {
          const localKey = book.key ?? `${book.title}-${book.isbn13 ?? ''}`;
          const added = addedKeys.has(localKey);
          return (
            <View key={`${localKey}-${i}`} style={styles.row} testID="search-result">
              <BookCover url={book.cover_url} title={book.title} color={color} width={44} />
              <View style={styles.rowMain}>
                <Text style={styles.rowTitle} numberOfLines={2}>{book.title}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {book.authors.join(', ') || 'Bilinmeyen yazar'}
                  {book.published_year ? ` · ${book.published_year}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => addCandidate(book)}
                disabled={added || addingKey === localKey}
                accessibilityRole="button"
                accessibilityLabel={`${book.title} ekle`}
                style={[styles.addBtn, added ? { backgroundColor: color, borderColor: color } : { borderColor: color }]}
              >
                {addingKey === localKey ? (
                  <ActivityIndicator size="small" color={color} />
                ) : (
                  <Icon name={added ? 'check' : 'plus'} size={18} strokeWidth={2.4} color={added ? onColor(color) : color} />
                )}
              </Pressable>
            </View>
          );
        })}

        {/* Elle giriş — hiçbir kaynak bulamazsa kullanıcı kitabını yine ekleyebilsin */}
        <Pressable onPress={() => setManualOpen((v) => !v)} style={styles.manualToggle} accessibilityRole="button">
          <Icon name="pen" size={15} color={color} />
          <Text style={[styles.manualToggleText, { color }]}>
            {manualOpen ? 'Elle girişi kapat' : 'Kitabı bulamadın mı? Elle ekle'}
          </Text>
        </Pressable>

        {manualOpen ? (
          <View style={styles.manualForm} testID="manual-form">
            <Field label="Başlık *" value={mTitle} onChangeText={setMTitle} placeholder="Kitabın adı" />
            <Field label="Yazar" value={mAuthor} onChangeText={setMAuthor} placeholder="Yazar adı" />
            <Field label="ISBN (varsa)" value={mIsbn} onChangeText={setMIsbn} placeholder="978…" keyboardType="numeric" />
            <Field label="Sayfa sayısı (varsa)" value={mPages} onChangeText={setMPages} placeholder="Örn. 320" keyboardType="numeric" />
            <Pressable
              onPress={saveManual}
              disabled={!mTitle.trim() || manualSaving}
              testID="manual-save"
              accessibilityRole="button"
              style={[styles.manualSave, { backgroundColor: mTitle.trim() ? color : theme.color.border }]}
            >
              <Text style={[styles.manualSaveText, { color: mTitle.trim() ? onColor(color) : theme.color.textMuted }]}>
                {manualSaving ? 'Ekleniyor…' : 'Kütüphaneme ekle'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>

      {scanning ? <BarcodeScanner color={color} onScanned={onScanned} onClose={() => setScanning(false)} /> : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'numeric' | 'default';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textFaint}
        style={styles.fieldInput}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={keyboardType === 'numeric' ? 'none' : 'sentences'}
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.color.bg,
    zIndex: 30,
    paddingTop: theme.space(3),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space(5),
    marginBottom: theme.space(3),
  },
  title: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text },
  close: { minHeight: 44, justifyContent: 'center', paddingLeft: theme.space(3) },
  closeText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.accent },
  shelfRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), paddingHorizontal: theme.space(5), marginBottom: theme.space(3), flexWrap: 'wrap' },
  shelfLabel: { fontSize: theme.font.caption, color: theme.color.textMuted, fontWeight: '600' },
  shelfChip: { paddingHorizontal: theme.space(3), minHeight: 32, justifyContent: 'center', borderRadius: theme.radius.pill, borderWidth: 1 },
  shelfChipText: { fontSize: theme.font.caption, fontWeight: '700', color: theme.color.text },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), paddingHorizontal: theme.space(5) },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space(3),
    minHeight: 48,
  },
  input: { flex: 1, fontSize: theme.font.body, color: theme.color.text, paddingVertical: theme.space(2) },
  scanBtn: { width: 48, height: 48, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  error: { paddingHorizontal: theme.space(5), marginTop: theme.space(3), fontSize: theme.font.label, color: theme.color.warnText, fontWeight: '600' },
  list: { flex: 1, marginTop: theme.space(3) },
  listContent: { paddingHorizontal: theme.space(5) },
  empty: { marginTop: theme.space(5), fontSize: theme.font.label, color: theme.color.textMuted, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: theme.font.body, fontWeight: '700', color: theme.color.text, lineHeight: 20 },
  rowMeta: { marginTop: 2, fontSize: theme.font.caption, color: theme.color.textMuted },
  addBtn: { width: 40, height: 40, borderRadius: theme.radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  manualToggle: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), paddingVertical: theme.space(4), justifyContent: 'center' },
  manualToggleText: { fontSize: theme.font.label, fontWeight: '700' },
  manualForm: { backgroundColor: theme.color.card, borderRadius: theme.radius.lg, padding: theme.space(4), gap: theme.space(3) },
  field: { gap: theme.space(1) },
  fieldLabel: { fontSize: theme.font.caption, color: theme.color.textMuted, fontWeight: '600' },
  fieldInput: {
    backgroundColor: theme.color.bg,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: theme.space(3),
    minHeight: 44,
    fontSize: theme.font.body,
    color: theme.color.text,
  },
  manualSave: { marginTop: theme.space(1), minHeight: 48, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  manualSaveText: { fontSize: theme.font.body, fontWeight: '800' },
});

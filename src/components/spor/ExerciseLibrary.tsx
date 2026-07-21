import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '../../lib/api';
import { useCachedQuery } from '../../lib/useCachedQuery';
import { onColor, theme } from '../../theme';
import type { Exercise, ExerciseList, WorkoutItem } from '../../types';
import { Icon } from '../Icon';

type CartEntry = { key: string; sets?: number; reps?: number; duration_sec?: number };

function defaultEntry(e: Exercise): CartEntry {
  const d = e.default || {};
  if (d.duration_sec) return { key: e.key, duration_sec: d.duration_sec };
  return { key: e.key, sets: d.sets ?? 3, reps: d.reps ?? 10 };
}

function entryLabel(e: Exercise): string {
  const d = e.default || {};
  if (d.duration_sec) return `${Math.round(d.duration_sec / 60) || 1} dk`;
  return `${d.sets ?? 3}×${d.reps ?? 10}`;
}

export function ExerciseLibrary({
  color,
  token,
  onClose,
  onLog,
}: {
  color: string;
  token: string | null;
  onClose: () => void;
  onLog: (items: CartEntry[]) => Promise<void>;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [lowImpact, setLowImpact] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [cart, setCart] = useState<Map<string, CartEntry>>(new Map());
  const [saving, setSaving] = useState(false);

  const query = useMemo(() => {
    const parts: string[] = [];
    if (category) parts.push(`category=${category}`);
    if (lowImpact) parts.push('low_impact=true');
    return parts.length ? `?${parts.join('&')}` : '';
  }, [category, lowImpact]);

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      apiRequest<ExerciseList>(`/api/spor/exercises${query}`, { token, signal }),
    [query, token],
  );
  const { data, loading } = useCachedQuery<ExerciseList>(
    token ? `spor-ex:${query}` : null,
    fetcher,
  );

  const toggleCart = useCallback((e: Exercise) => {
    setCart((prev) => {
      const next = new Map(prev);
      if (next.has(e.key)) next.delete(e.key);
      else next.set(e.key, defaultEntry(e));
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    if (cart.size === 0 || saving) return;
    setSaving(true);
    try {
      await onLog(Array.from(cart.values()));
      onClose();
    } finally {
      setSaving(false);
    }
  }, [cart, onClose, onLog, saving]);

  const categories = data?.categories ?? [];

  return (
    <View style={styles.overlay} testID="exercise-library">
      <View style={styles.header}>
        <Text style={styles.title}>Egzersiz kütüphanesi</Text>
        <Pressable onPress={onClose} testID="library-close" accessibilityRole="button" style={styles.close}>
          <Text style={styles.closeText}>Kapat</Text>
        </Pressable>
      </View>

      {/* Filtreler */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip label="Tümü" active={category === null} color={color} onPress={() => setCategory(null)} />
          {categories.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              active={category === c.key}
              color={color}
              onPress={() => setCategory(c.key)}
            />
          ))}
        </ScrollView>
        <Pressable
          onPress={() => setLowImpact((v) => !v)}
          testID="library-lowimpact"
          accessibilityRole="switch"
          accessibilityState={{ checked: lowImpact }}
          style={styles.lowRow}
        >
          <View style={[styles.checkbox, lowImpact && { backgroundColor: color, borderColor: color }]}>
            {lowImpact ? <Icon name="check" size={13} strokeWidth={3} color={onColor(color)} /> : null}
          </View>
          <Text style={styles.lowText}>Sadece düşük etkili (eklem dostu)</Text>
        </Pressable>
      </View>

      {loading && !data ? (
        <ActivityIndicator color={color} style={styles.loader} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {(data?.exercises ?? []).map((e) => {
            const inCart = cart.has(e.key);
            return (
              <View key={e.key} style={styles.row} testID={`ex-${e.key}`}>
                <Pressable style={styles.rowMain} onPress={() => setDetail(e)} accessibilityRole="button">
                  <Text style={styles.rowName}>{e.name_tr}</Text>
                  <View style={styles.rowMeta}>
                    <Text style={styles.rowMetaText}>{e.category_label}</Text>
                    <Text style={styles.rowMetaDot}>·</Text>
                    <Text style={styles.rowMetaText}>{e.difficulty_label}</Text>
                    <Text style={styles.rowMetaDot}>·</Text>
                    <Text style={styles.rowMetaText}>{entryLabel(e)}</Text>
                    {e.low_impact ? (
                      <View style={[styles.badge, { backgroundColor: `${color}26` }]}>
                        <Text style={[styles.badgeText, { color }]}>düşük etkili</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, styles.badgeWarn]}>
                        <Text style={[styles.badgeText, { color: theme.color.warnText }]}>yüksek etkili</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => toggleCart(e)}
                  testID={`ex-add-${e.key}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.name_tr} ${inCart ? 'çıkar' : 'ekle'}`}
                  style={[styles.addBtn, inCart ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border }]}
                >
                  <Icon name={inCart ? 'check' : 'plus'} size={18} strokeWidth={2.4} color={inCart ? onColor(color) : theme.color.text} />
                </Pressable>
              </View>
            );
          })}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* Sepet / kaydet çubuğu */}
      {cart.size > 0 ? (
        <Pressable
          onPress={save}
          testID="library-save"
          accessibilityRole="button"
          style={[styles.saveBar, { backgroundColor: color }]}
        >
          <Text style={[styles.saveText, { color: onColor(color) }]}>
            {saving ? 'Kaydediliyor…' : `${cart.size} egzersizi antrenman olarak kaydet`}
          </Text>
        </Pressable>
      ) : null}

      {detail ? (
        <ExerciseDetail
          exercise={detail}
          color={color}
          inCart={cart.has(detail.key)}
          onToggle={() => toggleCart(detail)}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </View>
  );
}

function ExerciseDetail({
  exercise,
  color,
  inCart,
  onToggle,
  onClose,
}: {
  exercise: Exercise;
  color: string;
  inCart: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.detailOverlay} testID="exercise-detail">
      <ScrollView style={styles.detailSheet} contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>{exercise.name_tr}</Text>
          <Pressable onPress={onClose} testID="detail-close" accessibilityRole="button" style={styles.close}>
            <Text style={styles.closeText}>Kapat</Text>
          </Pressable>
        </View>
        <Text style={styles.detailSub}>{exercise.name_en}</Text>

        <View style={styles.tagRow}>
          <Tag text={exercise.category_label} color={color} />
          <Tag text={exercise.difficulty_label} color={color} />
          <Tag text={exercise.equipment_label} color={color} />
          <Tag text={`MET ${exercise.met}`} color={color} />
        </View>
        {!exercise.low_impact ? (
          <View style={[styles.impactWarn, styles.badgeWarn]}>
            <Text style={[styles.badgeText, { color: theme.color.warnText }]}>
              Yüksek etkili — diz/ayak bileği sorununda veya fazla kiloda önerilmez.
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Nasıl yapılır</Text>
        {exercise.steps.map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={[styles.stepNum, { color }]}>{i + 1}</Text>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}

        {exercise.cautions?.length ? (
          <>
            <Text style={styles.sectionLabel}>Dikkat</Text>
            {exercise.cautions.map((c, i) => (
              <Text key={i} style={styles.caution}>• {c}</Text>
            ))}
          </>
        ) : null}

        {exercise.red_flags?.length ? (
          <View style={styles.redFlags}>
            <Text style={styles.redFlagsTitle}>Şu belirtilerde DURUN ve yardım alın:</Text>
            {exercise.red_flags.map((f, i) => (
              <Text key={i} style={styles.redFlagItem}>• {f}</Text>
            ))}
          </View>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>
      <Pressable
        onPress={onToggle}
        testID="detail-add"
        accessibilityRole="button"
        style={[styles.saveBar, inCart ? styles.saveBarOutline : { backgroundColor: color }]}
      >
        <Text style={[styles.saveText, inCart ? { color: theme.color.text } : { color: onColor(color) }]}>
          {inCart ? 'Antrenmandan çıkar' : 'Antrenmana ekle'}
        </Text>
      </Pressable>
    </View>
  );
}

function Chip({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.chip, active ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border }]}
    >
      <Text style={[styles.chipText, active && { color: onColor(color) }]}>{label}</Text>
    </Pressable>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}1F` }]}>
      <Text style={[styles.tagText, { color }]}>{text}</Text>
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
    marginBottom: theme.space(2),
  },
  title: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text, flexShrink: 1 },
  close: { minHeight: 44, justifyContent: 'center', paddingLeft: theme.space(3) },
  closeText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.accent },
  filters: { paddingHorizontal: theme.space(5), gap: theme.space(2), paddingVertical: theme.space(2) },
  chip: {
    paddingHorizontal: theme.space(3),
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text },
  lowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingHorizontal: theme.space(5),
    paddingVertical: theme.space(2),
    minHeight: 40,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lowText: { fontSize: theme.font.label, color: theme.color.textMuted, fontWeight: '600' },
  loader: { marginTop: theme.space(8) },
  list: { flex: 1 },
  listContent: { paddingHorizontal: theme.space(5), paddingTop: theme.space(2) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  rowMain: { flex: 1 },
  rowName: { fontSize: theme.font.body, fontWeight: '700', color: theme.color.text },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: theme.space(1), marginTop: 3, flexWrap: 'wrap' },
  rowMetaText: { fontSize: theme.font.caption, color: theme.color.textMuted },
  rowMetaDot: { fontSize: theme.font.caption, color: theme.color.textFaint },
  badge: { paddingHorizontal: theme.space(2), paddingVertical: 2, borderRadius: theme.radius.pill, marginLeft: theme.space(1) },
  badgeWarn: { backgroundColor: theme.color.warnBg },
  badgeText: { fontSize: 10, fontWeight: '700' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBar: {
    position: 'absolute',
    left: theme.space(5),
    right: theme.space(5),
    bottom: theme.space(5),
    minHeight: 54,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBarOutline: { backgroundColor: theme.color.cardRaised },
  saveText: { fontSize: theme.font.body, fontWeight: '800' },
  detailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.color.bg,
    zIndex: 40,
    paddingTop: theme.space(3),
  },
  detailSheet: { flex: 1 },
  detailContent: { paddingHorizontal: theme.space(5), paddingBottom: theme.space(6) },
  detailSub: { paddingHorizontal: theme.space(5), fontSize: theme.font.label, color: theme.color.textMuted, marginBottom: theme.space(3) },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2), paddingHorizontal: theme.space(5) },
  tag: { paddingHorizontal: theme.space(3), paddingVertical: theme.space(1), borderRadius: theme.radius.pill },
  tagText: { fontSize: theme.font.caption, fontWeight: '700' },
  impactWarn: { marginHorizontal: theme.space(5), marginTop: theme.space(3), padding: theme.space(3), borderRadius: theme.radius.sm },
  sectionLabel: {
    fontSize: theme.font.body,
    fontWeight: '800',
    color: theme.color.text,
    paddingHorizontal: theme.space(5),
    marginTop: theme.space(5),
    marginBottom: theme.space(2),
  },
  stepRow: { flexDirection: 'row', gap: theme.space(3), paddingHorizontal: theme.space(5), marginBottom: theme.space(2) },
  stepNum: { fontSize: theme.font.body, fontWeight: '800', width: 18 },
  stepText: { flex: 1, fontSize: theme.font.label, color: theme.color.text, lineHeight: 20 },
  caution: { paddingHorizontal: theme.space(5), fontSize: theme.font.label, color: theme.color.textMuted, marginBottom: 4, lineHeight: 19 },
  redFlags: {
    margin: theme.space(5),
    padding: theme.space(4),
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.errorBg,
  },
  redFlagsTitle: { fontSize: theme.font.label, fontWeight: '800', color: theme.color.danger, marginBottom: theme.space(2) },
  redFlagItem: { fontSize: theme.font.caption, color: theme.color.text, marginBottom: 3, lineHeight: 18 },
});

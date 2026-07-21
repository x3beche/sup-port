import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { useBackHandler } from '../lib/backHandler';
import { useCachedQuery } from '../lib/useCachedQuery';
import { onColor, tabularNums, theme } from '../theme';
import type { ProfileTimeline, UserProfile } from '../types';

const ACCENT = theme.color.accent;

const SEX = [
  { key: 'erkek', label: 'Erkek' },
  { key: 'kadin', label: 'Kadın' },
] as const;

const GOALS = [
  { key: 'ver', label: 'Kilo ver' },
  { key: 'koru', label: 'Koru' },
  { key: 'al', label: 'Kilo al' },
] as const;

function bmiColor(category: string | null): string {
  if (!category) return theme.color.textMuted;
  if (category === 'normal') return theme.color.success;
  if (category === 'zayif' || category === 'fazla_kilolu') return theme.color.warnText;
  return theme.color.danger;
}

/**
 * Genel kullanıcı profili — vücut bilgileri BİR KEZ buraya girilir; spor, yemek
 * gibi modüller aynı paylaşılan profili okur (tekrar sormaz). Ayrıca kilo/BMI
 * analizinin zaman çizelgesi burada tutulur.
 */
export function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { token } = useAuth();

  const { data: profile, refresh } = useCachedQuery<UserProfile>(
    token ? 'profile' : null,
    (signal) => apiRequest<UserProfile>('/api/profile', { token, signal }),
  );
  const { data: timeline, refresh: refreshTimeline } = useCachedQuery<ProfileTimeline>(
    token ? 'profile-timeline' : null,
    (signal) => apiRequest<ProfileTimeline>('/api/profile/timeline?days=180', { token, signal }),
  );

  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [sex, setSex] = useState<'erkek' | 'kadin' | null>(null);
  const [goal, setGoal] = useState<'ver' | 'koru' | 'al' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sunucudan gelen profili forma bir kez doldur.
  useEffect(() => {
    if (!profile) return;
    setAge(profile.age != null ? String(profile.age) : '');
    setHeight(profile.height_cm != null ? String(profile.height_cm) : '');
    setWeight(profile.weight_kg != null ? String(profile.weight_kg) : '');
    setTargetWeight(profile.target_weight_kg != null ? String(profile.target_weight_kg) : '');
    setSex(profile.sex);
    setGoal(profile.goal);
  }, [profile]);

  useBackHandler(() => {
    onBack();
    return true;
  });

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const num = (s: string) => {
        const n = parseFloat(s.replace(',', '.'));
        return Number.isFinite(n) ? n : null;
      };
      const body: Record<string, unknown> = {};
      if (num(age) != null) body.age = Math.round(num(age)!);
      if (num(height) != null) body.height_cm = num(height);
      if (num(weight) != null) body.weight_kg = num(weight);
      if (num(targetWeight) != null) body.target_weight_kg = num(targetWeight);
      if (sex) body.sex = sex;
      if (goal) body.goal = goal;
      await apiRequest('/api/profile', { method: 'PUT', token, body });
      await Promise.all([refresh(), refreshTimeline()]);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (err) {
      setError((err as Error)?.message ?? 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }, [age, goal, height, refresh, refreshTimeline, sex, targetWeight, token, weight]);

  const weightPoints = useMemo(
    () => (timeline?.points ?? []).filter((p) => p.weight_kg != null) as { date: string; weight_kg: number }[],
    [timeline],
  );
  const { min: wMin, max: wMax } = useMemo(() => {
    const ws = weightPoints.map((p) => p.weight_kg);
    return { min: Math.min(...ws), max: Math.max(...ws) };
  }, [weightPoints]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} testID="profile-screen" showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} testID="back" style={styles.back} accessibilityRole="button" accessibilityLabel="Geri">
          <Icon name="chevron-left" size={22} strokeWidth={2} color={theme.color.text} />
        </Pressable>
        <Text style={styles.topTitle}>Profilim</Text>
        <View style={styles.back} />
      </View>

      <Text style={styles.intro}>
        Vücut bilgilerini bir kez gir; spor, beslenme ve diğer modüller bunları buradan okur — her seferinde tekrar sormaz.
      </Text>

      {/* BMI özeti */}
      {profile?.bmi != null ? (
        <View style={[styles.card, styles.bmiCard]}>
          <View>
            <Text style={styles.bmiValue} testID="profile-bmi">BMI {profile.bmi}</Text>
            <Text style={[styles.bmiLabel, { color: bmiColor(profile.bmi_category) }]}>{profile.bmi_label}</Text>
          </View>
          <View style={styles.bmiRight}>
            <Text style={styles.bmiWeight}>{profile.weight_kg} kg</Text>
            {timeline?.trend_kg != null && timeline.trend_kg !== 0 ? (
              <Text style={styles.bmiTrend}>
                {timeline.trend_kg > 0 ? '+' : ''}{timeline.trend_kg} kg
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Form */}
      <View style={styles.card}>
        <View style={styles.grid2}>
          <NumField label="Yaş" value={age} onChangeText={setAge} placeholder="30" />
          <NumField label="Boy (cm)" value={height} onChangeText={setHeight} placeholder="175" />
        </View>
        <View style={styles.grid2}>
          <NumField label="Kilo (kg)" value={weight} onChangeText={setWeight} placeholder="82" />
          <NumField label="Hedef kilo (kg)" value={targetWeight} onChangeText={setTargetWeight} placeholder="75" />
        </View>

        <Text style={styles.fieldLabel}>Cinsiyet</Text>
        <View style={styles.chipRow}>
          {SEX.map((s) => (
            <Chip key={s.key} label={s.label} active={sex === s.key} onPress={() => setSex(s.key)} />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Hedef</Text>
        <View style={styles.chipRow}>
          {GOALS.map((g) => (
            <Chip key={g.key} label={g.label} active={goal === g.key} onPress={() => setGoal(g.key)} />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable onPress={save} disabled={saving} testID="profile-save" accessibilityRole="button" style={[styles.saveBtn, { backgroundColor: saved ? theme.color.success : ACCENT }]}>
          <Icon name={saved ? 'check' : 'plus'} size={18} strokeWidth={2.4} color={onColor(saved ? theme.color.success : ACCENT)} />
          <Text style={[styles.saveText, { color: onColor(saved ? theme.color.success : ACCENT) }]}>
            {saving ? 'Kaydediliyor…' : saved ? 'Kaydedildi' : 'Kaydet'}
          </Text>
        </Pressable>
      </View>

      {/* Kilo/BMI timeline */}
      <Text style={styles.sectionTitle}>Analiz zaman çizelgesi</Text>
      <View style={styles.card}>
        {weightPoints.length >= 2 ? (
          <>
            <View style={styles.chart}>
              {weightPoints.map((p) => {
                const range = wMax - wMin || 1;
                const h = 12 + ((p.weight_kg - wMin) / range) * 76;
                return (
                  <View key={p.date} style={styles.chartCol}>
                    <View style={styles.chartTrack}>
                      <View style={[styles.chartBar, { height: h, backgroundColor: ACCENT }]} />
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={styles.chartAxis}>
              <Text style={styles.axisText}>{weightPoints[0].weight_kg} kg</Text>
              <Text style={styles.axisText}>{weightPoints[weightPoints.length - 1].weight_kg} kg</Text>
            </View>
            <Text style={styles.chartNote}>
              {weightPoints.length} ölçüm · {weightPoints[0].date} → {weightPoints[weightPoints.length - 1].date}
            </Text>
          </>
        ) : (
          <Text style={styles.emptyTimeline}>
            Kilonu her girişinde buraya bir nokta düşer. Zamanla kilo ve BMI değişimini burada göreceksin.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function NumField({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (t: string) => void; placeholder: string }) {
  return (
    <View style={styles.numField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textFaint}
        keyboardType="numeric"
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active ? { backgroundColor: ACCENT, borderColor: ACCENT } : { borderColor: theme.color.border }]}
    >
      <Text style={[styles.chipText, active && { color: onColor(ACCENT) }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space(5), paddingBottom: theme.space(10) },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space(4) },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
  topTitle: { fontSize: theme.font.body + 1, fontWeight: '800', color: theme.color.text },
  intro: { fontSize: theme.font.label, color: theme.color.textMuted, lineHeight: 20, marginBottom: theme.space(4) },
  card: { backgroundColor: theme.color.card, borderRadius: theme.radius.lg, padding: theme.space(5), marginBottom: theme.space(3) },
  bmiCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bmiValue: { fontSize: theme.font.heading, fontWeight: '800', color: theme.color.text, ...tabularNums },
  bmiLabel: { marginTop: 2, fontSize: theme.font.label, fontWeight: '700' },
  bmiRight: { alignItems: 'flex-end' },
  bmiWeight: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text, ...tabularNums },
  bmiTrend: { marginTop: 2, fontSize: theme.font.caption, color: theme.color.textMuted },
  grid2: { flexDirection: 'row', gap: theme.space(3), marginBottom: theme.space(3) },
  numField: { flex: 1, gap: theme.space(1) },
  fieldLabel: { fontSize: theme.font.caption, color: theme.color.textMuted, fontWeight: '600', marginTop: theme.space(2), marginBottom: theme.space(1) },
  input: {
    backgroundColor: theme.color.bg,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: theme.space(3),
    minHeight: 48,
    fontSize: theme.font.heading,
    color: theme.color.text,
    ...tabularNums,
  },
  chipRow: { flexDirection: 'row', gap: theme.space(2), flexWrap: 'wrap', marginTop: theme.space(1) },
  chip: { paddingHorizontal: theme.space(4), minHeight: 42, justifyContent: 'center', borderRadius: theme.radius.pill, borderWidth: 1 },
  chipText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text },
  error: { marginTop: theme.space(3), fontSize: theme.font.label, color: theme.color.danger, fontWeight: '600' },
  saveBtn: { marginTop: theme.space(5), minHeight: 52, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space(2) },
  saveText: { fontSize: theme.font.body, fontWeight: '800' },
  sectionTitle: { fontSize: theme.font.body + 2, fontWeight: '800', color: theme.color.text, marginTop: theme.space(5), marginBottom: theme.space(3) },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 96, gap: 2 },
  chartCol: { flex: 1, alignItems: 'center' },
  chartTrack: { height: 90, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  chartBar: { width: '70%', maxWidth: 16, minWidth: 5, borderRadius: theme.radius.pill },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.space(2) },
  axisText: { fontSize: theme.font.tiny, color: theme.color.textMuted, fontWeight: '600' },
  chartNote: { marginTop: theme.space(2), fontSize: theme.font.tiny, color: theme.color.textFaint },
  emptyTimeline: { fontSize: theme.font.label, color: theme.color.textMuted, lineHeight: 20 },
});

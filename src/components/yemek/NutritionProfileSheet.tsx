import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../../lib/api';
import { onColor, theme } from '../../theme';
import type { NutritionProfile, YemekMeta } from '../../types';

function num(value: string): number | null {
  const n = Number(value.replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Beslenme profili — günlük kalori hedefi için (Mifflin-St Jeor). Yaş beslenmeye
 * özeldir; boy/cinsiyet/aktivite/hedef/kilo spor modülüyle PAYLAŞILIR, bu yüzden
 * spor'da doldurduysan burada hazır gelir (tekrar sorma).
 */
export function NutritionProfileSheet({
  color,
  token,
  profile,
  meta,
  onClose,
  onSaved,
}: {
  color: string;
  token: string | null;
  profile: NutritionProfile;
  meta: YemekMeta | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [age, setAge] = useState(profile.age ? String(profile.age) : '');
  const [sex, setSex] = useState<NutritionProfile['sex']>(profile.sex);
  const [height, setHeight] = useState(profile.height_cm ? String(profile.height_cm) : '');
  const [weight, setWeight] = useState(profile.weight_kg ? String(profile.weight_kg) : '');
  const [activity, setActivity] = useState<string | null>(profile.activity_level);
  const [goal, setGoal] = useState<NutritionProfile['goal']>(profile.goal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activityOptions =
    meta?.activity_levels.map((a) => ({ k: a.key, l: a.label })) ?? [];

  const save = async () => {
    setError(null);
    const body: Record<string, unknown> = {};
    const a = num(age);
    if (a) body.age = Math.round(a);
    if (sex) body.sex = sex;
    const h = num(height);
    if (h) body.height_cm = h;
    const w = num(weight);
    if (w) body.weight_kg = w;
    if (activity) body.activity_level = activity;
    if (goal) body.goal = goal;
    if (Object.keys(body).length === 0) {
      setError('En az bir alan gir');
      return;
    }
    setBusy(true);
    try {
      await apiRequest<NutritionProfile>('/api/yemek/profile', { method: 'PUT', body, token });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error)?.message ?? 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.overlay} testID="nutrition-profile-sheet">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Kalori hedefi</Text>
          <Pressable onPress={onClose} testID="profile-close" accessibilityRole="button" style={styles.close}>
            <Text style={styles.closeText}>Kapat</Text>
          </Pressable>
        </View>
        <Text style={styles.intro}>
          Günlük kalori/makro hedefini boy-kilo-yaş-aktivite ve hedefinden hesaplarız
          (Mifflin-St Jeor). Bu genel bir tahmindir, kişiye özel diyet reçetesi değildir.
        </Text>

        <Row>
          <Field label="Yaş" flex>
            <TextInput
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              placeholder="30"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              testID="profile-age"
            />
          </Field>
          <Field label="Kilo (kg)" flex>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="82"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              testID="profile-weight"
            />
          </Field>
          <Field label="Boy (cm)" flex>
            <TextInput
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
              placeholder="175"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              testID="profile-height"
            />
          </Field>
        </Row>

        <Field label="Cinsiyet">
          <Segmented
            options={[{ k: 'erkek', l: 'Erkek' }, { k: 'kadin', l: 'Kadın' }]}
            value={sex}
            color={color}
            onChange={(v) => setSex(v as NutritionProfile['sex'])}
          />
        </Field>

        <Field label="Aktivite düzeyi">
          <View style={styles.stack}>
            {activityOptions.map((o) => {
              const active = activity === o.k;
              return (
                <Pressable
                  key={o.k}
                  onPress={() => setActivity(o.k)}
                  testID={`activity-${o.k}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.stackItem, active ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border }]}
                >
                  <Text style={[styles.stackText, active && { color: onColor(color) }]}>{o.l}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Hedef">
          <Segmented
            options={[{ k: 'ver', l: 'Kilo ver' }, { k: 'koru', l: 'Koru' }, { k: 'al', l: 'Kilo al' }]}
            value={goal}
            color={color}
            onChange={(v) => setGoal(v as NutritionProfile['goal'])}
          />
        </Field>

        {error ? <Text style={styles.error} testID="profile-error">{error}</Text> : null}
      </ScrollView>

      <Pressable
        onPress={save}
        disabled={busy}
        testID="profile-save"
        accessibilityRole="button"
        style={[styles.saveBar, { backgroundColor: color }, busy && { opacity: 0.6 }]}
      >
        <Text style={[styles.saveText, { color: onColor(color) }]}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</Text>
      </Pressable>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Field({ label, hint, flex, children }: { label: string; hint?: string; flex?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.field, flex && styles.flex1]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Segmented({
  options,
  value,
  color,
  onChange,
}: {
  options: { k: string; l: string }[];
  value: string | null;
  color: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = value === o.k;
        return (
          <Pressable
            key={o.k}
            onPress={() => onChange(o.k)}
            testID={`seg-${o.k}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border }]}
          >
            <Text style={[styles.segmentText, active && { color: onColor(color) }]}>{o.l}</Text>
          </Pressable>
        );
      })}
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
  content: { paddingHorizontal: theme.space(5), paddingBottom: theme.space(12) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space(3) },
  title: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text },
  close: { minHeight: 44, justifyContent: 'center', paddingLeft: theme.space(3) },
  closeText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.accent },
  intro: { fontSize: theme.font.caption, color: theme.color.textMuted, lineHeight: 18, marginBottom: theme.space(4) },
  row: { flexDirection: 'row', gap: theme.space(2) },
  flex1: { flex: 1 },
  field: { marginBottom: theme.space(4) },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: theme.space(2) },
  label: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text },
  hint: { fontSize: theme.font.caption, color: theme.color.textMuted },
  input: {
    minHeight: 50,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.card,
    borderWidth: 1,
    borderColor: theme.color.border,
    paddingHorizontal: theme.space(4),
    fontSize: theme.font.body,
    color: theme.color.text,
  },
  segmented: { flexDirection: 'row', gap: theme.space(2) },
  segment: { flex: 1, minHeight: 46, borderRadius: theme.radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text },
  stack: { gap: theme.space(2) },
  stackItem: { minHeight: 44, borderRadius: theme.radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.space(3) },
  stackText: { fontSize: theme.font.label, fontWeight: '600', color: theme.color.text },
  error: { fontSize: theme.font.label, color: theme.color.danger, fontWeight: '600', marginTop: theme.space(2) },
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
  saveText: { fontSize: theme.font.body, fontWeight: '800' },
});

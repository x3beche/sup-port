import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiRequest } from '../../lib/api';
import { onColor, theme } from '../../theme';
import type { BodyMetric, SporProfile } from '../../types';

function num(value: string): number | null {
  const n = Number(value.replace(',', '.').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Boy-kilo-bel ölçümü + temel profil (BMI için boy/cinsiyet, güvenli hedef için
 * hedef kilo). BMI'yi bel çevresiyle birlikte gösterme ilkesi (rapor Başlık 3):
 * bel çevresi de istenir ama zorunlu değildir.
 */
export function BodyMetricSheet({
  color,
  token,
  profile,
  onClose,
  onSaved,
}: {
  color: string;
  token: string | null;
  profile: SporProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [height, setHeight] = useState(profile.height_cm ? String(profile.height_cm) : '');
  const [sex, setSex] = useState<SporProfile['sex']>(profile.sex);
  const [goal, setGoal] = useState<SporProfile['goal']>(profile.goal);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [target, setTarget] = useState(profile.target_weight_kg ? String(profile.target_weight_kg) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const w = num(weight);
    if (!w) {
      setError('Geçerli bir kilo gir');
      return;
    }
    setBusy(true);
    try {
      // Profil alanları (boy/cinsiyet/hedef) değiştiyse önce onları yaz.
      const profileUpdate: Record<string, unknown> = {};
      const h = num(height);
      if (h && h !== profile.height_cm) profileUpdate.height_cm = h;
      if (sex && sex !== profile.sex) profileUpdate.sex = sex;
      if (goal && goal !== profile.goal) profileUpdate.goal = goal;
      const t = num(target);
      if (t && t !== profile.target_weight_kg) profileUpdate.target_weight_kg = t;
      if (Object.keys(profileUpdate).length) {
        await apiRequest('/api/spor/profile', { method: 'PUT', body: profileUpdate, token });
      }
      const body: Record<string, unknown> = { weight_kg: w };
      const waistNum = num(waist);
      if (waistNum) body.waist_cm = waistNum;
      await apiRequest<BodyMetric>('/api/spor/metrics', { method: 'POST', body, token });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error)?.message ?? 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.overlay} testID="body-metric-sheet">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Ölçüm ekle</Text>
          <Pressable onPress={onClose} testID="metric-close" accessibilityRole="button" style={styles.close}>
            <Text style={styles.closeText}>Kapat</Text>
          </Pressable>
        </View>

        <Field label="Kilo (kg)">
          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="örn. 82"
            placeholderTextColor={theme.color.textFaint}
            style={styles.input}
            testID="metric-weight"
          />
        </Field>

        <Field label="Boy (cm)" hint="BMI hesabı için">
          <TextInput
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            placeholder="örn. 175"
            placeholderTextColor={theme.color.textFaint}
            style={styles.input}
            testID="metric-height"
          />
        </Field>

        <Field label="Bel çevresi (cm)" hint="isteğe bağlı — risk göstergesi">
          <TextInput
            value={waist}
            onChangeText={setWaist}
            keyboardType="decimal-pad"
            placeholder="örn. 92"
            placeholderTextColor={theme.color.textFaint}
            style={styles.input}
            testID="metric-waist"
          />
        </Field>

        <Field label="Cinsiyet" hint="bel çevresi eşiği için">
          <Segmented
            options={[{ k: 'erkek', l: 'Erkek' }, { k: 'kadin', l: 'Kadın' }]}
            value={sex}
            color={color}
            onChange={(v) => setSex(v as SporProfile['sex'])}
          />
        </Field>

        <Field label="Hedef">
          <Segmented
            options={[{ k: 'ver', l: 'Kilo ver' }, { k: 'koru', l: 'Koru' }, { k: 'al', l: 'Kilo al' }]}
            value={goal}
            color={color}
            onChange={(v) => setGoal(v as SporProfile['goal'])}
          />
        </Field>

        {goal === 'ver' ? (
          <Field label="Hedef kilo (kg)" hint="güvenli hız haftada 0,5–1 kg">
            <TextInput
              value={target}
              onChangeText={setTarget}
              keyboardType="decimal-pad"
              placeholder="örn. 75"
              placeholderTextColor={theme.color.textFaint}
              style={styles.input}
              testID="metric-target"
            />
          </Field>
        ) : null}

        {error ? <Text style={styles.error} testID="metric-error">{error}</Text> : null}
      </ScrollView>

      <Pressable
        onPress={save}
        disabled={busy}
        testID="metric-save"
        accessibilityRole="button"
        style={[styles.saveBar, { backgroundColor: color }, busy && { opacity: 0.6 }]}
      >
        <Text style={[styles.saveText, { color: onColor(color) }]}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</Text>
      </Pressable>
    </View>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space(4) },
  title: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text },
  close: { minHeight: 44, justifyContent: 'center', paddingLeft: theme.space(3) },
  closeText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.accent },
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
  segment: {
    flex: 1,
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text },
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

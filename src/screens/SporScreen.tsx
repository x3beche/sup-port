import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BodyMetricSheet } from '../components/spor/BodyMetricSheet';
import { ExerciseLibrary } from '../components/spor/ExerciseLibrary';
import { ParqSheet } from '../components/spor/ParqSheet';
import { Icon } from '../components/Icon';
import { ScoreRing } from '../components/ScoreRing';
import { useAuth } from '../context/AuthContext';
import { apiRequest, todayIso } from '../lib/api';
import { useBackHandler } from '../lib/backHandler';
import { useCachedQuery } from '../lib/useCachedQuery';
import { onColor, tabularNums, theme } from '../theme';
import type {
  MetricsSummary,
  ModuleProgress,
  SporMeta,
  SporProfile,
  SporRecommendation,
  WeeklyGoal,
  WorkoutResult,
} from '../types';

function bmiColor(category: string | null | undefined): string {
  if (!category) return theme.color.textMuted;
  if (category === 'normal') return theme.color.success;
  if (category === 'zayif' || category === 'fazla_kilolu') return theme.color.warnText;
  return theme.color.danger; // obez*
}

function waistColor(risk: string | undefined): string {
  if (risk === 'dusuk') return theme.color.success;
  if (risk === 'artmis') return theme.color.warnText;
  if (risk === 'yuksek') return theme.color.danger;
  return theme.color.textMuted;
}

const WAIST_LABELS: Record<string, string> = {
  dusuk: 'Bel çevresi: düşük risk',
  artmis: 'Bel çevresi: artmış risk',
  yuksek: 'Bel çevresi: yüksek risk',
};

export function SporScreen({
  module,
  onBack,
}: {
  module: ModuleProgress;
  onBack: () => void;
}) {
  const { token } = useAuth();
  const today = todayIso();
  const color = module.color;

  // useCachedQuery, fetcher'ı ref'te tuttuğu için inline (memoize edilmemiş)
  // fonksiyonlar güvenli — her render yeni closure sorun değil.
  const { data: summary, refresh: refreshSummary } = useCachedQuery<MetricsSummary>(
    token ? `spor-sum:${today}` : null,
    (signal) => apiRequest<MetricsSummary>(`/api/spor/metrics/summary?date=${today}`, { token, signal }),
  );
  const { data: weekly, refresh: refreshWeekly } = useCachedQuery<WeeklyGoal>(
    token ? `spor-week:${today}` : null,
    (signal) => apiRequest<WeeklyGoal>(`/api/spor/weekly?date=${today}`, { token, signal }),
  );
  const { data: todayWork, refresh: refreshToday } = useCachedQuery<{ total_min: number; total_calories: number }>(
    token ? `spor-today:${today}` : null,
    (signal) => apiRequest(`/api/spor/workouts?date=${today}`, { token, signal }),
  );
  const { data: meta } = useCachedQuery<SporMeta>(
    token ? 'spor-meta' : null,
    (signal) => apiRequest<SporMeta>('/api/spor/meta', { token, signal }),
  );
  const { data: rec, setData: setRec, refresh: refreshRec } = useCachedQuery<SporRecommendation>(
    token ? `spor-rec:${today}` : null,
    (signal) => apiRequest<SporRecommendation>('/api/spor/recommendation?llm=false', { token, signal }),
  );

  const [overlay, setOverlay] = useState<null | 'library' | 'metric' | 'parq'>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [profile, setProfile] = useState<SporProfile | null>(null);

  const effProfile: SporProfile =
    profile ??
    summary?.profile ?? {
      height_cm: null,
      sex: null,
      activity_level: null,
      goal: null,
      target_weight_kg: null,
      asian_thresholds: false,
      parq_completed: false,
      parq_flagged: false,
    };

  const logWorkout = useCallback(
    async (items: { key: string; sets?: number; reps?: number; duration_sec?: number }[]) => {
      await apiRequest<WorkoutResult>(`/api/spor/workouts?date=${today}`, {
        method: 'POST',
        body: { items },
        token,
      });
      await Promise.all([refreshWeekly(), refreshToday()]);
    },
    [refreshToday, refreshWeekly, today, token],
  );

  const getAiSummary = useCallback(async () => {
    setAiLoading(true);
    try {
      const fresh = await apiRequest<SporRecommendation>('/api/spor/recommendation?llm=true', { token });
      setRec(() => fresh);
    } finally {
      setAiLoading(false);
    }
  }, [setRec, token]);

  const refreshAll = useCallback(() => {
    void refreshSummary();
    void refreshWeekly();
    // Öneri BMI'ye bağlı; yeni ölçüm eklenince güncel kategoriye göre yenilensin.
    void refreshRec();
  }, [refreshRec, refreshSummary, refreshWeekly]);

  // Geri tuşu önce açık katmanı kapatır (kütüphane kendi iç geri işleyicisini
  // kullanır), sonra ekrandan çıkar.
  useBackHandler(() => {
    if (overlay) {
      setOverlay(null);
      return true;
    }
    onBack();
    return true;
  });

  const current = summary?.current;
  const minutesRatio = weekly ? Math.round(weekly.minutes_ratio * 100) : 0;

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} testID="spor-screen" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={onBack} testID="back" style={styles.back} accessibilityRole="button" accessibilityLabel="Geri">
            <Icon name="chevron-left" size={22} strokeWidth={2} color={theme.color.text} />
          </Pressable>
          <Text style={styles.topTitle}>{module.title}</Text>
          <View style={styles.back} />
        </View>

        {/* Tıbbi uyarı */}
        <View style={styles.disclaimer} testID="spor-disclaimer">
          <Text style={styles.disclaimerText}>
            {meta?.disclaimer ??
              'Bu içerik genel bilgidir, kişiye özel tıbbi tavsiye değildir. Gerekirse bir uzmana danışın.'}
          </Text>
        </View>

        {/* PAR-Q durumu */}
        {!effProfile.parq_completed ? (
          <Pressable onPress={() => setOverlay('parq')} testID="parq-prompt" style={[styles.card, styles.parqPrompt]}>
            <Text style={styles.parqTitle}>Başlamadan önce güvenlik taraması</Text>
            <Text style={styles.parqSub}>30 saniyelik kısa PAR-Q+ taraması ile güvenle başla.</Text>
          </Pressable>
        ) : effProfile.parq_flagged ? (
          <View style={[styles.banner, styles.warnBanner]} testID="parq-flag">
            <Text style={styles.warnBannerText}>
              Taramada işaretlediğin madde(ler) var — egzersize başlamadan önce bir sağlık uzmanına danışman önerilir.
            </Text>
          </View>
        ) : null}

        {/* Haftalık WHO hedefi */}
        <Text style={styles.sectionTitle}>Haftalık hedef</Text>
        <View style={styles.card}>
          <View style={styles.weekRow}>
            <ScoreRing score={minutesRatio} size={92} strokeWidth={9} color={color} />
            <View style={styles.weekInfo}>
              <Text style={styles.weekMinutes}>
                {weekly?.active_minutes ?? 0}
                <Text style={styles.weekUnit}> / {weekly?.moderate_target ?? 150} dk</Text>
              </Text>
              <Text style={styles.weekSub}>Orta şiddet aktivite (WHO)</Text>
              <View style={styles.strengthRow}>
                <Icon name="dumbbell" size={15} color={weekly && weekly.strength_days >= weekly.strength_target ? color : theme.color.textMuted} />
                <Text style={styles.weekSub}>
                  Kuvvet günü {weekly?.strength_days ?? 0}/{weekly?.strength_target ?? 2}
                </Text>
              </View>
            </View>
          </View>
          {weekly?.met_goal ? (
            <View style={[styles.goalDone, { backgroundColor: `${color}1F` }]}>
              <Icon name="check" size={16} strokeWidth={2.4} color={color} />
              <Text style={[styles.goalDoneText, { color }]}>Haftalık hedefi tuttun!</Text>
            </View>
          ) : null}
        </View>

        {/* Bugünkü antrenman */}
        {todayWork && todayWork.total_min > 0 ? (
          <View style={[styles.card, styles.todayCard]} testID="spor-today">
            <View>
              <Text style={styles.todayValue}>{todayWork.total_min} dk</Text>
              <Text style={styles.weekSub}>bugün · ~{todayWork.total_calories} kcal</Text>
            </View>
            <Icon name="dumbbell" size={26} color={color} />
          </View>
        ) : null}

        {/* Vücut / BMI */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Vücut takibi</Text>
          <Pressable onPress={() => setOverlay('metric')} testID="add-metric" accessibilityRole="button" style={[styles.smallBtn, { backgroundColor: `${color}26` }]}>
            <Icon name="plus" size={15} strokeWidth={2.2} color={color} />
            <Text style={[styles.smallBtnText, { color }]}>Ölçüm</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          {summary?.has_data && current ? (
            <>
              <View style={styles.bmiRow}>
                <View>
                  <Text style={styles.bmiWeight} testID="bmi-weight">
                    {current.weight_kg} <Text style={styles.weekUnit}>kg</Text>
                  </Text>
                  {typeof summary.trend_kg === 'number' && summary.trend_kg !== 0 ? (
                    <Text style={styles.trend}>
                      {summary.trend_kg > 0 ? '+' : ''}
                      {summary.trend_kg} kg (başlangıçtan)
                    </Text>
                  ) : null}
                </View>
                {current.bmi != null ? (
                  <View style={styles.bmiBadgeWrap}>
                    <Text style={[styles.bmiValue, { color: bmiColor(current.bmi_category) }]} testID="bmi-value">
                      BMI {current.bmi}
                    </Text>
                    <Text style={[styles.bmiLabel, { color: bmiColor(current.bmi_category) }]}>{current.bmi_label}</Text>
                  </View>
                ) : (
                  <Text style={styles.bmiHint}>Boy ekle → BMI</Text>
                )}
              </View>
              {current.waist_risk ? (
                <Text style={[styles.waist, { color: waistColor(current.waist_risk) }]}>
                  {WAIST_LABELS[current.waist_risk] ?? ''}
                </Text>
              ) : null}
              {summary.to_lose_kg && summary.safe_min_weeks ? (
                <Text style={styles.safeNote}>
                  Hedefe {summary.to_lose_kg} kg — güvenli hızda (0,5–1 kg/hafta) yaklaşık{' '}
                  {summary.safe_min_weeks}–{summary.safe_max_weeks} hafta.
                </Text>
              ) : null}
            </>
          ) : (
            <Pressable onPress={() => setOverlay('metric')} testID="bmi-empty">
              <Text style={styles.emptyTitle}>Boy ve kilonu ekle</Text>
              <Text style={styles.emptyText}>BMI, bel çevresi riski ve güvenli hedef takibi için ilk ölçümü gir.</Text>
            </Pressable>
          )}
        </View>

        {/* Öneri */}
        <Text style={styles.sectionTitle}>Sana özel öneri</Text>
        <View style={styles.card}>
          {rec ? (
            <>
              {rec.summary ? (
                <Text style={styles.recSummary} testID="rec-summary">{rec.summary}</Text>
              ) : (
                <Text style={styles.recSummary}>
                  {rec.bmi_label ? `Durumun: ${rec.bmi_label}. ` : ''}
                  {rec.avoid_high_impact
                    ? 'Eklem dostu, düşük etkili hareketlere odaklanalım.'
                    : 'Dengeli bir kuvvet + kardiyo programı uygun.'}
                </Text>
              )}
              <View style={styles.chips}>
                {rec.focus.map((f) => (
                  <View key={f} style={[styles.focusChip, { backgroundColor: `${color}1F` }]}>
                    <Text style={[styles.focusChipText, { color }]}>{f}</Text>
                  </View>
                ))}
              </View>
              {rec.notes?.map((n, i) => (
                <Text key={i} style={styles.recNote}>• {n}</Text>
              ))}
              {!rec.summary ? (
                <Pressable onPress={getAiSummary} disabled={aiLoading} testID="rec-ai" accessibilityRole="button" style={[styles.aiBtn, { borderColor: color }]}>
                  <Text style={[styles.aiBtnText, { color }]}>{aiLoading ? 'Hazırlanıyor…' : 'Yapay zekâ ile kişisel özet'}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <ActivityIndicator color={color} />
          )}
        </View>

        {/* Kütüphane */}
        <Pressable onPress={() => setOverlay('library')} testID="open-library" accessibilityRole="button" style={[styles.libraryBtn, { backgroundColor: color }]}>
          <Icon name="dumbbell" size={20} color={onColor(color)} />
          <Text style={[styles.libraryText, { color: onColor(color) }]}>Egzersiz kütüphanesi · antrenman kaydet</Text>
        </Pressable>
      </ScrollView>

      {overlay === 'library' ? (
        <ExerciseLibrary color={color} token={token} onClose={() => setOverlay(null)} onLog={logWorkout} />
      ) : null}
      {overlay === 'metric' ? (
        <BodyMetricSheet color={color} token={token} profile={effProfile} onClose={() => setOverlay(null)} onSaved={refreshAll} />
      ) : null}
      {overlay === 'parq' ? (
        <ParqSheet
          color={color}
          token={token}
          questions={meta?.parq_questions ?? []}
          onClose={() => setOverlay(null)}
          onSaved={(p) => setProfile(p)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space(5), paddingBottom: theme.space(10) },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space(4) },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
  topTitle: { fontSize: theme.font.body + 1, fontWeight: '800', color: theme.color.text },
  disclaimer: { backgroundColor: theme.color.card, borderRadius: theme.radius.sm, padding: theme.space(3), marginBottom: theme.space(3) },
  disclaimerText: { fontSize: theme.font.caption, color: theme.color.textMuted, lineHeight: 17 },
  card: { backgroundColor: theme.color.card, borderRadius: theme.radius.lg, padding: theme.space(5) },
  parqPrompt: { borderWidth: 1, borderColor: theme.color.warnText, marginBottom: theme.space(2) },
  parqTitle: { fontSize: theme.font.body, fontWeight: '800', color: theme.color.text },
  parqSub: { marginTop: 4, fontSize: theme.font.label, color: theme.color.textMuted },
  banner: { borderRadius: theme.radius.sm, padding: theme.space(3), marginBottom: theme.space(2) },
  warnBanner: { backgroundColor: theme.color.warnBg },
  warnBannerText: { fontSize: theme.font.caption, color: theme.color.warnText, fontWeight: '600', lineHeight: 17 },
  sectionTitle: { fontSize: theme.font.body + 2, fontWeight: '800', color: theme.color.text, marginTop: theme.space(6), marginBottom: theme.space(3) },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.space(6), marginBottom: theme.space(3) },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: theme.space(1), minHeight: 36, paddingHorizontal: theme.space(3), borderRadius: theme.radius.pill },
  smallBtnText: { fontSize: theme.font.label, fontWeight: '700' },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(4) },
  weekInfo: { flex: 1 },
  weekMinutes: { fontSize: theme.font.title + 4, fontWeight: '800', color: theme.color.text, ...tabularNums },
  weekUnit: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.textMuted },
  weekSub: { fontSize: theme.font.label, color: theme.color.textMuted },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2), marginTop: theme.space(2) },
  goalDone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space(2), marginTop: theme.space(4), paddingVertical: theme.space(2), borderRadius: theme.radius.sm },
  goalDoneText: { fontSize: theme.font.label, fontWeight: '800' },
  todayCard: { marginTop: theme.space(3), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayValue: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text, ...tabularNums },
  bmiRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  bmiWeight: { fontSize: theme.font.display, fontWeight: '800', color: theme.color.text, ...tabularNums },
  trend: { marginTop: 2, fontSize: theme.font.caption, color: theme.color.textMuted },
  bmiBadgeWrap: { alignItems: 'flex-end' },
  bmiValue: { fontSize: theme.font.heading, fontWeight: '800', ...tabularNums },
  bmiLabel: { fontSize: theme.font.label, fontWeight: '700', marginTop: 2 },
  bmiHint: { fontSize: theme.font.label, color: theme.color.textMuted },
  waist: { marginTop: theme.space(3), fontSize: theme.font.label, fontWeight: '600' },
  safeNote: { marginTop: theme.space(3), fontSize: theme.font.caption, color: theme.color.textMuted, lineHeight: 17 },
  emptyTitle: { fontSize: theme.font.body, fontWeight: '700', color: theme.color.text },
  emptyText: { marginTop: theme.space(2), fontSize: theme.font.label, color: theme.color.textMuted, lineHeight: 19 },
  recSummary: { fontSize: theme.font.label, color: theme.color.text, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space(2), marginTop: theme.space(3) },
  focusChip: { paddingHorizontal: theme.space(3), paddingVertical: theme.space(1), borderRadius: theme.radius.pill },
  focusChipText: { fontSize: theme.font.caption, fontWeight: '700' },
  recNote: { marginTop: theme.space(2), fontSize: theme.font.caption, color: theme.color.textMuted, lineHeight: 18 },
  aiBtn: { marginTop: theme.space(4), minHeight: 44, borderRadius: theme.radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  aiBtnText: { fontSize: theme.font.label, fontWeight: '800' },
  libraryBtn: {
    marginTop: theme.space(6),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    minHeight: 54,
    borderRadius: theme.radius.md,
  },
  libraryText: { fontSize: theme.font.body, fontWeight: '800' },
});

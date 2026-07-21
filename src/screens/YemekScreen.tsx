import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AddFoodSheet } from '../components/yemek/AddFoodSheet';
import { NutritionProfileSheet } from '../components/yemek/NutritionProfileSheet';
import { Icon } from '../components/Icon';
import { ScoreRing } from '../components/ScoreRing';
import { useAuth } from '../context/AuthContext';
import { apiRequest, todayIso } from '../lib/api';
import { useBackHandler } from '../lib/backHandler';
import { useCachedQuery } from '../lib/useCachedQuery';
import { onColor, tabularNums, theme } from '../theme';
import type {
  MealItem,
  MealType,
  ModuleProgress,
  NutritionProfile,
  NutritionSummary,
  YemekMeta,
} from '../types';

const NF = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

export function YemekScreen({
  module,
  onBack,
}: {
  module: ModuleProgress;
  onBack: () => void;
}) {
  const { token } = useAuth();
  const today = todayIso();
  const color = module.color;

  const { data: summary, refresh: refreshSummary } = useCachedQuery<NutritionSummary>(
    token ? `yemek-sum:${today}` : null,
    (signal) => apiRequest<NutritionSummary>(`/api/yemek/summary?date=${today}`, { token, signal }),
  );
  const { data: meta } = useCachedQuery<YemekMeta>(
    token ? 'yemek-meta' : null,
    (signal) => apiRequest<YemekMeta>('/api/yemek/meta', { token, signal }),
  );
  const { data: profile, refresh: refreshProfile } = useCachedQuery<NutritionProfile>(
    token ? 'yemek-profile' : null,
    (signal) => apiRequest<NutritionProfile>('/api/yemek/profile', { token, signal }),
  );

  const [overlay, setOverlay] = useState<null | 'add' | 'profile'>(null);

  const refreshAll = useCallback(() => {
    void refreshSummary();
    void refreshProfile();
  }, [refreshProfile, refreshSummary]);

  const deleteItem = useCallback(
    async (id: string) => {
      try {
        await apiRequest(`/api/yemek/meals/${id}`, { method: 'DELETE', token });
      } finally {
        await refreshSummary();
      }
    },
    [refreshSummary, token],
  );

  useBackHandler(() => {
    if (overlay) {
      setOverlay(null);
      return true;
    }
    onBack();
    return true;
  });

  const target = summary?.target;
  const hasTarget = !!target?.has_data;
  const consumed = summary?.totals.kcal ?? 0;
  const kcalRatio = summary?.kcal_ratio ?? 0;
  const mealTypes: { key: MealType; label: string }[] = meta?.meal_types ?? [
    { key: 'kahvalti', label: 'Kahvaltı' },
    { key: 'ogle', label: 'Öğle' },
    { key: 'aksam', label: 'Akşam' },
    { key: 'atistirma', label: 'Atıştırma' },
  ];

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} testID="yemek-screen" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={onBack} testID="back" style={styles.back} accessibilityRole="button" accessibilityLabel="Geri">
            <Icon name="chevron-left" size={22} strokeWidth={2} color={theme.color.text} />
          </Pressable>
          <Text style={styles.topTitle}>{module.title}</Text>
          <Pressable onPress={() => setOverlay('profile')} testID="open-profile" accessibilityRole="button" style={styles.back} accessibilityLabel="Kalori hedefi">
            <Icon name="pen" size={18} color={theme.color.textMuted} />
          </Pressable>
        </View>

        <View style={styles.disclaimer} testID="yemek-disclaimer">
          <Text style={styles.disclaimerText}>{meta?.disclaimer ?? summary?.notes.disclaimer ?? ''}</Text>
        </View>

        {/* Kalori halkası / hedef */}
        {hasTarget && target ? (
          <View style={styles.card}>
            <View style={styles.calRow}>
              <ScoreRing score={Math.round(kcalRatio * 100)} size={120} strokeWidth={11} color={color} />
              <View style={styles.calInfo}>
                <Text style={styles.calConsumed} testID="cal-consumed">
                  {NF.format(consumed)}
                  <Text style={styles.calTarget}> / {NF.format(target.target_kcal ?? 0)} kcal</Text>
                </Text>
                <Text style={styles.calRemaining}>
                  {(summary?.remaining_kcal ?? 0) >= 0
                    ? `${NF.format(summary?.remaining_kcal ?? 0)} kcal kaldı`
                    : `${NF.format(Math.abs(summary?.remaining_kcal ?? 0))} kcal aşıldı`}
                </Text>
                {target.goal ? (
                  <Text style={styles.calGoal}>
                    Hedef: {target.goal === 'ver' ? 'kilo ver' : target.goal === 'al' ? 'kilo al' : 'koru'}
                    {typeof target.weekly_change_kg === 'number' && target.weekly_change_kg !== 0
                      ? ` · ~${target.weekly_change_kg} kg/hafta`
                      : ''}
                  </Text>
                ) : null}
              </View>
            </View>

            <View style={styles.macros}>
              <MacroBar label="Protein" value={summary?.totals.protein_g ?? 0} goal={target.protein_g ?? 0} color="#E8618C" />
              <MacroBar label="Karb" value={summary?.totals.carb_g ?? 0} goal={target.carb_g ?? 0} color="#F5A623" />
              <MacroBar label="Yağ" value={summary?.totals.fat_g ?? 0} goal={target.fat_g ?? 0} color="#4FC3D9" />
            </View>

            {target.floor_applied && target.warning ? (
              <View style={[styles.banner, styles.warnBanner]} testID="floor-warning">
                <Text style={styles.warnText}>{target.warning}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Pressable onPress={() => setOverlay('profile')} testID="set-target" style={[styles.card, styles.targetPrompt]}>
            <Text style={styles.promptTitle}>Günlük kalori hedefini ayarla</Text>
            <Text style={styles.promptSub}>
              Boy, kilo, yaş, cinsiyet, aktivite ve hedefini gir; kişisel kalori/makro hedefini hesaplayalım
              (Mifflin-St Jeor).
            </Text>
          </Pressable>
        )}

        {/* Öğünler */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Bugünün öğünleri</Text>
          <Text style={styles.mealCount}>
            {summary?.meal_count ?? 0}/{summary?.meal_target ?? 3} öğün
          </Text>
        </View>

        {!summary ? (
          <ActivityIndicator color={color} style={styles.pad} />
        ) : summary.meals.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Henüz bir şey eklemedin. Aşağıdan öğün ekle.</Text>
          </View>
        ) : (
          summary.meals.map((group) => (
            <View key={group.meal_type} style={styles.card} testID={`meal-group-${group.meal_type}`}>
              <View style={styles.groupHead}>
                <Text style={styles.groupTitle}>{group.label}</Text>
                <Text style={styles.groupKcal}>{NF.format(group.subtotal.kcal)} kcal</Text>
              </View>
              {group.items.map((item) => (
                <MealRow key={item.id} item={item} color={color} onDelete={() => deleteItem(item.id)} />
              ))}
            </View>
          ))
        )}

        {/* Yeme bozukluğu güvenlik notu */}
        <Text style={styles.safetyNote}>{meta?.eating_disorder_note ?? summary?.notes.eating_disorder ?? ''}</Text>
      </ScrollView>

      {/* Öğün ekle butonu */}
      <Pressable
        onPress={() => setOverlay('add')}
        testID="open-add-food"
        accessibilityRole="button"
        style={[styles.addBtn, { backgroundColor: color }]}
      >
        <Icon name="plus" size={22} strokeWidth={2.4} color={onColor(color)} />
        <Text style={[styles.addBtnText, { color: onColor(color) }]}>Yemek ekle</Text>
      </Pressable>

      {overlay === 'add' ? (
        <AddFoodSheet
          color={color}
          token={token}
          date={today}
          mealTypes={mealTypes}
          llmAvailable={meta?.llm_available ?? false}
          onClose={() => setOverlay(null)}
          onSaved={refreshAll}
        />
      ) : null}
      {overlay === 'profile' ? (
        <NutritionProfileSheet
          color={color}
          token={token}
          profile={
            profile ?? {
              age: null,
              sex: null,
              height_cm: null,
              activity_level: null,
              goal: null,
              target_weight_kg: null,
              weight_kg: null,
              has_body_metrics: false,
            }
          }
          meta={meta ?? null}
          onClose={() => setOverlay(null)}
          onSaved={refreshAll}
        />
      ) : null}
    </View>
  );
}

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const ratio = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <View style={styles.macroBar}>
      <View style={styles.macroLabelRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {Math.round(value)} / {Math.round(goal)} g
        </Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MealRow({ item, color, onDelete }: { item: MealItem; color: string; onDelete: () => void }) {
  return (
    <View style={styles.itemRow} testID={`meal-item-${item.id}`}>
      <View style={styles.flex1}>
        <View style={styles.itemNameRow}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.estimated ? (
            <View style={[styles.estBadge, { borderColor: color }]}>
              <Text style={[styles.estBadgeText, { color }]}>tahmini</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.itemSub}>
          {Math.round(item.qty_g)} g · {Math.round(item.kcal)} kcal · P{item.protein_g} K{item.carb_g} Y{item.fat_g}
        </Text>
      </View>
      <Pressable onPress={onDelete} testID={`delete-${item.id}`} accessibilityRole="button" accessibilityLabel="Sil" hitSlop={8} style={styles.deleteBtn}>
        <Icon name="trash" size={17} color={theme.color.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.bg },
  content: { padding: theme.space(5), paddingBottom: theme.space(24) },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space(4) },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
  topTitle: { fontSize: theme.font.body + 1, fontWeight: '800', color: theme.color.text },
  disclaimer: { backgroundColor: theme.color.card, borderRadius: theme.radius.sm, padding: theme.space(3), marginBottom: theme.space(3) },
  disclaimerText: { fontSize: theme.font.caption, color: theme.color.textMuted, lineHeight: 17 },
  card: { backgroundColor: theme.color.card, borderRadius: theme.radius.lg, padding: theme.space(5), marginBottom: theme.space(3) },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(4) },
  calInfo: { flex: 1 },
  calConsumed: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text, ...tabularNums },
  calTarget: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.textMuted },
  calRemaining: { marginTop: 2, fontSize: theme.font.label, color: theme.color.textMuted },
  calGoal: { marginTop: theme.space(2), fontSize: theme.font.caption, color: theme.color.textMuted },
  macros: { marginTop: theme.space(4), gap: theme.space(3) },
  macroBar: {},
  macroLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.space(1) },
  macroLabel: { fontSize: theme.font.caption, fontWeight: '700', color: theme.color.text },
  macroValue: { fontSize: theme.font.caption, color: theme.color.textMuted, ...tabularNums },
  macroTrack: { height: 8, borderRadius: theme.radius.pill, backgroundColor: theme.color.track, overflow: 'hidden' },
  macroFill: { height: '100%', borderRadius: theme.radius.pill },
  banner: { borderRadius: theme.radius.sm, padding: theme.space(3), marginTop: theme.space(4) },
  warnBanner: { backgroundColor: theme.color.warnBg },
  warnText: { fontSize: theme.font.caption, color: theme.color.warnText, fontWeight: '600', lineHeight: 17 },
  targetPrompt: { borderWidth: 1, borderColor: theme.color.border },
  promptTitle: { fontSize: theme.font.body, fontWeight: '800', color: theme.color.text },
  promptSub: { marginTop: theme.space(2), fontSize: theme.font.label, color: theme.color.textMuted, lineHeight: 19 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.space(4), marginBottom: theme.space(3) },
  sectionTitle: { fontSize: theme.font.body + 2, fontWeight: '800', color: theme.color.text },
  mealCount: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.textMuted, ...tabularNums },
  pad: { paddingVertical: theme.space(6) },
  emptyText: { fontSize: theme.font.label, color: theme.color.textMuted, textAlign: 'center', lineHeight: 20 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space(2) },
  groupTitle: { fontSize: theme.font.body, fontWeight: '800', color: theme.color.text },
  groupKcal: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.textMuted, ...tabularNums },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(2),
    paddingVertical: theme.space(2),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  flex1: { flex: 1 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  itemName: { fontSize: theme.font.label, fontWeight: '600', color: theme.color.text, flexShrink: 1 },
  estBadge: { borderWidth: 1, borderRadius: theme.radius.pill, paddingHorizontal: theme.space(2), paddingVertical: 1 },
  estBadgeText: { fontSize: theme.font.tiny, fontWeight: '700' },
  itemSub: { marginTop: 2, fontSize: theme.font.caption, color: theme.color.textMuted, ...tabularNums },
  deleteBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  safetyNote: { marginTop: theme.space(4), fontSize: theme.font.caption, color: theme.color.textFaint, lineHeight: 17 },
  addBtn: {
    position: 'absolute',
    left: theme.space(5),
    right: theme.space(5),
    bottom: theme.space(5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    minHeight: 54,
    borderRadius: theme.radius.md,
  },
  addBtnText: { fontSize: theme.font.body, fontWeight: '800' },
});

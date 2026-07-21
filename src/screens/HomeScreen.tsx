import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { DraggableGrid } from '../components/DraggableGrid';
import { Icon } from '../components/Icon';
import { useBackHandler } from '../lib/backHandler';
import { checkForUpdate, type UpdateInfo } from '../lib/update';
import { UpdatePill } from '../components/UpdatePill';
import { UpdateSuccess, restartApp } from '../components/UpdateSuccess';
import { SummaryCard } from '../components/SummaryCard';
import { StepPad } from '../components/StepPad';
import { WeeklyChart } from '../components/WeeklyChart';
import { useAuth } from '../context/AuthContext';
import { apiRequest, todayIso } from '../lib/api';
import { readJson, writeJson } from '../lib/storage';
import { useCachedQuery } from '../lib/useCachedQuery';
import { tabularNums, theme } from '../theme';
import type { DailySummary, ModuleProgress, WeekDay } from '../types';

const SUMMARY_COMPACT_KEY = 'summary-compact';
const HOME_LAYOUT_KEY = 'home-layout';

type HomeSection = 'summary' | 'weekly';
type WeeklySize = 'hidden' | 'normal' | 'tall';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
};

export function HomeScreen({
  onOpenModule,
  onOpenStore,
  onOpenProfile,
}: {
  onOpenModule: (m: ModuleProgress) => void;
  onOpenStore: () => void;
  onOpenProfile: () => void;
}) {
  const { user, token, logout } = useAuth();
  const today = todayIso();

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      apiRequest<DailySummary>(`/api/summary?date=${today}`, { token, signal }),
    [token, today],
  );

  const { data, loading, refreshing, error, fromCache, refresh, setData } = useCachedQuery<DailySummary>(
    token ? `summary:${today}` : null,
    fetcher,
  );

  const weekFetcher = useCallback(
    (signal: AbortSignal) =>
      apiRequest<WeekDay[]>(`/api/summary/week?days=7&date=${today}`, { token, signal }),
    [token, today],
  );

  const { data: week, refresh: refreshWeek } = useCachedQuery<WeekDay[]>(
    token ? `week:${today}` : null,
    weekFetcher,
  );

  const [quickAdd, setQuickAdd] = useState<ModuleProgress | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [updStage, setUpdStage] = useState<'idle' | 'downloading' | 'verifying' | 'done'>('idle');
  const [updProgress, setUpdProgress] = useState(0);
  const [updSpeed, setUpdSpeed] = useState<string | null>(null);
  const updTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Yeni sürüm var mı? Kendi backend'imize sorar (bkz. lib/update.ts).
  useEffect(() => {
    const controller = new AbortController();
    void checkForUpdate(controller.signal).then(setUpdate);
    return () => controller.abort();
  }, []);

  const cancelUpdate = useCallback(() => {
    if (updTimer.current) {
      clearInterval(updTimer.current);
      updTimer.current = null;
    }
    setUpdStage('idle');
    setUpdProgress(0);
    setUpdSpeed(null);
  }, []);

  const startUpdate = useCallback(() => {
    if (!update || updStage !== 'idle') return;
    setMenuOpen(false);
    setUpdStage('downloading');
    setUpdProgress(0);
    // DEMO: kullanıcı ana ekranda kalır; sağ üstteki buton dolar. Bitince
    // "güncellendi → yeniden başlat" ekranı animasyonla belirir. Gerçek sürümde
    // bu simülasyonun yerini expo-file-system indirme + ilerleme callback'i alır
    // (gerçek hız = bayt/zaman).
    let value = 0;
    updTimer.current = setInterval(() => {
      value += 0.02 + Math.random() * 0.03;
      // Makul, hafif dalgalanan indirme hızı (demo). TR ondalık virgül.
      setUpdSpeed(`${(2.2 + Math.random() * 2.3).toFixed(1).replace('.', ',')} MB/s`);
      if (value >= 1) {
        setUpdProgress(1);
        setUpdSpeed(null);
        if (updTimer.current) clearInterval(updTimer.current);
        updTimer.current = null;
        setUpdStage('verifying');
        setTimeout(() => setUpdStage('done'), 1600);
      } else {
        setUpdProgress(value);
      }
    }, 150);
  }, [update, updStage]);

  useEffect(
    () => () => {
      if (updTimer.current) clearInterval(updTimer.current);
    },
    [],
  );

  const updActive = updStage === 'downloading' || updStage === 'verifying';

  // Geri tuşu açık menüyü kapatsın (uygulamadan çıkmadan önce).
  useBackHandler(() => {
    setMenuOpen(false);
    return true;
  }, menuOpen);

  // Size preference is a per-device layout choice, so it stays local.
  const [compactSummary, setCompactSummary] = useState(false);
  useEffect(() => {
    void readJson<boolean>(SUMMARY_COMPACT_KEY).then((saved) => {
      if (typeof saved === 'boolean') setCompactSummary(saved);
    });
  }, []);

  const changeSummarySize = useCallback((compact: boolean) => {
    setCompactSummary(compact);
    void writeJson(SUMMARY_COMPACT_KEY, compact);
  }, []);

  // "Düzeni değiştir": kullanıcı ana ekrandaki kartların SIRASINI ve BOYUNU
  // değiştirebilir. Yerleşim per-cihaz bir tercih olduğundan yerelde saklanır.
  const [layoutMode, setLayoutMode] = useState(false);
  const [order, setOrder] = useState<HomeSection[]>(['summary', 'weekly']);
  const [weeklySize, setWeeklySize] = useState<WeeklySize>('normal');
  useEffect(() => {
    void readJson<{ order?: HomeSection[]; weekly?: WeeklySize }>(HOME_LAYOUT_KEY).then((saved) => {
      if (saved?.order?.length === 2 && saved.order.includes('summary') && saved.order.includes('weekly')) {
        setOrder(saved.order);
      }
      if (saved?.weekly) setWeeklySize(saved.weekly);
    });
  }, []);

  const persistLayout = useCallback((nextOrder: HomeSection[], nextWeekly: WeeklySize) => {
    setOrder(nextOrder);
    setWeeklySize(nextWeekly);
    void writeJson(HOME_LAYOUT_KEY, { order: nextOrder, weekly: nextWeekly });
  }, []);

  const moveSection = useCallback(
    (section: HomeSection, dir: -1 | 1) => {
      setOrder((prev) => {
        const idx = prev.indexOf(section);
        const next = idx + dir;
        if (idx < 0 || next < 0 || next >= prev.length) return prev;
        const arr = [...prev];
        [arr[idx], arr[next]] = [arr[next], arr[idx]];
        void writeJson(HOME_LAYOUT_KEY, { order: arr, weekly: weeklySize });
        return arr;
      });
    },
    [weeklySize],
  );

  const cycleWeekly = useCallback(() => {
    const seq: WeeklySize[] = ['normal', 'tall', 'hidden'];
    persistLayout(order, seq[(seq.indexOf(weeklySize) + 1) % seq.length]);
  }, [order, persistLayout, weeklySize]);

  // Düzen modundayken geri tuşu önce düzenlemeyi bitirir.
  useBackHandler(() => {
    setLayoutMode(false);
    return true;
  }, layoutMode);

  const openQuickAdd = useCallback(
    (module: ModuleProgress) => {
      // Diş fırçalama (yuvalar), spor (antrenman/kütüphane) ve okuma
      // (raflar/oturum) jenerik "+1" hızlı ekleme modeline uymaz — günlük değeri
      // kendi zengin akışlarından (oturum/yuva) türetirler; uzun basış da kendi
      // ekranlarını açar.
      if (
        module.key === 'brush' ||
        module.key === 'workout' ||
        module.key === 'reading' ||
        module.key === 'meal'
      ) {
        onOpenModule(module);
        return;
      }
      setQuickAdd((current) => (current?.key === module.key ? null : module));
    },
    [onOpenModule],
  );

  const quickChange = useCallback(
    async (delta: number, step: number) => {
      if (!quickAdd) return;

      // Optimistic so the pad feels the same as inside the module.
      setQuickAdd((prev) => {
        if (!prev) return prev;
        const value = Math.max(0, prev.value + delta);
        const ratio = prev.target ? Math.min(value / prev.target, 1) : 0;
        return { ...prev, value, ratio, completed: ratio >= 1 };
      });

      try {
        await apiRequest(
          `/api/entries/${quickAdd.key}/add?date=${today}&used_step=${step}`,
          { method: 'POST', body: { delta }, token },
        );
      } finally {
        // The score, the grid and the week all move with a single entry.
        await Promise.all([refresh(), refreshWeek()]);
      }
    },
    [quickAdd, refresh, refreshWeek, today, token],
  );

  const saveOrder = useCallback(
    async (keys: string[]) => {
      // Optimistic: the grid already shows the new order, so a failed save just
      // reverts on the next refresh rather than fighting the user's drag.
      setData((current) => {
        if (!current) return current;
        const byKey = new Map(current.modules.map((m) => [m.key, m]));
        const reordered = keys.map((k) => byKey.get(k)).filter(Boolean) as typeof current.modules;
        return { ...current, modules: reordered };
      });

      try {
        await apiRequest('/api/order', { method: 'PUT', body: { order: keys }, token });
      } catch {
        await refresh();
      }
    },
    [refresh, setData, token],
  );

  const prettyDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('tr-TR', DATE_FORMAT).format(new Date(`${today}T00:00:00`));
    } catch {
      return today;
    }
  }, [today]);

  if (loading && !data) {
    return (
      <View style={styles.loader} testID="home-loading">
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  const modules = data?.modules ?? [];

  return (
    <View style={styles.flex}>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      testID="home-screen"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing && !fromCache} onRefresh={refresh} />
      }
    >
      <View style={styles.header}>
        <View style={styles.flexShrink}>
          <Text style={styles.greeting} numberOfLines={1}>
            Merhaba, {user?.name ?? ''}
          </Text>
          <Text style={styles.date}>{prettyDate}</Text>
        </View>
        {updActive ? (
          // Buton yatayda genişleyip yükleme rozetine dönüşür (ayrı popup yok).
          <UpdatePill stage={updStage} progress={updProgress} speed={updSpeed} onCancel={cancelUpdate} />
        ) : (
          <Pressable
            onPress={() => setMenuOpen(true)}
            testID="menu-open"
            accessibilityRole="button"
            accessibilityLabel={update ? 'Menü — güncelleme var' : 'Menü'}
            hitSlop={10}
            style={({ pressed }) => [styles.iconButton, pressed && styles.storePressed]}
          >
            <Icon name="menu" size={20} strokeWidth={2} color={theme.color.text} />
            {update ? <View style={styles.menuBadge} testID="update-badge" /> : null}
          </Pressable>
        )}
      </View>

      {error ? (
        <View style={styles.banner} testID="home-error" accessibilityRole="alert">
          <Text style={styles.bannerText}>
            {fromCache || data ? `Çevrimdışı veriler gösteriliyor — ${error}` : error}
          </Text>
        </View>
      ) : null}

      {layoutMode ? (
        <View style={styles.layoutBanner} testID="layout-banner">
          <Text style={styles.layoutBannerText}>Kartların sırasını ve boyunu ayarla</Text>
          <Pressable onPress={() => setLayoutMode(false)} testID="layout-done" accessibilityRole="button" style={styles.layoutDone}>
            <Icon name="check" size={15} strokeWidth={2.4} color={theme.color.bg} />
            <Text style={styles.layoutDoneText}>Bitti</Text>
          </Pressable>
        </View>
      ) : null}

      {order.map((section) => {
        const controls = layoutMode ? (
          <SectionControls
            title={section === 'summary' ? 'Günlük puan' : 'Bu hafta'}
            canUp={order.indexOf(section) > 0}
            canDown={order.indexOf(section) < order.length - 1}
            sizeLabel={
              section === 'summary'
                ? compactSummary
                  ? 'Kompakt'
                  : 'Normal'
                : weeklySize === 'hidden'
                  ? 'Gizli'
                  : weeklySize === 'tall'
                    ? 'Uzun'
                    : 'Normal'
            }
            onUp={() => moveSection(section, -1)}
            onDown={() => moveSection(section, 1)}
            onSize={() => (section === 'summary' ? changeSummarySize(!compactSummary) : cycleWeekly())}
          />
        ) : null;

        if (section === 'summary') {
          return (
            <View key="summary">
              {controls}
              <SummaryCard
                score={data?.score ?? 0}
                completed={data?.completed_count ?? 0}
                total={data?.module_count ?? 0}
                compact={compactSummary}
                onCompactChange={changeSummarySize}
              />
            </View>
          );
        }

        const showWeekly = weeklySize !== 'hidden' && !!week?.length;
        if (!layoutMode && !showWeekly) return null;
        return (
          <View key="weekly">
            {controls}
            {showWeekly ? (
              <WeeklyChart days={week!} tall={weeklySize === 'tall'} />
            ) : layoutMode ? (
              <View style={styles.hiddenCard}>
                <Text style={styles.hiddenText}>“Bu hafta” gizli — göstermek için Boyut’a bas</Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Uygulamalar</Text>
        <Pressable
          onPress={onOpenStore}
          testID="open-store"
          accessibilityRole="button"
          accessibilityLabel="Uygulama mağazasını aç"
          hitSlop={8}
          style={({ pressed }) => [styles.storeButton, pressed && styles.storePressed]}
        >
          <Icon name="store" size={15} strokeWidth={1.9} color={theme.color.accent} />
          <Text style={styles.storeText}>Mağaza</Text>
        </Pressable>
      </View>

      {modules.length === 0 ? (
        <Pressable onPress={onOpenStore} testID="empty-grid" style={styles.empty}>
          <Text style={styles.emptyTitle}>Hiç uygulama kurulu değil</Text>
          <Text style={styles.emptyText}>
            Takip etmek istediğin alanları mağazadan ekle.
          </Text>
        </Pressable>
      ) : (
        <DraggableGrid
          modules={modules}
          onOpen={onOpenModule}
          onQuickAdd={openQuickAdd}
          onReorder={saveOrder}
          activeKey={quickAdd?.key}
        />
      )}

      {/* Long-press keeps the common case — log today's value — on the home
          screen instead of costing a round trip into the module and back. */}
      {quickAdd ? (
        <View style={styles.quickAdd} testID="quick-add">
          <View style={styles.quickHead}>
            <Text style={styles.quickTitle}>{quickAdd.title}</Text>
            <Pressable
              onPress={() => setQuickAdd(null)}
              testID="quick-add-close"
              accessibilityRole="button"
              accessibilityLabel="Hızlı kaydı kapat"
              style={styles.quickClose}
            >
              <Text style={styles.quickCloseText}>Kapat</Text>
            </Pressable>
          </View>
          <Text style={styles.quickValue} testID="quick-add-value">
            {quickAdd.value} / {quickAdd.target} {quickAdd.unit}
          </Text>
          <StepPad module={quickAdd} onChange={quickChange} compact />
        </View>
      ) : null}
    </ScrollView>

    {menuOpen ? (
      <Pressable
        style={styles.menuBackdrop}
        testID="menu-backdrop"
        onPress={() => setMenuOpen(false)}
        accessibilityRole="button"
        accessibilityLabel="Menüyü kapat"
      >
        <View style={styles.menuCard}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuName} numberOfLines={1}>{user?.name ?? ''}</Text>
            {user?.email ? <Text style={styles.menuEmail} numberOfLines={1}>{user.email}</Text> : null}
          </View>
          {/* Güncelleme varsa en üstte; APK GitHub CDN'den iner, sistem kurar. */}
          {update ? (
            <Pressable
              onPress={startUpdate}
              testID="menu-update"
              accessibilityRole="button"
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            >
              <Icon name="download" size={18} strokeWidth={1.9} color={theme.color.accent} />
              <Text style={[styles.menuItemText, { color: theme.color.accent }]}>
                Güncelle · v{update.version}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              onOpenProfile();
            }}
            testID="menu-profile"
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <Icon name="user" size={18} strokeWidth={1.9} color={theme.color.text} />
            <Text style={styles.menuItemText}>Profilim</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              setLayoutMode(true);
            }}
            testID="menu-layout"
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <Icon name="layout" size={18} strokeWidth={1.9} color={theme.color.text} />
            <Text style={styles.menuItemText}>Düzeni değiştir</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMenuOpen(false);
              logout();
            }}
            testID="menu-logout"
            accessibilityRole="button"
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
          >
            <Icon name="logout" size={18} strokeWidth={1.9} color={theme.color.danger} />
            <Text style={styles.menuItemText}>Çıkış yap</Text>
          </Pressable>
        </View>
      </Pressable>
    ) : null}

    {updStage === 'done' && update ? (
      <UpdateSuccess
        version={update.version}
        onRestart={restartApp}
        onClose={cancelUpdate}
      />
    ) : null}
    </View>
  );
}

/** Düzen modunda bir kartın üstündeki kontrol çubuğu: yukarı/aşağı taşı + boyut. */
function SectionControls({
  title,
  canUp,
  canDown,
  sizeLabel,
  onUp,
  onDown,
  onSize,
}: {
  title: string;
  canUp: boolean;
  canDown: boolean;
  sizeLabel: string;
  onUp: () => void;
  onDown: () => void;
  onSize: () => void;
}) {
  return (
    <View style={styles.sectionControls}>
      <Text style={styles.sectionControlsTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.sectionControlsBtns}>
        <Pressable onPress={onSize} accessibilityRole="button" accessibilityLabel={`${title} boyutu: ${sizeLabel}`} style={styles.sizeBtn}>
          <Text style={styles.sizeBtnText}>{sizeLabel}</Text>
        </Pressable>
        <Pressable onPress={onUp} disabled={!canUp} accessibilityRole="button" accessibilityLabel="Yukarı taşı" style={[styles.moveBtn, !canUp && styles.moveBtnDisabled]}>
          <View style={styles.rotUp}>
            <Icon name="chevron-left" size={18} strokeWidth={2.2} color={canUp ? theme.color.text : theme.color.textFaint} />
          </View>
        </Pressable>
        <Pressable onPress={onDown} disabled={!canDown} accessibilityRole="button" accessibilityLabel="Aşağı taşı" style={[styles.moveBtn, !canDown && styles.moveBtnDisabled]}>
          <View style={styles.rotDown}>
            <Icon name="chevron-left" size={18} strokeWidth={2.2} color={canDown ? theme.color.text : theme.color.textFaint} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.color.bg },
  flexShrink: { flexShrink: 1 },
  layoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.accentSoft,
    borderRadius: theme.radius.md,
    paddingVertical: theme.space(2),
    paddingLeft: theme.space(4),
    paddingRight: theme.space(2),
    marginBottom: theme.space(3),
  },
  layoutBannerText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.accent, flexShrink: 1 },
  layoutDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(1),
    backgroundColor: theme.color.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space(3),
    minHeight: 34,
  },
  layoutDoneText: { fontSize: theme.font.label, fontWeight: '800', color: theme.color.bg },
  sectionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.color.cardRaised,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    marginBottom: -theme.space(2),
  },
  sectionControlsTitle: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.textMuted, flexShrink: 1 },
  sectionControlsBtns: { flexDirection: 'row', alignItems: 'center', gap: theme.space(2) },
  sizeBtn: {
    paddingHorizontal: theme.space(3),
    minHeight: 32,
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.card,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  sizeBtnText: { fontSize: theme.font.caption, fontWeight: '700', color: theme.color.text },
  moveBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.card,
  },
  moveBtnDisabled: { opacity: 0.4 },
  rotUp: { transform: [{ rotate: '90deg' }] },
  rotDown: { transform: [{ rotate: '-90deg' }] },
  hiddenCard: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderStyle: 'dashed',
    padding: theme.space(5),
    alignItems: 'center',
  },
  hiddenText: { fontSize: theme.font.label, color: theme.color.textMuted },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.bg,
  },
  content: {
    padding: theme.space(5),
    paddingBottom: theme.space(10),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space(5),
  },
  greeting: {
    fontSize: theme.font.title,
    fontWeight: '700',
    color: theme.color.text,
    letterSpacing: -0.4,
  },
  date: {
    marginTop: 2,
    fontSize: theme.font.label,
    color: theme.color.textMuted,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.card,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  menuBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: theme.color.success,
    borderWidth: 1.5,
    borderColor: theme.color.bg,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'flex-end',
    paddingTop: theme.space(4),
    paddingHorizontal: theme.space(5),
    zIndex: 50,
  },
  menuCard: {
    minWidth: 200,
    maxWidth: 280,
    backgroundColor: theme.color.cardRaised,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.color.border,
    overflow: 'hidden',
  },
  menuHeader: {
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  menuName: { fontSize: theme.font.body, fontWeight: '700', color: theme.color.text },
  menuEmail: { marginTop: 2, fontSize: theme.font.caption, color: theme.color.textMuted },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingHorizontal: theme.space(4),
    minHeight: 48,
  },
  menuItemPressed: { backgroundColor: theme.color.card },
  menuItemText: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text },
  banner: {
    backgroundColor: theme.color.warnBg,
    borderRadius: theme.radius.sm,
    padding: theme.space(3),
    marginBottom: theme.space(4),
  },
  bannerText: {
    fontSize: theme.font.caption,
    color: theme.color.warnText,
    fontWeight: '600',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.space(8),
    marginBottom: theme.space(5),
  },
  sectionTitle: {
    fontSize: theme.font.heading,
    fontWeight: '700',
    color: theme.color.text,
  },
  storeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(1),
    height: 34,
    paddingHorizontal: theme.space(3),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.accentSoft,
  },
  storePressed: { opacity: 0.7 },
  storeText: {
    fontSize: theme.font.caption,
    fontWeight: '700',
    color: theme.color.accent,
  },
  empty: {
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    padding: theme.space(6),
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: theme.font.body,
    fontWeight: '700',
    color: theme.color.text,
  },
  emptyText: {
    marginTop: theme.space(2),
    fontSize: theme.font.label,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
  quickAdd: {
    marginTop: theme.space(6),
    backgroundColor: theme.color.card,
    borderRadius: theme.radius.lg,
    padding: theme.space(5),
  },
  quickHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickTitle: {
    fontSize: theme.font.heading,
    fontWeight: '700',
    color: theme.color.text,
  },
  quickClose: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.space(3),
  },
  quickCloseText: {
    fontSize: theme.font.label,
    fontWeight: '700',
    color: theme.color.accent,
  },
  quickValue: {
    marginTop: theme.space(1),
    fontSize: theme.font.label,
    color: theme.color.textMuted,
    ...tabularNums,
  },
});

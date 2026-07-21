import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Icon, type IconName } from '../Icon';
import { FoodBarcodeScanner } from './FoodBarcodeScanner';
import { MealCameraCapture } from './MealCameraCapture';
import { apiRequest } from '../../lib/api';
import { onColor, tabularNums, theme } from '../../theme';
import type { Food, MealType, PhotoEstimate } from '../../types';

const IS_WEB = Platform.OS === 'web';

type Tab = 'arama' | 'barkod' | 'foto' | 'elle';

const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'arama', label: 'Ara', icon: 'search' },
  { key: 'barkod', label: 'Barkod', icon: 'barcode' },
  { key: 'foto', label: 'Fotoğraf', icon: 'camera' },
  { key: 'elle', label: 'Elle', icon: 'pen' },
];

function num(value: string): number | null {
  const n = Number(value.replace(',', '.').trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 100 g başına değerleri porsiyona ölçekler. */
function scale(food: Food, qtyG: number) {
  const f = qtyG / 100;
  return {
    kcal: Math.round(food.kcal * f),
    protein_g: Math.round(food.protein_g * f * 10) / 10,
    carb_g: Math.round(food.carb_g * f * 10) / 10,
    fat_g: Math.round(food.fat_g * f * 10) / 10,
  };
}

/** Web'de dosya seçtirip data URL döndürür; native/desteksizse null. */
function pickImageWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export function AddFoodSheet({
  color,
  token,
  date,
  mealTypes,
  llmAvailable,
  onClose,
  onSaved,
}: {
  color: string;
  token: string | null;
  date: string;
  mealTypes: { key: MealType; label: string }[];
  llmAvailable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mealType, setMealType] = useState<MealType>('kahvalti');
  const [tab, setTab] = useState<Tab>('arama');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const postItems = useCallback(
    async (items: Record<string, unknown>[]) => {
      setBusy(true);
      setError(null);
      try {
        await apiRequest(`/api/yemek/meals?date=${date}`, {
          method: 'POST',
          body: { meal_type: mealType, items },
          token,
        });
        onSaved();
        onClose();
      } catch (err) {
        setError((err as Error)?.message ?? 'Eklenemedi');
      } finally {
        setBusy(false);
      }
    },
    [date, mealType, onClose, onSaved, token],
  );

  return (
    <View style={styles.overlay} testID="add-food-sheet">
      <View style={styles.header}>
        <Text style={styles.title}>Yemek ekle</Text>
        <Pressable onPress={onClose} testID="add-close" accessibilityRole="button" style={styles.close}>
          <Text style={styles.closeText}>Kapat</Text>
        </Pressable>
      </View>

      {/* Öğün türü — tüm sekmelerde ortak */}
      <View style={styles.mealTypeRow}>
        {mealTypes.map((m) => {
          const active = mealType === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMealType(m.key)}
              testID={`meal-type-${m.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.mealTypeChip, active ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border }]}
            >
              <Text style={[styles.mealTypeText, active && { color: onColor(color) }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Sekmeler */}
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                setTab(t.key);
                setError(null);
              }}
              testID={`tab-${t.key}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && { borderBottomColor: color }]}
            >
              <Icon name={t.icon} size={18} color={active ? color : theme.color.textMuted} />
              <Text style={[styles.tabText, active && { color }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {tab === 'arama' ? (
          <SearchTab color={color} token={token} busy={busy} onAdd={postItems} />
        ) : tab === 'barkod' ? (
          <BarcodeTab color={color} token={token} busy={busy} onAdd={postItems} />
        ) : tab === 'foto' ? (
          <PhotoTab color={color} token={token} busy={busy} llmAvailable={llmAvailable} onAdd={postItems} />
        ) : (
          <ManualTab color={color} busy={busy} onAdd={postItems} />
        )}
        {error ? (
          <Text style={styles.error} testID="add-error">
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ Arama
function SearchTab({
  color,
  token,
  busy,
  onAdd,
}: {
  color: string;
  token: string | null;
  busy: boolean;
  onAdd: (items: Record<string, unknown>[]) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Food | null>(null);
  const [qty, setQty] = useState('');

  const run = useCallback(async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await apiRequest<{ foods: Food[] }>(
        `/api/yemek/foods/search?q=${encodeURIComponent(q.trim())}`,
        { token },
      );
      setResults(res.foods);
    } finally {
      setSearching(false);
    }
  }, [q, token]);

  if (selected) {
    return (
      <PortionConfirm
        color={color}
        food={selected}
        qty={qty}
        setQty={setQty}
        busy={busy}
        onBack={() => setSelected(null)}
        onAdd={onAdd}
      />
    );
  }

  return (
    <>
      <View style={styles.searchRow}>
        <TextInput
          value={q}
          onChangeText={setQ}
          onSubmitEditing={run}
          placeholder="örn. mercimek çorbası, yoğurt…"
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.flex1]}
          returnKeyType="search"
          testID="search-input"
        />
        <Pressable onPress={run} testID="search-go" accessibilityRole="button" style={[styles.goBtn, { backgroundColor: color }]}>
          <Icon name="search" size={18} color={onColor(color)} />
        </Pressable>
      </View>
      {searching ? (
        <ActivityIndicator color={color} style={styles.pad} />
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {results?.length === 0 ? (
            <Text style={styles.emptyText}>Sonuç yok. Elle ekleyebilirsin.</Text>
          ) : (
            results?.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => {
                  setSelected(f);
                  setQty(String(f.default_serving_g ?? 100));
                }}
                testID={`food-${f.key}`}
                style={styles.resultRow}
              >
                <View style={styles.flex1}>
                  <Text style={styles.resultName}>{f.name}</Text>
                  <Text style={styles.resultSub}>
                    {f.kcal} kcal / 100 g · P{f.protein_g} K{f.carb_g} Y{f.fat_g}
                  </Text>
                </View>
                <Icon name="plus" size={18} color={color} />
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Barkod
function BarcodeTab({
  color,
  token,
  busy,
  onAdd,
}: {
  color: string;
  token: string | null;
  busy: boolean;
  onAdd: (items: Record<string, unknown>[]) => void;
}) {
  const [code, setCode] = useState('');
  const [looking, setLooking] = useState(false);
  const [product, setProduct] = useState<Food | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [qty, setQty] = useState('');
  const [scanning, setScanning] = useState(false);

  const lookup = useCallback(
    async (codeArg?: string) => {
      const digits = (codeArg ?? code).trim();
      if (!digits) return;
      setLooking(true);
      setNotFound(false);
      try {
        const res = await apiRequest<{ found: boolean; food: Food }>(
          `/api/yemek/foods/barcode/${encodeURIComponent(digits)}`,
          { token },
        );
        setProduct(res.food);
        setQty(String(res.food.default_serving_g ?? 100));
      } catch {
        setNotFound(true);
        setProduct(null);
      } finally {
        setLooking(false);
      }
    },
    [code, token],
  );

  if (product) {
    return (
      <PortionConfirm color={color} food={product} qty={qty} setQty={setQty} busy={busy} onBack={() => setProduct(null)} onAdd={onAdd} />
    );
  }

  return (
    <>
      <Text style={styles.hintText}>Paketli ürünün barkodunu kameradan tara ya da numarayı elle gir (Open Food Facts'te aranır).</Text>
      {/* Kameradan tarama — native'de canlı; web'de tarayıcı "desteklenmiyor" der. */}
      <Pressable onPress={() => setScanning(true)} testID="barcode-scan" accessibilityRole="button" style={[styles.scanBtn, { borderColor: color }]}>
        <Icon name="barcode" size={18} color={color} />
        <Text style={[styles.scanBtnText, { color }]}>Kameradan tara</Text>
      </Pressable>
      <View style={styles.searchRow}>
        <TextInput
          value={code}
          onChangeText={setCode}
          onSubmitEditing={() => lookup()}
          keyboardType="number-pad"
          placeholder="örn. 8699999000024"
          placeholderTextColor={theme.color.textFaint}
          style={[styles.input, styles.flex1]}
          testID="barcode-input"
        />
        <Pressable onPress={() => lookup()} testID="barcode-go" accessibilityRole="button" style={[styles.goBtn, { backgroundColor: color }]}>
          <Icon name="search" size={18} color={onColor(color)} />
        </Pressable>
      </View>
      {looking ? <ActivityIndicator color={color} style={styles.pad} /> : null}
      {notFound ? (
        <Text style={styles.emptyText} testID="barcode-notfound">
          Ürün bulunamadı. Arama ya da elle ekleyebilirsin.
        </Text>
      ) : null}
      {scanning ? (
        <FoodBarcodeScanner
          color={color}
          onClose={() => setScanning(false)}
          onScanned={(c) => {
            setScanning(false);
            setCode(c);
            void lookup(c);
          }}
        />
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------ Fotoğraf
function PhotoTab({
  color,
  token,
  busy,
  llmAvailable,
  onAdd,
}: {
  color: string;
  token: string | null;
  busy: boolean;
  llmAvailable: boolean;
  onAdd: (items: Record<string, unknown>[]) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [draft, setDraft] = useState<PhotoEstimate | null>(null);
  const [items, setItems] = useState<{ name: string; qty_g: string; kcal: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const runEstimate = useCallback(
    async (dataUrl: string) => {
      setEstimating(true);
      setMsg(null);
      try {
        const res = await apiRequest<PhotoEstimate>('/api/yemek/meals/estimate', {
          method: 'POST',
          body: { consent: true, image_base64: dataUrl },
          token,
        });
        setDraft(res);
        setItems(res.items.map((it) => ({ name: it.name, qty_g: String(it.qty_g), kcal: String(Math.round(it.kcal)) })));
      } catch (err) {
        setMsg((err as Error)?.message ?? 'Tahmin yapılamadı.');
      } finally {
        setEstimating(false);
      }
    },
    [token],
  );

  // Web: dosya seçici. Native: canlı kamera (MealCameraCapture).
  const start = useCallback(async () => {
    setMsg(null);
    if (!consent) {
      setMsg('Devam etmek için onay kutusunu işaretle.');
      return;
    }
    if (IS_WEB) {
      const dataUrl = await pickImageWeb();
      if (!dataUrl) {
        setMsg('Görüntü seçilmedi.');
        return;
      }
      await runEstimate(dataUrl);
    } else {
      setCapturing(true);
    }
  }, [consent, runEstimate]);

  const confirm = useCallback(() => {
    const payload = items
      .map((it, i) => {
        const qty = num(it.qty_g) ?? 0;
        const kcal = num(it.kcal) ?? 0;
        const src = draft?.items[i];
        return {
          name: it.name.trim() || 'Yemek',
          qty_g: qty > 0 ? qty : 1,
          kcal,
          protein_g: src?.protein_g ?? 0,
          carb_g: src?.carb_g ?? 0,
          fat_g: src?.fat_g ?? 0,
          source: 'vision_llm',
          estimated: true,
          confidence: src?.confidence ?? draft?.confidence ?? null,
        } as Record<string, unknown>;
      })
      .filter((it) => (it.kcal as number) > 0);
    if (payload.length) onAdd(payload);
  }, [draft, items, onAdd]);

  if (!llmAvailable) {
    return (
      <Text style={styles.emptyText} testID="photo-unavailable">
        Fotoğraftan kalori tahmini şu an kullanılamıyor. Arama, barkod veya elle giriş kullanabilirsin.
      </Text>
    );
  }

  if (draft) {
    return (
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        <View style={[styles.estimateBanner, { borderColor: color }]}>
          <Text style={[styles.estimateTitle, { color }]}>
            ≈ {draft.range_kcal[0]}–{draft.range_kcal[1]} kcal (tahmini)
          </Text>
          <Text style={styles.hintText}>{draft.note} Değerleri düzeltip onayla.</Text>
        </View>
        {items.map((it, i) => (
          <View key={i} style={styles.draftRow}>
            <TextInput
              value={it.name}
              onChangeText={(v) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, name: v } : x)))}
              style={[styles.input, styles.flex1]}
              placeholderTextColor={theme.color.textFaint}
              testID={`draft-name-${i}`}
            />
            <TextInput
              value={it.qty_g}
              onChangeText={(v) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, qty_g: v } : x)))}
              keyboardType="decimal-pad"
              style={[styles.input, styles.qtyInput]}
              testID={`draft-qty-${i}`}
            />
            <TextInput
              value={it.kcal}
              onChangeText={(v) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, kcal: v } : x)))}
              keyboardType="decimal-pad"
              style={[styles.input, styles.qtyInput]}
              testID={`draft-kcal-${i}`}
            />
          </View>
        ))}
        <Pressable
          onPress={confirm}
          disabled={busy}
          testID="photo-confirm"
          accessibilityRole="button"
          style={[styles.primaryBtn, { backgroundColor: color }, busy && { opacity: 0.6 }]}
        >
          <Text style={[styles.primaryBtnText, { color: onColor(color) }]}>Onayla ve kaydet</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <View>
      <Text style={styles.hintText}>
        Öğün fotoğrafından yaklaşık kalori/porsiyon tahmini yapılır. Bu bir TAHMİNDİR; kesin değildir ve
        her zaman düzeltilebilir.
      </Text>
      <Pressable
        onPress={() => setConsent((c) => !c)}
        testID="photo-consent"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        style={styles.consentRow}
      >
        <View style={[styles.checkbox, consent && { backgroundColor: color, borderColor: color }]}>
          {consent ? <Icon name="check" size={14} strokeWidth={2.6} color={onColor(color)} /> : null}
        </View>
        <Text style={styles.consentText}>
          Fotoğrafın işlenmek üzere buluttaki bir modele gönderilmesini onaylıyorum. Fotoğraf saklanmaz
          (yalnızca tahmin sonucu tutulur); konum/EXIF paylaşılmaz.
        </Text>
      </Pressable>
      {estimating ? (
        <ActivityIndicator color={color} style={styles.pad} />
      ) : (
        <Pressable
          onPress={start}
          testID="photo-pick"
          accessibilityRole="button"
          style={[styles.primaryBtn, { backgroundColor: consent ? color : theme.color.card }]}
        >
          <Icon name="camera" size={18} color={consent ? onColor(color) : theme.color.textMuted} />
          <Text style={[styles.primaryBtnText, { color: consent ? onColor(color) : theme.color.textMuted }]}>
            {IS_WEB ? 'Fotoğraf seç' : 'Fotoğraf çek'}
          </Text>
        </Pressable>
      )}
      {msg ? (
        <Text style={styles.emptyText} testID="photo-msg">
          {msg}
        </Text>
      ) : null}
      {capturing ? (
        <MealCameraCapture
          color={color}
          onClose={() => setCapturing(false)}
          onCaptured={(dataUrl) => {
            setCapturing(false);
            void runEstimate(dataUrl);
          }}
        />
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ Elle
function ManualTab({
  color,
  busy,
  onAdd,
}: {
  color: string;
  busy: boolean;
  onAdd: (items: Record<string, unknown>[]) => void;
}) {
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carb, setCarb] = useState('');
  const [fat, setFat] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const add = () => {
    setErr(null);
    const k = num(kcal);
    if (!name.trim() || k === null) {
      setErr('En az yemek adı ve kalori gir.');
      return;
    }
    onAdd([
      {
        name: name.trim(),
        qty_g: num(qty) || 1,
        kcal: k,
        protein_g: num(protein) ?? 0,
        carb_g: num(carb) ?? 0,
        fat_g: num(fat) ?? 0,
        source: 'manual',
      },
    ]);
  };

  return (
    <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Yemek adı"
        placeholderTextColor={theme.color.textFaint}
        style={[styles.input, styles.mb]}
        testID="manual-name"
      />
      <View style={styles.searchRow}>
        <LabeledInput label="Porsiyon (g)" value={qty} onChange={setQty} placeholder="200" testID="manual-qty" />
        <LabeledInput label="Kalori" value={kcal} onChange={setKcal} placeholder="300" testID="manual-kcal" />
      </View>
      <View style={styles.searchRow}>
        <LabeledInput label="Protein (g)" value={protein} onChange={setProtein} placeholder="0" testID="manual-protein" />
        <LabeledInput label="Karb (g)" value={carb} onChange={setCarb} placeholder="0" testID="manual-carb" />
        <LabeledInput label="Yağ (g)" value={fat} onChange={setFat} placeholder="0" testID="manual-fat" />
      </View>
      {err ? <Text style={styles.error}>{err}</Text> : null}
      <Pressable
        onPress={add}
        disabled={busy}
        testID="manual-add"
        accessibilityRole="button"
        style={[styles.primaryBtn, { backgroundColor: color }, busy && { opacity: 0.6 }]}
      >
        <Text style={[styles.primaryBtnText, { color: onColor(color) }]}>Ekle</Text>
      </Pressable>
    </ScrollView>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  testID: string;
}) {
  return (
    <View style={styles.flex1}>
      <Text style={styles.miniLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={theme.color.textFaint}
        style={styles.input}
        testID={testID}
      />
    </View>
  );
}

// Ortak: seçilen besin için porsiyon onayı.
function PortionConfirm({
  color,
  food,
  qty,
  setQty,
  busy,
  onBack,
  onAdd,
}: {
  color: string;
  food: Food;
  qty: string;
  setQty: (v: string) => void;
  busy: boolean;
  onBack: () => void;
  onAdd: (items: Record<string, unknown>[]) => void;
}) {
  const qtyNum = num(qty) || 0;
  const scaled = useMemo(() => scale(food, qtyNum), [food, qtyNum]);

  const add = () => {
    onAdd([
      {
        name: food.name,
        brand: food.brand ?? null,
        barcode: food.barcode ?? null,
        qty_g: qtyNum > 0 ? qtyNum : 1,
        kcal: scaled.kcal,
        protein_g: scaled.protein_g,
        carb_g: scaled.carb_g,
        fat_g: scaled.fat_g,
        source: food.source,
        source_ref: food.source_ref ?? null,
      },
    ]);
  };

  return (
    <View>
      <Pressable onPress={onBack} testID="portion-back" accessibilityRole="button" style={styles.backLink}>
        <Icon name="chevron-left" size={18} color={theme.color.textMuted} />
        <Text style={styles.backLinkText}>Geri</Text>
      </Pressable>
      <Text style={styles.confirmName}>{food.name}</Text>
      {food.brand ? <Text style={styles.hintText}>{food.brand}</Text> : null}

      <View style={styles.portionRow}>
        {[0.5, 1, 2].map((mult) => {
          const base = food.default_serving_g ?? 100;
          return (
            <Pressable
              key={mult}
              onPress={() => setQty(String(Math.round(base * mult)))}
              testID={`portion-${mult}`}
              style={[styles.portionChip, { borderColor: color }]}
            >
              <Text style={[styles.portionChipText, { color }]}>{mult === 0.5 ? '½' : `${mult}x`}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.miniLabel}>Miktar (gram)</Text>
      <TextInput
        value={qty}
        onChangeText={setQty}
        keyboardType="decimal-pad"
        placeholder="100"
        placeholderTextColor={theme.color.textFaint}
        style={[styles.input, styles.mb]}
        testID="portion-qty"
      />

      <View style={styles.macroPreview}>
        <Text style={[styles.macroKcal, { color }]} testID="portion-kcal">
          {scaled.kcal} kcal
        </Text>
        <Text style={styles.macroSub}>
          P {scaled.protein_g} · K {scaled.carb_g} · Y {scaled.fat_g} g
        </Text>
      </View>

      <Pressable
        onPress={add}
        disabled={busy}
        testID="portion-add"
        accessibilityRole="button"
        style={[styles.primaryBtn, { backgroundColor: color }, busy && { opacity: 0.6 }]}
      >
        <Text style={[styles.primaryBtnText, { color: onColor(color) }]}>Öğüne ekle</Text>
      </Pressable>
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
    zIndex: 40,
    paddingTop: theme.space(3),
    paddingHorizontal: theme.space(5),
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space(3) },
  title: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text },
  close: { minHeight: 44, justifyContent: 'center', paddingLeft: theme.space(3) },
  closeText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.accent },
  mealTypeRow: { flexDirection: 'row', gap: theme.space(2), marginBottom: theme.space(3) },
  mealTypeChip: { flex: 1, minHeight: 38, borderRadius: theme.radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mealTypeText: { fontSize: theme.font.caption, fontWeight: '700', color: theme.color.text },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.color.border, marginBottom: theme.space(4) },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(1),
    paddingVertical: theme.space(3),
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.textMuted },
  body: { flex: 1 },
  searchRow: { flexDirection: 'row', gap: theme.space(2), alignItems: 'flex-end' },
  flex1: { flex: 1 },
  mb: { marginBottom: theme.space(3) },
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
  qtyInput: { width: 88, textAlign: 'center', paddingHorizontal: theme.space(2) },
  goBtn: { width: 50, height: 50, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    minHeight: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginBottom: theme.space(3),
  },
  scanBtnText: { fontSize: theme.font.label, fontWeight: '800' },
  list: { flex: 1, marginTop: theme.space(3) },
  pad: { paddingVertical: theme.space(5) },
  emptyText: { fontSize: theme.font.label, color: theme.color.textMuted, textAlign: 'center', paddingVertical: theme.space(5), lineHeight: 20 },
  hintText: { fontSize: theme.font.caption, color: theme.color.textMuted, lineHeight: 18, marginBottom: theme.space(3) },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    paddingVertical: theme.space(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  resultName: { fontSize: theme.font.body, fontWeight: '600', color: theme.color.text },
  resultSub: { marginTop: 2, fontSize: theme.font.caption, color: theme.color.textMuted, ...tabularNums },
  backLink: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  backLinkText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.textMuted },
  confirmName: { fontSize: theme.font.heading, fontWeight: '800', color: theme.color.text, marginTop: theme.space(1) },
  portionRow: { flexDirection: 'row', gap: theme.space(2), marginVertical: theme.space(3) },
  portionChip: { flex: 1, minHeight: 40, borderRadius: theme.radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  portionChipText: { fontSize: theme.font.label, fontWeight: '800' },
  miniLabel: { fontSize: theme.font.caption, fontWeight: '700', color: theme.color.textMuted, marginBottom: theme.space(1) },
  macroPreview: { alignItems: 'center', paddingVertical: theme.space(3) },
  macroKcal: { fontSize: theme.font.title, fontWeight: '800', ...tabularNums },
  macroSub: { marginTop: 2, fontSize: theme.font.label, color: theme.color.textMuted, ...tabularNums },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space(2),
    minHeight: 52,
    borderRadius: theme.radius.md,
    marginTop: theme.space(3),
  },
  primaryBtnText: { fontSize: theme.font.body, fontWeight: '800' },
  consentRow: { flexDirection: 'row', gap: theme.space(3), alignItems: 'flex-start', marginBottom: theme.space(4) },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  consentText: { flex: 1, fontSize: theme.font.caption, color: theme.color.textMuted, lineHeight: 18 },
  estimateBanner: { borderWidth: 1, borderRadius: theme.radius.md, padding: theme.space(3), marginBottom: theme.space(3) },
  estimateTitle: { fontSize: theme.font.heading, fontWeight: '800', marginBottom: theme.space(1), ...tabularNums },
  draftRow: { flexDirection: 'row', gap: theme.space(2), marginBottom: theme.space(2) },
  error: { fontSize: theme.font.label, color: theme.color.danger, fontWeight: '600', marginTop: theme.space(3), textAlign: 'center' },
});

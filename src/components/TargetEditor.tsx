import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { onColor, tabularNums, theme } from '../theme';
import type { ModuleProgress } from '../types';

const NUMBER_FORMAT = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

function formatValue(value: number): string {
  return NUMBER_FORMAT.format(value);
}

// Düzenleme alanı ham sayı ister: "8.000" tekrar ayrıştırılamaz.
function rawValue(value: number): string {
  return String(value);
}

type Props = {
  module: ModuleProgress;
  onSave: (target: number) => Promise<void>;
  onReset: () => Promise<void>;
};

export function TargetEditor({ module, onSave, onReset }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(rawValue(module.target));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setDraft(rawValue(module.target));
    setError(null);
    setEditing(true);
  }

  async function save() {
    // Accept both "7,5" and "7.5" — Turkish keyboards produce the comma.
    const parsed = Number(draft.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Hedef sıfırdan büyük bir sayı olmalı');
      return;
    }
    // Matches the server's ceiling, so the user is not told in English.
    if (parsed > 1_000_000) {
      setError('Hedef çok büyük');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSave(parsed);
      setEditing(false);
    } catch (err) {
      setError((err as Error)?.message ?? 'Hedef kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await onReset();
      setEditing(false);
    } catch (err) {
      setError((err as Error)?.message ?? 'Hedef sıfırlanamadı');
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <Pressable
        onPress={open}
        testID="edit-target"
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View>
          <Text style={styles.rowLabel}>GÜNLÜK HEDEF</Text>
          <Text style={styles.rowValue} testID="target-value">
            {formatValue(module.target)} {module.unit}
            {module.is_custom_target ? <Text style={styles.custom}> · kendi hedefin</Text> : null}
          </Text>
        </View>
        <Text style={styles.edit}>Değiştir</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.editor} testID="target-editor">
      <Text style={styles.rowLabel}>GÜNLÜK HEDEF ({module.unit})</Text>

      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          keyboardType="numeric"
          autoFocus
          selectTextOnFocus
          testID="target-input"
          accessibilityLabel={`Günlük hedef, ${module.unit}`}
          style={styles.input}
          placeholderTextColor={theme.color.textFaint}
          onSubmitEditing={save}
        />
      </View>

      {error ? (
        <Text style={styles.error} testID="target-error" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => setEditing(false)}
          disabled={busy}
          testID="target-cancel"
          accessibilityRole="button"
          accessibilityLabel="İptal"
          style={({ pressed }) => [styles.button, styles.ghost, pressed && styles.pressed]}
        >
          <Text style={styles.ghostLabel}>İptal</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={busy}
          testID="target-save"
          accessibilityRole="button"
          accessibilityLabel="Hedefi kaydet"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: module.color },
            pressed && styles.pressed,
            busy && styles.busy,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={onColor(module.color)} />
          ) : (
            <Text style={[styles.saveLabel, { color: onColor(module.color) }]}>Kaydet</Text>
          )}
        </Pressable>
      </View>

      {module.is_custom_target ? (
        <Pressable onPress={reset} disabled={busy} testID="target-reset"
          accessibilityRole="button"
          accessibilityLabel="Varsayılan hedefe dön" style={styles.resetRow}>
          <Text style={styles.resetText}>
            Varsayılana dön ({formatValue(module.default_target)} {module.unit})
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: theme.space(5),
    paddingTop: theme.space(4),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  pressed: { opacity: 0.7 },
  rowLabel: {
    fontSize: theme.font.tiny,
    fontWeight: '800',
    color: theme.color.textFaint,
    letterSpacing: 0.8,
  },
  rowValue: {
    marginTop: 3,
    fontSize: theme.font.body,
    fontWeight: '700',
    color: theme.color.text,
  },
  custom: {
    fontSize: theme.font.tiny,
    fontWeight: '600',
    color: theme.color.accent,
  },
  edit: {
    fontSize: theme.font.label,
    fontWeight: '700',
    color: theme.color.accent,
  },
  editor: {
    alignSelf: 'stretch',
    marginTop: theme.space(5),
    paddingTop: theme.space(4),
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space(3),
    marginTop: theme.space(2),
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.cardRaised,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    fontSize: theme.font.title,
    fontWeight: '800',
    color: theme.color.text,
    ...tabularNums,
  },
  error: {
    marginTop: theme.space(2),
    fontSize: theme.font.label,
    fontWeight: '600',
    color: theme.color.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.space(3),
    marginTop: theme.space(4),
  },
  button: {
    flex: 1,
    paddingVertical: theme.space(3.5),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  busy: { opacity: 0.75 },
  ghostLabel: {
    fontSize: theme.font.body,
    fontWeight: '700',
    color: theme.color.text,
  },
  saveLabel: {
    fontSize: theme.font.body,
    fontWeight: '800',
    color: theme.color.text,
  },
  resetRow: {
    marginTop: theme.space(3),
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetText: {
    fontSize: theme.font.label,
    fontWeight: '600',
    color: theme.color.textMuted,
    textDecorationLine: 'underline',
  },
});

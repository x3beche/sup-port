import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme';
import type { ModuleProgress } from '../types';

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

type Props = {
  module: ModuleProgress;
  onSave: (target: number) => Promise<void>;
  onReset: () => Promise<void>;
};

export function TargetEditor({ module, onSave, onReset }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(module.target));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setDraft(formatValue(module.target));
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
      <Text style={styles.rowLabel}>GÜNLÜK HEDEF</Text>

      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          keyboardType="numeric"
          autoFocus
          selectTextOnFocus
          testID="target-input"
          style={styles.input}
          placeholderTextColor={theme.color.textFaint}
          onSubmitEditing={save}
        />
        <Text style={styles.unit}>{module.unit}</Text>
      </View>

      {error ? (
        <Text style={styles.error} testID="target-error">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => setEditing(false)}
          disabled={busy}
          testID="target-cancel"
          style={({ pressed }) => [styles.button, styles.ghost, pressed && styles.pressed]}
        >
          <Text style={styles.ghostLabel}>İptal</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={busy}
          testID="target-save"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: module.color },
            pressed && styles.pressed,
            busy && styles.busy,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={theme.color.onAccent} />
          ) : (
            <Text style={styles.saveLabel}>Kaydet</Text>
          )}
        </Pressable>
      </View>

      {module.is_custom_target ? (
        <Pressable onPress={reset} disabled={busy} testID="target-reset" style={styles.resetRow}>
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
    backgroundColor: theme.color.inputBg,
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
    fontSize: theme.font.title,
    fontWeight: '800',
    color: theme.color.text,
  },
  unit: {
    fontSize: theme.font.body,
    fontWeight: '600',
    color: theme.color.textMuted,
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
    color: theme.color.onAccent,
  },
  resetRow: {
    marginTop: theme.space(3),
    alignItems: 'center',
  },
  resetText: {
    fontSize: theme.font.label,
    fontWeight: '600',
    color: theme.color.textMuted,
    textDecorationLine: 'underline',
  },
});

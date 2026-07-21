import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiRequest } from '../../lib/api';
import { onColor, theme } from '../../theme';
import type { SporProfile } from '../../types';

/**
 * PAR-Q+ temelli kısa güvenlik taraması. Herhangi bir "evet" hekime danışma
 * işareti koyar; kullanım engellenmez. Kaynak: rapor Başlık 4 (Riebe 2015).
 */
export function ParqSheet({
  color,
  token,
  questions,
  onClose,
  onSaved,
}: {
  color: string;
  token: string | null;
  questions: string[];
  onClose: () => void;
  onSaved: (profile: SporProfile) => void;
}) {
  const [answers, setAnswers] = useState<boolean[]>(() => questions.map(() => false));
  const [busy, setBusy] = useState(false);

  const setAnswer = (i: number, value: boolean) => {
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? value : a)));
  };

  const submit = async () => {
    setBusy(true);
    try {
      const profile = await apiRequest<SporProfile>('/api/spor/parq', {
        method: 'POST',
        body: { answers },
        token,
      });
      onSaved(profile);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.overlay} testID="parq-sheet">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Güvenlik taraması</Text>
          <Pressable onPress={onClose} testID="parq-close" accessibilityRole="button" style={styles.close}>
            <Text style={styles.closeText}>Kapat</Text>
          </Pressable>
        </View>
        <Text style={styles.intro}>
          Başlamadan önce kısa bir ön tarama. Herhangi birine "Evet" dersen egzersize
          başlamadan önce bir sağlık uzmanına danışman önerilir.
        </Text>

        {questions.map((q, i) => (
          <View key={i} style={styles.q} testID={`parq-q-${i}`}>
            <Text style={styles.qText}>{q}</Text>
            <View style={styles.yesno}>
              <Pressable
                onPress={() => setAnswer(i, false)}
                testID={`parq-${i}-no`}
                accessibilityRole="button"
                accessibilityState={{ selected: !answers[i] }}
                style={[styles.option, !answers[i] ? { backgroundColor: color, borderColor: color } : { borderColor: theme.color.border }]}
              >
                <Text style={[styles.optionText, !answers[i] && { color: onColor(color) }]}>Hayır</Text>
              </Pressable>
              <Pressable
                onPress={() => setAnswer(i, true)}
                testID={`parq-${i}-yes`}
                accessibilityRole="button"
                accessibilityState={{ selected: answers[i] }}
                style={[styles.option, answers[i] ? { backgroundColor: theme.color.warnText, borderColor: theme.color.warnText } : { borderColor: theme.color.border }]}
              >
                <Text style={[styles.optionText, answers[i] && { color: '#000' }]}>Evet</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Pressable
        onPress={submit}
        disabled={busy}
        testID="parq-save"
        accessibilityRole="button"
        style={[styles.saveBar, { backgroundColor: color }, busy && { opacity: 0.6 }]}
      >
        <Text style={[styles.saveText, { color: onColor(color) }]}>{busy ? 'Kaydediliyor…' : 'Taramayı tamamla'}</Text>
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
    zIndex: 30,
    paddingTop: theme.space(3),
  },
  content: { paddingHorizontal: theme.space(5), paddingBottom: theme.space(6) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space(3) },
  title: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text },
  close: { minHeight: 44, justifyContent: 'center', paddingLeft: theme.space(3) },
  closeText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.accent },
  intro: { fontSize: theme.font.label, color: theme.color.textMuted, lineHeight: 20, marginBottom: theme.space(4) },
  q: { marginBottom: theme.space(4) },
  qText: { fontSize: theme.font.label, color: theme.color.text, lineHeight: 20, marginBottom: theme.space(2) },
  yesno: { flexDirection: 'row', gap: theme.space(2) },
  option: {
    flex: 1,
    minHeight: 46,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.text },
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

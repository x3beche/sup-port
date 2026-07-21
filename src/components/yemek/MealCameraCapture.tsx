import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useBackHandler } from '../../lib/backHandler';
import { onColor, theme } from '../../theme';
import { Icon } from '../Icon';

/**
 * Öğün fotoğrafı çekimi (expo-camera CameraView.takePictureAsync). base64 JPEG
 * döner; çağıran taraf onu tahmin ucuna gönderir. Fotoğraf CİHAZDA çekilir ve
 * yalnızca kullanıcı onaylı tahmin için sunucuya iletilir — burada saklanmaz.
 *
 * Kalite düşük tutulur (base64 boyutu + yükleme süresi için yeterli). Web'de
 * canlı çekim güvenilir değil → PhotoTab web'de dosya seçiciyi kullanır, bu
 * bileşen yalnızca native'de açılır.
 */
export function MealCameraCapture({
  color,
  onCaptured,
  onClose,
}: {
  color: string;
  onCaptured: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  useBackHandler(() => {
    onClose();
    return true;
  });

  const capture = useCallback(async () => {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.45 });
      const base64 = photo?.base64;
      if (base64) onCaptured(`data:image/jpg;base64,${base64}`);
    } catch {
      // Sessizce geç: kullanıcı tekrar deneyebilir ya da kapatabilir.
    } finally {
      setBusy(false);
    }
  }, [busy, onCaptured]);

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>Öğün fotoğrafı</Text>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" style={styles.close}>
        <Text style={styles.closeText}>Kapat</Text>
      </Pressable>
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.overlay} testID="meal-camera">
        {header}
        <View style={styles.message}>
          <Icon name="camera" size={40} color={theme.color.textMuted} />
          <Text style={styles.messageText}>Bu platformda "Fotoğraf seç" ile bir görsel yükleyebilirsin.</Text>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.overlay} testID="meal-camera">
        {header}
        <View style={styles.message}>
          <Text style={styles.messageText}>Kamera hazırlanıyor…</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.overlay} testID="meal-camera">
        {header}
        <View style={styles.message}>
          <Icon name="camera" size={40} color={theme.color.textMuted} />
          <Text style={styles.messageText}>
            Fotoğraf çekmek için kamera izni gerekiyor. İzni reddettiysen arama, barkod veya elle giriş kullanabilirsin.
          </Text>
          <Pressable onPress={requestPermission} accessibilityRole="button" style={[styles.permBtn, { backgroundColor: color }]}>
            <Text style={[styles.permBtnText, { color: onColor(color) }]}>Kamera izni ver</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay} testID="meal-camera">
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <View style={styles.scrim}>
        {header}
        <View style={styles.spacer} />
        <View style={styles.shutterRow}>
          <Text style={styles.hint}>Öğünü çerçeveye al ve çek</Text>
          <Pressable
            onPress={capture}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Fotoğraf çek"
            testID="camera-shutter"
            style={[styles.shutter, { borderColor: color }, busy && { opacity: 0.5 }]}
          >
            {busy ? <ActivityIndicator color={color} /> : <View style={[styles.shutterInner, { backgroundColor: color }]} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.color.bg, zIndex: 60 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', paddingTop: theme.space(3) },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space(5),
    marginBottom: theme.space(2),
  },
  title: { fontSize: theme.font.title, fontWeight: '800', color: theme.color.text },
  close: { minHeight: 44, justifyContent: 'center', paddingLeft: theme.space(3) },
  closeText: { fontSize: theme.font.label, fontWeight: '700', color: theme.color.accent },
  spacer: { flex: 1 },
  shutterRow: { alignItems: 'center', paddingBottom: theme.space(10), gap: theme.space(4) },
  hint: { fontSize: theme.font.label, color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  shutterInner: { width: 54, height: 54, borderRadius: 27 },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space(4), paddingHorizontal: theme.space(6) },
  messageText: { fontSize: theme.font.body, color: theme.color.textMuted, textAlign: 'center', lineHeight: 22 },
  permBtn: { minHeight: 48, paddingHorizontal: theme.space(5), borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  permBtnText: { fontSize: theme.font.body, fontWeight: '800' },
});

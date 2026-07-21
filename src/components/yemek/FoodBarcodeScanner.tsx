import React, { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useBackHandler } from '../../lib/backHandler';
import { onColor, theme } from '../../theme';
import { Icon } from '../Icon';

/**
 * Gıda ürünü barkod tarayıcı (expo-camera CameraView). Paketli ürünlerin
 * barkodu EAN-13 / EAN-8 / UPC-A / UPC-E'dir (QR değil — gıda etiketinde besin
 * verisi barkoda gömülüdür, taranan rakamlar Open Food Facts'te aranır). Bkz.
 * okuma modülündeki BarcodeScanner: aynı yaklaşım, farklı barkod kümesi + doğrulama.
 *
 * Araştırma notu: barkod callback'i Expo Go'da güvenilir DEĞİL; native tarama
 * için EAS development/production build şart. Web'de CameraView barkod taramayı
 * desteklemez → orada kullanıcı elle numara girişine yönlendirilir.
 */

// EAN-8 (8), UPC-A (12), EAN-13 (13) — UPC-E genelde 8 haneye genişletilmiş döner.
function looksLikeProductBarcode(code: string): boolean {
  return /^\d{8}$|^\d{12,13}$/.test(code);
}

export function FoodBarcodeScanner({
  color,
  onScanned,
  onClose,
}: {
  color: string;
  onScanned: (code: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [rejected, setRejected] = useState<string | null>(null);
  // Bir kez tarayınca kilitle: aynı barkod saniyede onlarca kez tetiklenir.
  const locked = useRef(false);

  useBackHandler(() => {
    onClose();
    return true;
  });

  const handleScanned = useCallback(
    ({ data }: { data: string }) => {
      if (locked.current) return;
      const code = (data ?? '').replace(/[^0-9]/g, '');
      if (looksLikeProductBarcode(code)) {
        locked.current = true;
        onScanned(code);
      } else {
        setRejected('Geçerli bir ürün barkodu okunamadı. Barkodu çerçeveye net hizala ya da elle gir.');
      }
    },
    [onScanned],
  );

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>Barkod tara</Text>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" style={styles.close}>
        <Text style={styles.closeText}>Kapat</Text>
      </Pressable>
    </View>
  );

  // Web: CameraView barkod taramayı desteklemiyor → elle girişe yönlendir.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.overlay} testID="food-barcode-scanner">
        {header}
        <View style={styles.message}>
          <Icon name="barcode" size={40} color={theme.color.textMuted} />
          <Text style={styles.messageText}>
            Barkod tarama bu platformda desteklenmiyor. Barkod numarasını elle girebilir ya da yemeği arayabilirsin.
          </Text>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.overlay} testID="food-barcode-scanner">
        {header}
        <View style={styles.message}>
          <Text style={styles.messageText}>Kamera hazırlanıyor…</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.overlay} testID="food-barcode-scanner">
        {header}
        <View style={styles.message}>
          <Icon name="barcode" size={40} color={theme.color.textMuted} />
          <Text style={styles.messageText}>
            Barkod taramak için kamera izni gerekiyor. İzni reddettiysen barkodu elle girebilir ya da yemeği arayabilirsin.
          </Text>
          <Pressable onPress={requestPermission} accessibilityRole="button" style={[styles.permBtn, { backgroundColor: color }]}>
            <Text style={[styles.permBtnText, { color: onColor(color) }]}>Kamera izni ver</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay} testID="food-barcode-scanner">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={handleScanned}
      />
      <View style={styles.scrim}>
        {header}
        <View style={styles.frameWrap}>
          <View style={[styles.frame, { borderColor: color }]} />
          <Text style={styles.hint}>Ürünün barkodunu çerçeveye hizala</Text>
          {rejected ? <Text style={styles.rejected}>{rejected}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.color.bg, zIndex: 60 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', paddingTop: theme.space(3) },
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
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.space(6) },
  frame: { width: '82%', aspectRatio: 1.6, borderWidth: 3, borderRadius: theme.radius.md, backgroundColor: 'transparent' },
  hint: { marginTop: theme.space(4), fontSize: theme.font.label, color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  rejected: { marginTop: theme.space(3), fontSize: theme.font.caption, color: theme.color.warnText, textAlign: 'center', fontWeight: '600', lineHeight: 17 },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space(4), paddingHorizontal: theme.space(6) },
  messageText: { fontSize: theme.font.body, color: theme.color.textMuted, textAlign: 'center', lineHeight: 22 },
  permBtn: { minHeight: 48, paddingHorizontal: theme.space(5), borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  permBtnText: { fontSize: theme.font.body, fontWeight: '800' },
});

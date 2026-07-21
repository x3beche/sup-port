import React, { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useBackHandler } from '../../lib/backHandler';
import { onColor, theme } from '../../theme';
import { Icon } from '../Icon';

/**
 * EAN-13 barkod tarayıcı (expo-camera CameraView). Kitap barkodu zaten
 * EAN-13'tür ve 978/979 önekli EAN-13 = ISBN-13'tür — dönüşüm gerekmez, taranan
 * 13 hane doğrudan ISBN olarak döner. Checksum + önek doğrulaması burada yapılır
 * ki bozuk/kitap-dışı taramalar ekranı meşgul etmesin.
 *
 * Araştırma notu: barkod callback'i Expo Go'da güvenilir DEĞİL; üretimde EAS
 * development/production build şart. Web'de CameraView barkod taramayı
 * desteklemez → orada kullanıcı aramaya/elle girişe yönlendirilir.
 */

function ean13ChecksumOk(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += (i % 2 === 0 ? 1 : 3) * Number(code[i]);
  return sum % 10 === 0;
}

function isBookIsbn13(code: string): boolean {
  return (code.startsWith('978') || code.startsWith('979')) && ean13ChecksumOk(code);
}

export function BarcodeScanner({
  color,
  onScanned,
  onClose,
}: {
  color: string;
  onScanned: (isbn13: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [rejected, setRejected] = useState<string | null>(null);
  // Bir kez tarayınca callback'i kapat: aynı barkod saniyede onlarca kez tetikler.
  const locked = useRef(false);

  useBackHandler(() => {
    onClose();
    return true;
  });

  const handleScanned = useCallback(
    ({ data }: { data: string }) => {
      if (locked.current) return;
      const code = (data ?? '').replace(/[^0-9]/g, '');
      if (isBookIsbn13(code)) {
        locked.current = true;
        onScanned(code);
      } else {
        // Kitap dışı ürün / bozuk okuma: kullanıcıyı bilgilendir, taramaya devam.
        setRejected('Bu bir kitap barkodu değil (978/979 bekleniyor). Kitabın arka kapağındaki barkodu dene.');
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

  // Web: CameraView barkod taramayı desteklemiyor (araştırma). Aramaya yönlendir.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.overlay} testID="barcode-scanner">
        {header}
        <View style={styles.message}>
          <Icon name="barcode" size={40} color={theme.color.textMuted} />
          <Text style={styles.messageText}>
            Barkod tarama bu platformda desteklenmiyor. Kitabı başlık/yazar ile arayabilir ya da elle ekleyebilirsin.
          </Text>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.overlay} testID="barcode-scanner">
        {header}
        <View style={styles.message}>
          <Text style={styles.messageText}>Kamera hazırlanıyor…</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.overlay} testID="barcode-scanner">
        {header}
        <View style={styles.message}>
          <Icon name="barcode" size={40} color={theme.color.textMuted} />
          <Text style={styles.messageText}>
            Barkod taramak için kamera izni gerekiyor. İzni reddettiysen kitabı arayabilir ya da elle ekleyebilirsin.
          </Text>
          <Pressable
            onPress={requestPermission}
            accessibilityRole="button"
            style={[styles.permBtn, { backgroundColor: color }]}
          >
            <Text style={[styles.permBtnText, { color: onColor(color) }]}>Kamera izni ver</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay} testID="barcode-scanner">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
        onBarcodeScanned={handleScanned}
      />
      <View style={styles.scrim}>
        {header}
        <View style={styles.frameWrap}>
          <View style={[styles.frame, { borderColor: color }]} />
          <Text style={styles.hint}>Kitabın arka kapağındaki barkodu çerçeveye hizala</Text>
          {rejected ? <Text style={styles.rejected}>{rejected}</Text> : null}
        </View>
      </View>
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
    zIndex: 50,
  },
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
  frame: {
    width: '82%',
    aspectRatio: 1.6,
    borderWidth: 3,
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
  },
  hint: {
    marginTop: theme.space(4),
    fontSize: theme.font.label,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },
  rejected: {
    marginTop: theme.space(3),
    fontSize: theme.font.caption,
    color: theme.color.warnText,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 17,
  },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space(4), paddingHorizontal: theme.space(6) },
  messageText: { fontSize: theme.font.body, color: theme.color.textMuted, textAlign: 'center', lineHeight: 22 },
  permBtn: { minHeight: 48, paddingHorizontal: theme.space(5), borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  permBtnText: { fontSize: theme.font.body, fontWeight: '800' },
});

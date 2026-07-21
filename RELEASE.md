# Yayın Rehberi — sup-port (Google Play)

Bu belge, uygulamayı Play Store'a hazırlamanın teknik ve operasyonel adımlarını
tek yerde toplar. Kod tarafındaki her şey (imzalı AAB, SDK sürümleri, ortam
ayrımı, minify) hazırdır; **Play Console hesabı, ödeme ve yükleme senin
yapman gereken adımlardır** (bunlar otomatikleştirilemez).

## 1. Kaynakları tek yerden yönet

Tüm derleme ayarları `build-config.yaml` dosyasındadır:
- `app.version` / `app.version_code`
- `sdk.min` (24) / `sdk.target` (36) / `sdk.compile` (36)
- `environment` + `api.*` (lan / localhost / production)
- `release.minify` / `release.shrink_resources`

## 2. Sürüm ilerlemesi (her yayında)

- `version` (kullanıcıya görünür ad): semantik ilerlet — 1.0.0 → 1.0.1 → 1.1.0.
- `version_code` (Play'in gördüğü tam sayı): **her yüklemede mutlaka +1**.
  Play aynı `version_code`'u ikinci kez kabul etmez.

## 3. Release keystore — KAYBETME

- Keystore: `release/sup-port.keystore` (gitignore'lu, depoya girmez).
- Parolalar: `keystore.properties` (gitignore'lu).
- **Bu iki dosyayı güvenli bir yere yedekle** (parola yöneticisi + şifreli
  yedek). Kaybedersen Play'de bu uygulamayı **bir daha güncelleyemezsin** —
  yeni imza = yeni uygulama demektir.
- Yeni makinede derlemek için: `keystore.properties.example`'ı kopyalayıp
  doldur ve yedekten keystore dosyasını `release/` altına koy.
- Play "App Signing" (uygulama imzalama) kullanıyorsan bu senin **upload
  key**'indir; Play kendi imzasını üstüne ekler. İlk yüklemede bu keystore'u
  upload key olarak tanımlarsın.

## 4. Ortam ayrımı — test ve production karışmasın

- `build-config.yaml` içinde `environment` aktif ortamı seçer.
- `scripts/build-aab.sh` **production dışı ortamda uyarır ve durur**; bilerek
  test yapısı almak için `REQUIRE_PRODUCTION=0` verilir.
- Play'e gidecek yapı için: `environment: production` ve `api.production`
  gerçek, herkese açık bir HTTPS adresi olmalı. Backend'i deploy etmeden
  gerçek yayın çalışmaz (şu anki `10.40.30.213` yalnızca yerel ağda erişilir).
- HTTPS'e geçince `android.uses_cleartext_traffic: false` yap.

## 5. SDK gereksinimleri (Play 2025 benchmark)

- `targetSdkVersion 36` (≥ 34 zorunlu) ✓
- `minSdkVersion 24` ✓
- Bunlar `build-config.yaml` → `app.config.js` → expo-build-properties üzerinden
  ayarlanır; `android/app/build.gradle` elle düzenlenmez (prebuild yeniden üretir).

## 6. Derleme

```bash
# Play için imzalı AAB (production ortamı bekler):
bash scripts/build-aab.sh          # -> dist/sup-port-<sürüm>.aab

# Yan yükleme / cihazda test için APK:
bash scripts/build-apk.sh          # -> dist/sup-port-<sürüm>.apk
```

## 7. Minify/Proguard sonrası kritik akış testi

`release.minify: true` iken R8 kod küçültme devrededir. Küçültme native
modülleri bozabildiği için, minify'lı yapıyı bir cihazda şu akışlarla test et:
- Kayıt ol / giriş yap / çıkış yap
- Bir modüle değer gir, hedef değiştir
- Mağazadan uygulama kaldır ve geri kur
- Uygulamayı kapat-aç: oturum ve veriler duruyor mu

Sorun çıkarsa `android/app/proguard-rules.pro` içine kural ekle ya da geçici
olarak `release.minify: false` yap.

## 8. Play Console adımları (senin yapacakların)

1. **Hesap:** play.google.com/console — 25 USD tek seferlik kayıt ücreti.
   Bireysel ya da organizasyon hesabı seç.
2. **Uygulama oluştur:** ad, dil, uygulama/oyun, ücretsiz/ücretli.
3. **App signing:** Play App Signing'i etkinleştir; ilk AAB'yi yüklerken
   `release/sup-port.keystore` upload key olur.
4. **Ana mağaza girişi:** `store/listing-tr.md` içeriğini gir (ad, kısa/tam
   açıklama). Görseller: 512×512 ikon, 1024×500 öne çıkan grafik, en az 2
   ekran görüntüsü.
5. **Gizlilik politikası:** `store/privacy-policy-tr.md`'yi herkese açık bir
   URL'de yayınla, URL'yi gir.
6. **Veri güvenliği formu:** topladığın veriler = e-posta, isim, uygulama
   içi alışkanlık verisi; üçüncü tarafla paylaşım yok; aktarım şifreli.
   Politikayla birebir tutarlı doldur.
7. **İçerik derecelendirmesi** anketini doldur (uygulama şiddet/uygunsuz
   içerik barındırmaz → büyük ihtimalle "Herkes").
8. **Test kanalı:** önce **Internal testing**'e AAB yükle, kendi cihazında
   dene. Sonra Closed → Open → Production.
9. **Kademeli yayın (staged rollout):** production'a %10-20 ile başla,
   çökme oranını izle (hedef: crash-free %99.5+), sorun yoksa %100'e çıkar.

## 9. Sık ret sebepleri (rehberden)

- **Yanıltıcı listeleme:** mağaza metni gerçek özelliklerle birebir olmalı
  (`store/listing-tr.md` buna göre yazıldı).
- **Eksik izin açıklaması:** uygulama yalnızca INTERNET izni ister; hassas
  izin yok.
- **SDK uyumsuzluğu:** target ≥ 34 sağlandı.
- **Veri beyanı uyumsuzluğu:** veri güvenliği formu politikayla aynı olmalı.

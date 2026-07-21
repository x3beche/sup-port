# Sürüm Çıkarma Runbook'u (sup-port)

Bu belge **her yeni sürümü** baştan sona nasıl çıkardığımızı adım adım toplar.
Play Store'a özgü hesap/ödeme adımları için ayrıca kök dizindeki `RELEASE.md`'ye
bak. Burası "kod → CI → imzalı APK/AAB → GitHub release → uygulama-içi
güncelleme" akışının teknik reçetesi.

> Örnek: v1.1.0 (version_code 3) bu reçeteyle çıktı.

---

## 0. Ön koşullar (bir kez kur)

- **Android araç zinciri:** `/mnt/ssd1/android-studio` (JDK 21 = `ide/jbr`,
  SDK = `sdk/`, build-tools 36). Derleme scriptleri bunu otomatik kaynak alır.
- **Release keystore:** `release/sup-port.keystore` + kök dizinde
  `keystore.properties` (İKİSİ DE gitignore'lu, ASLA commit edilmez).
  - `keystore.properties` yoksa `plugins/withReleaseSigning.js` sessizce
    **debug** anahtarına düşer → imza değişir → güncelleme mevcut kurulumun
    üstüne YÜKLENMEZ. Bu yüzden build öncesi varlığını doğrula.
  - Keystore SHA-256 parmak izi: `B7:A7:A3:4A:...:D9:D5`. Her sürümün APK'sı
    aynı sertifikayla imzalanmalı (aşağıda doğrulama adımı var).
- **Backend:** production `https://support.medipol.dev` ayakta ve
  `/api/app/latest` uçu GitHub `releases/latest`'i proxy'liyor (600 sn cache).

---

## 1. Sürümü yükselt (`build-config.yaml` tek kaynak)

`build-config.yaml` hem `expo start` hem APK/AAB tarafından `app.config.js`
üzerinden okunur. Değiştir:

```yaml
app:
  version: "1.1.0"      # kullanıcıya görünür ad — semver ilerlet
  version_code: 3       # Play'in gördüğü tamsayı — HER yüklemede +1, tekrar kabul edilmez
```

Tutarlılık için `app.json` içindeki `version` ve `android.versionCode`'u da aynı
değere çek (app.config.js zaten build-config'i üste yazar ama fallback tutarlı
kalsın).

> Uygulama-içi güncelleme, kurulu `version` ile GitHub'daki en son release
> etiketini karşılaştırır. version'ı ilerletmezsen kimse güncelleme görmez.

---

## 2. Testler yeşil olmalı (CI = gerçek ortam)

- CI ortamı: kendi MongoDB'si (`support_ci`), `RATE_LIMIT_ENABLED=false`,
  **OpenRouter anahtarı YOK** (config.yaml repoda değil).
- Yerelde hızlı kapı: `npx tsc --noEmit` (CI'ın ilk adımı).
- Ortama duyarlı testlere dikkat:
  - LLM 503 testi: CI'da anahtar olmadığı için geçer; yerelde anahtarın varsa
    yerelde patlayabilir — bu beklenen.
  - Dış servise (Open Food Facts) dayanan testler deterministik olmamalı; barkod
    testi 200/404'ü birlikte kabul eder (CI'da da internet var).
- **Yarış/flaky tuzağı:** UI testleri yüklü CI koşucusunda yavaş çalışır. Hızlı
  ardışık dokunuşları "düşüren" (drop eden) guard'lar yerelde geçip CI'da patlar.
  İstekleri **sıraya diz** (drop etme). Örn. `BrushScreen` yuva yazımları bir
  promise-chain ile serileştirildi.

Push `master`'a → CI (`ci.yml`) + backend değiştiyse Portainer deploy tetiklenir.
CI eş-zaman grubu `cancel-in-progress` olduğu için yeni push öncekini iptal eder.

```bash
git push origin master
gh run list --branch master --limit 3
gh run view <run-id> --log-failed   # kırmızıysa
```

---

## 3. İmzalı yapıları derle (production'a işaret etmeli)

İki artefakt: **AAB** (Play) ve **APK** (yan yükleme + uygulama-içi güncelleme).
İkisi de `https://support.medipol.dev`'e bakmalı; token'lar düz-metin HTTP'ye
sızmasın.

```bash
# AAB — script APP_ENV=production'ı ZORLAR; test API'siyle derlemeyi reddeder.
bash scripts/build-aab.sh

# APK — build-config'in environment'ı 'lan' olduğu için production'ı AÇIKÇA ver:
APP_ENV=production EXPO_PUBLIC_API_URL=https://support.medipol.dev bash scripts/build-apk.sh
```

Çıktı: `dist/sup-port-<version>.aab`, `dist/sup-port-<version>.apk`.

**Metro cache tuzağı:** `EXPO_PUBLIC_API_URL` bundle'a gömülür ve
`node_modules/.cache` içinde önbelleğe alınır. Ortam değiştirip yeniden
derlerken URL yeniden gömülmezse yanlış backend'e bakan APK çıkar. Şüphede
kalırsan `rm -rf node_modules/.cache` yapıp yeniden derle ve URL'i doğrula.

`assembleRelease`, bir Expo bağımlılığında patlayan `lintVital*`'ı atlar
(scriptler `-x lintVital...` verir).

---

## 4. İmzayı doğrula (KRİTİK — güncelleme buna bağlı)

Yeni APK, önceki sürümle **birebir aynı** sertifikayla imzalı olmalı; yoksa
Android güncellemeyi kurmaz ve uygulama-içi imza doğrulaması reddeder.

```bash
export JAVA_HOME=/mnt/ssd1/android-studio/ide/jbr
export PATH="$JAVA_HOME/bin:$PATH"
APKSIGNER=/mnt/ssd1/android-studio/sdk/build-tools/36.0.0/apksigner
"$APKSIGNER" verify --print-certs dist/sup-port-<version>.apk | grep -i 'SHA-256'
# Beklenen: b7a7a34a70f9aadb1c2cea3dd951e2cb5f37247b51fa1c6f60d18b2e3c78d9d5
sha256sum dist/sup-port-<version>.apk   # release notunda referans için
```

---

## 5. GitHub release yayınla

Uygulama-içi güncelleme mekanizması GitHub `releases/latest`'i kaynak alır.
Backend uçu (`/api/app/latest`) APK asset'inin `digest` (sha256) ve `size`
alanlarını okur; frontend indirdikten sonra boyut/hash bütünlüğünü kontrol eder.
**sha256'yı elle girmene gerek yok** — GitHub asset'inden türetilir.

```bash
gh release create v<version> \
  --title "sup-port v<version>" \
  --notes-file <notlar.md> \
  --latest \
  dist/sup-port-<version>.aab dist/sup-port-<version>.apk
```

- `--latest` şart: `/api/app/latest` "latest" release'i çeker.
- APK asset adı `sup-port-<version>.apk` olmalı (backend `_normalize` bunu
  `apk_url` yapar).

---

## 6. Yayın sonrası doğrulama

```bash
# Cache 600 sn; birkaç dakika sonra ya da uç yeniden dağıtıldığında güncellenir.
curl -s https://support.medipol.dev/api/app/latest | python3 -m json.tool
# version == yeni sürüm, apk_url == v<version>/sup-port-<version>.apk,
# sha256 + size dolu olmalı.
```

- Emülatör/gerçek cihazda kurulu eski sürümü aç → hamburger menüde güncelleme
  rozeti çıkmalı → pill genişleyip indirir (SHA-256 → Sertifika → İmza rulosu +
  indirme hızı) → boyut/imza doğrular → tam ekran yeşil "güncellendi → yeniden
  başlat" ekranı → kurulum.
- iOS güncelleme akışını göstermez (`checkForUpdate` iOS'ta null döner).

---

## 7. Güvenlik notları (her sürümde geçerli)

- `config.yaml` (Mongo/JWT/OpenRouter sırları), `.env`, `keystore.properties`,
  `release/*.keystore` **gitignore'lu**; CI `secrets-guard` job'ı canlı bağlantı
  dizesi/`config.yaml` sızarsa build'i kırar.
- Test paketini ASLA prod DB'sine karşı çalıştırma — `tests/global-setup.ts`
  buna karşı guard koyar.
- Keystore + parolalarını şifreli yedekte tut. Kaybedersen bu uygulamayı bir
  daha güncelleyemezsin (yeni imza = yeni uygulama).

---

## Hızlı kontrol listesi

- [ ] `build-config.yaml` + `app.json`: version & version_code +1
- [ ] `npx tsc --noEmit` temiz
- [ ] push → CI yeşil
- [ ] `keystore.properties` mevcut (debug'a düşme yok)
- [ ] AAB + APK derlendi, production'a bakıyor
- [ ] APK imzası `b7a7a34a...` ile eşleşiyor
- [ ] `gh release create v<version> --latest` (AAB + APK ekli)
- [ ] `/api/app/latest` yeni sürümü döndürüyor
- [ ] cihazda güncelleme akışı test edildi

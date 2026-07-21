# sup-port — Güvenlik Denetim Raporu

**Tarih:** 2026-07-21
**Kapsam:** Backend (FastAPI + MongoDB + JWT), Frontend (Expo/React Native), derleme & CI/CD, secret yönetimi
**Genel değerlendirme:** İyi. Kod, ortalamanın belirgin şekilde üzerinde bir güvenlik hijyeniyle yazılmış. Kritik/yüksek mimari açık yok; bulguların çoğu "üretime çıkmadan kapatılması gereken" sertleştirme (hardening) maddeleri.

---

## 1. İyi yapılmış olanlar (dokunma / bozma)

- **Parola saklama:** `bcrypt` + per-parola salt (`gensalt`). 72-byte bcrypt truncation tuzağı Pydantic'te `max_length=72` ile kapatılmış (`models.py`).
- **JWT:** HS256, `jti` + `iat` + `exp`. Her token'a özel `jti` sayesinde tek oturum, diğer cihazları etkilemeden iptal edilebiliyor. `jti`'siz eski tokenlar reddediliyor (`security.py:60`).
- **Token iptali (logout):** MongoDB denylist + **TTL index** (`expireAfterSeconds=0`) ile liste süresiz büyümüyor (`db.py:46`, `revocation.py`).
- **IDOR yok:** `tracker.py` içindeki *her* sorgu `user["_id"]` ile scope'lanmış. Başka kullanıcının verisine erişim yolu görünmüyor.
- **Login enumeration koruması:** Yanlış e-posta ve yanlış parola aynı yanıtı dönüyor (`auth.py:44`).
- **Girdi doğrulama:** Tüm sayısal alanlarda alt/üst sınır, parola uzunluğu, `order` listesinde whitelist + duplicate kontrolü.
- **Secret hijyeni:** `config.yaml` ve `keystore.properties` gitignore'lu, git geçmişinde de yok. CI'da `secrets-guard` job'ı canlı `mongodb+srv://` dizesi sızarsa build'i kırıyor.
- **Secret gücü (yeterli):** JWT secret 64 karakter, keystore parolaları 27 karakter, Mongo parolası 16 karakter — hiçbiri örnek/zayıf değil.
- **MongoDB TLS:** `mongodb+srv` için `certifi` CA bundle ile TLS zorlanıyor (`db.py:21`).
- **Frontend oturum bütünlüğü:** `epoch` guard ile logout sonrası yarışan isteğin oturumu "diriltmesi" engellenmiş; web'de sekmeler arası logout senkronu; yalnızca 401'de otomatik çıkış.

---

## 2. Bulgular (öncelik sırası)

### 🔴 H-1 — Token'lar cleartext HTTP üzerinden gidiyor
**Nerede:** `build-config.yaml` (`environment: lan → http://10.40.30.213:4000`, `uses_cleartext_traffic: true`), `app.config.js:65`, `api.ts:22`
**Sorun:** Aktif ortam `http://`. 30 günlük Bearer JWT her istekte düz metin gidiyor. Aynı Wi-Fi'daki biri (MITM) token'ı yakalayıp 30 gün kullanabilir. `production` adresi hâlâ `api.example.com` placeholder'ı ve `uses_cleartext_traffic` varsayılanı `true` → **bir release build'inin cleartext açıkken Play'e çıkma riski gerçek.**
**Öneri:**
- Production backend'i **HTTPS** arkasına al (docker-compose'daki Traefik/nginx ile TLS terminasyonu).
- Release'te `uses_cleartext_traffic: false` yap ve `environment: production`'a geç. `build-aab.sh` zaten production bekliyormuş — bu guard'ı zorunlu tut (`REQUIRE_PRODUCTION=1`).

### 🟠 M-1 — /login ve /register'da rate limiting yok
**Nerede:** `routers/auth.py` — `requirements.txt`'te slowapi/limiter yok.
**Sorun:** Brute-force parola denemesi ve credential-stuffing'e karşı hiçbir throttle yok.
**Öneri:** `slowapi` veya reverse-proxy seviyesinde IP+e-posta bazlı limit (örn. 5/dk/e-posta, 20/dk/IP), başarısız denemelerde artan gecikme. Login'e kısa bir sabit gecikme de eklenebilir.

### 🟠 M-2 — /register üzerinden hesap enumeration
**Nerede:** `routers/auth.py:29-33` → `409 "Bu e-posta zaten kayıtlı"`.
**Sorun:** Login'deki enumeration koruması güzel ama register, bir e-postanın kayıtlı olup olmadığını **açıkça** sızdırıyor. Rate-limit de olmayınca (M-1) toplu enumeration mümkün.
**Öneri:** İki seçenek: (a) register'ı da generic yanıt + e-posta doğrulama akışına çevir, ya da (b) en azından M-1 rate-limit'i register'a da uygula. E-posta doğrulaması yoksa (a) tam çözmez; pratikte M-1 + jenerik mesaj makul.

### 🟠 M-3 — Uzun ömürlü token, refresh/rotation yok
**Nerede:** `config.py:33` (`access_token_days=30`).
**Sorun:** 30 gün tek access token. Çalınırsa (bkz. H-1/M-4) bir ay geçerli. Idle timeout yok, rotation yok. Revocation reaktif — kullanıcı fark edip logout etmeli.
**Öneri:** Kısa ömürlü access token (örn. 15–60 dk) + ayrı refresh token (rotation'lı) modeline geç. Basit ilk adım: `access_token_days`'i düşürüp sessiz yenileme ekle.

### 🟡 L-1 — Oturum token'ı şifresiz AsyncStorage'da
**Nerede:** `src/lib/storage.ts`, `AuthContext.tsx` (`writeJson('session', ...)`).
**Sorun:** Native'de AsyncStorage düz metin (root'lu cihaz / ADB backup ile çıkarılabilir); web'de `localStorage` (XSS ile okunabilir).
**Öneri:** Native oturum token'ı için `expo-secure-store` (iOS Keychain / Android Keystore). Cache verisi AsyncStorage'da kalabilir; sadece `session` anahtarını SecureStore'a taşı.

### 🟡 L-2 — CORS `allow_origins=["*"]` + wildcard method/header
**Nerede:** `main.py:23-28`.
**Sorun:** Her origin API'yi çağırabilir. Auth cookie değil Bearer olduğu ve `allow_credentials` açık olmadığı için doğrudan credential-hırsızlığı vektörü **değil**, ama gereğinden geniş.
**Öneri:** Bilinen origin listesine daralt (web app dom?ain'i + dev host'ları). İleride cookie tabanlı bir şey eklenirse bu şart olur.

### 🟡 L-3 — Login timing yan-kanalı
**Nerede:** `routers/auth.py:45` — `user is None or not verify_password(...)` short-circuit.
**Sorun:** Kullanıcı yoksa bcrypt hiç çalışmıyor → yanıt ölçülebilir şekilde daha hızlı → timing ile enumeration. (M-2 zaten enumeration'ı açtığı için pratik etkisi düşük.)
**Öneri:** Kullanıcı yokken de sabit bir dummy bcrypt karşılaştırması çalıştır (constant-time davranış).

### 🟡 L-4 — /health iç hata metnini sızdırıyor
**Nerede:** `main.py:38-41` → `{"message": str(err)}`.
**Sorun:** DB hatasında bağlantı/iç detay dışarı sızabilir.
**Öneri:** Dışarıya generic mesaj, detayı sadece log'a. Mümkünse `/health`'i internal ağa kısıtla.

### 🟡 L-5 — Expo build araç zincirinde 10 moderate npm açığı
**Nerede:** `npm audit` → `@expo/cli` / `@expo/config-plugins` zinciri.
**Sorun:** Yalnızca **build-time** araçlar; uygulama runtime'ına girmiyor, kullanıcı riskine dönüşmüyor. Yine de takip edilmeli.
**Öneri:** `npm audit fix` (breaking olmadan), Expo SDK güncellemelerini takip et.

### 🟡 L-6 — Güvenlik başlıkları / HTTPS redirect / TrustedHost yok
**Nerede:** `main.py` — hiçbir güvenlik middleware'i yok.
**Sorun:** HSTS, X-Frame-Options, host allow-list yok.
**Öneri:** Çoğu reverse proxy'de (Traefik/nginx) çözülmeli; en azından HSTS + host allow-list ekle. Web istemci için CSP.

---

## 3. Önerilen sıra (etki/çaba)

1. **H-1** — Production HTTPS + release'te cleartext kapat. *(çıkıştan önce şart)*
2. **M-1 + M-2** — Rate limit (login+register) ve register jenerik mesaj. *(düşük çaba, yüksek etki)*
3. **L-1** — Session token'ı SecureStore'a taşı.
4. **M-3** — Access token süresini kısalt + refresh.
5. **L-3, L-4, L-2, L-6, L-5** — sertleştirme temizliği.

> Not: Kod tabanı güvenlik açısından sağlıklı. Buradaki liste "kırılmış" değil, "üretim-sertleştirmesi" seviyesinde. Hiçbir aktif kritik açık (RCE, SQL/NoSQL injection, IDOR, secret sızıntısı) tespit edilmedi.

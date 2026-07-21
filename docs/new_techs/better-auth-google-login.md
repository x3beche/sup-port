# Google Login — Better Auth (araştırma + entegrasyon planı)

> **Durum:** Araştırıldı, planlandı — **henüz implemente edilmedi.** İleride
> Google login (ve muhtemelen Apple) için. Bu doküman kararları ve iki yolu tutar.

## Amaç
Kullanıcılar Google ile giriş yapabilsin (ileride Apple). Şu an backend'de
**kendi FastAPI JWT auth'umuz** var (`auth.py`, `refresh.py`, `revocation.py`,
`security.py`, Mongo `users`). Soru: Better Auth ekleyerek mi, yoksa mevcut
auth'a Google bağlayarak mı?

## Better Auth nedir
TypeScript/Node tabanlı, "batteries-included" auth framework:
- E-posta/şifre, **social (Google/Apple/GitHub…)**, oturum, **JWT + JWKS**, 2FA,
  hesap bağlama, org/rol eklentileri.
- **Kendi şemasını yönetir**: `user`, `session`, `account`, `verification`
  (+ jwks) koleksiyonları. **MongoDB adapter var** (`mongodbAdapter`,
  `better-auth/adapters/mongodb`) — şema migrasyonu gerektirmez, `collectionNames`
  ile isim eşlenebilir, 1.4.0+ join desteği.
- **Expo eklentisi** (`@better-auth/expo`): social akışı + `SecureStore`'da oturum.

## ⚠️ Kritik mimari not
Better Auth **Node runtime** ister; bizim backend **FastAPI/Python**. Yani
FastAPI içine gömülemez. İki barındırma seçeneği:
1. **Ayrı Node servisi** — Better Auth'u kendi Node sunucusunda çalıştır (Portainer'a
   yeni bir konteyner). En temiz ayrım.
2. **Expo API Routes'a göm** (`app/api/auth/[...auth]+api.ts`) — ama bu, Expo
   uygulamasını bir **Node host** ile (EAS Hosting/sunucu) yayınlamayı gerektirir;
   şu an app statik web + native olarak dağıtılıyor, sunucu değil.

Her iki durumda da **kimlik sahipliği FastAPI'den Better Auth'a taşınır.**

## FastAPI ile entegrasyon: JWKS/JWT köprüsü
Better Auth **IdP** (kimlik sağlayıcı), FastAPI **resource server** olur:
```
Expo (@better-auth/expo)
  → Better Auth (Node)  ── Google OAuth + oturum + JWT üretir (JWKS yayınlar)
Expo, FastAPI'ye Authorization: Bearer <BA-JWT> ile gider
  → FastAPI, JWKS'ten public key çekip JWT'yi doğrular (RS256, iss/aud/exp)
     ve kullanıcıyı tanır (sub/email claim'i)
```
- FastAPI'nin `deps.current_user`'ı artık **Better Auth JWT'sini doğrular**
  (kendi token üretmeyi bırakır ya da geçiş döneminde ikisini de kabul eder).
- `access/refresh/revocation` mantığı Better Auth'a devrolur.

## Mongo verisi ve migrasyon
- Better Auth kendi `user`/`session`/`account` koleksiyonlarını kullanır. Mevcut
  `users` dokümanları **birebir yeniden kullanılamaz** (şema farklı) → **migrasyon**
  gerekir (e-posta eşleştirme + `account` kaydı). `collectionNames` ile isim
  çakışması yönetilebilir ama alan şeması Better Auth'ın beklediği gibi olmalı.
- Geçiş döneminde çift-okuma/çift-yazma ya da tek seferlik migrasyon script'i.

## Expo tarafı (Better Auth yolu)
Gereksinim: **Expo SDK 55+ / New Architecture / dev-build** (Expo Go değil).
Bizde APK/AAB derliyoruz, dev-build + New Arch zaten uygun; SDK v57 daha yeni.

Sunucu (`lib/auth.ts`, Node):
```ts
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

export const auth = betterAuth({
  database: mongodbAdapter(db),            // mevcut Mongo instance
  plugins: [expo()],
  socialProviders: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET },
  },
  trustedOrigins: ["support://", "support://*"],
});
```
İstemci (`lib/auth-client.ts`):
```ts
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: "https://<better-auth-host>",
  plugins: [expoClient({ scheme: "support", storage: SecureStore })],
});
// Giriş:
await authClient.signIn.social({ provider: "google", callbackURL: "/" });
```
Paketler: `better-auth @better-auth/expo expo-secure-store expo-network
expo-linking expo-web-browser expo-constants`. `app.json` → `"scheme": "support"`.

## Google Cloud kurulumu (her iki yolda ortak)
- Google Cloud Console'da OAuth client ID'leri: **Web** (Better Auth/redirect),
  **iOS**, **Android** (SHA-1 imzası ile). Yetkili redirect/scheme'ler.
- Client secret **sunucuda** (bundle'a girmez).

## Etki/maliyet (dürüst)
| | Better Auth | Alternatif (aşağıda) |
|---|---|---|
| Yeni runtime | **Node servisi** (Portainer'a ek) | Yok (FastAPI'de kalır) |
| Kimlik sahipliği | Better Auth'a taşınır | FastAPI'de kalır |
| Mevcut auth kodu | Yeniden yazılır (JWKS doğrulama) | Korunur, üstüne eklenir |
| Kullanıcı migrasyonu | Gerekir | Gerekmez |
| Kazanım | Social + 2FA + hesap bağlama + bakımlı lib | Sadece Google (şimdilik) |
| Efor | Yüksek | Düşük |

## Alternatif (hafif): FastAPI + Google ID token doğrulama
Amaç *sadece Google login* ise, **yeni servis/migrasyon olmadan**: istemci Google
ile giriş yapar (`expo-auth-session` / `@react-native-google-signin`), aldığı
**ID token**'ı FastAPI'ye yollar; FastAPI doğrular, Mongo'da kullanıcıyı
bulur/oluşturur ve **mevcut access+refresh JWT'mizi** üretir.
```python
# pip install google-auth
from google.oauth2 import id_token
from google.auth.transport import requests as grequests

@router.post("/auth/google")
async def google_login(payload: GoogleToken):
    info = id_token.verify_oauth2_token(
        payload.id_token, grequests.Request(), settings.google_client_id)
    email, sub = info["email"], info["sub"]        # info["email_verified"] kontrol et
    user = await find_or_create_user(email, google_sub=sub)
    return issue_tokens(user)                       # mevcut JWT/refresh akışımız
```
Mevcut `refresh`/`revocation`/`security` altyapısı aynen kullanılır. Apple, Facebook
vb. de aynı desenle eklenir.

## Karar / öneri
- **Sadece Google login yakında** isteniyorsa → **hafif alternatif** (FastAPI +
  Google ID token). Az efor, yeni runtime yok, mevcut JWT korunur.
- **Tam auth platformu** (social + 2FA + hesap bağlama + org) hedefleniyor ve bir
  **Node servisi** eklemeye değer görülüyorsa → **Better Auth'u IdP** yap, FastAPI'yi
  JWKS ile resource server yap, Mongo adapter kullan.

Kullanıcı isteği Better Auth yönünde; yine de "yakında sadece Google" senaryosunda
hafif yolun maliyet/fayda avantajı yüksek — implementasyondan önce bu seçim net olmalı.

## Yapılacaklar (ileride)
**Better Auth yolu:**
- [ ] Node servisi (Better Auth + `mongodbAdapter`, Google provider) + Portainer stack.
- [ ] Google Cloud OAuth client'ları (web/iOS/Android).
- [ ] FastAPI `deps.current_user` → Better Auth JWKS doğrulaması (RS256, iss/aud).
- [ ] Kullanıcı migrasyonu (mevcut `users` → Better Auth `user`/`account`).
- [ ] Expo: `@better-auth/expo` client + `signIn.social("google")`, scheme.

**Hafif yol:**
- [ ] `config.py`: `google_client_id` (+ platform client ID'leri).
- [ ] `routers/auth.py`: `POST /auth/google` (google-auth ile ID token doğrula).
- [ ] `requirements.txt`: `google-auth`.
- [ ] Expo: Google Sign-In (`expo-auth-session`/`@react-native-google-signin`) → ID token → `/auth/google`.

## Kaynaklar
- Better Auth — Expo entegrasyonu: https://better-auth.com/docs/integrations/expo
- Better Auth — MongoDB adapter: https://better-auth.com/docs/adapters/mongo
- Better Auth + FastAPI (JWKS köprüsü): https://dev.to/rogasper/bridging-the-gap-implementing-better-auth-with-non-node-backends-5dh4
- Expo — Google authentication: https://docs.expo.dev/guides/google-authentication/
- React Native + Better Auth rehberi: https://blog.logrocket.com/react-native-authentication-with-better-auth-and-expo/

# Yeni Teknolojiler / Entegrasyon Planları

sup-port'a **ileride** eklenecek teknoloji ve entegrasyonların araştırma + plan
notları. Buradaki her doküman kararları, mimariyi ve taslak kodu tutar;
**implementasyon henüz yapılmadı** — sırası gelince buradan geliştirilecek.

## İçindekiler
| Konu | Doküman | Özet |
|---|---|---|
| Sesli giriş (voice-to-text) | [`voice-to-text-openrouter.md`](./voice-to-text-openrouter.md) | OpenRouter STT (`whisper-large-v3`, `$0.0015/dk`, `language=tr`); FastAPI `/api/stt` proxy; cihaz-içi alternatif; KVKK |
| Google login | [`better-auth-google-login.md`](./better-auth-google-login.md) | Better Auth (Node IdP + FastAPI JWKS köprüsü, Mongo adapter) **vs** hafif yol (FastAPI + Google ID token doğrulama) |

## Ortak ilkeler
- **Anahtarlar sunucuda** (bundle'a sızmaz); dış servisleri backend proxy'ler.
- **Gizlilik/KVKK:** ses/kimlik gibi kişisel/sınır-ötesi veri için açık onay,
  ham veriyi saklamama; mümkünse cihaz-içi.
- Her plan **hafif ↔ tam** seçeneğini ve maliyet/etki dengesini açıkça verir;
  implementasyondan önce seçim netleşmeli.

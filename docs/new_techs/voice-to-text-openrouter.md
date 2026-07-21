# Sesli Giriş (Voice-to-Text) — OpenRouter STT

> **Durum:** Araştırıldı, planlandı — **henüz implemente edilmedi.** İleride
> yapılacak. Bu doküman kararları, mimariyi ve taslak kodu tutar.

## Amaç
sup-port'ta metin alanlarına **sesle dikte**: özellikle serbest-metin modülleri
(Fikir Defteri, Günlük, Şükran, ileride Ruh Hâli notu) ve arama/komut. Kullanıcı
mikrofona konuşur → metne dönüşür → alana yazılır.

## Verilen kararlar
- **Sağlayıcı:** OpenRouter'ın **adanmış transcription ucu**
  `POST https://openrouter.ai/api/v1/audio/transcriptions` (OpenAI uyumlu).
  Chat-completions + `input_audio` yolu yalnız "sesi anla/özetle" gibi işler için;
  düz transkriptte gereksiz.
- **Varsayılan model:** `openai/whisper-large-v3` — **$0.0015/dk** (1 saat ≈ $0.09),
  99+ dil, Türkçe dahil, kelime/segment zaman damgası. Fiyat/performans tatlı noktası.
- **Kalite gerekirse:** `openai/gpt-4o-transcribe` (token bazlı, daha akıllı
  noktalama/bağlam). **Zirve Türkçe** şartsa OpenRouter dışı **ElevenLabs Scribe**
  (FLEURS WER ~%3.1) için ayrı anahtar.
- **Dil:** her istekte `language: "tr"` — otomatik algılamaya bırakma, Türkçe
  doğruluğu belirgin artıyor.
- **Anahtar sunucuda:** istemciden doğrudan OpenRouter'a gitme; mevcut desen
  (LLM proxy) gibi backend üzerinden geç. Anahtar `config.yaml`/`.env`'de.

## OpenRouter STT — özet
| | |
|---|---|
| Uç | `POST /api/v1/audio/transcriptions` |
| İstek | multipart (`file=@ses.m4a`) **veya** JSON (`input_audio:{data:base64,format:"m4a"}`) |
| Format | mp3, mp4, wav, webm, flac, ogg, m4a, aac |
| Limit | **≤25 MB** · ~60 sn upstream timeout → uzun sesi parçala |
| Fiyat | Whisper süre bazlı ($0.0015/dk); yeni modeller token bazlı. Gerçek maliyet yanıttaki `usage.cost` |
| Model ID listesi | `GET /api/v1/models?output_modalities=transcription` |

### Model karşılaştırma (Türkçe odaklı)
| Model | OpenRouter ID | Türkçe/kalite | Maliyet | Not |
|---|---|---|---|---|
| Whisper large-v3 | `openai/whisper-large-v3` | İyi (temiz kayıtta çok iyi) | **$0.0015/dk** | **Varsayılan** |
| GPT-4o Transcribe | `openai/gpt-4o-transcribe` | Daha iyi bağlam/noktalama | token, orta | Kalite modu |
| Deepgram Nova-3 | `deepgram/nova-3` | İyi, hızlı | ucuz-orta | Alternatif |
| ElevenLabs Scribe | *(OpenRouter'da yok)* | **Zirve TR (WER ~%3.1)** | ayrı sağlayıcı | Şart olursa |

## Mimari
```
Expo (mikrofon → ses dosyası)
   → POST /api/stt  (multipart upload)      [FastAPI]
      → OpenRouter /audio/transcriptions    (anahtar sunucuda)
   ← { text }
```
Sesi istemciden **kendi backend'imize** yükleriz; backend OpenRouter'ı çağırır.
Böylece anahtar bundle'a sızmaz ve maliyet/limit tek yerden kontrol edilir.

## Backend taslağı — `backend/app/routers/stt.py`
```python
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from openai import AsyncOpenAI          # requirements.txt'e 'openai' ekle
from ..config import settings
from ..deps import current_user

router = APIRouter(prefix="/api", tags=["stt"])

@router.post("/stt")
async def transcribe(file: UploadFile = File(...), user: dict = Depends(current_user)):
    if not settings.openrouter_api_key:
        raise HTTPException(503, "STT yapılandırılmamış")   # anahtar yoksa güvenli düş
    audio = await file.read()
    if len(audio) > 25 * 1024 * 1024:
        raise HTTPException(413, "Ses 25 MB'ı aşıyor")
    client = AsyncOpenAI(base_url=settings.openrouter_base_url,
                         api_key=settings.openrouter_api_key)
    tr = await client.audio.transcriptions.create(
        model=settings.openrouter_stt_model,               # varsayılan whisper-large-v3
        file=(file.filename or "ses.m4a", audio, file.content_type or "audio/m4a"),
        language="tr",
    )
    return {"text": tr.text}
```
- `config.py` → `openrouter_stt_model: str = "openai/whisper-large-v3"`.
- `main.py` → `app.include_router(stt.router)`.

## İstemci (Expo v57)
- **`expo-audio`** ile kaydet → dosya URI'si → `FormData` ile `/api/stt`'ye yükle →
  dönen `text`'i input'a yaz. (Kayıt API'si v57'de değişmiş olabilir; yazarken
  `https://docs.expo.dev/versions/v57.0.0/` teyit edilecek — AGENTS.md gereği.)
- Basit "bas-konuş" (push-to-talk) düğmesi: basılıyken kaydet, bırakınca yükle.

## Alternatif: cihaz-içi STT (OpenRouter'sız)
- Mobil: **`@react-native-voice/voice`** → iOS/Android yerel tanıyıcı, **`tr-TR`**,
  ücretsiz, düşük gecikme, **ses cihazdan çıkmaz.** Dev-build gerekir (Expo Go değil).
- Web (s23.html): **Web Speech API** (`SpeechRecognition`, `tr-TR`, Chrome).
- Trade-off: kalite işletim sistemine bağlı ve tutarsız; ama gizlilik + maliyet
  en iyi. **Kalite tutarlılığı** istiyorsan OpenRouter/Scribe, **gizlilik/maliyet**
  istiyorsan cihaz-içi.

## Gizlilik (KVKK)
Ses **kişisel veridir**; OpenRouter üçüncü taraf/yurt dışı sağlayıcıya yönlendirir
→ **sınır ötesi aktarım.** Yemek modülündeki `PhotoEstimateInput` desenini uygula:
**açık onay** + **ham sesi saklama** (yalnız transkripti tut). Cihaz-içi yol bu
yükü tümüyle kaldırır.

## Yapılacaklar (ileride)
- [ ] `config.py`: `openrouter_stt_model` (varsayılan `openai/whisper-large-v3`).
- [ ] `requirements.txt`: `openai` (audio.transcriptions için) + backend yeniden derle.
- [ ] `routers/stt.py` + `main.py` include.
- [ ] Onay akışı (KVKK) + ham sesi saklamama.
- [ ] Expo: kayıt bileşeni (bas-konuş) + `/api/stt` upload + input'a yazma.
- [ ] (Opsiyonel) uzun ses için parçalama; hata/timeout UX.
- [ ] (Opsiyonel) cihaz-içi fallback (mobilde `@react-native-voice/voice`).

## Kaynaklar
- OpenRouter STT: https://openrouter.ai/docs/guides/overview/multimodal/stt
- Whisper large-v3 (fiyat/ID): https://openrouter.ai/openai/whisper-large-v3
- STT model koleksiyonu: https://openrouter.ai/collections/speech-to-text-models
- Türkçe STT karşılaştırma: https://elevenlabs.io/speech-to-text/turkish

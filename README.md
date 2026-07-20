# sup-port

Kişisel gelişim için bir **superapp**. Tek bir uygulama içinde, alışkanlık ve gelişim
alanlarının her biri kendi modülü olarak yer alır — hepsi ortak bir kabuk, ortak bir
API ve ortak bir veri modeli üzerinde çalışır.

> Durum: erken aşama. Şu an uygulama iskeleti, backend API'si ve test altyapısı hazır.

## Planlanan modüller

| Modül | Ne yapar |
| --- | --- |
| 🍽️ Yemek | Öğün takibi, beslenme kaydı |
| 🪥 Diş fırçalama | Günlük rutin takibi, hatırlatma |
| 🇬🇧 İngilizce | Kelime çalışma, tekrar takibi |
| ➕ … | Yeni alanlar aynı modül yapısıyla eklenir |

Her modül aynı desende ilerler: kendi ekranı, kendi API uç noktaları, ortak kimlik ve
ortak ilerleme takibi.

## Teknolojiler

- **Mobil / web:** Expo SDK 57, React Native 0.86, React 19, TypeScript
- **Backend:** FastAPI (Python 3.12), MongoDB Atlas
- **Test:** Playwright

Hedef cihaz: Samsung Galaxy S23 (1080×2340, DPR 3 → 360×780 mantıksal px).

## Kurulum

### 1. Yapılandırma

```bash
cp config.yaml.example config.yaml
```

`config.yaml` içine kendi MongoDB bağlantı bilgilerini yaz. Bu dosya `.gitignore`
içinde — gerçek kimlik bilgileri **asla** commit edilmez. Dilersen dosya yerine
`MONGODB_URI` ve `DB_NAME` ortam değişkenlerini de kullanabilirsin; ortam
değişkenleri dosyadaki değerleri geçersiz kılar.

### 2. Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 4000
```

- API: `http://localhost:4000`
- Otomatik dokümantasyon: `http://localhost:4000/docs`
- Sağlık kontrolü: `http://localhost:4000/health` (MongoDB'ye gerçek `ping` atar)

### 3. Uygulama

```bash
npm install
npx expo start
```

- Web: `http://localhost:8081` (port doluysa Expo başka bir port önerir)
- **S23 çerçeveli önizleme:** `http://localhost:8081/s23.html`
- Cihazda: Expo Go ile aynı Wi-Fi ağından bağlan

> Kök adres uygulamanın kendisini çerçevesiz gösterir. Telefon çerçevesi içinde
> görmek için `/s23.html` adresini aç.

## Testler

```bash
npx playwright test          # tümü
npx playwright test --ui     # arayüzle
```

Testler `tests/` altında; Playwright'ın ürettiği çıktılar da `tests/.artifacts` ve
`tests/.report` klasörlerine yazılır, proje kökü temiz kalır.

API testleri çalışan bir backend bekler. Farklı adresler için `WEB_URL` ve `API_URL`
ortam değişkenlerini kullanabilirsin.

## Proje yapısı

```
App.tsx                     uygulama girişi
public/s23.html             S23 çerçeveli önizleme sayfası
backend/
  app/config.py             config.yaml + ortam değişkeni okuma
  app/db.py                 MongoDB bağlantısı
  app/models.py             Pydantic modelleri
  app/routers/tickets.py    CRUD uç noktaları
  app/main.py               FastAPI uygulaması
tests/
  s23-frame.spec.ts         çerçeve ve ölçü testleri
  api.spec.ts               backend uçtan uca testleri
```

## Mimari notu

Mobil uygulama MongoDB'ye **doğrudan bağlanmaz**. Tüm veri erişimi FastAPI katmanı
üzerinden gider; aksi halde veritabanı kimlik bilgisi uygulama paketinin içine
gömülür ve paketi açan herkes tarafından okunabilir.

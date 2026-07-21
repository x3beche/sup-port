# sup-port Okuma/Kütüphane Modülü — Teknik Araştırma Raporu

## TL;DR

- **Metadata için birincil kaynak Google Books API + kapak yedeği olarak Open Library Covers API** öneriliyor; her ikisi de bir backend proxy + önbellek arkasından çağrılmalı (gizlilik + rate-limit için). Google Books güncel Türkçe ticari kitaplarda daha geniş kapsam sağlarken, Open Library CC0 lisanslı metadata + net kapak gösterim izni sunar.
- **Barkod tarama için** `expo-camera` **(**`CameraView`**) kullanın** — `expo-barcode-scanner` SDK 52'de tamamen kaldırıldı. EAN-13 desteği var, ancak **EAS development build şart**; Expo Go'da barkod callback'i güvenilir çalışmıyor.
- **En kritik risk kapak telifidir**: kapaklar yayınevi telifidir. Open Library kapaklarını [`covers.openlibrary.org`](http://covers.openlibrary.org) üzerinden GÖSTERMEK açıkça izinlidir, ancak toplu indirme/crawl yasaktır. Kapakları kalıcı olarak kendi CDN'inize kopyalamak hukuki risk taşır.

---

## Key Findings

### 1. Metadata API karşılaştırma tablosu


| Kriter                  | Open Library                                                                                                                                                  | Google Books API                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Metadata lisansı**    | Veri CC0 (kamu malı) mantığında; API key yok, açık                                                                                                            | Google'ın çoğunu lisansladığı veri; ToS'a tabi, kamu malı **değil**                                                        |
| **Kapak hakkı**         | [`covers.openlibrary.org`](http://covers.openlibrary.org)'dan gösterim açıkça izinli; crawl/toplu indirme yasak                                               | `imageLinks` thumbnail; kaynağı yayınevi/tarama, ToS gereği ihlal iddiasında kaldırma zorunlu                              |
| **TR kapsamı**          | Zayıf (eski akademik/sözlük/tarih ağırlıklı); güncel TR kurgu eksik                                                                                           | Daha iyi (yayınevi/perakende beslemesi); yine de uzun kuyruk eksik                                                         |
| **Rate limit**          | Search/Books: **1 istek/sn** (kimliksiz), **3 istek/sn** (User-Agent+email ile); Covers: **100 istek/IP/5dk** (ISBN/OCLC/LCCN ile), CoverID/OLID ile limitsiz | **1.000 istek/gün** (Courtesy Limit) + **1 istek/sn/kullanıcı** (Per-User Limit); API key ile, dashboard'dan artırılabilir |
| **Auth**                | Gerekmez                                                                                                                                                      | API key önerilir (kota takibi için)                                                                                        |
| **Çevrimdışı önbellek** | Aylık toplu veri dökümü + kapak tar dosyaları ([archive.org](http://archive.org)) mevcut                                                                      | Toplu döküm yok; yalnızca canlı sorgu                                                                                      |


**Rate-limit kaynak notları (kesin):**

- Open Library APIs sayfası: *"Default (non-identified requests): 1 request per second. Identified requests (with User-Agent and email): 3 requests per second."*
- Open Library Covers API resmi dokümanı: *"The cover access by ids other than CoverID and OLID are rate-limited. Currently only 100 requests/IP are allowed for every 5 minutes. If any IP tries to access more than the allowed limit, the service will return "403 Forbidden" status."* — CoverID/OLID ile erişim rate-limitsizdir.
- Google Books API varsayılan kotası (Google API Console): *"Courtesy Limit: 1,000 requests/day"* ve *"Per-User Limit: 1.0 requests/second/user"*; kota dashboard'dan artırılabilir.

**Ücret kısıtı (kritik):** Google Books API ToS: *"You may not charge users any fee for the use of your application, unless you have entered into a separate agreement with Google or obtained Google's written permission."* — sup-port ücretli/abonelikli bir süperapp ise Google Books kullanımı ToS ihlali riski taşır; bu, verilmiş "birincil kaynak" kararını değiştirebilir.

**İçerik kaldırma zorunluluğu:** Google Books ToS ayrıca telif ihlali iddiası halinde içeriğin uygulamadan kaldırılmasını ve hak sahiplerine iletişim bilgisi sunulmasını şart koşar.

---

### 2. Open Library çağrı örnekleri (gerçek URL'ler)

- **ISBN ile kitap verisi** (önerilen `jscmd=data`): [`https://openlibrary.org/api/books?bibkeys=ISBN:9780980200447&jscmd=data&format=json`](https://openlibrary.org/api/books?bibkeys=ISBN:9780980200447&jscmd=data&format=json)
- **Genel arama** (hafif alan seçimiyle): [`https://openlibrary.org/search.json?q=s%C3%B6zc%C3%BCk&fields=key,title,author_name,first_publish_year,cover_i,isbn&limit=10`](https://openlibrary.org/search.json?q=s%C3%B6zc%C3%BCk&fields=key,title,author_name,first_publish_year,cover_i,isbn&limit=10)
- **Edition JSON**: [`https://openlibrary.org/isbn/9780385533225.json`](https://openlibrary.org/isbn/9780385533225.json)
- **Kapak URL kalıbı**: [`https://covers.openlibrary.org/b/$key/$value-$size.jpg`](https://covers.openlibrary.org/b/$key/$value-$size.jpg)
  - Örnek (M boyut, ISBN): [`https://covers.openlibrary.org/b/isbn/9780385472579-M.jpg`](https://covers.openlibrary.org/b/isbn/9780385472579-M.jpg)
  - `$key` ∈ {isbn, oclc, lccn, olid, id}; `$size` ∈ {S, M, L}
  - Kapak yoksa varsayılan boş resim döner; `?default=false` eklerseniz **404** döner (istemcide placeholder mantığı için kullanışlı).

**Open Library** `jscmd=data` **alanları:** title, subtitle, authors[], publishers[], publish_date, number_of_pages, identifiers (isbn_10/isbn_13/oclc/lccn), subjects[], cover (small/medium/large URL), url. `description` bu endpoint'te güvenilir gelmez; work seviyesinden (`/works/{id}.json`) çekilmeli.

**Google Books** `volumeInfo` **alanları:** title, subtitle, authors[], publisher, publishedDate, description, industryIdentifiers[] (ISBN_10/ISBN_13), pageCount, categories[], averageRating, imageLinks (smallThumbnail…extraLarge), language.

- Örnek çağrı: [`https://www.googleapis.com/books/v1/volumes?q=isbn:9789750718533&country=TR`](https://www.googleapis.com/books/v1/volumes?q=isbn:9789750718533&country=TR)

---

### 3. Barkod tarama (Expo SDK 57)

- `expo-barcode-scanner` **SDK 52'de tamamen kaldırıldı**. Expo SDK 52 changelog: *"expo-barcode-scanner has been removed: it was deprecated in SDK 50 and slated for removal in SDK 51. The barcode scanning functionality provided by expo-camera is a better alternative (and it also supports the iOS 16+ DataScannerViewController)."* → Resmi öneri `expo-camera`'nın `CameraView` bileşeni.
- **expo-camera desteklediği tipler:** qr, aztec, **ean13**, ean8, pdf417, upc_e, datamatrix, code39, code93, itf14, codabar, code128, upc_a. Android'de Google Code Scanner (Play Services), iOS 16+'da VisionKit DataScannerViewController kullanır.
- **Expo Go'da barkod callback'i güvenilir çalışmıyor** (birden çok GitHub issue: `onBarcodeScanned`/`onBarCodeScanned` tetiklenmiyor — hem Expo Go hem bazı build senaryolarında). Üretim için **EAS development/production build** gerekir. `app.json`'da `barcodeScannerEnabled: true` ve iOS için `NSCameraUsageDescription` şart (yoksa izin isteğinde çöker).
- **Alternatif:** `react-native-vision-camera` **+** `react-native-vision-camera-barcode-scanner` (MLKit). Daha çok sembol, görüntüden tarama, autofocus/pinch-zoom ve platformlar arası daha iyi parite sunar; ancak custom dev client şart (Expo Go'da çalışmaz) ve düşük seviyelidir. Not: iOS'ta UPC-A, EAN-13 olarak (baş sıfırla) döner; bazı cihazlarda EAN-13 yanlışlıkla Code 128 olarak okunabilir.
- **Örnek expo-camera kullanımı:**

```jsx
import { CameraView, useCameraPermissions } from 'expo-camera';
// ...
<CameraView
  onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8'] }}
  style={StyleSheet.absoluteFillObject}
/>

```

**EAN-13 → ISBN-13 akışı ve checksum:**

- Kitap barkodu zaten **EAN-13**'tür ve **978/979 önekli EAN-13 = ISBN-13**'tür. Yani taranan 13 hane doğrudan ISBN-13 olarak kullanılır — dönüşüm gerekmez.
- Checksum doğrulama: mod-10, soldan itibaren alternatif **1× ve 3×** ağırlık, toplam 10'un katı olmalı. Sorgu öncesi checksum doğrulaması, yanlış/bozuk taramaları eler.
- **979** önekli kodların ISBN-10 karşılığı **yoktur**; her zaman 13 haneli dizeyle sorgulayın. Kitap dışı ürünlerin (978/979 dışı önek) barkodunu reddedin.

---

### 4. TR kapsamı ve yedek kaynaklar

- **Open Library**: Türkçe koleksiyon gönüllü-katkılıdır; kapsam eski akademik/sözlük/tarih eserlerine kayar (ör. subject "Turkish language" Türk Dil Kurumu, Redhouse sözlükleri ağırlıklı). Güncel popüler Türkçe kurgu zayıftır ve ünlü Türk yazarların (ör. Elif Şafak) çoğunlukla **İngilizce çevirileri** kayıtlıdır. Doğan Kitap gibi büyük yayınevi sayfalarında çağdaş yazarlar kısmen mevcuttur ama edisyon düzeyinde eksiktir.
- **Google Books**: Yayınevi/perakende beslemesi sayesinde güncel Türkçe ticari kitaplarda daha iyidir; yine de `imageLinks` sıklıkla eksik olabilir ve ülke (`country=TR`) parametresine göre sonuç değişebilir. Türkçe kitaplar ISBN-13'tür (öneki genellikle **978-605, 978-975, 978-9944**); daima ISBN-13 ile sorgulayın (ISBN-10/13 tutarsızlığı bilinen bir sorundur).
- **Resmi ISBN sistemi ([ekygm.gov.tr](http://ekygm.gov.tr) / e-Devlet "Yayın Standartları ve Derleme Bilgi Sistemi")**: Yalnızca yayıncı girişine (T.C. no + e-Devlet şifresi) açıktır; başvuru/atama iş akışıdır. **Kamuya açık ISBN sorgusu veya programatik API yoktur.** Metadata kaynağı olarak kullanılamaz.
- **Milli Kütüphane KÂŞİF** ([`https://kasif.mkutup.gov.tr/`](https://kasif.mkutup.gov.tr/)): ISBN ile aranabilen otoriter kamu OPAC'ıdır ve derleme (yasal-teslim) sayesinde Türkiye'de yayımlanmış kitaplar için en otoriter kaynaktır. Ancak **yayınlanmış/kamuya açık Z39.50/SRU/REST API yoktur**; programatik erişim için kütüphaneyle doğrudan iletişim (hedef/kimlik bilgisi talebi) gerekir. "Talep üzerine mümkün olabilir, kamuya açık değil" olarak değerlendirin.
- **idefix / D&amp;R / kitapyurdu**: Resmi API yoktur; yalnızca scraping mümkündür ve bu, site ToS'u ile KVKK açısından risklidir (ör. kitapyurdu şartları otomatik veri çıkarımını açıkça yasaklar). Kapaklar da telifli yayınevi varlığıdır. **Ticari ürün için önerilmez.**

---

### 5. UX ve motivasyon (kanıtlı)

- **Yıllık okuma hedefi** motivasyonu artırır, ancak gerçekçi tutulmalı. Jafari, Sabri &amp; Bahrak (2020), *"Investigating the effects of Goodreads' challenges on individuals' reading habits"* (arXiv:2012.03932): 3 milyonu aşkın okuma challenge'ı ve 2 milyondan fazla benzersiz Goodreads kullanıcısı (2011–2019) incelendi; bulgu: *"participants in reading challenges, in essence, commit to more books than they actually read, with female members demonstrating higher success rates in completing challenges compared to male members."*
- **Goal-setting teorisi** (Locke &amp; Latham): spesifik, ulaşılabilir hedefler öz-yeterliği ve içsel motivasyonu artırır; çok zor hedefler ulaşılamadığında öz-yeterliği düşürür. → Kullanıcıya düşük başlangıç hedefi (ör. 12/yıl) ve kolay ayar imkânı verin.
- **Streak/seri** güçlü ama riskli bir mekaniktir. Davranış-bilimi literatürü (Yu-kai Chou; Woolley 2026, *Consumer Psychology Review*; Habitica üzerine çalışmalar) aşırı oyunlaştırmanın **kaygı, suçluluk, bağımlılık ve tükenmişlik** yaratabileceğini, dışsal ödüllerin içsel motivasyonu düşürebileceğini (overjustification etkisi) gösterir. Ayrıca performatif davranış riski (sırf streak için minimal loglama) vardır.
- **Öneri**: streak'i opsiyonel ve **telafili** (streak dondurma/esneme günü) tutun; sosyal karşılaştırma/liderlik tablosunu zorunlu kılmayın; ilerleme görselleştirmesini (progress bar, aylık ritim) merkeze alın.

---

## Details

### Önerilen mimari (gizlilik odaklı) — Backend proxy vs. doğrudan istemci

Doğrudan istemci→üçüncü taraf çağrısı, kullanıcının okuma alışkanlığını (kişisel veri) kullanıcının **kendi IP'siyle** Google/Open Library'ye sızdırır. Ayrıca rate-limit'ler IP başına olduğundan tek bir yoğun kullanıcı diğerlerini bloke edebilir. **Backend proxy (FastAPI) + MongoDB önbellek** önerilir:

1. İstemci yalnızca kendi backend'inize ISBN/arama sorgusu gönderir.
2. Backend, Google Books / Open Library'ye **User-Agent + email** başlığıyla sorar (Open Library'de 3 istek/sn'ye çıkmak için gerekli), rate-limit'i merkezî yönetir ve retry/backoff uygular.
3. Metadata MongoDB'de önbelleğe alınır (katalog verisi nadiren değişir → hem hız hem rate-limit koruması).
4. **Kapaklar**: [`covers.openlibrary.org`](http://covers.openlibrary.org) URL'i istemcide doğrudan `<Image>` src olarak gösterilir (Open Library bunu açıkça öneriyor: *"If you want to display covers on public-facing pages, please use a src URL that points to [covers.openlibrary.org](http://covers.openlibrary.org)"*). Kapak dosyaları kalıcı olarak kopyalanmaz; yalnızca URL saklanır.

> İnce ayrım: Metadata (başlık, yazar, ISBN, sayfa) önbelleğe alınabilir (CC0/olgusal veri). Kapak **görselinin bit'lerini** kalıcı depolamak ise ayrı bir telif meselesidir — bunu yapmayın.

### Örnek Book JSON şeması

```json
{
  "key": "book_9789750718533",
  "isbn13": "9789750718533",
  "isbn10": null,
  "title": "Kürk Mantolu Madonna",
  "authors": ["Sabahattin Ali"],
  "cover_url": "https://covers.openlibrary.org/b/isbn/9789750718533-L.jpg",
  "cover_source": "openlibrary",
  "page_count": 160,
  "published_year": 1943,
  "publisher": "Yapı Kredi Yayınları",
  "subjects": ["Türk edebiyatı", "Roman"],
  "language": "tur",
  "source": "google_books",
  "added_at": "2026-07-21T10:00:00Z",
  "shelf": "reading",
  "rating": null,
  "notes": null,
  "started_at": "2026-07-21",
  "finished_at": null
}

```

`shelf` değerleri: `reading` (Okuyorum) / `to_read` (Okuyacağım) / `finished` (Bitirdim) + opsiyonel özel raf ID'leri.

### Reading session veri modeli

```json
{
  "session_id": "uuid",
  "user_id": "uuid",
  "book_key": "book_9789750718533",
  "date": "2026-07-21",
  "duration_min": 30,
  "pages_from": 20,
  "pages_to": 45,
  "created_at": "2026-07-21T22:10:00Z"
}

```

**Günlük puan akışı:** Mevcut modül "dk" birimini kullandığından `duration_min` doğrudan günlük puana map edilir. Sayfa bazlı ilerleme için `pages_to - pages_from` istatistiklere ve (istenirse) hedefe akar. Kullanıcıya süre VEYA sayfa girme seçeneği verin; ikisinden biri zorunlu olsun.

### Yıllık hedef (challenge) modeli

```json
{
  "user_id": "uuid",
  "year": 2026,
  "target_books": 24,
  "completed_books": 7,
  "target_pages": null
}

```

`completed_books`, `shelf == "finished"` ve `finished_at.year == year` olan kitaplardan türetilebilir (denormalize saklamak gösterim hızı için faydalı).

### İstatistik için saklanması gereken alanlar

- **Bitirilen kitap**: `finished_at` dolu kayıt sayısı.
- **Toplam sayfa/süre**: session'ların `duration_min` ve `(pages_to-pages_from)` toplamı.
- **En çok okunan tür/yazar**: `subjects[]` ve `authors[]` üzerinden agregasyon.
- **Aylık/haftalık ritim**: [`session.date`](http://session.date) gruplaması.
- **Ortalama puan**: `rating` ortalaması (bitirilen kitaplarda).

---

## Recommendations

**Aşama 1 (MVP):**

1. **Metadata**: Birincil Google Books (ISBN-13 ile, `country=TR`), yedek/kapak Open Library Covers. Tümü **backend proxy + MongoDB önbellek** arkasından; her istekte User-Agent + iletişim email'i ekleyin.
2. **Barkod**: `expo-camera` + **EAS development build**. Expo Go'ya bel bağlamayın. Taranan EAN-13'ü checksum ile doğrulayıp 978/979 önekini kontrol edin, sonra doğrudan ISBN-13 sorgusuna bağlayın.
3. **Raflar + session + yıllık hedef** yukarıdaki şemalarla; `duration_min`'i mevcut günlük puan modeline map edin.

**Aşama 2:** 4. **Ücret modeli kontrolü**: Uygulama ücretli/abonelikliyse Google Books ToS "fee" maddesini hukukçuya değerlendirin; gerekirse Open Library'yi birincil metadata yapıp kapaklarda OL'e dönün. 5. **TR eksik akışı**: Google Books boşsa → Open Library'ye, o da boşsa → **manuel giriş** formuna düş. Manuel girişte kullanıcının ISBN + başlık girmesine izin verin.

**Aşama 3:** 6. **Milli Kütüphane KÂŞİF** ile programatik (Z39.50/SRU) erişim için kütüphaneyle iletişime geçin — Türkçe uzun kuyruğu kapatmanın tek otoriter yolu. 7. **UX**: Yıllık hedef + ilerleme çubuğu; streak opsiyonel + telafili; sosyal karşılaştırma varsayılan kapalı.

**Değişimi tetikleyecek benchmark'lar:** Google Books günlük 1.000 istek kotasına yaklaşılırsa kota artışı talep edin veya önbellek TTL'ini uzatın; kapak 100/IP/5dk limiti aşılırsa Books API cover-ID yoluna (limitsiz) geçin.

---

## Kararı değiştirecek eşikler

- **Google Books ToS ücret yasağı** sup-port'un iş modeliyle (ücretli/abonelik) çelişirse → Google Books'u birincil metadata'dan çıkarın, **Open Library birincil** olsun.
- **Türkçe hit oranı düşükse** (kendi API key'inizle örnek 50–100 güncel TR ISBN'i test edin; hedef ör. &gt;%80): → Milli Kütüphane KÂŞİF entegrasyonu veya lisanslı bir feed öncelik kazansın.
- **Open Library kapak rate-limit'i (100/IP/5dk)** kullanıcı hacmini karşılamazsa → Books API cover-ID yolu (rate-limit'siz) veya lisanslı kapak kaynağı.
- **expo-camera EAN-13 güvenilirliği düşükse** (yanlış tip/başarısız tarama şikâyeti artarsa) → `react-native-vision-camera` + barcode-scanner'a geçin.
- **Gizlilik/regülasyon** (KVKK) doğrudan istemci sorgusuna izin vermezse → backend proxy zaten önerilen; doğrudan istemci seçeneğini tamamen kaldırın.

---

## En kritik riskler

1. **Kapak telifi (en yüksek risk)**: Kapaklar yayınevi telifidir. Open Library kapaklarını [`covers.openlibrary.org`](http://covers.openlibrary.org) URL'inden **göstermek** izinlidir; ancak kalıcı olarak kendi CDN/depolamanıza **kopyalamak veya toplu indirmek** OL ToS ihlali (*"do not crawl our cover API… we may decide to block your crawl"*) + telif riskidir. Kapağı istemcide OL URL'inden gösterin, bit'lerini saklamayın. Nezaket linki ([openlibrary.org](http://openlibrary.org)'a) ekleyin.
2. **Google Books ticari/ücret kısıtı**: Ücretli uygulamada ToS ihlali; ayrıca ihlal iddiasında içerik kaldırma yükümlülüğü.
3. **Gizlilik**: Doğrudan istemci→üçüncü taraf sorgusu kullanıcı kütüphanesini/aramalarını üçüncü tarafa kullanıcı IP'siyle sızdırır → **backend proxy zorunlu** kabul edin.
4. **Barkod Expo Go bağımlılığı**: Dev build atlanırsa üretimde tarama çalışmaz; test cihazında (fiziksel) doğrulayın.
5. **TR uzun kuyruk boşlukları**: Hiçbir ücretsiz kaynak Türkçe uzun kuyruğu tam kapsamıyor → **manuel giriş fallback'i şarttır** (aksi halde kullanıcı kitabını ekleyemez ve modül terk edilir).

---

### Başlıca kaynaklar

- Open Library Covers API — [https://openlibrary.org/dev/docs/api/covers](https://openlibrary.org/dev/docs/api/covers)
- Open Library APIs (rate limit) — [https://openlibrary.org/developers/api](https://openlibrary.org/developers/api)
- Open Library Books API — [https://openlibrary.org/dev/docs/api/books](https://openlibrary.org/dev/docs/api/books)
- Open Library Search API — [https://openlibrary.org/dev/docs/api/search](https://openlibrary.org/dev/docs/api/search)
- Google Books API ToS — [https://developers.google.com/books/terms](https://developers.google.com/books/terms)
- Google Books Branding Guidelines — [https://developers.google.com/books/branding](https://developers.google.com/books/branding)
- Google Books Volume reference (alanlar) — [https://developers.google.com/books/docs/v1/reference/volumes](https://developers.google.com/books/docs/v1/reference/volumes)
- Google Books kota (Drupal doküman) — [https://www.drupal.org/docs/extending-drupal/contributed-modules/contributed-module-documentation/google-books/google-books-module-and-api-usage](https://www.drupal.org/docs/extending-drupal/contributed-modules/contributed-module-documentation/google-books/google-books-module-and-api-usage)
- Expo Camera dokümanı — [https://docs.expo.dev/versions/latest/sdk/camera/](https://docs.expo.dev/versions/latest/sdk/camera/)
- Expo SDK 52 changelog (barcode-scanner kaldırma) — [https://expo.dev/changelog/2024-11-12-sdk-52](https://expo.dev/changelog/2024-11-12-sdk-52)
- expo → expo-camera geçiş notu — [https://github.com/expo/fyi/blob/main/barcode-scanner-to-expo-camera.md](https://github.com/expo/fyi/blob/main/barcode-scanner-to-expo-camera.md)
- expo-camera Expo Go barkod sorunu — [https://github.com/expo/expo/issues/26658](https://github.com/expo/expo/issues/26658)
- VisionCamera barcode scanning — [https://react-native-vision-camera.com/docs/guides/code-scanning](https://react-native-vision-camera.com/docs/guides/code-scanning)
- vision-camera vs expo-camera karşılaştırma — [https://scanbot.io/blog/react-native-vision-camera-vs-expo-camera/](https://scanbot.io/blog/react-native-vision-camera-vs-expo-camera/)
- ISBN / Bookland EAN-13 — [https://en.wikipedia.org/wiki/International_Standard_Book_Number](https://en.wikipedia.org/wiki/International_Standard_Book_Number) ; [https://www.bisg.org/barcoding-guidelines-for-the-us-book-industry](https://www.bisg.org/barcoding-guidelines-for-the-us-book-industry)
- Goodreads challenge çalışması — [https://arxiv.org/abs/2012.03932](https://arxiv.org/abs/2012.03932)
- Streak/gamification riskleri — [https://yukaichou.com/gamification-analysis/streak-design-gamification-motivation-burnout/](https://yukaichou.com/gamification-analysis/streak-design-gamification-motivation-burnout/) ; [https://myscp.onlinelibrary.wiley.com/doi/10.1002/arcp.70004](https://myscp.onlinelibrary.wiley.com/doi/10.1002/arcp.70004)
- Goal setting &amp; extensive reading — [https://files.eric.ed.gov/fulltext/EJ1250956.pdf](https://files.eric.ed.gov/fulltext/EJ1250956.pdf)
- TR ISBN resmi sistem — [https://www.yayfed.org/isbn](https://www.yayfed.org/isbn) ; [https://ekygm.gov.tr/Home/IsbnIndex](https://ekygm.gov.tr/Home/IsbnIndex) ; [https://www.turkiye.gov.tr/kultur-isbn-issn](https://www.turkiye.gov.tr/kultur-isbn-issn)
- Milli Kütüphane KÂŞİF — [https://kasif.mkutup.gov.tr/](https://kasif.mkutup.gov.tr/) ; [https://www.millikutuphane.gov.tr/page/Katalog-Tarama](https://www.millikutuphane.gov.tr/page/Katalog-Tarama)
- CC0 / metadata lisansı — [https://creativecommons.org/2012/08/14/library-catalog-metadata-open-licensing-or-public-domain/](https://creativecommons.org/2012/08/14/library-catalog-metadata-open-licensing-or-public-domain/)


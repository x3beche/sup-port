# Araştırma Görevi: sup-port "Okuma / Kütüphane" Modülü

> Bir araştırma agent'ına verilecek prompt. Çıktı uygulamaya veri/karar olarak
> girecek; **yapılandırılmış** ve **kaynaklı** olmalı. Öneri: Opus + research modu.
> (Spor modülünde bu akış işe yaradı: agent bir rapor döndürdü, ondan geliştirdik.)

---

Sen kitap verisi, açık API'ler ve mobil okuma-takip uygulamaları alanında
araştırmacısın. "sup-port" adlı bir kişisel-gelişim süperapp'ine (Expo/React
Native + FastAPI/MongoDB) bir **Okuma/Kütüphane modülü** kuruyoruz. Kullanıcı
kitaplarını raflara koyacak, okuma sürelerini kaydedecek (bu günlük puana
akacak), yıllık okuma hedefi ve istatistik görecek. **Verilmiş kararlar:**
kitap meta verisi + kapak için **Open Library** ve **ISBN barkod tarama**;
**uygulama içi okuyucu YOK** (şimdilik). Aşağıdakileri araştır ve **kaynaklı**,
**karşılaştırma tablolu** döndür.

## Zorunlu kısıtlar (bunları her seçenek için açıkça değerlendir)
1. **Telif/Lisans:** Metadata ve özellikle **kapak görselleri** için lisans ve
   ticari uygulama içi kullanım koşulu. Kapaklar çoğu zaman yayınevi telifidir —
   Open Library kapaklarını gösterme/önbellekleme hakkı nedir? Metadata lisansı
   (Open Library verisi kamu malı/CC0 mı)? Kitap **içeriği** asla shipping edilmez.
2. **Gizlilik:** Aramaların/ISBN sorgularının nereye gittiği (cihaz→üçüncü taraf);
   kullanıcının kütüphanesi kişisel veridir. Sorgu bir servise gidiyorsa belirt.
3. **TR kapsamı:** Türkçe kitaplar ve Türkiye ISBN'leri ne kadar iyi kapsanıyor
   (Open Library vs Google Books). Eksikse yedek kaynak öner.

## 1. Kitap meta verisi API'leri
- **Open Library** (Books API, Search API, Covers API) ve **Google Books API**'yi
  karşılaştır: lisans/ToS (ticari kullanım), rate limit, kimlik doğrulama gerekip
  gerekmediği, döndürülen alanlar (başlık, yazar, ISBN, sayfa sayısı, yayın yılı,
  yayınevi, konu/kategori, açıklama, kapak URL'leri), TR kapsamı, çevrimdışı önbellek.
- **Kapak görselleri:** her kaynağın kapak URL yapısı, çözünürlük, **lisans/kullanım
  hakkı**, eksik kapak durumu. Kapağı önbelleğe almak/göstermek hukuken uygun mu?
- **Öneri:** app için birincil + yedek kaynak ve neden. Backend proxy + önbellek mi,
  doğrudan istemci mi (gizlilik/rate-limit açısından)?

## 2. ISBN barkod tarama (Expo SDK 57)
- Expo'da barkod/QR tarama: **expo-camera** (barcode scanning) güncel durumu, SDK 57
  API'si, EAN-13 (ISBN) desteği, **development build** gerektirmesi (Expo Go'da
  çalışır mı?), izin akışı, çevrimdışı çalışma. Alternatif kütüphaneler varsa kıyasla.
- Taranan EAN-13 → ISBN-13 dönüşümü ve metadata sorgusuna bağlama akışı.

## 3. Okuma-takip modeli ve veri şeması
- **Raflar:** Okuyorum / Okuyacağım / Bitirdim (+ opsiyonel özel raflar). Kitap
  varlığı (book) için önerilen **JSON şeması** (key, isbn13, title, authors[],
  cover_url, page_count, published_year, publisher, subjects[], source, added_at,
  shelf, rating?, notes?, started_at?, finished_at?).
- **Okuma seansı:** süre (dk) veya sayfa bazlı ilerleme → günlük puana nasıl akmalı
  (mevcut modüller günlük değer/hedef modeli kullanıyor; okuma zaten "dk" birimiyle var).
- **Yıllık hedef (challenge):** Goodreads tarzı "yılda N kitap" — ilerleme/gösterim.
- **İstatistik:** bitirilen kitap, toplam sayfa/süre, en çok okunan tür/yazar,
  aylık/haftalık ritim, ortalama puan.

## 4. UX ve motivasyon (kısa, kaynaklı)
- Okuma alışkanlığı için kanıtlı motivasyon öğeleri (seri/streak, hedef, ilerleme
  görselleştirme). Aşırı oyunlaştırmadan kaçınma notu.

## Biçim
- Her başlık: yapılandırılmış çıktı + kaynak URL listesi.
- Meta veri API'leri ve barkod kütüphaneleri için **karşılaştırma tablosu**
  (lisans / kapak hakkı / TR kapsam / rate limit / auth / çevrimdışı).
- Başlangıç için **örnek Book JSON** ve **Open Library çağrı örnekleri** (ISBN ile
  arama + kapak URL kalıbı).
- Kısa, uygulanabilir; pazarlama dili yok. "Kararı değiştirecek eşikler" ve
  "en kritik riskler" (özellikle kapak telifi) bölümleriyle bitir.

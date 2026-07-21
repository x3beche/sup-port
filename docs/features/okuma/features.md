# Okuma / Kütüphane Modülü — Özellikler

Dakika sayacından kişisel bir kütüphaneye. (İçerik sunmayız; kullanıcının kendi
kitaplığını + ilerlemesini takip eder.)

## Vizyon
Kullanıcı okuduğu kitapları rafa ekler, ilerlemesini ve istatistiklerini görür;
günlük okuma dakikası hedefi ve puan entegrasyonu korunur.

## Kararlar (kullanıcı onayı)
- Kapak + meta veri: **Open Library API + ISBN barkod tarama** ile otomatik.
- Uygulama içi okuyucu (Gutenberg): **şimdilik yok** — sonraki adıma bırakıldı.

## Özellikler

### Kütüphane / raflar
- Kitap durumları: **Okuyorum / Okuyacağım / Bitirdim**.
- Kitap kaydı: başlık, yazar, kapak, toplam sayfa, mevcut sayfa.
- Kitap ekleme: başlık/ISBN ile Open Library araması **veya** kamerayla barkod
  tarama; elle ekleme de mümkün.

### İlerleme ve oturum
- Kitap başına % ilerleme (mevcut sayfa / toplam).
- Okuma oturumu: başlat-durdur → kaç dakika + kaç sayfa. Dakika günlük hedefe
  ve puana akar.
- Okuma serisi (streak): arka arkaya okuma günleri.

### Yıllık okuma hedefi
- "Bu yıl N kitap" challenge + ilerleme çubuğu (Goodreads mantığı).

### Keyif
- Bitirilen kitaba yıldız (puan) + kısa yorum.
- Kişisel not / favori alıntı (kendi notların — telif sorunu değil).

### İstatistik
- Bu ay/yıl bitirilen kitap, toplam sayfa/dakika, ortalama hız (sayfa/saat),
  tür dağılımı, en uzun seri.

## Kısıtlar / dikkat
- Open Library **API kullanım koşulları** ve **kapak görseli lisansı** önden
  doğrulanmalı (rate limit, atıf gereksinimi, ticari kullanım).
- Barkod tarama **native** (kamera) — Expo Go'da çalışmaz, **development build**
  gerekir; izin akışı (kamera) eklenmeli.
- Kapaklar çevrimdışı için önbelleğe alınmalı; ağ yoksa placeholder.

# Okuma / Kütüphane Modülü — Yapılacaklar

## Ön araştırma (hafif)
- [ ] Open Library API: arama + kapak uçları, rate limit, atıf/lisans koşulları,
      ISBN ile sorgu. (Google Books alternatif; kapak lisansını karşılaştır.)
- [ ] Barkod kütüphanesi: `expo-camera` (barcode scanning) — izin, format (EAN-13).

## Backend
- [ ] `books` koleksiyonu: user_id, title, author, cover_url, total_pages,
      current_page, status (reading/want/finished), rating, review, started_at,
      finished_at, isbn.
- [ ] `reading_sessions` koleksiyonu: user_id, book_id, minutes, pages, date.
- [ ] `notes` (opsiyonel): kitap başına alıntı/not.
- [ ] Uçlar:
  - `GET /api/books?status=`, `POST /api/books`, `PATCH /api/books/{id}`,
    `DELETE /api/books/{id}`
  - `POST /api/books/{id}/session` (dakika+sayfa) → günlük okumaya akar
  - `GET /api/reading/summary` (yıllık hedef, istatistik, seri)
  - `GET /api/books/search?q=` → Open Library proxy (rate limit + önbellek)
  - Yıllık hedef: kullanıcı belgesinde `reading_goal_year`.
- [ ] Kapakları backend proxy'leyip önbelleğe al (CORS + gizlilik + hız).

## Frontend
- [ ] `LibraryScreen`: raflara göre sekmeler (Okuyorum/Okuyacağım/Bitirdim).
- [ ] `BookDetailScreen`: kapak, ilerleme, oturum başlat, puan/yorum, notlar.
- [ ] `AddBookScreen`: arama (Open Library) + **barkod tarama** + elle giriş.
- [ ] `ReadingStatsScreen`: yıllık hedef, aylık/yıllık kitap, hız, seri.
- [ ] Modül ana ekranı: bugünkü okuma + "okumaya başla" + o an okunan kitap(lar).
- [ ] Kapak önbelleği + placeholder.

## Entegrasyon
- [ ] Oturum dakikası → günlük "Okuma" değerine ve puana.
- [ ] Kamera izni → development build + `app.config.js` izin açıklaması.
- [ ] Gizlilik politikası: Open Library'ye giden sorgular + kamera kullanımı.

## Test
- [ ] API: kitap CRUD, oturum, arama proxy (mock), yıllık hedef, izolasyon.
- [ ] UI: raf geçişi, kitap ekleme (elle), ilerleme, istatistik.
- [ ] Barkod akışı cihazda/emülatörde elle doğrulanır (Playwright kapsamaz).

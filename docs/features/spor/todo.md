# Spor Modülü — Yapılacaklar

> Araştırma sonucu (`research-prompt.md`) geldikten sonra veriyle beslenecek.

## Backend
- [ ] `exercises.py`: egzersiz kaydı (araştırma JSON'undan üret) — key, ad TR/EN,
      kategori, kas grubu, ekipman, zorluk, low_impact, met, adımlar, uyarı,
      görsel(+lisans), default set/tekrar veya süre.
- [ ] `workouts` koleksiyonu: kullanıcı antrenman oturumları (egzersiz, set,
      tekrar, ağırlık/süre, tarih).
- [ ] `body_metrics` koleksiyonu: boy, kilo (zaman serisi), hedef kilo.
- [ ] `programs.py`: hazır programlar (başlangıç, düşük-etki, ev...).
- [ ] Uçlar:
  - `GET /api/exercises` (filtreli), `GET /api/exercises/{key}`
  - `POST /api/workouts` (oturum kaydet), `GET /api/workouts?date=`
  - `PUT /api/body/weight`, `GET /api/body` (kilo geçmişi + BMI)
  - `GET /api/programs`, program başlatma/ilerleme
  - `GET /api/exercises/summary` (haftalık dakika, kalori, seri)
- [ ] Kalori: MET × kg × saat; kilo yoksa tahmin devre dışı + uyarı.
- [ ] BMI: WHO eşikleri (araştırmadan), sınıf etiketi.

## Frontend
- [ ] `ExerciseLibraryScreen`: kategori/filtre + kart listesi.
- [ ] `ExerciseDetailScreen`: görsel, adımlar, uyarılar, "antrenmana ekle".
- [ ] `WorkoutScreen`: aktif antrenman (egzersiz sırası, set sayacı, süre).
- [ ] `BodyScreen`: kilo girişi, kilo grafiği, BMI kartı, hedef.
- [ ] `ProgramsScreen`: program listesi + haftalık plan görünümü.
- [ ] Modül ana ekranı: bugünkü aktivite + hızlı "antrenman başlat" + istatistik.
- [ ] Görseller: seçilen açık lisanslı set (bundle) ya da vektör ikon fallback.

## Entegrasyon
- [ ] Antrenman süresi → günlük "Spor" değerine ve puana akar.
- [ ] `modules.py` "steps" kaydı "spor" olarak zenginleşir (veya yeni modül key).
- [ ] Boy/kilo/kalori → gizlilik politikası + veri güvenliği formu güncellemesi.

## Test
- [ ] API: egzersiz listesi/filtre, antrenman kaydı, BMI hesabı, kalori, izolasyon.
- [ ] UI: kütüphane render, antrenman akışı, kilo grafiği.

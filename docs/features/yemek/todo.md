# Yemek / Beslenme Modülü — Yapılacaklar

> Araştırma (`research-prompt.md`) sonrası: besin veri tabanı + fotoğraf-tahmin
> yaklaşımı seçilecek.

## Backend
- [ ] `foods` / arama proxy: Open Food Facts (barkod) + arama kaynağı.
- [ ] `meals` koleksiyonu: user_id, date, meal_type, items[] (ad, kalori,
      makro, kaynak: foto/barkod/arama/elle), photo_hash?.
- [ ] `nutrition_profile`: boy, kilo, yaş, cinsiyet, aktivite, hedef →
      BMR/TDEE → günlük kalori/makro hedefi.
- [ ] Uçlar:
  - `POST /api/meals`, `GET /api/meals?date=`, `PATCH/DELETE`
  - `GET /api/foods/search?q=`, `GET /api/foods/barcode/{code}` (proxy+önbellek)
  - `POST /api/meals/estimate` (fotoğraf → tahmin; seçilen servis)
  - `GET /api/nutrition/summary?date=` (günlük kalori/makro + hedef)
- [ ] Fotoğrafı **saklamadan** işle (gizlilik); yalnızca tahmin sonucunu tut.
- [ ] Günlük hedef: BMR/TDEE (Mifflin-St Jeor), güvenli alt sınır uyarısı.

## Frontend
- [ ] `MealLogScreen`: öğünlere göre günlük liste + toplam kalori/makro halkası.
- [ ] `AddFoodScreen`: **fotoğraf** / barkod / arama / elle sekmeler.
- [ ] Fotoğraf akışı: çek → tahmin → **düzenle & onayla** ("tahmini" ibaresi).
- [ ] `NutritionStatsScreen`: haftalık kalori/makro, hedefe uyum.
- [ ] Modül ana ekranı: bugünkü kalori/hedef + hızlı "öğün ekle".

## Entegrasyon
- [ ] Öğün kaydı → günlük "Beslenme" değerine ve puana.
- [ ] Kamera izni + development build; fotoğraf servisi anahtarı env'de.
- [ ] Gizlilik politikası + veri güvenliği formu: fotoğraf gönderimi,
      besin API sorguları, saklanan/saklanmayan veri.

## Test
- [ ] API: öğün CRUD, arama/barkod proxy (mock), TDEE hesabı, izolasyon.
- [ ] UI: öğün ekleme (elle+arama), günlük özet, hedef.
- [ ] Fotoğraf akışı cihazda elle doğrulanır; tahmin servisi mock'lanır.

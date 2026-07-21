# Araştırma Görevi: sup-port "Yemek / Beslenme" Modülü

> Bir araştırma agent'ına verilecek prompt. Çıktı uygulamaya veri/karar olarak
> girecek; **yapılandırılmış**, **kaynaklı**, **karşılaştırma tablolu** olmalı.
> Öneri: Opus + research modu. (Spor modülünde bu akış işe yaradı: agent bir
> rapor döndürdü, ondan geliştirdik — aynı kaliteyi hedefle.)

---

Sen beslenme/besin verisi ve gıda görüntü tanıma alanında araştırmacısın.
"sup-port" adlı kişisel-gelişim süperapp'ine (Expo/React Native + FastAPI/MongoDB)
bir **Yemek/Beslenme modülü** kuruyoruz. Kullanıcı ne yediğini hızlıca kaydedecek
(fotoğraf / barkod / arama / elle), günlük kalori-makro hedefine göre ilerlemesini
görecek; öğün kaydı günlük puana akacak. **Uygulama bağlamı:** spor modülünde
zaten **OpenRouter LLM entegrasyonu** var (pydantic-ai, ucuz model, structured
çıktı) — fotoğraftan kalori için çok-modlu (vision) LLM seçeneği bunu yeniden
kullanabilir; bunu değerlendir. Aşağıdakileri araştır ve **kaynaklı** döndür.

## Zorunlu kısıtlar (her seçenek için açıkça değerlendir)
1. **Lisans:** Her besin veri tabanı / API için lisans ve **ticari uygulama içi
   kullanım** koşulu. Belirsiz/telifli kaynak önerme. Open Food Facts açık (ODbL) —
   atıf/share-alike yükümlülüğünü netleştir.
2. **Gizlilik:** Fotoğraf işleyen her çözüm için verinin nereye gittiği (cihaz mı,
   bulut mu), saklanıp saklanmadığı, GDPR-KVKK etkisi. Yemek fotoğrafı cihazdan
   çıkıyorsa gönderim öncesi kullanıcıya açık uyarı gerekir.
3. **Sağlık:** Kalori/diyet önerileri **genel ve kaynaklı** (WHO, kayıtlı
   diyetisyen); kişiye özel reçete değil. **Yeme bozukluğu riskine duyarlı ol** —
   agresif kalori kısıtlaması dayatma, asgari sınır uyarıları koy.

## 1. Besin veri tabanı (arama + barkod)
- **Open Food Facts**, USDA FoodData Central, Nutritionix, Edamam'ı karşılaştır:
  lisans, kapsam (paketli/taze/hazır/restoran), **barkod** desteği, API/rate limit,
  auth, **TR ürün ve TR yemek** kapsamı, çevrimdışı önbellek, ticari+uygulama içi
  kullanım serbest mi.
- Paketli ürün (barkod) ve taze/ev yemeği (arama) için ayrı kaynak gerekebilir —
  hangi kombinasyon? Backend proxy + önbellek mi, doğrudan istemci mi (gizlilik/limit)?

## 2. Fotoğraftan kalori tahmini
- Yaklaşımlar: (a) **çok-modlu LLM** (yemeği tanı + porsiyon/kalori tahmini —
  OpenRouter'daki ucuz vision modelleriyle; hangileri, maliyet/1M, doğruluk?),
  (b) özel gıda-tanıma API'leri (LogMeal, Foodvisor, Passio, Calorie Mama...),
  (c) cihaz-üstü model. Her biri için: **doğruluk** (yayınlanmış hata payları,
  kaynak), **maliyet**, **gizlilik** (fotoğraf nereye gidiyor, saklanıyor mu),
  TR yemek kapsamı, entegrasyon zorluğu, çevrimdışı.
- **Gerçekçi beklenti (kaynaklı):** fotoğraftan kalori ne kadar hatalı olur?
  Kullanıcıya nasıl "tahmin" olarak sunulmalı, **düzelt-onayla** akışı nasıl olmalı.
- **Öneri:** app için en uygulanabilir + gizlilik açısından en güvenli yaklaşım.

## 3. Günlük kalori/makro hedefi
- **BMR/TDEE** (Mifflin-St Jeor tercih; kaynak) + aktivite katsayıları. (Not: spor
  modülü zaten boy/kilo/yaş/cinsiyet/aktivite profili tutuyor — paylaşılabilir.)
- Hedefe göre ayar (ver/koru/al): **güvenli** kalori açığı aralığı ve **asgari
  kalori** sınırları (kaynak; sağlık uyarısı). Makro dağılımı genel aralıkları
  (protein/karb/yağ, kaynak).

## Biçim
- Her başlık: yapılandırılmış çıktı + kaynak URL listesi.
- Besin veri tabanı ve fotoğraf-tahmin seçenekleri için **karşılaştırma tablosu**
  (lisans / doğruluk / maliyet / gizlilik / TR kapsam / çevrimdışı).
- Başlangıç için **örnek besin/öğün JSON şeması** (food: name, brand?, barcode?,
  serving_g, kcal, protein_g, carb_g, fat_g, source; meal: date, meal_type,
  items[], photo_hash?) ve Open Food Facts barkod çağrı örneği.
- "Kararı değiştirecek eşikler" ve **"en kritik riskler"** (fotoğraf-kalori
  hatası + gizlilik + yeme bozukluğu hassasiyeti) bölümleriyle bitir.
- Kısa, uygulanabilir; pazarlama dili yok.

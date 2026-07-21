# sup-port — Yemek / Beslenme Modülü: Araştırma Raporu

> Kapsam: (1) besin veri tabanı, (2) fotoğraftan kalori, (3) günlük kalori/makro hedefi. Her başlıkta yapılandırılmış çıktı + kaynak. Sonda **kararı değiştirecek eşikler** ve **en kritik riskler**. Bu rapor hukuki/tıbbi tavsiye değildir; lisans ve sağlık maddeleri için son onayı ilgili uzmandan alın.

---

## 0. Özet ve öneri (TL;DR)

- **Barkod / paketli ürün:** Open Food Facts (OFF) birincil kaynak. Ücretsiz, ticari+uygulama içi kullanıma açık (ODbL), global + TR kapsamı var, gecelik veri dökümü ile çevrimdışı önbellek kurulabilir. **Backend proxy + önbellek** ile kullan (rate limit, User-Agent, gizlilik).
- **Taze / genel malzeme / ev yemeği makroları:** USDA FoodData Central (CC0, yükümlülük yok) referans tablosu olarak. Ama **TR ev yemekleri kapsamı yok** — bunun için ya yerel bir kompozisyon tablosu (ör. TÜBER) ya da LLM tahmini + kullanıcı onayı gerekir.
- **Fotoğraftan kalori:** İki gerçekçi yol var. **(a)** En gizli + Expo/RN'e en uygun: **Passio cihaz-üstü SDK** (fotoğraf cihazdan çıkmaz, React Native SDK'sı var). **(b)** En ucuz + mevcut altyapıyı yeniden kullanan: **OpenRouter vision LLM** (Gemini 2.5 Flash-Lite / Qwen VL) — ama fotoğraf buluta gider, ZDR + eğitim kapatma ayarı + **açık kullanıcı onayı** (KVKK) şart.
- **Her koşulda:** fotoğraf kalorisi "tahmin" olarak sunulmalı, **düzelt-onayla akışı** zorunlu, tek sayı yerine **aralık** göster. Öğün fotoğrafı cihazdan çıkacaksa **gönderim öncesi açık uyarı**.
- **Hedef:** BMR için Mifflin-St Jeor, TDEE için aktivite katsayısı; açık **500 kcal/gün ≈ 0,5 kg/hafta**, **asgari sınırlar** (kadın ≥1200, erkek ≥1500 kcal/gün, tıbbi gözetim olmadan). Yeme bozukluğu riskine karşı agresif açık dayatma yok, sınır uyarıları var.

---

## 1. Besin veri tabanı (arama + barkod)

### 1.1 Karşılaştırma tablosu


| Kriter                    | Open Food Facts                                                           | USDA FoodData Central                                              | Nutritionix                                            | Edamam                                  |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------- |
| **Lisans**                | ODbL (DB) + DbCL (içerik) + CC-BY-SA (görsel)                             | CC0 / kamu malı                                                    | Tescilli / ticari                                      | Tescilli / freemium                     |
| **Ticari + uygulama içi** | Serbest (atıf + share-alike koşuluyla)                                    | Serbest, koşulsuz                                                  | Ücretli katmanlarda                                    | Ücretli katmanlarda                     |
| **Kapsam**                | Paketli/barkodlu ürün, global (~3M)                                       | ABD; ham/analitik (Foundation, SR Legacy), FNDDS, Branded (~400k+) | ABD markalı + restoran zinciri menüleri                | ~900k gıda, 680k+ UPC, tarifler         |
| **Barkod**                | Evet (temiz endpoint)                                                     | Dolaylı (branded'da GTIN var, temiz "barkodla ara" yok)            | Evet (UPC, ağırlıklı ABD)                              | Evet (UPC)                              |
| **Rate limit**            | 15 istek/dk ürün, 10/dk arama, 2/dk facet (IP başına)¹                    | 1000 istek/saat (ücretsiz key)                                     | 200 çağrı/gün (ücretsiz), üstü ücretli                 | 1000 istek/gün, 50/dk (ücretsiz)        |
| **Auth**                  | Yok (özel User-Agent zorunlu)                                             | Ücretsiz [data.gov](http://data.gov) key                           | API key                                                | API key                                 |
| **TR ürün**               | Orta (büyük TR markaları var, küçükler seyrek; TR arayüz/instance mevcut) | Yok (ABD)                                                          | Zayıf (ABD odaklı)                                     | Zayıf; ama NLP Türkçe metni destekliyor |
| **TR ev yemeği**          | Yok                                                                       | Yok (jenerik malzeme referansı olarak dolaylı)                     | Yok                                                    | Zayıf                                   |
| **Çevrimdışı önbellek**   | Evet — gecelik tam döküm (CSV/JSON/Parquet/MongoDB)                       | Evet — aylık toplu döküm                                           | Hayır (önbellek kısıtlı)                               | Hayır (önbellek çok kısıtlı)            |
| **Maliyet**               | Ücretsiz                                                                  | Ücretsiz                                                           | ~$50/ay (hobby) → $500–2000+/ay; enterprise $1.850/ay+ | Ücretsiz temel → $299–999/ay            |


¹ **Not:** Resmî OFF dokümantasyonu 15 istek/dk (ürün) diyor; bazı üçüncü taraf kaynaklar 100 diyor. Güvenli tarafta kalmak için 15'i baz alın; limiti aşan IP'ler yasaklanabiliyor.

### 1.2 Önemli lisans nüansları (uygulamaya doğrudan etki eder)

- **Open Food Facts / ODbL — iki yükümlülük:** *atıf* ve *share-alike*. Kritik ayrım: share-alike yükümlülüğü, OFF verisini **başka veri tabanlarıyla birleştirip türetilmiş bir veri tabanını yeniden dağıttığınızda/kamuya açtığınızda** tetiklenir; o türev DB de ODbL olmak zorunda kalır. Veriyi sadece uygulamada göstermeniz ve barkod başına önbelleğe almanız "Produced Work" sayılır ve uygulamanızın kaynak kodunu açmanızı gerektirmez. **Pratik güvenli yol:** OFF kaynaklı kayıtları ayrı/etiketli tutun, kendi verinizle tek bir yeniden-dağıtılan DB'ye eritmeyin; arayüzde şu tarz bir atıf gösterin: "Bu kayıt Open Food Facts'ten ([openfoodfacts.org](http://openfoodfacts.org)) alınmıştır, ODbL altında sunulur." (Hukuki tavsiye değildir.)
- **USDA FDC / CC0:** kamu malı; atıf bile zorunlu değil, birleştirme yükümlülüğü yok. Lisans açısından en temiz seçenek. Bedeli: besin ID'lerini kendiniz eşlemeniz (1008=enerji kcal, 1003=protein…), değerleri 100 g üzerinden ölçeklemeniz gerekir; barkod aramasını kendiniz kurmanız gerekir.
- **Nutritionix / Edamam:** tescilli. Edamam önbelleklemeyi ağır kısıtlar — yalnızca 4 makroyu (protein, yağ, net karb, kalori) kullanıcının parolalı hesabı içinde saklamaya izin verir; verinin kopyasını çıkarıp kendi aramanızı kurmanız yasak. İkisinde de atıf zorunlu.

Kaynaklar:

- OFF şartları/lisans: [https://world.openfoodfacts.org/terms-of-use](https://world.openfoodfacts.org/terms-of-use) — [https://openfoodfacts.github.io/openfoodfacts-server/api/](https://openfoodfacts.github.io/openfoodfacts-server/api/)
- OFF rate limit (resmî): [https://openfoodfacts.github.io/openfoodfacts-server/api/](https://openfoodfacts.github.io/openfoodfacts-server/api/) — [https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api)
- OFF TR instance: [https://tr.openfoodfacts.org/](https://tr.openfoodfacts.org/)
- USDA FDC lisans/limit: [https://fdc.nal.usda.gov/api-key-signup/](https://fdc.nal.usda.gov/api-key-signup/) — [https://chowapi.dev/blog/usda-fooddata-central-api-guide](https://chowapi.dev/blog/usda-fooddata-central-api-guide) — [https://selfhostednutrition.org/api/usda-fdc-api-getting-started/](https://selfhostednutrition.org/api/usda-fdc-api-getting-started/)
- Nutritionix fiyat/kapsam: [https://selfhostednutrition.org/api/nutritionix-api-when-to-use/](https://selfhostednutrition.org/api/nutritionix-api-when-to-use/) — [https://www.spikeapi.com/blog/top-nutrition-apis-for-developers-2026](https://www.spikeapi.com/blog/top-nutrition-apis-for-developers-2026)
- Edamam fiyat/önbellek: [https://developer.edamam.com/edamam-nutrition-api](https://developer.edamam.com/edamam-nutrition-api) — [https://www.oreateai.com/blog/unpacking-edamams-food-database-api-your-guide-to-nutrition-data-pricing/82fc5afd8126fb9aa92fb1edc2984522](https://www.oreateai.com/blog/unpacking-edamams-food-database-api-your-guide-to-nutrition-data-pricing/82fc5afd8126fb9aa92fb1edc2984522)

### 1.3 Kombinasyon ve mimari önerisi

- **Paketli/barkod → OFF birincil.** Global + TR kapsamı ve ücretsizlik nedeniyle. Küçük TR markaları eksikse: kullanıcıya "ürünü ekle" akışı sun (OFF'a katkı), böylece kapsam zamanla artar.
- **Taze/jenerik + ev yemeği → USDA FDC referansı** (Foundation + SR Legacy = ham malzeme, FNDDS = hazır/tüketildiği haliyle). Bir ev yemeğini malzemeye kırıp FDC değerlerinden makro hesaplayabilirsiniz. Ama TR yemek adları (mercimek çorbası, karnıyarık, lahmacun…) hiçbir yabancı DB'de düzgün yok → **yerel kompozisyon tablosu (TÜBER) veya LLM tahmini + onay** gerekli.
- **Restoran zinciri → yalnızca gerekirse Nutritionix** (menüler ABD ağırlıklı; TR için düşük değer).
- **Doğrudan istemci mi, backend proxy mi?** **Backend proxy + önbellek** önerilir:
  - Rate limit ve zorunlu User-Agent'ı tek yerden yönetirsin; IP yasağı riskini havuzlarsın.
  - Gizlilik: kullanıcının ne yediği doğrudan üçüncü tarafa gitmez, senin arka ucundan geçer.
  - **Önce yerel arama:** OFF gecelik dökümünü içeri alıp ilk aramayı kendi DB'nde yap; canlı API'yi yalnızca barkod tam eşleşmesi/eksik kayıt için çağır → hem hız hem limit dostu.
  - Karşı argüman: OFF, "istekler doğrudan kullanıcılardan geliyorsa limit kullanıcı başına uygulanır" diyor; tek paylaşılan IP'den giderken bunu per-user rate limiting ile dengele.

---

## 2. Fotoğraftan kalori tahmini

### 2.1 Karşılaştırma tablosu


| Kriter                              | (a) Çok-modlu LLM (OpenRouter vision)                                                                | (b) Özel gıda-tanıma API (Passio / LogMeal / Foodvisor…)                                 | (c) Cihaz-üstü model                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Doğruluk (enerji)**               | Karışık öğünde ~%36 MAPE (GPT-4o/Claude sınıfı); zayıf modeller %64–110                              | Bağımsız testlerde ~%10–15 MAPE (ör. Cal AI %11–14). "±%1–2" iddialarına şüpheyle yaklaş | Genelde bulut altı; karmaşık yemekte düşer          |
| **Maliyet (1M token, girdi/çıktı)** | Gemini 2.5 Flash-Lite $0,10/$0,40; Gemini 2.5 Flash $0,30/$2,50; Qwen3.5-Flash (vision) $0,065/$0,26 | Token/abonelik bazlı; Passio aşım $2,50/1M token                                         | SDK lisansı (Passio); çağrı başı bulut maliyeti yok |
| **Gizlilik (fotoğraf nereye)**      | Buluta gider (OpenRouter→sağlayıcı). Varsayılan loglamıyor ama sağlayıcı saklayabilir/eğitebilir     | Bulut modunda gider; **Passio cihaz-üstü modda cihazda kalır**                           | **Fotoğraf cihazdan çıkmaz** (en güçlü gizlilik)    |
| **TR yemek kapsamı**                | İyi tanır (geniş eğitim); ama porsiyon/kalori yine tahmin                                            | Batı/global mutfak ağırlıklı; TR ev yemeği sınırlı                                       | Etiket kümesi dar; TR ev yemeği sınırlı             |
| **Entegrasyon**                     | Düşük — mevcut OpenRouter + pydantic-ai structured çıktı yeniden kullanılır                          | Orta — SDK/REST; Passio'nun **React Native SDK'sı Expo/RN'e uyar**                       | Orta/yüksek — SDK gömme, boyut/performans           |
| **Çevrimdışı**                      | Hayır                                                                                                | Kısmen (Passio cihaz-üstü)                                                               | Evet                                                |


### 2.2 Gerçekçi beklenti (kaynaklı) — bu bölüm kritik

- **Portakal boyu hata porsiyon tahmininden gelir, yemeği tanımaktan değil.** Modeller yemeği çoğu zaman doğru tanır ama gram/porsiyonu şaşırır ve **porsiyon büyüdükçe sistematik olarak düşük tahmin eder.**
- Hakemli bulgular:
  - ChatGPT-4o ve Claude sınıfı modeller karışık öğün fotoğrafında **enerji için ~%36 MAPE**; Gemini 1.5 Pro %64–110. (Fridolfsson 2025 — Current Developments in Nutrition; DOI 10.1016/j.cdnut.2025.107556)
  - 3-LLM karşılaştırması: ChatGPT/Claude enerji MAPE ~%35,8; Gemini %64,2; makrolarda hata daha da yüksek. (ScienceDirect S2475299125030185)
  - GPT-4V'de kalori hatası tek yemekten karışık öğüne geçince kabaca **iki katına** çıkıyor. (Lo 2024)
  - Yalnızca-görüntü tahminlerinde enerji hatası %54'e, yağ hatası %76'ya kadar çıkabiliyor; gizli yağ (yağ, sos) ve karmaşık öğünlerde yoğunlaşıyor. (Çınar ve ark., J. Food Composition and Analysis)
  - Ticari fotoğraf uygulamaları bağımsız testte ~%10–15 MAPE bandında; bazı ürünlerin "±%1–2" iddiaları pazarlama kokuyor, doğrulaması zayıf → temkinli ol.
- **Uygulamaya sunum:** asla otoriter tek sayı gösterme. **"≈ 620 kcal (yaklaşık, ±%25)"** gibi bir **aralık** + düşük güven rozeti göster.
- **Düzelt-onayla akışı (zorunlu):**
  1. Model çıktısı: `items[]` (yemek adı + tahmini gram + güven) + toplam kcal/makro + `confidence`.
  2. Kullanıcı ekranda her öğeyi görür; **gramı/porsiyonu ve öğeleri düzeltebilir** (kaydırıcı + hızlı "yarım/1x/2x" butonları).
  3. Kullanıcı **onaylayınca** kaydedilir; onaylı değer günlüğe/puana akar. Onaylanmamış tahmin "taslak".
  4. Barkod veya arama ile eşleşen öğe varsa DB değerini tercih et (fotoğraf yalnızca porsiyon için).

### 2.3 Öneri (uygulama için)

- **Gizlilik önceliği ve Expo/RN uyumu → Passio cihaz-üstü SDK.** Fotoğraf cihazda kalır; barkod+foto+ses tek SDK. Not: Passio'nun "Advisor" özelliği profil verisini üçüncü taraf LLM'e (ör. GPT) taşıyabiliyor — o özelliği kullanacaksan KVKK açısından ayrıca değerlendir. TR kapsamını ve maliyeti PoC ile ölç.
- **En ucuz + mevcut altyapı → OpenRouter vision LLM** (Gemini 2.5 Flash-Lite veya Qwen VL). Spor modülündeki OpenRouter + pydantic-ai structured çıktı akışını aynen kullanırsın. **Şartlar:** OpenRouter'da ZDR aç + "train on inputs" togglelarını kapat + yalnızca eğitmeyen/saklamayan sağlayıcılara yönlendir; gönderim öncesi kullanıcıdan **açık onay** al; fotoğraftan **EXIF/konum sil**.
- **Pragmatik hibrit (önerilen ilk sürüm):** paketli → barkod (OFF, doğru); ev yemeği → foto-LLM yalnızca "hızlı tahmin" + zorunlu düzelt-onayla; **varsayılan güvenilir yol arama/elle giriş.** Fotoğraf bir kolaylık katmanı, tek doğruluk kaynağı değil.

Kaynaklar:

- Doğruluk: [https://nourli.health/ai-vs-manual-calorie-tracking](https://nourli.health/ai-vs-manual-calorie-tracking) — [https://www.sciencedirect.com/science/article/pii/S2475299125030185](https://www.sciencedirect.com/science/article/pii/S2475299125030185) — [https://www.sciencedirect.com/science/article/abs/pii/S0002916525006173](https://www.sciencedirect.com/science/article/abs/pii/S0002916525006173)
- OpenRouter fiyat: [https://openrouter.ai/qwen/qwen3.5-flash-02-23](https://openrouter.ai/qwen/qwen3.5-flash-02-23) — [https://betonai.net/openrouter-pricing-2026-complete-guide-to-every-model-tier-and-hidden-cost/](https://betonai.net/openrouter-pricing-2026-complete-guide-to-every-model-tier-and-hidden-cost/)
- OpenRouter gizlilik/ZDR: [https://openrouter.ai/docs/guides/features/zdr](https://openrouter.ai/docs/guides/features/zdr) — [https://openrouter.ai/docs/guides/privacy/logging](https://openrouter.ai/docs/guides/privacy/logging)
- Passio (cihaz-üstü, RN SDK, gizlilik): [https://www.passio.ai/pricing](https://www.passio.ai/pricing) — [https://github.com/Passiolife/Passio-Nutrition-AI-Android-SDK-Distribution](https://github.com/Passiolife/Passio-Nutrition-AI-Android-SDK-Distribution)

---

## 3. Günlük kalori / makro hedefi

### 3.1 BMR — Mifflin-St Jeor (tercih edilen)

```
Erkek:  BMR = 10*kg + 6.25*cm - 5*yaş + 5
Kadın:  BMR = 10*kg + 6.25*cm - 5*yaş - 161

```

- Modern popülasyonlar için en doğru kabul edilen denklem; ölçülmüş REE'ye göre ~±%10. Obezite, yüksek kas kütlesi ve ileri yaşta doğruluk düşer (o durumlarda Katch-McArdle vücut yağıyla daha iyi olabilir).
- **Spor modülü zaten boy/kilo/yaş/cinsiyet/aktivite profilini tutuyor → paylaşarak tekrar sorma.**
- Kaynak: Mifflin ve ark., Am J Clin Nutr 1990;51(2):241-247, PMID 2305711.

### 3.2 TDEE — aktivite katsayısı


| Aktivite                          | Katsayı |
| --------------------------------- | ------- |
| Hareketsiz (masa başı)            | 1.2     |
| Hafif (1–3 gün/hafta)             | 1.375   |
| Orta (3–5 gün/hafta)              | 1.55    |
| Yüksek (6–7 gün/hafta)            | 1.725   |
| Çok yüksek (ağır iş/2x antrenman) | 1.9     |


`TDEE = BMR × katsayı`. Uyarı: öz-bildirilen aktivite genelde abartılır → TDEE şişebilir; 2–4 hafta gerçek kilo değişimine göre kalibre et.

### 3.3 Hedefe göre ayar ve GÜVENLİ sınırlar

- **Ver (kilo verme):** açık **500 kcal/gün ≈ 0,5 kg/hafta**. Açığı **500–750 kcal/gün üstüne çıkarma.**
- **Koru:** ≈ TDEE.
- **Al (kilo alma):** ~+250 ile +500 kcal/gün fazla.
- **Asgari kalori tabanları (tıbbi gözetim olmadan, NIH/CDC):** kadın **≥1200 kcal/gün**, erkek **≥1500 kcal/gün**. Altı tıbbi gözetim gerektirir. **Hesaplanan hedef tabanın altına düşerse tabanı uygula ve uyar** ("daha yavaş ver, aktiviteyi artır").

### 3.4 Makro dağılımı (genel aralıklar, AMDR)


| Makro        | AMDR (enerjinin %'si) |
| ------------ | --------------------- |
| Karbonhidrat | %45–65                |
| Protein      | %10–35                |
| Yağ          | %20–35                |


- Klasik hipokalorik diyet ~ %50 karb / %20 protein / %30 yağ.
- Kilo verirken kas korumak için **proteini üst banda** çek: ~1,6–2,2 g/kg (≈ 0,7–1 g/lb hedef kilo).
- Sağlık notu (WHO): serbest şeker enerjinin **&lt;%10'u** olsun.

Kaynaklar:

- Mifflin-St Jeor: [https://tdeecalculator.org/mifflin-st-jeor-equation/](https://tdeecalculator.org/mifflin-st-jeor-equation/) — [https://www.promealplan.com/en/blog/mifflin-st-jeor-equation-coaches-guide](https://www.promealplan.com/en/blog/mifflin-st-jeor-equation-coaches-guide)
- Açık/asgari kalori: [https://pmc.ncbi.nlm.nih.gov/articles/PMC6163457/](https://pmc.ncbi.nlm.nih.gov/articles/PMC6163457/) — [https://www.getkalohealth.com/blog/is-1200-calories-enough](https://www.getkalohealth.com/blog/is-1200-calories-enough) — [https://www.getkalohealth.com/blog/is-1400-calories-enough](https://www.getkalohealth.com/blog/is-1400-calories-enough)
- AMDR: [https://med.libretexts.org/Courses/Allan_Hancock_College/Introduction_to_Nutrition_Science_(Bisson_et._al)/04:_Dietary_Recommendations/4.02:_Defining_Nutrient_Requirements-_Dietary_Reference_Intakes](https://med.libretexts.org/Courses/Allan_Hancock_College/Introduction_to_Nutrition_Science_(Bisson_et._al)/04:_Dietary_Recommendations/4.02:_Defining_Nutrient_Requirements-_Dietary_Reference_Intakes)

### 3.5 Yeme bozukluğu güvenlik önlemleri (modüle gömülmeli)

- Agresif açık dayatma yok; açığı 500–750 kcal ile sınırla; asgari tabanların altına inme.
- Suçlayıcı/ceza dili yok ("X kalori açıktasın, kötü!" değil; nötr ilerleme).
- Öneriler **genel ve kaynaklı** (WHO, kayıtlı diyetisyen) — kişiye özel reçete değil.
- Aşırı kısıtlama/hızlı hedefler tespit edilirse profesyonel destek kaynaklarına yönlendir.

---

## 4. Örnek JSON şeması

```json
{
  "food": {
    "name": "Süzme yoğurt",
    "brand": "Örnek Marka",
    "barcode": "8690000000000",
    "serving_g": 150,
    "kcal": 90,
    "protein_g": 8.0,
    "carb_g": 6.0,
    "fat_g": 4.0,
    "source": "openfoodfacts",
    "source_ref": "8690000000000",
    "per": "serving"
  },
  "meal": {
    "date": "2026-07-21",
    "meal_type": "breakfast",
    "items": [
      { "food_ref": "8690000000000", "qty_g": 150, "kcal": 90 },
      { "name": "Menemen (tahmin)", "qty_g": 220, "kcal": 300,
        "source": "vision_llm", "confidence": 0.55, "estimated": true }
    ],
    "total_kcal": 390,
    "photo_hash": "sha256:...",
    "confirmed": true
  }
}

```

Notlar:

- `source` alanı zorunlu: `openfoodfacts | usda_fdc | nutritionix | edamam | vision_llm | manual`. Lisans/atıf ve doğruluk izlenebilirliği için kritik.
- Fotoğraf tahmin öğelerinde `estimated: true` + `confidence` tut; `confirmed=false` iken puana katma.
- **Ham fotoğraf saklama; yalnızca** `photo_hash` (dedup/denetim için). EXIF/konum temizlenmiş olmalı.

### 4.1 Open Food Facts barkod çağrı örneği

```bash
# Yalnızca gerekli alanları iste (yanıtı küçültür); özel User-Agent ZORUNLU
curl "https://world.openfoodfacts.org/api/v2/product/3017624010701.json?fields=product_name,brands,nutriments,serving_size" \
  -H "User-Agent: sup-port/1.0 (destek@sup-port.app)"

```

```python
# Backend proxy örneği (FastAPI tarafı) — özet
import httpx

OFF_BASE = "https://world.openfoodfacts.org/api/v2/product"
HEADERS = {"User-Agent": "sup-port/1.0 (destek@sup-port.app)"}
FIELDS = "product_name,brands,nutriments,serving_size"

async def fetch_off(barcode: str):
    url = f"{OFF_BASE}/{barcode}.json?fields={FIELDS}"
    async with httpx.AsyncClient(timeout=8) as c:
        r = await c.get(url, headers=HEADERS)
    data = r.json()
    if data.get("status") != 1:          # 0 = ürün bulunamadı
        return None                       # → kullanıcıya "ürünü ekle" akışı
    n = data["product"]["nutriments"]
    return {
        "name": data["product"].get("product_name"),
        "brand": data["product"].get("brands"),
        "barcode": barcode,
        "kcal": n.get("energy-kcal_100g"),
        "protein_g": n.get("proteins_100g"),
        "carb_g": n.get("carbohydrates_100g"),
        "fat_g": n.get("fat_100g"),
        "per": "100g",
        "source": "openfoodfacts",
    }

```

(Değerler 100 g başına gelir; porsiyona ölçekle. Önce yerel önbellek/dökümde ara, yoksa canlı çağır.)

---

## 5. Kararı değiştirecek eşikler

- **TR ev yemeği kapsamı kritikse:** yerel kompozisyon tablosuna (TÜBER) yatırım yap veya LLM tahmini + onay akışını kabul et. Yabancı DB'ler bunu çözmez.
- **Fotoğraf gizliliği / KVKK riski sertse:** cihaz-üstü (Passio) seç veya fotoğraf özelliğini hiç koyma. **Maliyet** birincil kısıtsa: OpenRouter LLM (ama buluta gider).
- **Restoran/zincir loglama önem kazanırsa:** Nutritionix ekle (ABD ağırlıklı, TR değeri düşük).
- **OFF verisini kendi yeniden-dağıtılan DB'ne eritecekseniz:** ODbL share-alike tetiklenir → OFF'u ayrı/referans tut veya USDA CC0'a geç (yükümlülük yok).
- **Ölçek büyürse (rate limit sık yeniyorsa):** canlı OFF API'den gecelik döküm ithaline geç.
- **Doğruluk hedefi klinik seviyeye çıkarsa:** foto-tahmini birincil yapma; barkod + doğrulanmış DB + elle onay zorunlu olsun.

---

## 6. En kritik riskler

1. **Fotoğraf-kalori hatası (porsiyon).** En iyi modellerde bile karışık öğünde ~%36 MAPE; hata porsiyondan gelir ve büyük porsiyonda düşük tahmin sistematiktir. **Azaltma:** tahmin olarak + aralıkla sun, düzelt- onayla zorunlu, barkod/arama eşleşiyorsa DB değerini tercih et. Kullanıcının yanlış sayıya güvenip yanlış karar vermesi asıl risktir.
2. **Gizlilik — fotoğraf cihazdan çıkması.** Bulut LLM/API'de saklama/eğitim riski; öğün fotoğrafı yüz, arka plan, konum içerebilir. **Azaltma:** cihaz-üstü tercih; buluta gidecekse ZDR + eğitim kapalı + **gönderim öncesi açık onay**, EXIF/konum silme, ham fotoğraf saklamama (`photo_hash`). GDPR-KVKK: veri akışı şeffaf, veri minimizasyonu, kullanıcı silme hakkı.
3. **Yeme bozukluğu hassasiyeti.** Agresif açık, ceza/streak dili, kişiye özel katı reçete tehlikeli. **Azaltma:** asgari kalori tabanlarını uygula, açığı sınırla, nötr dil, genel+kaynaklı öneri, aşırı kısıtlama sinyalinde profesyonel desteğe yönlendir.
4. **Lisans.** OFF'u birleştirip yeniden dağıtırsan share-alike; her koşulda atıf zorunlu. USDA CC0 temiz. **Azaltma:** kaynak bazında `source` etiketle, OFF atıf metnini göster, birleştirilmiş DB'yi kamuya açma.

---

### Ek: kaynak listesi (toplu)

- Open Food Facts: terms-of-use, API docs, TR instance, rate-limit SSS (yukarıda başlık bazında linkli)
- USDA FoodData Central: api-key-signup, geliştirici rehberleri
- Nutritionix / Edamam: geliştirici sayfaları + bağımsız karşılaştırmalar
- OpenRouter: model fiyat sayfaları + ZDR/logging dokümanı
- Passio: pricing + RN SDK deposu
- Doğruluk çalışmaları: Fridolfsson 2025 (cdnut), 3-LLM karşılaştırması (ScienceDirect), Lo 2024, Çınar ve ark.
- Beslenme bilimi: Mifflin-St Jeor (PMID 2305711), NIH/CDC kalori tabanları, AMDR (IOM/DRI), WHO serbest şeker


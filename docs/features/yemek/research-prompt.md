# Araştırma Görevi: sup-port "Yemek / Beslenme" Modülü

> Bir araştırma agent'ına verilecek prompt. Çıktı uygulamaya veri/karar olarak
> girecek; **yapılandırılmış** ve **kaynaklı** olmalı. Öneri: Opus + research modu.

---

Sen beslenme/besin verisi ve gıda görüntü tanıma alanı araştırmacısısın.
"sup-port" mobil uygulaması için bir **Yemek/Beslenme modülü** kuruyoruz.
Aşağıdakileri araştır ve **kaynaklı** döndür.

## Zorunlu kısıtlar
1. **Lisans:** her besin veri tabanı / API için lisansını ve uygulama içi
   ticari kullanım koşulunu açıkça yaz. Belirsiz/telifli kaynak önerme.
2. **Gizlilik:** fotoğraf işleyen her çözüm için verinin nereye gittiğini
   (cihaz mı, bulut mu), saklanıp saklanmadığını ve gizlilik/GDPR-KVKK etkisini
   belirt.
3. **Sağlık:** kalori/diyet önerileri **genel ve kaynaklı** (WHO, kayıtlı
   diyetisyen kaynakları); kişiye özel reçete değil. Yeme bozukluğu riskine
   duyarlı ol.

## 1. Besin veri tabanı
- Açık/kullanılabilir besin veri tabanları: **Open Food Facts**, USDA
  FoodData Central, Nutritionix, Edamam vb. Her biri için: lisans, kapsam
  (paketli/taze/hazır yemek), barkod desteği, API/rate limit, TR ürün kapsamı,
  ticari+uygulama içi kullanım serbest mi.
- **Öneri:** app için en uygun(lar)ı ve neden. Barkod (paketli) için ayrı, taze
  yemek/arama için ayrı kaynak gerekebilir.

## 2. Fotoğraftan kalori tahmini
- Yaklaşımlar: (a) çok-modlu LLM (yemeği tanı + porsiyon/kalori tahmini),
  (b) özel gıda-tanıma API'leri (LogMeal, Foodvisor, Passio, Calorie Mama...),
  (c) cihaz-üstü model. Her biri için: **doğruluk** (yayınlanmış hata payları,
  kaynak), **maliyet**, **gizlilik** (fotoğraf nereye gidiyor), TR yemek kapsamı,
  entegrasyon zorluğu.
- **Gerçekçi beklenti:** fotoğraftan kalori ne kadar hatalı olur (kaynaklı)?
  Kullanıcıya nasıl "tahmin" olarak sunulmalı, düzeltme akışı nasıl olmalı.
- **Öneri:** app için en uygulanabilir yaklaşım + gizlilik açısından en güvenlisi.

## 3. Günlük kalori/makro hedefi
- **BMR/TDEE** formülleri (Mifflin-St Jeor tercih; kaynak). Aktivite katsayıları.
- Hedefe göre ayarlama (kilo verme/koruma/alma) — **güvenli** kalori açığı
  aralığı (kaynak), asgari kalori sınırları (sağlık uyarısı).
- Makro dağılımı için genel öneri aralıkları (protein/karb/yağ, kaynak).

## Biçim
- Her başlık: yapılandırılmış çıktı + kaynak URL listesi.
- Besin veri tabanı ve fotoğraf-tahmin seçenekleri için **karşılaştırma tablosu**
  (lisans / doğruluk / maliyet / gizlilik / TR kapsam).
- Kısa, uygulanabilir; pazarlama dili yok.

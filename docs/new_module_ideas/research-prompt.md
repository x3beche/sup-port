# Araştırma Görevi: sup-port için Yeni Modül (Mini-App) Fikirleri

> Bir araştırma agent'ına verilecek prompt. Amaç: mevcut mimariyle uyumlu,
> kanıta dayalı yeni modül adaylarını **önceliklendirilmiş** ve **kaynaklı**
> döndürmek. Öneri: Opus + research modu.

---

Sen davranış bilimi, alışkanlık oluşturma ve kişisel-gelişim uygulamaları
araştırmacısısın. "sup-port" bir kişisel-gelişim **süperapp'i** (Expo/React
Native + FastAPI/MongoDB). Her alan bir **modül/mini-app**: çoğu basit bir
günlük **değer/hedef sayacı** (birim + hedef, ör. Su 8 bardak, Adım 8000),
bazıları zengin ekranlı (Diş Fırçalama: yuvalar/seri/2 dk sayaç; Egzersiz:
kütüphane/BMI/kalori/LLM öneri). Günlük puan tüm kurulu modüllerin
tamamlanma oranından hesaplanır. Mevcut modüller: Su, Beslenme, Diş Fırçalama,
İngilizce, Egzersiz, Adım, Uyku, Okuma (kütüphane), Yemek (planlı), Meditasyon.
Kategoriler: Sağlık, Öğrenme, Hareket, Zihin.

**Görev:** Eklenebilecek yeni modülleri araştır ve önceliklendir.

## Her aday modül için değerlendir
1. **Ne izler + günlük metrik/hedef:** birim, mantıklı varsayılan hedef, basit
   sayaç mı yoksa zengin ekran mı gerektiği.
2. **Kanıt temeli:** bu alışkanlığın faydası için **kaynak** (WHO, hakemli
   çalışma, kayıtlı uzman). Abartılı/kanıtsız "wellness" iddialarından kaçın.
3. **Veri/API ihtiyacı + lisans:** dış veri/görsel gerekiyor mu? Gerekiyorsa
   **açık lisans** ve ticari uygulama içi kullanım. Telifli içerik shipping YOK.
4. **Gizlilik:** hassas veri mi (ruh hali, günlük yazıları, finans, sağlık)?
   Cihazdan çıkan bir şey var mı? GDPR-KVKK etkisi.
5. **Uygulama karmaşıklığı:** basit sayaç (düşük) / zengin ekran (orta) / native
   modül gerektirir (yüksek — ör. bildirim, kamera, sağlık verisi, ekran süresi).
6. **TR uygunluğu** ve hedef kitleye değeri.

## Keşfedilecek alanlar (bunlarla sınırlı değil)
- **Zihin/duygu:** ruh hali (mood) takibi, şükran günlüğü, serbest günlük
  (journaling), nefes egzersizi (rehberli timer), dijital detoks/ekran süresi.
- **Sağlık:** ilaç/vitamin hatırlatma (bildirim), duruş (posture), esneme,
  soğuk duş, güneş/dışarı zamanı, göz molası (20-20-20).
- **Öğrenme/üretkenlik:** derin çalışma/pomodoro, kod pratiği, müzik pratiği,
  yeni kelime (mevcut İngilizce ile ilişki).
- **Finans:** günlük harcama/bütçe takibi, tasarruf hedefi.
- **Sosyal/ilişki:** sevdiğine ulaşma, nazik davranış (acts of kindness).

## Biçim
- **Önceliklendirilmiş tablo:** modül | kategori | metrik/hedef | karmaşıklık
  (düşük/orta/yüksek) | veri/lisans ihtiyacı | gizlilik riski | kanıt gücü.
- **İlk 5 öneri** için kısa gerekçe + kaynak + önerilen günlük hedef + basit mi
  zengin mi ekran.
- **Hızlı kazanımlar** (düşük karmaşıklık, dış veri yok, yüksek değer) ile
  **büyük ama değerli** (native/dış veri gerektiren) ayrımını yap.
- "En kritik riskler" (özellikle gizlilik: ruh hali/günlük/finans verisi) ile bitir.
- Kısa, uygulanabilir; pazarlama dili yok.

# Araştırma Görevi: sup-port "Spor" Modülü

> Bu, bir araştırma agent'ına verilecek prompt'tur. Çıktı doğrudan mobil
> uygulamaya veri olarak girecek; bu yüzden **yapılandırılmış (JSON/tablo)** ve
> **kaynaklı** olmalı. Pazarlama dili yok, uygulanabilir bilgi.

---

Sen bir egzersiz bilimi / fitness alanı araştırmacısısın. "sup-port" adlı bir
mobil alışkanlık-takip uygulaması için tam teşekküllü bir **Spor/Egzersiz
modülü** kuruyoruz. Aşağıdaki başlıkları araştır ve **belirtilen şemalarda**
döndür. Her veri parçası **kaynaklı** olsun (URL ver).

## Kapsam ve varsayımlar (gerekiyorsa başında belirt ve uyarla)
- **Ortam:** öncelik ev / ekipmansız veya minimum ekipman (mat, dambıl, direnç
  bandı). Salon/ekipmanlı varyantlar bonus.
- **Seviye:** başlangıç → orta → ileri; ama **başlangıç** ve **fazla kilolu**
  kullanıcıya özel vurgu.
- **Birim:** metrik (kg, cm). **Dil:** egzersiz adları hem Türkçe hem İngilizce.

## Zorunlu kısıtlar
1. **Görsel lisansı şart.** Her görsel/animasyon kaynağı için lisansını açıkça
   yaz (CC0 / public domain / CC-BY / ticari+uygulama içi kullanım serbest mi?).
   Lisansı belirsiz veya telifli kaynak **önerme**. Uygulama açık lisanslı
   görsel kullanacak ya da kendi çizimini üretecek.
2. **Sağlık güvenliği.** Tüm öneriler kanıta dayalı ve **genel** olsun; kişiye
   özel tıbbi reçete değil. Riskli durumlar için "bir sağlık/spor uzmanına
   danış" uyarısını verinin içine koy. Kaynak olarak WHO, ACSM, NHS, CDC ve
   hakemli çalışmaları önceliklendir.

---

## 1. Egzersiz veri seti (elle üretme — kaynaktan al)
Egzersizleri **kafandan yazma**. Bunun yerine **hazır, açık lisanslı egzersiz
veri setlerini bul**, lisanslarını doğrula ve en uygununu seç. Bilinen adaylar
(varsa daha iyisini de ekle): `Free Exercise DB` (yuhonas/free-exercise-db),
`wger` egzersiz veritabanı, `ExRx`, `WGER API`. Her aday için:
- ad, URL, **lisans** (CC0 / CC-BY / GPL / ...), kaç egzersiz, hangi alanlar,
  görsel/animasyon içeriyor mu ve onların lisansı, uygulama içinde ticari
  kullanım serbest mi, toplu indirme/API var mı.
- **Öneri:** app'e gömmek için en uygun set hangisi ve **neden** (lisans +
  kapsam + görsel dahil mi).

Seçtiğin setten, mevcut alanları **bu şemaya eşle** ve eksik alanları (Türkçe ad,
kategori, MET, uyarılar) **kaynaklı** olarak tamamla. Tümünü **tek JSON dizisi**
olarak ver (uygulamaya doğrudan aktaracağız). En az 40 egzersiz seç; kategorilere
dengeli dağıt, ısınma/soğuma da olsun.

```json
{
  "key": "squat",
  "name_tr": "Squat (Çömelme)",
  "name_en": "Squat",
  "category": "kuvvet | kardiyo | esneklik | denge | isinma | soguma",
  "muscle_groups": ["bacak", "kalca", "core"],
  "equipment": "yok | mat | dambil | direnc_bandi | sandalye",
  "difficulty": "baslangic | orta | ileri",
  "low_impact": true,
  "met": 5.0,
  "default": { "sets": 3, "reps": 12 },
  "steps": ["Ayaklar omuz genişliğinde ...", "..."],
  "cautions": ["Diz ağrısı olanlar hareket açısını sınırlasın", "..."],
  "source": { "dataset": "free-exercise-db", "id": "Squat", "license": "Unlicense/CC0" },
  "image": { "source_url": "...", "license": "CC0", "type": "foto | gif | illustrasyon" }
}
```
- Kardiyo/statik hareketlerde `default` yerine `{ "duration_sec": 40 }` kullan.
- `met` değerini kaynağıyla ver (bkz. Başlık 5). `name_tr` çevirisi ve `category`
  eşlemesi senin katkın; `steps`/`image` mümkünse setten gelsin (yoksa kaynaklı
  ekle). Her egzersizin `source` + görsel `license` alanı **dolu** olsun.

## 2. Görsel / animasyon kaynakları
- Başlık 1'deki set görsel içeriyorsa: format, lisans, çevrimdışı bundle boyutu.
- İçermiyorsa: açık lisanslı egzersiz görseli/GIF sağlayan **ayrı kaynaklar**
  (ad, URL, lisans, format, kapsam, API var mı).
- **Öneri:** en uygulanabilir yaklaşım — (a) setin görsellerini bundle'lamak,
  (b) API'den çekmek, (c) kendi vektör illüstrasyonlarımızı çizmek. Her
  seçeneğin lisans / dosya boyutu / çevrimdışı çalışma açısından artı-eksisi.

## 3. Boy-kilo takibi ve BMI
- BMI formülü + **WHO sınıflandırması** (zayıf / normal / fazla kilolu / obez;
  **tam sayısal eşiklerle**, kaynak).
- BMI'ın sınırları (kas kütlesi vb.) ve tamamlayıcı ölçüt: **bel çevresi**
  risk eşikleri (kadın/erkek, kaynak).
- **Sağlıklı kilo verme hızı** (haftada kaç kg, kaynak).
- Kilo/boy verisini üründe nasıl sunmalı (ilerleme grafiği, hedef belirleme) —
  kısa, uygulanabilir öneriler.

## 4. Fazla kilolu / başlangıç için program ve öneriler
- **Düşük etkili (low-impact)** egzersizler ve neden tercih edilmeli (eklem
  yükü) — kanıtla.
- **Başlangıç haftalık örnek program(lar):** gün / egzersizler / set veya süre /
  dinlenme; **kademeli ilerleme** mantığı (haftalara göre artış).
- **Güvenlik:** ne zaman durmalı, kırmızı bayraklar (göğüs ağrısı, baş dönmesi
  vb.), doktora danışma gereken durumlar.
- Uyum/motivasyon için kanıtlı kısa stratejiler.

## 5. Kalori / enerji hesabı
- **MET tabanlı** kalori yakım formülü (kaynak): `kalori = MET × kg × saat`.
- Yaygın egzersizler için **MET değerleri tablosu** (Compendium of Physical
  Activities gibi bir kaynaktan; Başlık 1'deki `met` alanlarıyla tutarlı).

## 6. Haftalık aktivite hedefi
- Yetişkin için **WHO / ACSM** önerisi: haftalık orta/yüksek şiddet dakikası,
  haftalık kuvvet günü sayısı (kaynak).

---

## Çıktı biçimi
- Her başlık için yukarıdaki yapılandırılmış çıktı + **kaynak URL listesi**.
- Egzersiz kütüphanesini ayrıca **tek JSON dizisi** olarak ver (uygulamaya
  doğrudan aktaracağız).
- Kısa ve uygulanabilir; her sayısal eşik/öneri kaynaklı olsun.

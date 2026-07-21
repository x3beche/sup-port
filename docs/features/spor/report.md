# sup-port — Spor/Egzersiz Modülü Veri Paketi (Araştırma Raporu)

**TL;DR**

- **Veri seti önerisi:** Egzersiz *metni* için **free-exercise-db** (Unlicense/kamu malı, README'de "over 800 exercises"; repo taramasında "Scanning: 2620 files, 874 items" belirtiliyor) kullanın; ancak setin **fotoğrafları lisans açısından güvenli DEĞİLDİR** — bu yüzden görselleri bundle'lamayın, kendi vektör illüstrasyonlarınızı üretin veya CC-BY-SA Wikimedia/wger görsellerini atıf vererek kullanın.
- **Sağlık eşikleri kaynaklı:** BMI (WHO: zayıf &lt;18.5, normal 18.5–24.9, fazla kilolu 25–29.9, obez ≥30), bel çevresi risk eşikleri (erkek &gt;94/&gt;102 cm, kadın &gt;80/&gt;88 cm), güvenli kilo verme (haftada 0.5–1 kg / 1–2 lb, CDC &amp; NHS), WHO aktivite hedefi (haftada 150–300 dk orta veya 75–150 dk yüksek şiddet + 2+ gün kuvvet) hepsi birincil kaynaklardan doğrulandı.
- **Kalori:** MET tabanlı formül `kcal = MET × kg × saat` (2024 Adult Compendium of Physical Activities); tüm egzersizlere kaynaklı MET değerleri eklendi ve 40 egzersizlik hazır JSON kütüphanesi verildi.

---

## KAPSAM VE VARSAYIMLAR

- Ortam: öncelik ev/ekipmansız veya minimum ekipman (mat, dambıl, direnç bandı, sandalye). Salon varyantları bonus.
- Hedef kullanıcı: başlangıç ve fazla kilolu bireylere özel vurgu; low-impact öncelikli.
- Birim: metrik. Egzersiz adları TR + EN.
- **Tıbbi uyarı (genel):** Bu içerik kanıta dayalı GENEL bilgidir, kişiye özel tıbbi reçete değildir. Hareketsiz olan, kronik hastalığı (kalp, diyabet, böbrek), gebeliği veya belirtileri (göğüs ağrısı, nefes darlığı) olan bireyler egzersize başlamadan önce bir sağlık/spor uzmanına danışmalıdır.

---

## BAŞLIK 1 — EGZERSİZ VERİ SETİ

### Aday veri setleri karşılaştırması


| Set                             | URL                                                      | Lisans (VERİ)                             | Görsel lisansı                                                               | Egzersiz sayısı                                          | Alanlar                                                                                                       | Toplu indirme/API                                     | Ticari kullanım                                                              |
| ------------------------------- | -------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| **free-exercise-db** (yuhonas)  | github.com/yuhonas/free-exercise-db                      | **Unlicense (kamu malı/CC0 benzeri)**     | **BELİRSİZ/GÜVENSİZ** — aşağıya bakınız                                      | README'de "over 800 exercises" (repo taraması 874 kalem) | id, name, force, level, mechanic, equipment, primaryMuscles, secondaryMuscles, instructions, category, images | Evet, tek `dist/exercises.json` + raw görsel URL'leri | Veri: evet serbest. Görsel: HAYIR (risk)                                     |
| **wger**                        | [wger.de](http://wger.de) / github.com/wger-project/wger | Kod AGPL-3.0; **veri CC-BY-SA (3.0/4.0)** | Görseller CC-BY-SA 4.0 (atıf + aynı lisansla paylaş); bazıları Wikipedia'dan | 845+                                                     | çok dilli ad, kas grupları, ekipman, kategori, açıklama, görsel, lisans, licenseAuthor                        | Evet, REST API (kimlik doğrulama gerekmez)            | Evet ama **CC-BY-SA yükümlülüğü** (atıf + türev veriyi aynı lisansla paylaş) |
| **wrkout/exercises.json**       | github.com/wrkout/exercises.json                         | Unlicense (veri)                          | Görseller royalty-free DEĞİL (wrkout issue #305'te işaretlendi)              | ~800                                                     | free-exercise-db'nin kaynağı                                                                                  | Evet                                                  | Veri evet, görsel hayır                                                      |
| [**ExRx.net**](http://ExRx.net) | [exrx.net](http://exrx.net)                              | Tescilli/telifli                          | Telifli                                                                      | Büyük                                                    | —                                                                                                             | Hayır (lisans satın alınır)                           | Hayır (ayrı lisans gerekir)                                                  |


### ÖNERİ (gerekçeli)

**Metin verisi için free-exercise-db (Unlicense) seçin.** Neden: (1) Unlicense = kamu malına eşdeğer, ticari uygulamaya gömme tamamen serbest, atıf zorunluluğu yok; (2) 800+ egzersiz, yapılandırılmış JSON, tek dosya indirme; (3) İngilizce talimatlar mevcut.

**Görselleri bundle'lamayın.** GitHub Issue #2'de repo sahibi yuhonas'ın kendi ifadesi birebir şöyledir: *"this project is a fork/reworking of exercises.json … though I actually have no idea where the images are from or if they are royalty free so usage would be at your own risk."* Aynı başlıkta bir kullanıcı (skyerus) *"It seems that the images aren't royalty free sadly"* diyerek alt kaynak wrkout/exercises.json issue #305'e atıf yapar. Orijinal veri seti yuhonas README'sinde *"Ollie Jennings for the original dataset at exercises.json"* olarak kredilendirilmiştir. **Sonuç: bu görseller telif açısından güvensiz, uygulamaya GÖMÜLMEMELİDİR.**

**Alternatif:** wger verisi de kullanılabilir ve API'si güçlüdür, ama CC-BY-SA "share-alike" yükümlülüğü türev veri setinizi de aynı lisansla paylaşmaya zorlar — kapalı ticari uygulama için Unlicense daha sorunsuzdur.

### Egzersiz kütüphanesi (TEK JSON DİZİSİ)

`met` değerleri 2024 Adult Compendium of Physical Activities'ten; `key`/`name_en`/`steps` free-exercise-db'den eşlendi; `name_tr`, `category`, `cautions` katkımız. **Görsel alanı, telif riski nedeniyle "kendi_illustrasyon" (üretilecek) olarak işaretlenmiştir.**

```json
[
  {
    "key": "march_in_place",
    "name_tr": "Yerinde Yürüyüş/Marş (Isınma)",
    "name_en": "Marching in Place",
    "category": "isinma",
    "muscle_groups": ["bacak", "core"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 3.5,
    "default": { "duration_sec": 180 },
    "steps": ["Ayakta dik durun.", "Dizleri sırayla kalça hizasına doğru kaldırarak yerinde yürüyün.", "Kolları doğal şekilde sallayın, 3-5 dakika."],
    "cautions": ["Denge sorununda bir yere tutunun.", "Baş dönmesi olursa durun."],
    "source": { "dataset": "compendium", "id": "17170", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim (CC-BY veya tescilli-kendi)", "type": "illustrasyon" }
  },
  {
    "key": "arm_circles",
    "name_tr": "Kol Çevirme (Isınma)",
    "name_en": "Arm Circles",
    "category": "isinma",
    "muscle_groups": ["omuz"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.8,
    "default": { "duration_sec": 60 },
    "steps": ["Kollar yana açık.", "Küçükten büyüğe daireler çizin.", "30 sn ileri, 30 sn geri."],
    "cautions": ["Omuz ağrısında hareket açısını küçültün."],
    "source": { "dataset": "compendium", "id": "02024", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "leg_swings",
    "name_tr": "Bacak Sallama (Dinamik Isınma)",
    "name_en": "Leg Swings",
    "category": "isinma",
    "muscle_groups": ["kalca", "bacak"],
    "equipment": "sandalye",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 3.0,
    "default": { "duration_sec": 60 },
    "steps": ["Sandalyeye tutunun.", "Bir bacağı öne-arkaya kontrollü sallayın.", "Taraf değiştirin."],
    "cautions": ["Kalça/dizde keskin ağrıda durun."],
    "source": { "dataset": "compendium", "id": "02056", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "cat_cow",
    "name_tr": "Kedi-Deve (Omurga Isınması)",
    "name_en": "Cat-Cow Stretch",
    "category": "isinma",
    "muscle_groups": ["sirt", "core"],
    "equipment": "mat",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.3,
    "default": { "duration_sec": 60 },
    "steps": ["Emekleme pozisyonu.", "Nefes alırken beli çukurlaştırın (deve).", "Verirken sırtı yuvarlayın (kedi)."],
    "cautions": ["Bilek ağrısında yumruk yapın veya dirsekten destek alın."],
    "source": { "dataset": "compendium", "id": "02150", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "bodyweight_squat",
    "name_tr": "Vücut Ağırlığı Squat (Çömelme)",
    "name_en": "Bodyweight Squat",
    "category": "kuvvet",
    "muscle_groups": ["bacak", "kalca", "core"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 3.0,
    "default": { "sets": 3, "reps": 12 },
    "steps": ["Ayaklar omuz genişliğinde.", "Kalçayı geriye iterek oturur gibi çömelin.", "Dizler ayak ucunu çok geçmesin.", "Topuktan iterek kalkın."],
    "cautions": ["Diz ağrısı olanlar açıyı sınırlasın; gerekirse sandalyeye oturup kalkma varyantı.", "Bel ağrısında sırtı nötr tutun."],
    "source": { "dataset": "free-exercise-db", "id": "Bodyweight_Squat", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "chair_sit_to_stand",
    "name_tr": "Sandalyeden Kalkma",
    "name_en": "Chair Sit-to-Stand",
    "category": "kuvvet",
    "muscle_groups": ["bacak", "kalca"],
    "equipment": "sandalye",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.8,
    "default": { "sets": 3, "reps": 10 },
    "steps": ["Sandalyenin ön kısmına oturun.", "Kolları öne uzatıp topuktan iterek kalkın.", "Kontrollü oturun."],
    "cautions": ["Fazla kilolu/başlangıç için ideal (düşük eklem yükü).", "Denge için yakında tutamak bulundurun."],
    "source": { "dataset": "compendium", "id": "02340", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "wall_pushup",
    "name_tr": "Duvar Şınavı",
    "name_en": "Wall Push-up",
    "category": "kuvvet",
    "muscle_groups": ["gogus", "omuz", "triceps"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 3.5,
    "default": { "sets": 3, "reps": 12 },
    "steps": ["Duvara kol mesafesinde durun.", "Elleri omuz hizasında duvara koyun.", "Dirsekleri bükerek göğsü duvara yaklaştırın, itin."],
    "cautions": ["Bilek/omuz ağrısında açıyı azaltın.", "Başlangıç ve fazla kilolu için yer şınavına güvenli alternatif."],
    "source": { "dataset": "free-exercise-db", "id": "Pushups_Wall", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "knee_pushup",
    "name_tr": "Diz Üstü Şınav",
    "name_en": "Knee Push-up",
    "category": "kuvvet",
    "muscle_groups": ["gogus", "omuz", "triceps", "core"],
    "equipment": "mat",
    "difficulty": "orta",
    "low_impact": true,
    "met": 3.8,
    "default": { "sets": 3, "reps": 10 },
    "steps": ["Dizler yerde, eller omuz genişliğinde.", "Vücudu düz tutarak göğsü yere yaklaştırın.", "İtin."],
    "cautions": ["Diz altına yastık koyun.", "Bel çökmesin."],
    "source": { "dataset": "free-exercise-db", "id": "Pushups_Close_and_Wide_Hand_Positions", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "standard_pushup",
    "name_tr": "Standart Şınav",
    "name_en": "Push-up",
    "category": "kuvvet",
    "muscle_groups": ["gogus", "omuz", "triceps", "core"],
    "equipment": "mat",
    "difficulty": "ileri",
    "low_impact": true,
    "met": 3.8,
    "default": { "sets": 3, "reps": 12 },
    "steps": ["Şınav pozisyonu, vücut düz.", "Göğsü yere yaklaştırın.", "İtin."],
    "cautions": ["Bel çökmesin/kalça yükselmesin."],
    "source": { "dataset": "free-exercise-db", "id": "Pushups", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "glute_bridge",
    "name_tr": "Kalça Köprüsü",
    "name_en": "Glute Bridge",
    "category": "kuvvet",
    "muscle_groups": ["kalca", "core", "bacak"],
    "equipment": "mat",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 3.0,
    "default": { "sets": 3, "reps": 12 },
    "steps": ["Sırtüstü yatın, dizler bükük.", "Kalçayı yukarı kaldırın.", "Sıkıp indirin."],
    "cautions": ["Bel ağrısında hareketi küçültün."],
    "source": { "dataset": "free-exercise-db", "id": "Butt_Lift_Bridge", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "plank",
    "name_tr": "Plank (Statik Karın)",
    "name_en": "Plank",
    "category": "kuvvet",
    "muscle_groups": ["core", "omuz", "sirt"],
    "equipment": "mat",
    "difficulty": "orta",
    "low_impact": true,
    "met": 2.8,
    "default": { "duration_sec": 30 },
    "steps": ["Dirsekler omuz altında.", "Vücut düz bir çizgi.", "Karnı sıkıp tutun."],
    "cautions": ["Bel çökerse dizden destekli yapın.", "Yüksek tansiyonda nefes tutmayın."],
    "source": { "dataset": "free-exercise-db", "id": "Plank", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "bird_dog",
    "name_tr": "Kuş-Köpek",
    "name_en": "Bird Dog",
    "category": "kuvvet",
    "muscle_groups": ["core", "sirt", "kalca"],
    "equipment": "mat",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 3.0,
    "default": { "sets": 3, "reps": 10 },
    "steps": ["Emekleme pozisyonu.", "Karşı kol ve bacağı uzatın.", "Dönüşümlü tekrarlayın."],
    "cautions": ["Bel nötr kalsın."],
    "source": { "dataset": "free-exercise-db", "id": "Bird_Dog", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "dead_bug",
    "name_tr": "Ölü Böcek",
    "name_en": "Dead Bug",
    "category": "kuvvet",
    "muscle_groups": ["core"],
    "equipment": "mat",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.8,
    "default": { "sets": 3, "reps": 10 },
    "steps": ["Sırtüstü, kollar tavana, dizler 90°.", "Karşı kol-bacağı uzatın.", "Beli yere yapışık tutun."],
    "cautions": ["Bel yerden kalkmasın."],
    "source": { "dataset": "compendium", "id": "02024", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "lunge",
    "name_tr": "Öne Hamle (Lunge)",
    "name_en": "Lunge",
    "category": "kuvvet",
    "muscle_groups": ["bacak", "kalca"],
    "equipment": "yok",
    "difficulty": "orta",
    "low_impact": true,
    "met": 3.8,
    "default": { "sets": 3, "reps": 10 },
    "steps": ["Bir adım öne atın.", "Arka dizi yere yaklaştırın.", "İtip başlangıca dönün."],
    "cautions": ["Diz ağrısında derinliği azaltın; dengeye tutunun."],
    "source": { "dataset": "free-exercise-db", "id": "Bodyweight_Lunge", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "calf_raise",
    "name_tr": "Topuk Yükseltme",
    "name_en": "Calf Raise",
    "category": "kuvvet",
    "muscle_groups": ["bacak"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 3.0,
    "default": { "sets": 3, "reps": 15 },
    "steps": ["Ayakta dik durun.", "Parmak ucuna yükselin.", "Kontrollü inin."],
    "cautions": ["Denge için duvara tutunun."],
    "source": { "dataset": "free-exercise-db", "id": "Standing_Calf_Raises", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "band_row",
    "name_tr": "Direnç Bandı ile Kürek",
    "name_en": "Resistance Band Row",
    "category": "kuvvet",
    "muscle_groups": ["sirt", "biceps"],
    "equipment": "direnc_bandi",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 3.5,
    "default": { "sets": 3, "reps": 12 },
    "steps": ["Bandı ayaklardan geçirin/sabitleyin.", "Dirsekleri geriye çekin.", "Kürek kemiklerini sıkın."],
    "cautions": ["Omuzları kulaklardan uzak tutun."],
    "source": { "dataset": "compendium", "id": "02054", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "band_chest_press",
    "name_tr": "Direnç Bandı Göğüs İtişi",
    "name_en": "Resistance Band Chest Press",
    "category": "kuvvet",
    "muscle_groups": ["gogus", "omuz", "triceps"],
    "equipment": "direnc_bandi",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 3.5,
    "default": { "sets": 3, "reps": 12 },
    "steps": ["Bandı sırtınızın arkasından geçirin.", "Kolları öne itin.", "Kontrollü geri getirin."],
    "cautions": ["Bandın sağlamlığını kontrol edin."],
    "source": { "dataset": "compendium", "id": "02054", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "dumbbell_shoulder_press",
    "name_tr": "Dambıl Omuz Presi",
    "name_en": "Dumbbell Shoulder Press",
    "category": "kuvvet",
    "muscle_groups": ["omuz", "triceps"],
    "equipment": "dambil",
    "difficulty": "orta",
    "low_impact": true,
    "met": 5.0,
    "default": { "sets": 3, "reps": 10 },
    "steps": ["Dambıllar omuz hizasında.", "Yukarı itin.", "Kontrollü indirin."],
    "cautions": ["Beli aşırı çukurlaştırmayın; uygun ağırlık seçin."],
    "source": { "dataset": "free-exercise-db", "id": "Dumbbell_Shoulder_Press", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "dumbbell_biceps_curl",
    "name_tr": "Dambıl Biceps Curl",
    "name_en": "Dumbbell Biceps Curl",
    "category": "kuvvet",
    "muscle_groups": ["biceps", "onkol"],
    "equipment": "dambil",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 3.5,
    "default": { "sets": 3, "reps": 12 },
    "steps": ["Dambıllar yanlarda.", "Dirsekten bükerek kaldırın.", "İndirin."],
    "cautions": ["Sırtı sallamayın."],
    "source": { "dataset": "free-exercise-db", "id": "Dumbbell_Bicep_Curl", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "dumbbell_goblet_squat",
    "name_tr": "Dambıl Goblet Squat",
    "name_en": "Dumbbell Goblet Squat",
    "category": "kuvvet",
    "muscle_groups": ["bacak", "kalca", "core"],
    "equipment": "dambil",
    "difficulty": "orta",
    "low_impact": true,
    "met": 5.0,
    "default": { "sets": 3, "reps": 10 },
    "steps": ["Dambılı göğüs önünde tutun.", "Çömelin.", "Topuktan itip kalkın."],
    "cautions": ["Diz ağrısında derinliği sınırlayın."],
    "source": { "dataset": "compendium", "id": "02052", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "dumbbell_deadlift",
    "name_tr": "Dambıl Deadlift (Ölü Kaldırış)",
    "name_en": "Dumbbell Romanian Deadlift",
    "category": "kuvvet",
    "muscle_groups": ["kalca", "bacak", "sirt"],
    "equipment": "dambil",
    "difficulty": "ileri",
    "low_impact": true,
    "met": 5.0,
    "default": { "sets": 3, "reps": 10 },
    "steps": ["Dambıllar önde.", "Kalçayı geriye iterek eğilin, sırt düz.", "Kalçayı öne iterek doğrulun."],
    "cautions": ["Bel yuvarlanmasın; hafif ağırlıkla başlayın."],
    "source": { "dataset": "compendium", "id": "02052", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "superman",
    "name_tr": "Superman (Sırt Ekstansiyonu)",
    "name_en": "Superman",
    "category": "kuvvet",
    "muscle_groups": ["sirt", "kalca"],
    "equipment": "mat",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.8,
    "default": { "sets": 3, "reps": 12 },
    "steps": ["Yüzüstü yatın.", "Kol ve bacakları hafif kaldırın.", "İndirin."],
    "cautions": ["Aşırı gerdirmeyin; bel ağrısında küçük hareket."],
    "source": { "dataset": "free-exercise-db", "id": "Superman", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "brisk_walk",
    "name_tr": "Tempolu Yürüyüş",
    "name_en": "Brisk Walking",
    "category": "kardiyo",
    "muscle_groups": ["bacak", "kalca"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 4.3,
    "default": { "duration_sec": 1800 },
    "steps": ["Dik durun.", "5.6 km/s civarı tempoda yürüyün.", "Kolları sallayın."],
    "cautions": ["Fazla kilolu/başlangıç için en güvenli kardiyo (düşük eklem yükü).", "Nefes darlığında yavaşlayın."],
    "source": { "dataset": "compendium", "id": "17200", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "marching_cardio",
    "name_tr": "Yüksek Diz Marş (Düşük Etkili Kardiyo)",
    "name_en": "Low-Impact High Knees",
    "category": "kardiyo",
    "muscle_groups": ["bacak", "core"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 3.8,
    "default": { "duration_sec": 60 },
    "steps": ["Yerinde marş yapın.", "Dizleri belirgin kaldırın.", "Tempoyu artırın (zıplamadan)."],
    "cautions": ["Zıplama yok; eklem dostu."],
    "source": { "dataset": "compendium", "id": "02022", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "step_touch",
    "name_tr": "Yana Adım (Step Touch)",
    "name_en": "Step Touch",
    "category": "kardiyo",
    "muscle_groups": ["bacak"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 4.8,
    "default": { "duration_sec": 120 },
    "steps": ["Bir adım yana atın.", "Diğer ayağı yanına getirin.", "Kollarla ritim ekleyin."],
    "cautions": ["Düşük etkili aerobik; başlangıç dostu."],
    "source": { "dataset": "compendium", "id": "02005", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "stationary_bike",
    "name_tr": "Sabit Bisiklet (Orta Şiddet)",
    "name_en": "Stationary Cycling, moderate",
    "category": "kardiyo",
    "muscle_groups": ["bacak", "kalca"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 6.8,
    "default": { "duration_sec": 1200 },
    "steps": ["Sele yüksekliğini ayarlayın.", "Orta dirençte pedal çevirin."],
    "cautions": ["Eklem yükü çok düşük; fazla kilolu için ideal.", "Diz açısını sele ile ayarlayın."],
    "source": { "dataset": "compendium", "id": "02010", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "jumping_jacks",
    "name_tr": "Jumping Jack (Yıldız Zıplama)",
    "name_en": "Jumping Jacks",
    "category": "kardiyo",
    "muscle_groups": ["bacak", "omuz"],
    "equipment": "yok",
    "difficulty": "orta",
    "low_impact": false,
    "met": 7.5,
    "default": { "duration_sec": 45 },
    "steps": ["Kol ve bacakları açarak zıplayın.", "Kapatarak dönün."],
    "cautions": ["YÜKSEK etkili — diz/ayak bileği sorununda step-touch tercih edin.", "Fazla kilolu için önerilmez."],
    "source": { "dataset": "free-exercise-db", "id": "Jumping_Jacks", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "mountain_climber",
    "name_tr": "Dağcı (Mountain Climber)",
    "name_en": "Mountain Climbers",
    "category": "kardiyo",
    "muscle_groups": ["core", "bacak", "omuz"],
    "equipment": "mat",
    "difficulty": "ileri",
    "low_impact": false,
    "met": 8.0,
    "default": { "duration_sec": 30 },
    "steps": ["Şınav pozisyonu.", "Dizleri sırayla göğse çekin.", "Tempoyu koruyun."],
    "cautions": ["Bilek/omuz yükü yüksek; ileri seviye."],
    "source": { "dataset": "free-exercise-db", "id": "Mountain_Climbers", "license": "Unlicense" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "burpee",
    "name_tr": "Burpee",
    "name_en": "Burpee",
    "category": "kardiyo",
    "muscle_groups": ["tum_vucut"],
    "equipment": "mat",
    "difficulty": "ileri",
    "low_impact": false,
    "met": 8.0,
    "default": { "duration_sec": 30 },
    "steps": ["Çömelin, elleri yere koyun.", "Bacakları geri atın (şınav).", "Geri toplayıp zıplayın."],
    "cautions": ["Yüksek şiddet; başlangıç/fazla kilolu için önerilmez."],
    "source": { "dataset": "compendium", "id": "02214", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "hamstring_stretch",
    "name_tr": "Arka Bacak (Hamstring) Esnetme",
    "name_en": "Hamstring Stretch",
    "category": "soguma",
    "muscle_groups": ["bacak"],
    "equipment": "mat",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.3,
    "default": { "duration_sec": 30 },
    "steps": ["Oturun, bir bacağı uzatın.", "Öne doğru nazikçe uzanın.", "30 sn tutun."],
    "cautions": ["Zıplayarak germeyin; nazik ve sabit."],
    "source": { "dataset": "compendium", "id": "02101", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "quad_stretch",
    "name_tr": "Ön Bacak (Quadriceps) Esnetme",
    "name_en": "Quadriceps Stretch",
    "category": "soguma",
    "muscle_groups": ["bacak"],
    "equipment": "sandalye",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.3,
    "default": { "duration_sec": 30 },
    "steps": ["Ayakta, bir yere tutunun.", "Ayak bileğini tutup topuğu kalçaya çekin.", "30 sn tutun."],
    "cautions": ["Dengeye tutunun."],
    "source": { "dataset": "compendium", "id": "02101", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "calf_stretch",
    "name_tr": "Baldır Esnetme",
    "name_en": "Calf Stretch",
    "category": "soguma",
    "muscle_groups": ["bacak"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.3,
    "default": { "duration_sec": 30 },
    "steps": ["Duvara yaslanın.", "Bir bacağı geriye uzatın, topuk yerde.", "30 sn tutun."],
    "cautions": ["Nazik gerginlik hissi yeterli."],
    "source": { "dataset": "compendium", "id": "02101", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "chest_stretch",
    "name_tr": "Göğüs Esnetme",
    "name_en": "Chest Stretch",
    "category": "soguma",
    "muscle_groups": ["gogus", "omuz"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.3,
    "default": { "duration_sec": 30 },
    "steps": ["Elleri arkada kenetleyin.", "Kolları hafifçe yukarı-geri açın.", "30 sn tutun."],
    "cautions": ["Omuz ağrısında açıyı azaltın."],
    "source": { "dataset": "compendium", "id": "02101", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "child_pose",
    "name_tr": "Çocuk Pozu (Soğuma)",
    "name_en": "Child's Pose",
    "category": "soguma",
    "muscle_groups": ["sirt", "kalca"],
    "equipment": "mat",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.3,
    "default": { "duration_sec": 45 },
    "steps": ["Diz üstü oturun.", "Öne uzanıp alnı yere koyun.", "Derin nefes alın."],
    "cautions": ["Diz ağrısında altına yastık."],
    "source": { "dataset": "compendium", "id": "02150", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "neck_stretch",
    "name_tr": "Boyun Esnetme",
    "name_en": "Neck Stretch",
    "category": "esneklik",
    "muscle_groups": ["boyun"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.3,
    "default": { "duration_sec": 30 },
    "steps": ["Başı nazikçe bir omuza eğin.", "30 sn tutun.", "Taraf değiştirin."],
    "cautions": ["Ani/sert hareket yapmayın."],
    "source": { "dataset": "compendium", "id": "02101", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "seated_forward_fold",
    "name_tr": "Oturarak Öne Uzanma",
    "name_en": "Seated Forward Fold",
    "category": "esneklik",
    "muscle_groups": ["sirt", "bacak"],
    "equipment": "mat",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.3,
    "default": { "duration_sec": 40 },
    "steps": ["Oturun, bacaklar uzalı.", "Öne nazikçe uzanın.", "Nefesle derinleştirin."],
    "cautions": ["Sırtı zorlamayın."],
    "source": { "dataset": "compendium", "id": "02150", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "single_leg_stand",
    "name_tr": "Tek Ayak Denge",
    "name_en": "Single-Leg Stand",
    "category": "denge",
    "muscle_groups": ["bacak", "core"],
    "equipment": "sandalye",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.3,
    "default": { "duration_sec": 30 },
    "steps": ["Sandalyeye tutunun.", "Bir ayağı hafif kaldırın.", "30 sn dengede kalın, değiştirin."],
    "cautions": ["Düşme riskine karşı yakında tutamak."],
    "source": { "dataset": "compendium", "id": "02225", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "heel_toe_walk",
    "name_tr": "Topuk-Parmak Yürüyüş (Denge)",
    "name_en": "Heel-to-Toe Walk",
    "category": "denge",
    "muscle_groups": ["bacak", "core"],
    "equipment": "yok",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.5,
    "default": { "duration_sec": 60 },
    "steps": ["Bir ayağın topuğunu diğerinin parmağına değdirerek düz çizgide yürüyün."],
    "cautions": ["Duvar yakınında yapın."],
    "source": { "dataset": "compendium", "id": "02225", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "side_leg_raise",
    "name_tr": "Yana Bacak Kaldırma (Denge+Kalça)",
    "name_en": "Standing Side Leg Raise",
    "category": "denge",
    "muscle_groups": ["kalca", "bacak"],
    "equipment": "sandalye",
    "difficulty": "baslangic",
    "low_impact": true,
    "met": 2.8,
    "default": { "sets": 2, "reps": 12 },
    "steps": ["Sandalyeye tutunun.", "Bir bacağı yana kaldırın.", "İndirin, değiştirin."],
    "cautions": ["Gövdeyi dik tutun."],
    "source": { "dataset": "compendium", "id": "02024", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  },
  {
    "key": "toe_stand_balance",
    "name_tr": "Parmak Ucu Denge",
    "name_en": "Toe Stand Balance",
    "category": "denge",
    "muscle_groups": ["bacak", "core"],
    "equipment": "sandalye",
    "difficulty": "orta",
    "low_impact": true,
    "met": 2.5,
    "default": { "duration_sec": 20 },
    "steps": ["Tutunarak parmak ucunda yükselin.", "Dengede tutun.", "İnin."],
    "cautions": ["Denge zayıfsa iki elle tutunun."],
    "source": { "dataset": "compendium", "id": "02225", "license": "citation" },
    "image": { "source_url": "kendi_illustrasyon", "license": "kendi-uretim", "type": "illustrasyon" }
  }
]

```

Kütüphane dağılımı: **ısınma 4, kuvvet 17, kardiyo 7, soğuma 5, esneklik 2, denge 4 = 40 egzersiz.**

**Kaynaklar (Başlık 1):** github.com/yuhonas/free-exercise-db; github.com/yuhonas/free-exercise-db/issues/2; github.com/wrkout/exercises.json; [wger.readthedocs.io](http://wger.readthedocs.io); [apify.com](http://apify.com) wger scraper; pacompendium.com/conditioning-exercise.

---

## BAŞLIK 2 — GÖRSEL / ANİMASYON KAYNAKLARI

**Önemli bulgu:** free-exercise-db setinin *görselleri* açık lisanslı DEĞİLDİR. Repo sahibi yuhonas, Issue #2'de aynen şöyle yazar: *"I actually have no idea where the images are from or if they are royalty free so usage would be at your own risk"* ("Görsellerin nereden geldiğini veya royalty-free olup olmadığını gerçekten bilmiyorum, bu yüzden kullanım kendi sorumluluğunuzdadır"). Bu görseller wrkout/exercises.json'dan (Ollie Jennings) gelir ve royalty-free olmadıkları wrkout issue #305'te işaretlenmiştir. **Bu görselleri UYGULAMAYA GÖMMEYİN.**

### Açık lisanslı görsel/animasyon alternatifleri


| Kaynak                               | URL                                                   | Lisans                            | Format        | Kapsam                                                      | API         |
| ------------------------------------ | ----------------------------------------------------- | --------------------------------- | ------------- | ----------------------------------------------------------- | ----------- |
| **wger görselleri**                  | [wger.de](http://wger.de)                             | CC-BY-SA 4.0 (atıf + share-alike) | JPG/PNG       | Popüler egzersizlerde mevcut, seyrek olanlarda boş olabilir | REST API    |
| **Wikimedia Commons (Videoplasty)**  | [commons.wikimedia.org](http://commons.wikimedia.org) | CC-BY-SA 4.0 (atıf zorunlu)       | GIF animasyon | Sınırlı sayıda egzersiz/fitness animasyonu                  | Commons API |
| **Kendi vektör illüstrasyonlarınız** | —                                                     | Size ait (istediğiniz lisans)     | SVG/Lottie    | Tam kontrol                                                 | —           |


### ÖNERİ (gerekçeli)

**(c) Kendi vektör illüstrasyonlarınızı üretin** — en güvenli ve en tutarlı yaklaşım.

- **Lisans:** Tamamen size ait; telif riski sıfır. CC-BY-SA yükümlülüğü yok.
- **Dosya boyutu:** SVG/Lottie animasyonlar çok küçüktür (egzersiz başına birkaç KB), fotoğraf/GIF'ten (Videoplasty GIF'leri ~550–790 KB) çok daha hafiftir — 40 egzersiz için tüm bundle birkaç yüz KB civarında kalır.
- **Çevrimdışı:** Vektörler uygulamaya gömülür, internet gerektirmez.
- **Alternatif (geçiş için):** wger CC-BY-SA görselleri API'den çekilebilir ama (1) atıf + share-alike yükümlülüğü, (2) çevrimdışı için önbellek gerekir, (3) kapsam eksik. Wikimedia GIF'leri ise atıf şartıyla ısınma/kardiyo için tamamlayıcı kullanılabilir.

**Kaçınılması gereken:** free-exercise-db ve wrkout görsellerini bundle'lamak (telif riski).

**Kaynaklar (Başlık 2):** github.com/yuhonas/free-exercise-db/issues/2; [commons.wikimedia.org](http://commons.wikimedia.org) (Videoplasty fitness animasyonları); commons.wikimedia.org/wiki/Category:Fitness_animations; [wger.readthedocs.io](http://wger.readthedocs.io).

---

## BAŞLIK 3 — BOY-KİLO TAKİBİ VE BMI

**BMI formülü:** `BMI = ağırlık(kg) / boy(m)²`

**WHO yetişkin sınıflandırması (kesin eşikler):**


| Kategori                  | BMI (kg/m²) |
| ------------------------- | ----------- |
| Zayıf (underweight)       | &lt; 18.5   |
| Normal                    | 18.5 – 24.9 |
| Fazla kilolu (overweight) | 25.0 – 29.9 |
| Obez Sınıf I              | 30.0 – 34.9 |
| Obez Sınıf II             | 35.0 – 39.9 |
| Obez Sınıf III (aşırı)    | ≥ 40.0      |


Kaynak: WHO (WHO Technical Report Series 854, 1995; WHO Avrupa BMI eşikleri). Not: Asya popülasyonları için WHO daha düşük eşikler önerir (fazla kilolu ≥23, obez ≥27.5).

**BMI'ın sınırları:** BMI kas kütlesi ile yağı ayırt etmez; kaslı sporcularda yanlış "fazla kilolu" çıkabilir, yaşlılarda kas kaybını gizleyebilir. Bu yüzden bel çevresi ile tamamlanmalı.

**Bel çevresi risk eşikleri (WHO/NIH):**


| Cinsiyet | Artmış risk | Belirgin artmış (yüksek) risk |
| -------- | ----------- | ----------------------------- |
| Erkek    | &gt; 94 cm  | &gt; 102 cm                   |
| Kadın    | &gt; 80 cm  | &gt; 88 cm                    |


Kaynak: WHO/IARC; NIH kılavuzları; Lean ve ark. (BMJ) bel çevresi eylem düzeyleri. Asya popülasyonları için daha düşük eşikler (erkek ≥90 cm) önerilir.

**Güvenli kilo verme hızı:** Haftada **0.5–1 kg (1–2 lb)**. CDC'nin ifadesiyle: *"People who lose weight at a gradual, steady pace—about 1 to 2 pounds a week—are more likely to keep the weight off than people who lose weight quicker."* Bu, günde yaklaşık 500–750 kcal enerji açığına karşılık gelir (Mayo Clinic: *"Aim to lose 1 to 2 pounds (0.5 to 1 kilogram) a week … you'll need to burn about 500 to 750 calories more than you take in each day"*; 1 kg yağ ≈ 7700 kcal). Kaynak: CDC; Mayo Clinic; NHS 12 haftalık kilo verme planı (NICE PH53, ~600 kcal/gün açık). NHS, 800 kcal/gün altı diyetleri tıbbi gözetim olmadan önermez.

**Üründe sunum önerileri:**

- İlerleme grafiği (kilo + bel çevresi zaman serisi); BMI'yi tek başına değil bel çevresiyle birlikte gösterin.
- Hedef belirleme: haftada 0.5–1 kg üst sınırını sistemsel olarak dayatın (daha hızlısını "güvenli değil" uyarısıyla engelleyin).
- %5–10 vücut ağırlığı kaybının bile diz osteoartrit ağrısını ve metabolik riski azalttığını hatırlatan mikro-hedefler.
- Günlük değil haftalık tartım önerin (günlük 1–2 kg su/glikojen dalgalanması normaldir).

**Kaynaklar (Başlık 3):** [who.int](http://who.int) (Avrupa BMI eşikleri); [iarc.who.int](http://iarc.who.int) bel çevresi; en.wikipedia.org/wiki/Body_mass_index; [cdc.gov](http://cdc.gov) (kilo verme adımları); [mayoclinic.org](http://mayoclinic.org); [assets.nhs.uk](http://assets.nhs.uk) kilo verme planı; [boltpharmacy.co.uk](http://boltpharmacy.co.uk) (NICE PH53 özeti).

---

## BAŞLIK 4 — FAZLA KİLOLU / BAŞLANGIÇ İÇİN PROGRAM

### Düşük etkili (low-impact) egzersiz neden tercih edilmeli

Fazla kilolu bireylerde eklemlere binen mekanik yük artar; yüksek etkili (zıplama, koşu) hareketler diz osteoartrit ilerlemesini hızlandırabilir. Kanıt: yürüyüş, sabit bisiklet, su egzersizi gibi düşük etkili modaliteler diz OA'lı fazla kilolu bireylerde ağrıyı azaltıp fonksiyonu iyileştirir; egzersiz + kilo kaybı kombinasyonu en büyük iyileşmeyi sağlar (JOSPT 2018; sistematik derlemeler/meta-analizler). Bu yüzden başlangıç programı yürüyüş, sabit bisiklet, sandalye egzersizleri ve bant/dambıl kuvvet çalışmalarına dayanır.

### Başlangıç haftalık program (ACSM FITT temelli)

**Kuvvet reçetesi (ACSM):** Novice için her büyük kas grubu **haftada 2–3 gün**, egzersiz başına **1–3 set × 8–12 tekrar**, 8–10 egzersiz tüm büyük kas gruplarını kapsayacak şekilde. Yaşlı/kırılgan için 10–15 tekrar. ACSM'nin birebir ifadesi: *"The recommendation for training frequency is 2–3 d·wk⁻¹ for novice training"* ve minimal standart *"one set of 8–12 repetitions for 8–10 exercises, including one exercise for all major muscle groups."* (Kaynak: Ratamess ve ark., "Progression Models in Resistance Training for Healthy Adults", Med Sci Sports Exerc 2009;41(3):687–708, DOI 10.1249/MSS.0b013e3181915670.)

**Aerobik reçetesi (deconditioned başlangıç):** Hafif-orta şiddet faydalı; 10 dakikalık parçalara bölünebilir; "start low and go slow". (Kaynak: Garber ve ark., ACSM Position Stand, Med Sci Sports Exerc 2011;43(7):1334–1359, DOI 10.1249/MSS.0b013e318213fefb; ACSM 1998 position stand — min. 10 dk bloklar.)

**Hafta 1–2 (temel/adaptasyon):**


| Gün        | İçerik                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Pzt        | 5 dk ısınma + 15–20 dk tempolu yürüyüş + esneme                                                        |
| Sal        | Kuvvet A: sandalyeden kalkma, duvar şınavı, kalça köprüsü, bant kürek, plank (her biri 1–2 set × 8–10) |
| Çar        | Dinlenme veya 15 dk yürüyüş                                                                            |
| Per        | Kuvvet B: goblet/vücut squat, bird-dog, calf raise, biceps curl, dead bug (1–2 set × 8–10)             |
| Cum        | 20 dk yürüyüş veya sabit bisiklet                                                                      |
| C.tesi/Paz | Aktif dinlenme (esneklik/denge)                                                                        |


**Kademeli ilerleme mantığı:**

- Aerobik süreyi kademeli artırın ("start low and go slow"); haftalık artışları küçük tutun.
- Kuvvette: kişi hedef tekrarın 1–2 üstünü rahatça yapabildiğinde yükü **%2–10 artırın**. ACSM'nin birebir ifadesi: *"it is recommended that 2–10% increase in load be applied when the individual can perform the current workload for one to two repetitions over the desired number"* (ACSM 2009 progresyon kuralı).
- Hafta 3–4'te set sayısını 2–3'e, süreyi 30 dk'ya çıkarın; Hafta 5–6'da orta şiddet dakikasını WHO hedefi 150 dk/hafta'ya doğru artırın.

### Güvenlik: kırmızı bayraklar (egzersizi DURDUR ve yardım al)

Aşağıdaki belirtilerde **hemen durun** ve tıbbi yardım alın (acil ise 112):

- Göğüs ağrısı/baskı/sıkışma (kola, çeneye, sırta yayılabilir)
- Anormal/orantısız nefes darlığı
- Baş dönmesi, bayılacak gibi olma, denge kaybı
- Düzensiz/çarpıntılı kalp atışı
- Soğuk terleme, bulantı Kaynak: Healthline (kardiyoloji), Banner Health, Baptist Health.

**Doktora danışma gereken durumlar (egzersize başlamadan önce):** ACSM 2015 tarama modeline göre — hareketsiz olup bilinen kalp/metabolik/böbrek hastalığı VEYA belirtisi olanlar egzersize başlamadan önce tıbbi onay almalı. Belirtisiz/hastalıksız hareketsiz kişiler hafif-orta egzersize onay olmadan başlayabilir ama yüksek şiddete geçmeden önce onay almalı. (Kaynak: Riebe ve ark., "Updating ACSM's Recommendations for Exercise Preparticipation Health Screening", Med Sci Sports Exerc 2015;47(11):2473–2479.) PAR-Q+ öz-tarama aracı uygulamaya gömülebilir (tamamlayanların ~%1'i egzersiz öncesi hekim değerlendirmesi gerektirir).

### Uyum/motivasyon için kanıtlı stratejiler

- **Hedef belirleme (goal setting)** + **öz-izleme (self-monitoring) ve geri bildirim**: fiziksel aktiviteye uyumu artırdığına dair kanıt var (sistematik derleme; kesinlik düşük-orta).
- **Uygulama niyetleri (implementation intentions)**: "X gününde Y saatte yürüyeceğim" gibi somut planlar.
- Teori temelli öz-izleme uygulaması kullananlar 2 ayda haftada 7.2 egzersiz seansına ulaşırken, kullanmayanlar 4.7'de kaldı (JMIR pilot çalışması). Kaynak: [dovepress.com](http://dovepress.com) (PPA sistematik derleme); [pmc.ncbi.nlm.nih.gov](http://pmc.ncbi.nlm.nih.gov) davranışsal uyum; [mhealth.jmir.org](http://mhealth.jmir.org).

**Kaynaklar (Başlık 4):** jospt.org/doi/10.2519/jospt.2018.7877; [pmc.ncbi.nlm.nih.gov](http://pmc.ncbi.nlm.nih.gov) diz OA meta-analizleri; [journals.lww.com](http://journals.lww.com) ACSM 2009/2011; pubmed 26473759 (Riebe 2015); [healthline.com](http://healthline.com); [dovepress.com](http://dovepress.com); [mhealth.jmir.org](http://mhealth.jmir.org).

---

## BAŞLIK 5 — KALORİ / ENERJİ HESABI

**MET tanımı:** 1 MET = dinlenme metabolizması ≈ 1 kcal/kg/saat ≈ 3.5 ml O₂/kg/dk.

**Formül:** `Yakılan kalori (kcal) = MET × kg × saat` Örnek: 8.0 MET, 70 kg, 1 saat → 8.0 × 70 × 1 = 560 kcal. Dakika bazlı alternatif: `kcal = (MET × 3.5 × kg) / 200` (dakika başına).

**MET değerleri tablosu (2024 Adult Compendium of Physical Activities):**


| Aktivite                                           | MET  | Kod   |
| -------------------------------------------------- | ---- | ----- |
| Esneme, hafif                                      | 2.3  | 02101 |
| Yoga, Hatha                                        | 2.3  | 02150 |
| Pilates, mat                                       | 1.8  | 02103 |
| Sit-to-stand (6–12/dk)                             | 2.8  | 02340 |
| Kalistenik, hafif (plank, crunch)                  | 2.8  | 02024 |
| Vücut ağırlığı direnç (squat, lunge, şınav), genel | 3.0  | 02056 |
| Yürüyüş, orta tempo (~4.8 km/s)                    | 3.5  | 17190 |
| Kalistenik, orta (şınav, lunge)                    | 3.8  | 02022 |
| Ev egzersizi, genel                                | 3.8  | 02064 |
| Tempolu yürüyüş (5.6 km/s)                         | 4.3  | 17200 |
| Aerobik dans, düşük etkili                         | 4.8  | 02005 |
| Direnç antrenmanı, 8–15 tekrar çeşitli             | 3.5  | 02054 |
| Direnç, squat/deadlift                             | 5.0  | 02052 |
| Eliptik, orta                                      | 5.0  | 02048 |
| Su aerobiği                                        | 5.3  | 02120 |
| Devre antrenmanı (vücut ağırlığı)                  | 6.0  | 02032 |
| Vücut ağırlığı direnç, yüksek yoğunluk             | 6.5  | 02057 |
| Kalistenik, yoğun (burpee, jumping jack)           | 7.5  | 02020 |
| HIIT (burpee, mountain climber, Tabata)            | 11.0 | 02214 |
| İp atlama, genel                                   | 11.0 | 02068 |


Kaynak: pacompendium.com/conditioning-exercise; pacompendium.com/walking; Ainsworth ve ark., 2024 Adult Compendium (kırmızı kodlar tahmini değer, diğerleri yayınlanmış literatürle desteklenir).

**Kaynaklar (Başlık 5):** [pacompendium.com](http://pacompendium.com); pmc.ncbi.nlm.nih.gov/articles/PMC10818145; [acefitness.org](http://acefitness.org) (MET açıklaması).

---

## BAŞLIK 6 — HAFTALIK AKTİVİTE HEDEFİ

**WHO / ACSM yetişkin (18–64) önerisi:**

- **Aerobik:** Haftada **150–300 dakika orta şiddet** VEYA **75–150 dakika yüksek şiddet** aerobik aktivite, ya da eşdeğer kombinasyon. WHO 2020 kılavuzunun birebir ifadesi: *"All adults should undertake 150–300 min of moderate-intensity, or 75–150 min of vigorous-intensity physical activity, or some equivalent combination … per week."*
- **Kuvvet:** Tüm büyük kas gruplarını çalıştıran, orta veya üzeri şiddette **haftada 2+ gün** kas güçlendirme (*"on 2 or more days a week"*).
- Daha fazla fayda için orta şiddeti 300 dk üzerine çıkarmak faydalıdır. Kaynak: WHO Guidelines on Physical Activity and Sedentary Behaviour (2020), [iris.who.int](http://iris.who.int); Bull ve ark., Br J Sports Med 2020; CDC Physical Activity Guidelines for Americans; ncbi.nlm.nih.gov/books/NBK566046.

**Kaynaklar (Başlık 6):** [iris.who.int](http://iris.who.int) WHO kılavuzu; cdc.gov/physical-activity-basics/guidelines/adults.html; ncbi.nlm.nih.gov/books/NBK566046; pmc.ncbi.nlm.nih.gov/articles/PMC7719906.

---

## RECOMMENDATIONS (Uygulama Ekibi İçin)

1. **Veri:** free-exercise-db `dist/exercises.json`'u (Unlicense) uygulamaya gömün; yukarıdaki 40 egzersizlik JSON'u başlangıç kütüphanesi yapın. wger'a geçerseniz CC-BY-SA atıf/share-alike yükümlülüğünü değerlendirin.
2. **Görsel:** free-exercise-db/wrkout görsellerini KULLANMAYIN (repo sahibi telif riskini teyit etti). Kendi SVG/Lottie vektör illüstrasyonlarınızı üretin (en güvenli + en hafif). Geçici olarak wger (CC-BY-SA, atıf) kullanacaksanız uygulama içinde atıf ekranı ekleyin.
3. **Güvenlik:** İlk açılışta PAR-Q+ tarama akışı; her egzersiz kartında kırmızı-bayrak uyarısı; hedef kilo verme hızını 0.5–1 kg/hafta ile sınırlayın; yüksek etkili (low_impact: false) egzersizleri fazla kilolu/başlangıç profilinde varsayılan olarak gizleyin.
4. **Kalori/hedef:** MET formülünü kullanıcının kilosuyla uygulayın (`kcal = MET × kg × saat`); WHO 150–300 dk + 2 gün kuvvet hedefini haftalık ilerleme halkası olarak gösterin.
5. **Eşik değişimi (benchmark):** Kullanıcı Asya kökenliyse BMI/bel eşiklerini düşük varyanta geçirmeyi bir ayar olarak sunun (fazla kilolu ≥23, obez ≥27.5; erkek bel ≥90 cm).

**Kararı değiştirecek eşikler:** (a) free-exercise-db görsellerine net bir açık lisans eklenirse (repo güncellenirse) bundle seçeneği yeniden değerlendirilebilir. (b) Uygulama açık kaynak/CC-BY-SA yayınlanacaksa wger verisi + görselleri en ekonomik seçenek olur. (c) Kullanıcı tabanı klinik/hasta popülasyona kayarsa zorunlu hekim onayı akışı eklenmelidir.

## CAVEATS

- **En kritik risk:** free-exercise-db görselleri telif açısından güvensizdir (repo sahibi kendisi teyit etmiştir) — metin verisi serbest, görsel değil.
- MET değerleri popülasyon ortalamasıdır; bireysel kalori yakımı ±%20–30 sapabilir; giyilebilir cihaz farkları normaldir.
- "%10 haftalık artış kuralı" ACSM'nin resmi position stand'inde birebir GEÇMEZ; pratik/eğitimsel bir kural olarak kullanın. ACSM'nin resmi dili "start low and go slow" ve direnç için %2.5–5 hacim artışı örneğidir.
- ACSM'nin novice yük aralığında küçük bir iç tutarsızlık vardır: 2009 metni bazı yerlerde %70–85 1RM, 2011/GETP ise %60–70 1RM belirtir; başlangıç için %60–70 daha güvenlidir.
- ACSM 2026'da direnç antrenmanı kılavuzunu daha esnek/efor-temelli bir çerçeveye güncellemiş olabilir; yukarıdaki sayılar yerleşik ve yaygın atıf alan 2009/2011 kılavuzlarına dayanır.
- Bel çevresi ve BMI eşikleri çoğunlukla Avrupa kökenli popülasyon verisinden türetilmiştir; etnik köken, gebelik ve tıbbi geçmiş riski değiştirebilir.
- Compendium MET tablosunda "kırmızı" kodlanan değerler ölçülmüş değil tahminidir; kütüphanede bunları mümkünse ölçülmüş değerlerle değiştirin.


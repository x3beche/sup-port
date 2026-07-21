# sup-port — Yeni Modül Araştırması (kanıta dayalı, önceliklendirilmiş)

> [`new-modules-research-prompt.md`](./new-modules-research-prompt.md) çıktısı.
> Yöntem: 6 arama açısı → 29 kaynak → 136 iddia → **25 iddia 3 oylu çekişmeli
> doğrulamadan geçti (25/25 onaylandı, 0 çürütüldü)**. Bütçe nedeniyle bazı
> adaylar biçimsel doğrulamaya girmedi; onlar için **arama-fazı birincil
> kaynakları** (etki büyüklüğü + URL ile) kullanıldı ve tabloda "(arama)" olarak
> işaretlendi — çekişmeli doğrulanmadılar, güven bir tık daha düşük.
> Karmaşıklık dereceleri gerçek koda göre: `backend/app/modules.py` içinde
> **tek `Module(...)` kaydı = Düşük**; kendi ekranı + koleksiyonu + `entries`
> rollup'ı olan (brush/spor gibi) = **Orta**; native yetenek (bildirim, kamera,
> sağlık/ekran-süresi API'si, arka plan zamanlayıcı) gerektiren = **Yüksek**.

## TL;DR
- **Hemen yap (yüksek değer, temiz):** Nefes egzersizi (en güçlü kanıt), Sosyal
  bağ / sevdiğine ulaşma (en güçlü sosyal kanıt), Güneş/dışarı zamanı, Şükran
  günlüğü, Pomodoro/derin çalışma. İlk beşin dördü basit sayaç; nefes tek "zengin
  ekran" ama native gerektirmez, dış veri/lisans/gizlilik yükü sıfır.
- **Büyük ama değerli (ertele):** İlaç/vitamin hatırlatma — gerçek fayda var
  ama native bildirim + hassas sağlık verisi.
- **Zayıf kanıt, skorlanan çekirdeğe koyma:** Soğuk duş, dijital detoks/ekran
  süresi, 20-20-20 göz molası. Opsiyonel bırakılabilir, "iyileştirir" denmemeli.
- **En kritik risk gizlilik:** Şükran/günlük/ruh hali/finans **serbest metni ve
  duygu verisi** özel kategori (KVKK md. 6 / GDPR art. 9). sup-port veriyi
  **sunucuda (MongoDB)** tutuyor; kaynaklar ısrarla "cihazda tut" diyor. Çözüm
  aşağıda: mevcut **rollup deseni** — sunucuya sadece sayı, metin cihazda.

---

## Önceliklendirilmiş tablo

| # | Modül | Kategori | Metrik / varsayılan hedef | Karmaşıklık | Veri/Lisans | Gizlilik | Kanıt gücü |
|---|-------|----------|---------------------------|-------------|-------------|----------|-----------|
| 1 | **Nefes egzersizi** | Zihin | dk/seans · **~5 dk, 6 nefes/dk** | Orta (zengin ekran, native yok) | Yok | Yok | **Güçlü** ✓doğrulandı |
| 2 | **Sosyal bağ / sevdiğine ulaşma** | Zihin | anlamlı temas/gün · **1** | Düşük (sayaç) | Yok | Orta (**isim tutma**) | **Güçlü** (arama) |
| 3 | **Güneş / dışarı zamanı** | Sağlık | dk dışarıda/gün · **~120 dk** (miyopi/ruh hali) / öğle 15-20 dk (D vit.) | Düşük (sayaç, **GPS yok**) | Yok | Düşük (GPS eklenirse artar) | Orta (arama) |
| 4 | **Şükran günlüğü** | Zihin | kayıt/gün · **1** | Orta (metin ekranı + koleksiyon) | Yok | **Yüksek (serbest metin)** | Orta ✓doğrulandı |
| 5 | **Pomodoro / derin çalışma** | Öğrenme | odak seansı veya mola/gün · **4** | Düşük–Orta (sayaç/timer) | Yok | Yok | Orta (arama) |
| 6 | **Nazik davranış (acts of kindness)** | Zihin | davranış/gün · **1** | Düşük (sayaç) | Yok | Yok | Orta (arama) |
| 7 | **Esneme / duruş molası** | Hareket | mola/gün · **3** | Düşük–Orta (sayaç; spor kütüphanesi tekrar kullanılır) | Yok (kendi görselin) | Yok | Orta (arama) |
| 8 | **Ruh hali (mood)** | Zihin | log/gün (1–5 skala) · **1** | Düşük–Orta (skala UI) | Yok | **Yüksek (duygu verisi)** | **Ölçüm, tedavi değil** ✓doğrulandı |
| 9 | **Serbest günlük (journaling)** | Zihin | kayıt/gün · **1** | Orta (metin) | Yok | **Yüksek (metin)** | Orta/koşullu ✓doğrulandı — **pozitif prompt kullan** |
| 10 | **İlaç / vitamin hatırlatma** | Sağlık | doz/gün | **Yüksek (native bildirim)** | Yok | **Yüksek (sağlık verisi)** | Orta, düşük-GRADE (arama) |
| 11 | **Yeni kelime / Kod / Müzik pratiği** | Öğrenme | dk/gün (İngilizce/okuma deseni) | Düşük | Yok | Yok | Genel (bilinçli pratik) |
| 12 | **Finans (tasarruf/bütçe)** | (yeni kategori) | ₺ veya "kaydettim"/gün | Düşük–Orta | Yok | **Yüksek (finansal veri)** | Bu turda değerlendirilmedi |
| 13 | **Soğuk duş** | Sağlık | duş/gün · 1 | Düşük (sayaç) | Yok | Yok | **Zayıf-karışık** (arama) |
| 14 | **Dijital detoks / ekran süresi** | Zihin | telefonsuz dk / "detoks ✓" (öz-bildirim) | Düşük (öz-bildirim) / **Yüksek** (gerçek ekran-süresi API) | Yok | Orta | **Zayıf-karışık** (arama) |
| 15 | **20-20-20 göz molası** | Sağlık | mola/20 dk | **Yüksek (arka plan zamanlayıcı/bildirim)** | Yok | Yok | **Zayıf** (tanım otoriter, etki kanıtsız) ✓doğrulandı |

---

## İlk 5 öneri (gerekçe + kaynak + hedef + ekran)

### 1) Nefes egzersizi — *rehberli yavaş nefes* · Zihin · **zengin ekran**
En yüksek kanıtlı yeni aday ve teknik olarak temiz: dış veri yok, lisans yok,
hassas veri yok. Sadece bir tempolu nefes animasyonu/sayacı — mevcut `BrushTimer`
(2 dk dairesel geri sayım) deseni birebir kullanılabilir.
- **Kanıt (güçlü, çekişmeli doğrulandı):** Fincham 2023 (12 RCT, 785 kişi) —
  nefes çalışması stresi anlamlı düşürdü, *g = −0.35* [−0.55, −0.14], p=0.0009,
  düşük yayın yanlılığı. Laborde 2022 (223 çalışma) — yavaş nefes vagal HRV'yi
  seans sırasında/sonrasında güvenilir biçimde artırıyor. Doz-yanıt yok: **5 dk,
  10-15-20 dk kadar etkili** → kısa günlük hedef savunulabilir.
- **Hedef:** 6 nefes/dk (~5 sn al / 5 sn ver), **günde ~5 dk**. Wearable/HR
  sensörü gerekmez (telefon-yalnız timer yeterli).
- **Kaynak:** https://www.nature.com/articles/s41598-022-27247-y ·
  https://www.sciencedirect.com/science/article/abs/pii/S0149763422002007 ·
  https://pmc.ncbi.nlm.nih.gov/articles/PMC8656666/

### 2) Sosyal bağ / "sevdiğine ulaşma" · Zihin · **basit sayaç**
Kanıt gücü en yüksek sosyal davranış; uygulaması tek `Module(...)` kaydı.
- **Kanıt (güçlü — devasa gözlemsel meta-analizler):** Holt-Lunstad 2010
  (148 çalışma, 308k kişi) — güçlü sosyal ilişki **%50 daha yüksek hayatta kalma
  olasılığı** (OR=1.50), etki sigarayı bırakmakla kıyaslanabilir. Holt-Lunstad
  2015 — sosyal izolasyon OR=1.29, yalnızlık OR=1.26 (~%26-32 artmış mortalite).
- **Hedef:** günde **1 anlamlı temas** (ara / sesli mesaj / buluşma).
- **Gizlilik:** *yalnızca sayıyı* tut; kişi adı/telefon **tutma**.
- **Kaynak:** https://journals.plos.org/plosmedicine/article?id=10.1371%2Fjournal.pmed.1000316 ·
  https://journals.sagepub.com/doi/full/10.1177/1745691614568352

### 3) Güneş / dışarı zamanı · Sağlık · **basit sayaç**
Türkiye için özellikle değerli (güneşli iklim), ama kışın önemli bir nüans var.
- **Kanıt (orta):** Wu 2018 (okul temelli küme RCT) — günde ~120 dk / ≥1000 lux
  dışarı, çocukta miyopik kaymayı azaltıyor. Sherwin 2012 meta-analiz — net
  doz-yanıt. Nature *Translational Psychiatry* 2023 (UK Biobank ~500k) — her
  fazladan 1 saat gün ışığı depresyon olasılığını düşürüyor, genetik riskten
  bağımsız. UCLA Health — D vitamini için öğle **10-30 dk** yeterli; **UV
  indeksi <3 iken sentez yok** (TR kışı / yüksek enlem uyarısı).
- **Hedef:** ruh hali/miyopi için **~120 dk/gün dışarı**; sadece D vitamini
  amaçlıysa öğle **15-20 dk**. Uygulama içi not: kışın UV<3'te güneşlenme D
  vitamini üretmez.
- **Gizlilik:** öz-bildirim yeterli — **GPS/konum kullanma** (topladığın anda
  KVKK yükü doğar).
- **Kaynak:** https://pubmed.ncbi.nlm.nih.gov/29371008/ ·
  https://www.nature.com/articles/s41398-023-02338-0 ·
  https://www.uclahealth.org/news/article/ask-the-doctors-round-sun-exposure-vital-to-vitamin-d-production

### 4) Şükran günlüğü · Zihin · **zengin (metin) ekran**
Gerçek ama **mütevazı** fayda — abartma. Kültürler-arası (TR dahil) geçerli.
- **Kanıt (orta, çekişmeli doğrulandı):** Kirca 2023 (25 RCT, 6.745 kişi) —
  *g = 0.22*; Fritz 2025 *PNAS* (24.804 kişi, 28 ülke) — *g = 0.19*, yayın
  yanlılığına dayanıklı. **Etki küçük** ve aktif kontrollere karşı ~0.12'ye
  düşüyor (anlamsız). İyi oluş/pozitif duygulanımda güçlü; **klinik anksiyete/
  depresyon tedavisi iddiası zayıf** → "iyi oluş aracı" olarak konumla.
- **Hedef:** günde **1 şükran kaydı** ("bugün minnettar olduğun 1 şey").
- **Gizlilik:** serbest metin — aşağıdaki rollup desenini uygula.
- **Kaynak:** https://link.springer.com/article/10.1007/s41042-023-00086-6 ·
  https://pubmed.ncbi.nlm.nih.gov/40627390/ ·
  https://pubmed.ncbi.nlm.nih.gov/37585888/

### 5) Pomodoro / derin çalışma · Öğrenme · **basit sayaç (opsiyonel timer)**
Mevcut Öğrenme kategorisini tamamlar; İngilizce/okuma ile doğal ilişki.
- **Kanıt (orta):** Albulescu 2022 *PLOS ONE* (22 örneklem, N=2335, CC-BY) —
  mikro-molalar dinçliği artırıp (*d=0.36*) yorgunluğu azaltıyor (*d=0.35*);
  **ama** genel performansta etki zayıf (*d=0.16*, yalnız düşük bilişsel yükte
  anlamlı). Biwer 2023 — Pomodoro molaları öznel odak/motivasyonu artırıyor.
  Dürüst çerçeve: "enerji/odak toparlar", "zor işte performansı fırlatır" değil.
- **Hedef:** günde **~4 odak seansı / mola**. Basit sayaç; istenirse 25/5
  dk hafif timer (native gerektirmez, sadece ekran açık zamanlayıcı).
- **Kaynak:** https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0272460 ·
  https://bpspsychub.onlinelibrary.wiley.com/doi/10.1111/bjep.12593

> **Onurlu bahis — Nazik davranış (acts of kindness):** Curry 2018 (27 çalışma,
> N=4045) — davranış sahibinin iyi oluşunda küçük-orta artış (*δ=0.28*), yayın
> yanlılığı yok; Rowland & Curry 2019 RCT bunu doğruluyor. Tek `Module(...)`
> kaydı, sıfır risk. 5. sırayla neredeyse başa baş.
> https://www.sciencedirect.com/science/article/pii/S0022103117303451

---

## Hızlı kazanımlar ↔ Büyük ama değerli

**Hızlı kazanımlar** (Düşük karmaşıklık · dış veri/lisans yok · gizlilik düşük ·
kanıt orta+): **Sosyal bağ, Güneş/dışarı, Nazik davranış, Pomodoro**, ve
İngilizce/okuma desenini kopyalayan **Yeni kelime / Kod pratiği / Müzik pratiği**
(dk/gün sayaçları — tek kayıt, saatler içinde eklenir). **Nefes** teknik olarak
"orta" (zengin ekran) ama dış veri/lisans/gizlilik yükü sıfır ve **en yüksek
kanıt** — pratikte hızlı-kazanım muamelesi görmeli.

**Büyük ama değerli** (native yetenek / hassas veri — planla, acele etme):
- **İlaç / vitamin hatırlatma** — gerçek klinik fayda: mobil hatırlatıcılar
  uyumu artırıyor (*d=0.40* [0.27, 0.52], ama GRADE **düşük** ve çoğu çalışma
  öz-bildirime dayanıyor). Maliyet: **native zamanlanmış bildirim** +
  **hassas sağlık verisi (KVKK)**. TR'de değeri yüksek; doğru yapılırsa güçlü
  bir modül. https://pmc.ncbi.nlm.nih.gov/articles/PMC7045248/ ·
  https://pmc.ncbi.nlm.nih.gov/articles/PMC10391210/
- **Gerçek ekran-süresi takibi** — native ekran-süresi API'si (Expo managed'de
  çoğu zaman yok); üstelik kanıt zayıf → **önerilmez**.

---

## Zayıf kanıt — skorlanan çekirdeğe koyma / "iyileştirir" deme

- **Soğuk duş / soğuğa maruz kalma (zayıf-karışık):** PLOS One 2025 meta-analizi
  kanıtı açıkça **düşük kaliteli** buluyor (az RCT, küçük örneklem); faydalar
  kısa ömürlü, bağışıklık/ruh hali iddiaları desteklenmiyor (stres ancak 12 saat
  sonra, uyku yalnız erkeklerde). Opsiyonel "eğlence" sayaç olabilir ama günlük
  puana ağırlık verme. https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0317615
- **Dijital detoks / ekran süresi (zayıf-karışık):** 12 RCT'lik sistematik
  derlemede sonuçlar tutarsız; bir RCT sosyal medyayı %50 kısmanın dikkat/iyi
  oluşta **fayda sağlamadığını** buldu; bir diğeri ruh sağlığında iyileşme
  buldu. Net değil. https://pmc.ncbi.nlm.nih.gov/articles/PMC11422191/ ·
  https://www.sciencedirect.com/science/article/pii/S0747563225000718
- **20-20-20 göz molası (zayıf):** AOA kuralı otoriter biçimde *tanımlıyor*
  (her 20 dk, 20 sn, ~6 m uzağa bak) ama **etkinliği kanıtlanmamış** (doğrulama
  yalnız tanımı onayladı, faydayı değil); üstelik anlamlı uygulaması **arka plan
  zamanlayıcı/bildirim** ister (yüksek karmaşıklık). Zorunlu skor habiti değil,
  hafif opsiyonel hatırlatıcı olarak düşünülebilir.
  https://www.aoa.org/AOA/Images/Patients/Eye%20Conditions/20-20-20-rule.pdf

**Kapsam dürüstlüğü:** Bu turda çekişmeli **doğrulanan** 5 alan nefes, şükran,
ruh hali, journaling tasarımı ve 20-20-20 tanımı. Diğerleri (sosyal bağ, güneş,
pomodoro, nazik davranış, esneme, ilaç, soğuk duş, detoks) güçlü **birincil
arama kaynaklarına** dayanıyor ama 3-oylu doğrulamadan geçmedi — güven bir tık
daha düşük, tekrar-doğrulama önerilir.

---

## En kritik riskler — GİZLİLİK (başlık)

sup-port `entries`'i **sunucuda MongoDB'de** saklıyor. Aşağıdaki modüller özel
kategori/hassas veri üretir; kaynaklar ısrarla **"cihazdan çıkmasın"** diyor.
Bu mimaride en büyük tasarım riski budur.

1. **Serbest metin ve duygu verisi sunucuya gitmesin (özel kategori — KVKK md. 6
   / GDPR art. 9).** Şükran, serbest günlük, ruh hali ve finans için **mevcut
   rollup desenini kullan**: sunucuya **yalnızca sayısal tamamlanma** gitsin
   (ör. `1 = bugün yazdım`, `mood = 4`) — günlük puan için bu yeterli — ve
   **metnin/detayın kendisi cihazda** (`SecureStore`/`AsyncStorage`) kalsın.
   Alternatif: at-rest şifreleme + **açık, ayrık KVKK rızası** + amaç sınırlaması.
   Bu, `module-data-architecture` notundaki "rollup = hız, kendi verisi ayrı"
   ilkesiyle birebir örtüşüyor — burada ayrı yer *cihaz* oluyor.
2. **LLM sınır-ötesi aktarımı:** ruh hali/günlük metnini öneri/özet için
   OpenRouter'a (üçüncü taraf, yurt dışı) **ham** göndermek sınır ötesi veri
   aktarımıdır. Gerekirse yalnız **anonim/özet sinyal** gönder (ör. "7 günün
   ortalama mood 3.2"), serbest metni değil.
3. **Ruh hali çerçevesi:** modülü **ölçüm/farkındalık** olarak konumla. Kanıt
   (2026 meta-analiz, 8 RCT) izlemenin tek başına semptomu **ne iyileştirdiğini
   ne kötüleştirdiğini** gösteriyor — "ruh halini iyileştirir" gibi bir sağlık
   iddiası hem yanlış hem KVKK/tüketici riski.
   https://pmc.ncbi.nlm.nih.gov/articles/PMC12779106/
4. **Journaling tasarımı:** genel kitle için **pozitif/şükran yönlendirmeleri**
   kullan; serbest travma yazımı daha sıkıntı verici ve daha az faydalı (Lai
   2023). https://pmc.ncbi.nlm.nih.gov/articles/PMC10415981/
5. **Sosyal bağ:** kişi ismi/numarası tutma, **yalnız sayı**.
6. **Konum:** güneş/dışarı modülünde **GPS kullanma**; öz-bildirim yeterli.
7. **Finans:** finansal veri hassastır; eklenirse sunucuda tutar (yalnız günlük
   "kaydettim ✓" veya toplam ₺) ve dökümü cihazda bırak.

## Sırada ne var (öneri)
İlk 5'in dördü **tek `Module(...)` kaydı + (nefes için) bir zengin ekran** ile
gelir. Önerilen sıra: **Nefes → Sosyal bağ → Güneş/dışarı → Nazik davranış →
Pomodoro**, ardından şükran/journaling'i yukarıdaki **rollup-cihazda-metin**
deseniyle birlikte. Her biri için `features.md`/`todo.md` iskeleti bu klasör
konvansiyonuyla ayrıca çıkarılabilir.

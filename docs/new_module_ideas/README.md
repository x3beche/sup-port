# Yeni Modül Fikirleri — Araştırma

sup-port'a eklenebilecek yeni modül (mini-app) adaylarının kanıta dayalı,
önceliklendirilmiş araştırması. Girdi (prompt), sonuç ve ham kanıt tabanının
tamamı bu klasörde toplandı.

## İçindekiler
- [`research-prompt.md`](./research-prompt.md) — **girdi:** araştırma agent'ına
  verilen görev.
- [`research.md`](./research.md) — **sonuç:** önceliklendirilmiş tablo, ilk 5
  öneri, hızlı-kazanım↔büyük ayrımı, kritik gizlilik riskleri.
- [`evidence.md`](./evidence.md) — **ham veri:** 3-oylu doğrulanmış bulgular +
  aday başına birincil kaynaklar + tüm kaynak listesi + uyarılar/açık sorular.

## Öne çıkanlar
Önerilen sıra: **Nefes egzersizi → Sosyal bağ → Güneş/dışarı zamanı → Şükran
günlüğü → Pomodoro** (+ onurlu bahis: Nazik davranış). İlk beşin dördü tek
`Module(...)` kaydı; nefes tek "zengin ekran" ama native gerektirmez.

**Kritik gizlilik notu:** şükran/günlük/ruh hali/finans **serbest metni ve duygu
verisi** özel kategori (KVKK md. 6 / GDPR art. 9). sup-port veriyi sunucuda
tutuyor → **rollup deseni**: sunucuya yalnız sayısal tamamlanma, metin/detay
cihazda (`SecureStore`). Ayrıntı `research.md` "En kritik riskler" bölümünde.

**Zayıf kanıt (skorlanan çekirdeğe koyma):** soğuk duş, dijital detoks/ekran
süresi, 20-20-20 göz molası.

## Yöntem
deep-research harness: 6 arama açısı → 29 kaynak → 136 iddia → 25 iddia 3-oylu
çekişmeli doğrulama (25 onay / 0 çürütme) → sentez. Ayrıntılı meta ve kapsam
uyarıları `evidence.md` içinde.

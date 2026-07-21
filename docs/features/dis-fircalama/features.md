# Diş Fırçalama Modülü — Özellikler

Basit "2 kez" sayacından daha **eğlenceli, ödüllendirici** bir rutine. Odak: UX,
animasyon, seri (streak) — veri/telif/araştırma gerektirmez.

## Vizyon
Sabah + akşam fırçalamayı keyifli bir alışkanlığa dönüştür: rehberli süre,
tatmin edici geri bildirim, büyüyen bir seri.

## Özellikler

### Rehberli fırçalama sayacı (2 dakika)
- Diş hekimi önerisi **2 dakika**; 4 bölgeye (30'ar sn) bölünmüş sayaç.
- Başlat → dairesel geri sayım + bölge değişiminde titreşim (haptic) + hafif ses.
- Bitince "tamam" kutlaması.

### Seri (streak) ve kutlama
- Gün gün büyüyen seri (sabah+akşam tamamlandıkça).
- **Streak animasyonu:** alev/rozet büyür; kilometre taşlarında (7, 30, 100 gün)
  konfeti + özel rozet + haptic.
- Seri kırılırsa yumuşak, suçlamayan geri bildirim ("yeniden başlayalım").

### Sabah / akşam yuvaları
- İki ayrı yuva (☀️ sabah / 🌙 akşam) — her biri işaretlenince dolu animasyonu.
- Gün içinde ikisi de tamamlanınca kart kutlama durumuna geçer.

### Hatırlatma (opsiyonel, sonraki adım)
- Sabah/akşam yerel bildirim (expo-notifications) — izinli.

## Kısıtlar / dikkat
- Animasyonlar **abartısız ve profesyonel** (jüri ilkesi): kutlama kısa, tekrar
  eden görevde yorucu olmamalı; `prefers-reduced-motion` desteği.
- Bildirimler **native** — development build + izin akışı.
- Konfeti vb. için ağır kütüphane yerine hafif özel bileşen (bundle şişmesin).

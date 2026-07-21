# Diş Fırçalama Modülü — Yapılacaklar

Çoğu iş frontend/UX; backend hafif.

## Backend
- [ ] Yuva bazlı kayıt: günlük "brush" değeri yerine `slots` (morning/evening)
      — veya mevcut değeri koruyup istemcide iki yuvaya bölmek yeterli olabilir.
- [ ] Seri (streak) hesabı: `GET /api/brush/streak` (arka arkaya tam günler) —
      ya da mevcut `history` uçundan istemcide hesapla.
- [ ] (Opsiyonel) kilometre taşı rozetleri kullanıcı belgesinde.

## Frontend
- [ ] `BrushTimerScreen` / modal: 2 dk dairesel geri sayım, 4 bölge, haptic
      (expo-haptics), bitiş kutlaması.
- [ ] Sabah/akşam yuvaları: iki büyük dokunma alanı, işaretlenince dolma
      animasyonu (mevcut `Animated`).
- [ ] Streak bileşeni: büyüyen alev/rozet; kilometre taşında konfeti + haptic.
- [ ] Hafif konfeti bileşeni (özel, kütüphanesiz) — `prefers-reduced-motion`.
- [ ] Modül ana ekranı: iki yuva + seri sayısı + "fırçalamaya başla".

## Entegrasyon
- [ ] İki yuva tamamlanınca günlük "Diş Fırçalama" değeri = hedef (puan akışı).
- [ ] (Opsiyonel) expo-notifications: sabah/akşam hatırlatma + izin akışı +
      development build.
- [ ] expo-haptics bağımlılığı + izin gerektirmez.

## Test
- [ ] UI: yuva işaretleme, iki yuva → tamamlanma, seri artışı, kilometre taşı.
- [ ] Sayaç akışı ve animasyonlar cihazda/emülatörde elle doğrulanır.
- [ ] Mevcut mağaza/puan testleri bozulmamalı (modül değeri davranışı korunur).

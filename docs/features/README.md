# Modül Geliştirme Planları

Her modül kendi alt-uygulaması gibi büyütülüyor. Ana ekrandaki kutucuk giriş
kapısı; günlük hedef ve puan entegrasyonu tüm modüllerde korunur.

| Modül | Klasör | Durum | Araştırma gerekiyor mu |
| --- | --- | --- | --- |
| Spor / Egzersiz | [`spor/`](./spor) | Planlandı | Evet — egzersiz veri seti + görsel lisansı |
| Okuma / Kütüphane | [`okuma/`](./okuma) | Planlandı | Hafif — Open Library API koşulları |
| Yemek / Beslenme | [`yemek/`](./yemek) | Planlandı | Evet — besin veri tabanı + fotoğraf→kalori |
| Diş Fırçalama | [`dis-fircalama/`](./dis-fircalama) | Planlandı | Hayır — UX/animasyon |

Her klasörde:
- `features.md` — ne yapacağız (vizyon + özellikler)
- `todo.md` — nasıl yapacağız (backend + frontend adımları)
- `research-prompt.md` — (gerekiyorsa) araştırma agent'ına verilecek prompt

## Yeni modül adayları
Eklenebilecek yeni modüller için kanıta dayalı, önceliklendirilmiş araştırma:
[`new-modules-research.md`](./new-modules-research.md)
([`new-modules-research-prompt.md`](./new-modules-research-prompt.md) çıktısı).
Öne çıkan öneri sırası: **Nefes egzersizi → Sosyal bağ → Güneş/dışarı zamanı →
Şükran günlüğü → Pomodoro**. Kritik not: şükran/günlük/ruh hali/finans **serbest
metni sunucuya değil, cihazda** tutulmalı (rollup deseni).

## Ortak ilkeler
- **Telif:** kitap/besin/egzersiz **içeriği** sunmayız; yalnızca açık lisanslı
  veri + kullanıcının kendi verisi. Uygulama içi içerik yalnızca kamu malıysa.
- **Sağlık:** kalori/kilo/egzersiz önerileri **genel ve kaynaklı**; kişiye özel
  tıbbi reçete değil, "uzmana danış" uyarılı.
- **Gizlilik:** cihazdan dışarı veri gidiyorsa (ör. yemek fotoğrafı → API) bunu
  gizlilik politikasında ve kullanıcıya açıkça belirt.
- **Mimari:** her modül `backend/app/modules.py` kaydına + kendi koleksiyon/uç
  ve ekranlarına oturur. Basit sayaç modülleri (Su, Uyku, Adım, Meditasyon)
  şimdilik olduğu gibi kalır.

# Gizlilik Politikası — sup-port

Son güncelleme: 21 Temmuz 2026

Bu politika, sup-port uygulamasının hangi verileri topladığını, nasıl
kullandığını ve koruduğunu açıklar. Play Console'un **Veri güvenliği** formu bu
politikayla tutarlı doldurulmalıdır (beyan ile gerçek toplama farklı olursa
yayın sonrası uygulama askıya alınabilir).

## Toplanan veriler

**Hesap bilgisi**
- E-posta adresi — giriş ve hesabını tanımlamak için.
- İsim — uygulama içinde seni selamlamak için.
- Parola — güvenli biçimde (bcrypt ile karma olarak) saklanır; düz metin
  parolan hiçbir yerde tutulmaz.

**Alışkanlık verileri**
- Kurduğun uygulamalar, günlük girdilerin (ör. içtiğin su, uyku süresi),
  belirlediğin hedefler ve sıralama tercihlerin.

Bu veriler, hesabına bağlı olarak kendi sunucumuzdaki (MongoDB Atlas)
veritabanında saklanır.

## Toplanmayan veriler

- Konum, kişiler, fotoğraf, mikrofon, kamera verisi toplanmaz.
- Reklam kimliği veya izleme tanımlayıcısı kullanılmaz.
- Analitik/çökme izleme üçüncü taraf SDK'sı gömülü değildir.

## Verilerin kullanımı ve paylaşımı

- Verilerin yalnızca uygulamanın çalışması (girdilerini kaydetmek, puanını ve
  grafiğini hesaplamak) için kullanılır.
- Verilerin **üçüncü taraflarla paylaşılmaz** ve **reklam için kullanılmaz**.
- Yasal zorunluluk dışında kimseye satılmaz veya devredilmez.

## Güvenlik

- Parolalar bcrypt ile karma olarak saklanır.
- Oturumlar süreli JWT ile yönetilir; çıkış yaptığında oturum sunucu tarafında
  iptal edilir.

## Verilerinin silinmesi

Hesabının ve verilerinin silinmesini istersen aşağıdaki e-posta adresine
yazman yeterlidir; talebin üzerine hesabın ve tüm alışkanlık verilerin
kalıcı olarak silinir.

## Çocukların gizliliği

Uygulama 13 yaş altındaki çocuklara yönelik değildir ve bilerek onlardan veri
toplamaz.

## İletişim

Sorular ve veri silme talepleri için: **emirpehlevan@gmail.com**

---
Not: Play'e yüklemeden önce bu dosyayı herkese açık bir URL'de yayınla
(örneğin GitHub Pages veya repo'nun ham dosya bağlantısı) ve bu URL'yi Play
Console listeleme + veri güvenliği bölümlerine gir.

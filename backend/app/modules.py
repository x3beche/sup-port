"""The superapp's module registry.

Adding a new mini-app to sup-port means adding one entry here — the store, the
API, the daily score and the home grid all read from this list.
"""

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Module:
    key: str
    title: str
    icon: str  # vektör ikon adı; istemcideki Icon bileşeni çizer
    color: str
    unit: str
    target: float
    step: float  # varsayılan kademe; steps listesinin ilk elemanı
    description: str  # tek satırlık tanıtım (mağaza listesi)
    category: str
    about: str  # mağaza detayındaki uzun açıklama
    # Modülün ölçeğine uygun artış kademeleri. 8000 adımı 500'er 500'er girmek
    # 16 dokunuş demekti; büyük ölçekli modüller büyük kademe istiyor.
    steps: tuple[float, ...] = ()
    # Mağazada "Yakında" rozetiyle görünür; henüz kurulamaz, günlük puana ve ana
    # ızgaraya girmez. Metin/ikon/hedef hazır, işlevsel ekranı sonra gelecek.
    coming_soon: bool = False

    def step_options(self) -> tuple[float, ...]:
        return self.steps or (self.step,)


MODULES: tuple[Module, ...] = (
    Module(
        key="water", title="Su", icon="droplet", color="#2AA9E0",
        unit="bardak", target=8, step=1, steps=(1, 2, 4),
        category="Sağlık", description="Günlük su takibi",
        about=(
            "Gün içinde içtiğin suyu tek dokunuşla kaydet. Hedefine ne kadar "
            "yaklaştığını halkadan gör, haftalık grafikte düzenini takip et. "
            "Küçük bardaktan büyük şişeye kadar farklı kademelerle hızlıca ekle."
        ),
    ),
    Module(
        key="meal", title="Beslenme", icon="meal", color="#43B77A",
        unit="öğün", target=3, step=1, steps=(1,),
        category="Sağlık", description="Kalori, makro ve öğün takibi",
        about=(
            "Ne yediğini fotoğraf, barkod, arama ya da elle hızlıca kaydet; "
            "günlük kalori ve protein/karbonhidrat/yağ toplamını gör. Boy-kilo-"
            "yaş-aktivite-hedefinden kişisel kalori hedefini hesaplar (Mifflin-"
            "St Jeor, güvenli alt sınır uyarısıyla). Fotoğraftan kalori bir "
            "TAHMİNDİR ve düzeltilebilir; öğün ritmin günlük puana yansır. Genel "
            "bilgidir, kişiye özel diyet reçetesi değildir."
        ),
    ),
    Module(
        key="brush", title="Diş Fırçalama", icon="brush", color="#22C3C3",
        unit="kez", target=2, step=1, steps=(1,),
        category="Sağlık", description="Sabah ve akşam rutini",
        about=(
            "Sabah ve akşam diş fırçalama rutinini kaçırma. Günde iki kez "
            "hedefini tuttukça seri oluşur ve haftalık grafiğinde görünür."
        ),
    ),
    Module(
        key="english", title="İngilizce", icon="language", color="#9B86FF",
        unit="dk", target=20, step=5, steps=(5, 15, 30),
        category="Öğrenme", description="Kelime ve tekrar çalışması",
        about=(
            "Her gün İngilizce çalışmaya ayırdığın süreyi kaydet. Kısa ve "
            "düzenli çalışma, uzun ama seyrek çalışmadan daha kalıcıdır — bu "
            "modül o düzeni tutmana yardım eder. Yakında kelime listeleri gelecek."
        ),
    ),
    Module(
        key="workout", title="Egzersiz", icon="dumbbell", color="#F2622E",
        unit="dk", target=30, step=10, steps=(10, 20, 30),
        category="Hareket", description="Antrenman ve vücut takibi",
        about=(
            "Ev/ekipmansız egzersiz kütüphanesinden antrenman yap, süreni ve "
            "yaktığın kaloriyi kaydet. Boy-kilo ve bel çevresi takibiyle BMI'ni "
            "gör, haftalık WHO aktivite hedefine (150–300 dk + 2 gün kuvvet) "
            "ilerle. Başlangıç ve fazla kilolu için düşük etkili hareketler "
            "öne çıkar. Genel bilgidir, tıbbi tavsiye değildir."
        ),
    ),
    Module(
        key="steps", title="Adım", icon="steps", color="#F5A623",
        unit="adım", target=8000, step=500, steps=(500, 1000, 2500),
        category="Hareket", description="Günlük hareket",
        about=(
            "Günlük adım sayını takip et. 500'den 2500'e kadar kademelerle "
            "büyük sayıları hızlıca gir; en çok kullandığın kademe otomatik "
            "olarak en erişilebilir yere gelir."
        ),
    ),
    Module(
        key="sleep", title="Uyku", icon="moon", color="#7C8CF0",
        unit="saat", target=8, step=0.5, steps=(0.5, 1),
        category="Sağlık", description="Uyku süresi",
        about=(
            "Gece kaç saat uyuduğunu kaydet. Yarım saatlik kademelerle hassas "
            "gir, haftalık grafikte uyku düzenindeki dalgalanmayı gör."
        ),
    ),
    Module(
        key="reading", title="Okuma", icon="book", color="#EE8570",
        unit="dk", target=30, step=10, steps=(5, 15, 30),
        category="Öğrenme", description="Kütüphane, okuma süresi ve yıllık hedef",
        about=(
            "Kitaplarını barkod tarayarak ya da arayarak ekle, raflara ayır "
            "(Okuyorum / Okuyacağım / Bitirdim). Okuma oturumlarını süre veya "
            "sayfa olarak kaydet; süre günlük hedefine işlenir. Yıllık okuma "
            "hedefi (challenge) koy, ilerlemeni çubukta gör; en çok okuduğun "
            "yazar, aylık ritmin ve serin istatistiklere düşer. Kapaklar Open "
            "Library’den gösterilir."
        ),
    ),
    Module(
        key="meditation", title="Meditasyon", icon="lotus", color="#E06BA9",
        unit="dk", target=10, step=5, steps=(5, 10, 20),
        category="Zihin", description="Zihin dinginliği",
        about=(
            "Meditasyon veya nefes çalışmasına ayırdığın süreyi kaydet. "
            "Zihnini dinlendirmeyi günlük bir alışkanlığa dönüştür."
        ),
    ),

    # --- Yakında (coming soon) ---
    # docs/new_module_ideas araştırmasından çıkan 20 aday. Yalnızca kayıt/tanıtım;
    # işlevsel ekran ve mantık henüz yazılmadı. coming_soon=True → mağazada "Yakında".

    # Zihin
    Module(
        key="breathwork", title="Nefes Egzersizi", icon="wind", color="#4FC3D9",
        unit="dk", target=5, step=1, steps=(1, 3, 5), coming_soon=True,
        category="Zihin", description="Rehberli yavaş nefes",
        about=(
            "Dakikada ~6 nefeslik tempolu bir ritimle kısa bir nefes seansı yap. "
            "Yavaş nefes akut stresi ve gerginliği azaltmaya yardımcı olur; çoğu "
            "zaman 5 dakika yeterli. Sakinleşmek için hızlı, ekipmansız bir mola."
        ),
    ),
    Module(
        key="mood", title="Ruh Hâli", icon="smile", color="#F7B32B",
        unit="kayıt", target=1, step=1, steps=(1,), coming_soon=True,
        category="Zihin", description="Günlük ruh hâli kaydı",
        about=(
            "Gününü basit bir ölçekte işaretle ve zaman içindeki değişimi gör. Bu "
            "bir ölçüm/farkındalık aracıdır — kendi başına bir tedavi değil, ama "
            "düzenini fark etmene yardımcı olur. Kayıtların cihazında kalır."
        ),
    ),
    Module(
        key="gratitude", title="Şükran Günlüğü", icon="heart", color="#E8618C",
        unit="kayıt", target=1, step=1, steps=(1,), coming_soon=True,
        category="Zihin", description="Her gün 1 minnet notu",
        about=(
            "Her gün minnettar olduğun bir şeyi kısaca yaz. Etki mütevazı ama "
            "gerçektir: düzenli şükran, iyi oluşu ve pozitif duyguları destekler. "
            "Notların cihazında kalır."
        ),
    ),
    Module(
        key="journal", title="Günlük", icon="pen", color="#8E7CC3",
        unit="kayıt", target=1, step=1, steps=(1,), coming_soon=True,
        category="Zihin", description="Serbest günlük yazma",
        about=(
            "Aklından geçenleri kısaca yaz. En çok fayda olumlu ve yapıcı "
            "yönlendirmelerle gelir; günlük tutmak düşünceyi düzenlemeye yardımcı "
            "olur. Yazıların cihazında kalır."
        ),
    ),
    Module(
        key="notes", title="Fikir Defteri", icon="note", color="#F2994A",
        unit="kayıt", target=1, step=1, steps=(1,), coming_soon=True,
        category="Zihin", description="Önemli fikirlerini yakala",
        about=(
            "Aklına gelen önemli fikirleri, notları ve yapılacakları anında "
            "kaydet — sonra kaybolmasınlar. Fikirleri hemen yazmak unutma "
            "kaygısını azaltır ve zihnini boşaltır. Notların cihazında kalır."
        ),
    ),
    Module(
        key="kindness", title="Nazik Davranış", icon="hands", color="#EF7D7D",
        unit="davranış", target=1, step=1, steps=(1,), coming_soon=True,
        category="Zihin", description="Günde bir iyilik",
        about=(
            "Küçük bir iyilik yap ve işaretle — bir yardım, bir teşekkür, bir "
            "jest. İyilik yapmak, yapanın da iyi oluşunu küçük ama ölçülebilir "
            "biçimde artırır. Kime yaptığın fark etmez."
        ),
    ),
    Module(
        key="social", title="Sevdiğine Ulaş", icon="chat", color="#3FA7D6",
        unit="kişi", target=1, step=1, steps=(1,), coming_soon=True,
        category="Zihin", description="Anlamlı bir bağ kur",
        about=(
            "Her gün sevdiğin birine ulaş — ara, yaz ya da buluş. Güçlü sosyal "
            "bağlar, sağlıkla en tutarlı ilişkili alışkanlıklardan biridir. "
            "Yalnızca sayıyı tutar, kişi bilgisi saklamaz."
        ),
    ),
    Module(
        key="detox", title="Dijital Detoks", icon="phone-off", color="#6C7A89",
        unit="dk", target=60, step=15, steps=(15, 30, 60), coming_soon=True,
        category="Zihin", description="Ekransız zaman",
        about=(
            "Gün içinde telefonsuz geçirdiğin süreyi kaydet. Ekran süresini "
            "azaltmanın etkisi kişiden kişiye değişir; bunu katı bir kural değil, "
            "bilinçli bir mola olarak düşün."
        ),
    ),

    # Sağlık
    Module(
        key="medication", title="İlaç & Vitamin", icon="pill", color="#E5544B",
        unit="doz", target=1, step=1, steps=(1,), coming_soon=True,
        category="Sağlık", description="Doz takibi",
        about=(
            "Aldığın ilaç veya vitamin dozlarını işaretle. Düzenli hatırlatma "
            "uyumu artırmaya yardımcı olabilir. Bu bir sağlık kaydıdır; verini "
            "kendine sakla ve doktorunun önerisini esas al."
        ),
    ),
    Module(
        key="sunlight", title="Güneş & Dışarı", icon="sun", color="#FDB813",
        unit="dk", target=120, step=15, steps=(15, 30, 60), coming_soon=True,
        category="Sağlık", description="Dışarıda geçen zaman",
        about=(
            "Gün ışığında dışarıda geçirdiğin süreyi kaydet. Dışarı zamanı ruh "
            "hâliyle olumlu ilişkilidir ve çocuklarda miyopiyi geciktirmeye "
            "yardımcı olur. Kışın güneş zayıfken D vitamini üretiminin düştüğünü "
            "unutma."
        ),
    ),
    Module(
        key="coldshower", title="Soğuk Duş", icon="snowflake", color="#56B4E9",
        unit="duş", target=1, step=1, steps=(1,), coming_soon=True,
        category="Sağlık", description="Soğuk duş serisi",
        about=(
            "Soğuk duş alışkanlığını takip et. Kanıt henüz sınırlı ve faydalar "
            "çoğunlukla kısa süreli; keyif alıyorsan hoş bir rutin, ama abartılı "
            "sağlık iddialarına dayanma."
        ),
    ),
    Module(
        key="eyebreak", title="Göz Molası", icon="eye", color="#7B9EA8",
        unit="mola", target=8, step=1, steps=(1,), coming_soon=True,
        category="Sağlık", description="20-20-20 göz molası",
        about=(
            "Ekran başında her 20 dakikada bir 20 saniye uzağa bakma molası ver. "
            "Optometri dernekleri bunu önerir; göz konforuna yardımcı olabilir, "
            "basit ve zararsız bir alışkanlık."
        ),
    ),

    # Hareket
    Module(
        key="posture", title="Duruş", icon="posture", color="#5AA9A3",
        unit="mola", target=3, step=1, steps=(1,), coming_soon=True,
        category="Hareket", description="Duruş molaları",
        about=(
            "Gün içinde birkaç kez duruşunu düzelt ve kısa bir mola ver. Uzun süre "
            "aynı pozisyonda kalmak boyun ve sırt rahatsızlığı yapabilir; düzenli "
            "molalar bunu azaltmaya yardımcı olur."
        ),
    ),
    Module(
        key="stretch", title="Esneme", icon="stretch", color="#6FCF97",
        unit="dk", target=10, step=5, steps=(5, 10), coming_soon=True,
        category="Hareket", description="Günlük esneme",
        about=(
            "Kısa bir esneme seansı yap. Düzenli germe, özellikle masa başı "
            "çalışanlarda kas-iskelet rahatsızlığını azaltmaya yardımcı olur; "
            "süreklilik anahtardır."
        ),
    ),

    # Öğrenme
    Module(
        key="focus", title="Odak / Pomodoro", icon="timer", color="#EB5757",
        unit="seans", target=4, step=1, steps=(1,), coming_soon=True,
        category="Öğrenme", description="Derin çalışma seansları",
        about=(
            "25 dakikalık odak + kısa mola döngüleriyle çalış. Molalar enerjiyi ve "
            "odağı toparlamaya yardımcı olur; tamamladığın seans sayısını takip et."
        ),
    ),
    Module(
        key="coding", title="Kod Pratiği", icon="code", color="#667EEA",
        unit="dk", target=30, step=10, steps=(10, 20, 30), coming_soon=True,
        category="Öğrenme", description="Günlük kod çalışması",
        about=(
            "Her gün kod yazmaya ayırdığın süreyi kaydet. Kısa ve düzenli pratik, "
            "uzun ama seyrek çalışmadan daha kalıcıdır."
        ),
    ),
    Module(
        key="music", title="Müzik Pratiği", icon="music", color="#C86FC9",
        unit="dk", target=20, step=5, steps=(5, 15, 30), coming_soon=True,
        category="Öğrenme", description="Enstrüman çalışması",
        about=(
            "Enstrüman veya müzik pratiğine ayırdığın süreyi kaydet. Düzenli, kısa "
            "çalışmalar beceriyi zamanla biriktirir."
        ),
    ),
    Module(
        key="vocab", title="Yeni Kelime", icon="abc", color="#59B48A",
        unit="kelime", target=10, step=5, steps=(5, 10), coming_soon=True,
        category="Öğrenme", description="Günlük yeni kelime",
        about=(
            "Her gün öğrendiğin yeni kelime sayısını kaydet. İngilizce modülünü "
            "tamamlar; düzenli kelime tekrarı kalıcılığı artırır."
        ),
    ),

    # Finans
    Module(
        key="expense", title="Harcama Takibi", icon="wallet", color="#E0A458",
        unit="kayıt", target=1, step=1, steps=(1,), coming_soon=True,
        category="Finans", description="Günlük harcama kaydı",
        about=(
            "Gün içindeki harcamalarını kaydetme alışkanlığı edin. Harcamanın "
            "farkında olmak bütçe kontrolünün ilk adımıdır. Finansal verilerin "
            "hassastır; kendine sakla."
        ),
    ),
    Module(
        key="savings", title="Tasarruf Hedefi", icon="piggy", color="#58C08E",
        unit="kayıt", target=1, step=1, steps=(1,), coming_soon=True,
        category="Finans", description="Tasarruf alışkanlığı",
        about=(
            "Kenara koyduğun tutarı işaretle ve hedefe ilerle. Küçük ama düzenli "
            "tasarruf zamanla birikir. Finansal verilerin cihazında kalır."
        ),
    ),
    Module(
        key="budget", title="Bütçe", icon="coins", color="#7C9EF2",
        unit="gün", target=1, step=1, steps=(1,), coming_soon=True,
        category="Finans", description="Bütçeye sadık kal",
        about=(
            "Belirlediğin günlük/aylık bütçenin içinde kaldığın günleri işaretle. "
            "Bütçe takibi, harcama alışkanlıklarını görünür kılar. Verilerin "
            "hassastır; kendine sakla."
        ),
    ),
)

MODULES_BY_KEY: dict[str, Module] = {m.key: m for m in MODULES}

# Yeni kullanıcı bu modüllerle başlar. Diğerleri mağazadan kurulabilir.
# "Yakında" modülleri kurulamaz, bu yüzden varsayılan kuruluma da girmez.
DEFAULT_INSTALLED: tuple[str, ...] = tuple(m.key for m in MODULES if not m.coming_soon)


def module_list() -> list[dict]:
    return [asdict(m) for m in MODULES]


def is_valid(key: str) -> bool:
    return key in MODULES_BY_KEY

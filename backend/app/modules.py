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
        category="Sağlık", description="Öğün kaydı",
        about=(
            "Günde kaç öğün yediğini işaretle. Düzenli beslenme alışkanlığını "
            "oturtmak için basit bir sayaç — ne yediğini değil, ritmini takip eder."
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
        category="Öğrenme", description="Kitap okuma süresi",
        about=(
            "Kitap okumaya ayırdığın süreyi kaydet. Günde birkaç dakika bile "
            "düzenli olduğunda birikir; bu modül o birikimi görünür kılar."
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
)

MODULES_BY_KEY: dict[str, Module] = {m.key: m for m in MODULES}

# Yeni kullanıcı bu modüllerle başlar. Diğerleri mağazadan kurulabilir.
DEFAULT_INSTALLED: tuple[str, ...] = tuple(m.key for m in MODULES)


def module_list() -> list[dict]:
    return [asdict(m) for m in MODULES]


def is_valid(key: str) -> bool:
    return key in MODULES_BY_KEY

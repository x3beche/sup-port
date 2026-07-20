"""The superapp's module registry.

Adding a new mini-app to sup-port means adding one entry here — the API, the
daily score and the home grid all read from this list.
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
    description: str
    # Modülün ölçeğine uygun artış kademeleri. 8000 adımı 500'er 500'er girmek
    # 16 dokunuş demekti; büyük ölçekli modüller büyük kademe istiyor.
    steps: tuple[float, ...] = ()

    def step_options(self) -> tuple[float, ...]:
        return self.steps or (self.step,)


MODULES: tuple[Module, ...] = (
    Module("water", "Su", "droplet", "#2AA9E0", "bardak", 8, 1, "Günlük su takibi", (1, 2, 4)),
    Module("meal", "Beslenme", "meal", "#43B77A", "öğün", 3, 1, "Öğün kaydı", (1,)),
    Module("brush", "Diş Fırçalama", "brush", "#22C3C3", "kez", 2, 1, "Sabah ve akşam rutini", (1,)),
    Module("english", "İngilizce", "language", "#9B86FF", "dk", 20, 5, "Kelime ve tekrar çalışması", (5, 15, 30)),
    Module("steps", "Adım", "steps", "#F5A623", "adım", 8000, 500, "Günlük hareket", (500, 1000, 2500)),
    Module("sleep", "Uyku", "moon", "#7C8CF0", "saat", 8, 0.5, "Uyku süresi", (0.5, 1)),
    Module("reading", "Okuma", "book", "#EE8570", "dk", 30, 10, "Kitap okuma süresi", (5, 15, 30)),
    Module("meditation", "Meditasyon", "lotus", "#E06BA9", "dk", 10, 5, "Zihin dinginliği", (5, 10, 20)),
)

MODULES_BY_KEY: dict[str, Module] = {m.key: m for m in MODULES}


def module_list() -> list[dict]:
    return [asdict(m) for m in MODULES]


def is_valid(key: str) -> bool:
    return key in MODULES_BY_KEY

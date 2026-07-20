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
    step: float
    description: str


MODULES: tuple[Module, ...] = (
    Module("water", "Su", "droplet", "#2AA9E0", "bardak", 8, 1, "Günlük su takibi"),
    Module("meal", "Beslenme", "meal", "#43B77A", "öğün", 3, 1, "Öğün kaydı"),
    Module("brush", "Diş Fırçalama", "brush", "#22C3C3", "kez", 2, 1, "Sabah ve akşam rutini"),
    Module("english", "İngilizce", "language", "#7B61FF", "dk", 20, 5, "Kelime ve tekrar çalışması"),
    Module("steps", "Adım", "steps", "#F5A623", "adım", 8000, 500, "Günlük hareket"),
    Module("sleep", "Uyku", "moon", "#4A5BD4", "saat", 8, 0.5, "Uyku süresi"),
    Module("reading", "Okuma", "book", "#E2725B", "dk", 30, 10, "Kitap okuma süresi"),
    Module("meditation", "Meditasyon", "lotus", "#D4569B", "dk", 10, 5, "Zihin dinginliği"),
)

MODULES_BY_KEY: dict[str, Module] = {m.key: m for m in MODULES}


def module_list() -> list[dict]:
    return [asdict(m) for m in MODULES]


def is_valid(key: str) -> bool:
    return key in MODULES_BY_KEY

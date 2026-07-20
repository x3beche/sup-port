"""The superapp's module registry.

Adding a new mini-app to sup-port means adding one entry here — the API, the
daily score and the home grid all read from this list.
"""

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Module:
    key: str
    title: str
    icon: str  # emoji, so the grid needs no icon font on any platform
    color: str
    unit: str
    target: float
    step: float
    description: str


MODULES: tuple[Module, ...] = (
    Module("water", "Su", "💧", "#2AA9E0", "bardak", 8, 1, "Günlük su takibi"),
    Module("meal", "Beslenme", "🥗", "#43B77A", "öğün", 3, 1, "Öğün kaydı"),
    Module("brush", "Diş Fırçalama", "🪥", "#22C3C3", "kez", 2, 1, "Sabah ve akşam rutini"),
    Module("english", "İngilizce", "📚", "#7B61FF", "dk", 20, 5, "Kelime ve tekrar çalışması"),
    Module("steps", "Adım", "👟", "#F5A623", "adım", 8000, 500, "Günlük hareket"),
    Module("sleep", "Uyku", "😴", "#4A5BD4", "saat", 8, 0.5, "Uyku süresi"),
    Module("reading", "Okuma", "📖", "#E2725B", "dk", 30, 10, "Kitap okuma süresi"),
    Module("meditation", "Meditasyon", "🧘", "#D4569B", "dk", 10, 5, "Zihin dinginliği"),
)

MODULES_BY_KEY: dict[str, Module] = {m.key: m for m in MODULES}


def module_list() -> list[dict]:
    return [asdict(m) for m in MODULES]


def is_valid(key: str) -> bool:
    return key in MODULES_BY_KEY

"""Kullanıcıya özel modül hedefleri.

Hedefler kullanıcı belgesinde `targets` alanında saklanır: oturum doğrulaması
zaten o belgeyi okuduğu için hedefleri okumak ek sorgu maliyeti getirmez.
"""

from .modules import DEFAULT_INSTALLED, Module


def custom_targets(user: dict) -> dict[str, float]:
    raw = user.get("targets")
    if not isinstance(raw, dict):
        return {}
    return {
        key: float(value)
        for key, value in raw.items()
        # Stored values are validated on write, but a stale or hand-edited
        # document must never divide the completion ratio by zero.
        if isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0
    }


def effective_target(user: dict, module: Module) -> float:
    return custom_targets(user).get(module.key, module.target)


def favorite_step(user: dict, module: Module) -> float:
    """Kullanıcının o modülde en çok dokunduğu kademe; hiç yoksa varsayılan."""
    usage = (user.get("step_usage") or {}).get(module.key)
    options = module.step_options()
    if not isinstance(usage, dict) or not usage:
        return module.step

    def score(option: float) -> int:
        raw = usage.get(_usage_key(option))
        return raw if isinstance(raw, int) else 0

    best = max(options, key=score)
    return best if score(best) > 0 else module.step


def _usage_key(step: float) -> str:
    """Kademeyi Mongo alan adına çevirir.

    Her zaman float üzerinden üretilir: kayıt sırasında 2500.0, okuma sırasında
    2500 gelirse iki farklı anahtar oluşur ve sayaç hiç eşleşmez.
    Mongo alan adları nokta içeremediği için ayraç alt çizgidir: 0.5 -> "0_5".
    """
    return str(float(step)).replace(".", "_")


def usage_field(module_key: str, step: float) -> str:
    return f"step_usage.{module_key}.{_usage_key(step)}"


def ordered_modules(user: dict, modules: tuple[Module, ...]) -> list[Module]:
    """Kurulu modüller, kullanıcının sıralamasında.

    Yalnızca kurulu modüller döner: kaldırılan bir modül ana ekrandan ve
    puandan çıkar. Sıralamada olmayan kurulu modüller (ör. yeni kurulan) sona
    eklenir; bilinmeyen anahtarlar yok sayılır.
    """
    installed = installed_modules(user, modules)
    saved = user.get("module_order")
    if not isinstance(saved, list):
        return installed

    by_key = {m.key: m for m in installed}
    seen: set[str] = set()
    result: list[Module] = []
    for key in saved:
        module = by_key.get(key) if isinstance(key, str) else None
        if module is not None and module.key not in seen:
            seen.add(module.key)
            result.append(module)

    result.extend(m for m in installed if m.key not in seen)
    return result


def installed_keys(user: dict) -> list[str]:
    """Kullanıcının kurduğu modüller; kayıt yoksa varsayılan set.

    Alan hiç yoksa (eski kullanıcı) varsayılan olarak hepsi kurulu sayılır,
    böylece mağaza eklenince kimsenin ızgarası boşalmaz.
    """
    saved = user.get("installed_modules")
    if not isinstance(saved, list):
        return list(DEFAULT_INSTALLED)
    valid = {m for m in saved if isinstance(m, str)}
    # Kayıt sırasını değil, modül kayıt sırasını koru; sıralama /order işi.
    return [key for key in DEFAULT_INSTALLED if key in valid]


def installed_modules(user: dict, modules: tuple[Module, ...]) -> list[Module]:
    keys = set(installed_keys(user))
    return [m for m in modules if m.key in keys]

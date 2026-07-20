"""Kullanıcıya özel modül hedefleri.

Hedefler kullanıcı belgesinde `targets` alanında saklanır: oturum doğrulaması
zaten o belgeyi okuduğu için hedefleri okumak ek sorgu maliyeti getirmez.
"""

from .modules import Module


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

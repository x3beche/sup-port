"""OpenRouter tabanlı LLM yardımcıları (pydantic-ai, structured çıktı).

Tasarım ilkesi: LLM bir **iyileştirme**dir, zorunluluk değil. Anahtar yoksa,
pydantic-ai kurulu değilse ya da çağrı hata verirse fonksiyonlar ``None`` döner
ve çağıran taraf kural-temelli (deterministik) çıktıya düşer. Böylece backend
her koşulda açılır ve öneri uçları çalışmaya devam eder.

Ucuz model kullanılır (girdi+çıktı 1M token'da < 0.50 USD). Model/anahtar
config.py'den (OPENROUTER_*) gelir.
"""

import logging

from .config import settings

logger = logging.getLogger("sup-port.llm")

# İlk çağrıda kurulur, sonra tekrar kullanılır. None: kurulamadı (kütüphane/anahtar yok).
_agent_cache: dict[str, object] = {}
_agent_failed = False


def llm_available() -> bool:
    return bool(settings.openrouter_api_key)


def _build_agent():
    """pydantic-ai Agent'ı tembel kurar. Sürüm farklarına dayanıklı; hata → None."""
    global _agent_failed
    if _agent_failed or not llm_available():
        return None
    if "spor" in _agent_cache:
        return _agent_cache["spor"]

    try:
        from pydantic import BaseModel, Field
        from pydantic_ai import Agent

        # Model/sağlayıcı adları pydantic-ai sürümleri arasında değişebiliyor;
        # birkaç yolu sırayla dene.
        model = _make_model()
        if model is None:
            _agent_failed = True
            return None

        class SporSummary(BaseModel):
            summary: str = Field(description="2-3 cümlelik, sıcak ve motive edici Türkçe özet")
            motivation: str = Field(description="Tek cümlelik kısa motivasyon")

        agent = Agent(
            model,
            output_type=SporSummary,
            system_prompt=(
                "Sen destekleyici bir egzersiz koçusun. Türkçe, kısa ve nazik yaz. "
                "Verilen kural-temelli öneriyi doğal dile çevir; YENİ tıbbi iddia "
                "ekleme, teşhis/reçete verme. Fazla kilolu kullanıcıya karşı "
                "yargılayıcı olma; küçük, ulaşılabilir adımlara odaklan. Genel "
                "bilgi olduğunu ima et."
            ),
        )
        _agent_cache["spor"] = agent
        return agent
    except Exception as err:  # kütüphane yok / API farkı / vs.
        logger.info("LLM agent kurulamadı, kural-temeline düşülüyor: %s", err)
        _agent_failed = True
        return None


def _make_model():
    """OpenRouter modelini kur — pydantic-ai sürüm farklarına dayanıklı.

    Sınıf adları sürümler arasında değişti (OpenAIModel → OpenAIChatModel, ayrıca
    adanmış OpenRouterModel eklendi). Bilinen yolları sırayla dener.
    """
    key = settings.openrouter_api_key
    name = settings.openrouter_model
    base = settings.openrouter_base_url

    # 1) Adanmış OpenRouter modeli + sağlayıcısı (yeni sürümler).
    try:
        from pydantic_ai.models.openrouter import OpenRouterModel
        from pydantic_ai.providers.openrouter import OpenRouterProvider

        return OpenRouterModel(name, provider=OpenRouterProvider(api_key=key))
    except Exception:
        pass

    # 2) OpenRouter sağlayıcısı + OpenAI (chat) modeli.
    try:
        from pydantic_ai.providers.openrouter import OpenRouterProvider

        provider = OpenRouterProvider(api_key=key)
        try:
            from pydantic_ai.models.openai import OpenAIChatModel

            return OpenAIChatModel(name, provider=provider)
        except Exception:
            from pydantic_ai.models.openai import OpenAIModel  # eski ad

            return OpenAIModel(name, provider=provider)
    except Exception:
        pass

    # 3) Genel OpenAI uyumlu sağlayıcı + base_url (OpenRouter OpenAI uyumludur).
    try:
        from pydantic_ai.providers.openai import OpenAIProvider

        provider = OpenAIProvider(base_url=base, api_key=key)
        try:
            from pydantic_ai.models.openai import OpenAIChatModel

            return OpenAIChatModel(name, provider=provider)
        except Exception:
            from pydantic_ai.models.openai import OpenAIModel

            return OpenAIModel(name, provider=provider)
    except Exception as err:
        logger.info("OpenRouter modeli kurulamadı: %s", err)
        return None


def _prompt(base: dict, profile: dict | None, latest: dict | None) -> str:
    profile = profile or {}
    parts = [
        "Kural-temelli öneriyi kullanıcı için sıcak bir dille özetle.",
        f"BMI kategorisi: {base.get('bmi_label') or 'bilinmiyor'}.",
        f"Odak alanları: {', '.join(base.get('focus', [])) or 'genel'}.",
        f"Hedef: {profile.get('goal') or 'belirtilmedi'}.",
        f"Haftalık hedef: {base.get('weekly_minutes_target')} dk + "
        f"{base.get('weekly_strength_days')} gün kuvvet.",
    ]
    if base.get("avoid_high_impact"):
        parts.append("Yüksek etkili (zıplama/koşu) hareketlerden kaçınılmalı.")
    if base.get("notes"):
        parts.append("Notlar: " + " ".join(base["notes"]))
    return " ".join(parts)


async def spor_recommendation_llm(base: dict, profile: dict | None, latest: dict | None) -> str | None:
    """Kural-temelli öneriyi doğal dile çevirir. Başarısızsa None (fallback)."""
    agent = _build_agent()
    if agent is None:
        return None
    try:
        result = await agent.run(_prompt(base, profile, latest))
        out = result.output
        summary = getattr(out, "summary", "") or ""
        motivation = getattr(out, "motivation", "") or ""
        text = summary if not motivation else f"{summary} {motivation}"
        return text.strip() or None
    except Exception as err:
        logger.info("LLM öneri çağrısı başarısız, kural-temeli kullanılıyor: %s", err)
        return None

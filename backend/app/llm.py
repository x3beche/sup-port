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


# ----------------------------------------------------------- yemek: foto-tahmin
_YEMEK_SYSTEM = (
    "Sen bir beslenme asistanısın. Sana bir ÖĞÜN fotoğrafı verilir; içindeki "
    "yiyecekleri tanı ve HER biri için tahmini gram porsiyonu ile kalori/makro "
    "ver. Türkçe yaz. Kesin konuşma: bu bir TAHMİNDİR, porsiyon hatası büyüktür. "
    "Emin olmadığında confidence'ı düşük tut (0–1). Toplam kaloriyi öğelerin "
    "toplamına yakın ver. Fotoğrafta yemek yoksa boş liste döndür. Tıbbi/diyet "
    "iddiası ekleme."
)


def _build_yemek_agent():
    """Foto-tahmin için pydantic-ai Agent (structured). Kurulamazsa None."""
    global _agent_failed
    if _agent_failed or not llm_available():
        return None
    if "yemek" in _agent_cache:
        return _agent_cache["yemek"]
    try:
        from pydantic import BaseModel, Field

        model = _make_model()
        if model is None:
            _agent_failed = True
            return None

        class EstItem(BaseModel):
            name: str = Field(description="Yiyeceğin Türkçe adı")
            qty_g: float = Field(description="Tahmini porsiyon (gram)")
            kcal: float = Field(description="Bu porsiyonun tahmini kalorisi")
            protein_g: float = 0
            carb_g: float = 0
            fat_g: float = 0
            confidence: float = Field(description="Bu öğe için güven 0–1")

        class MealEstimate(BaseModel):
            items: list[EstItem]
            total_kcal: float
            confidence: float = Field(description="Toplam tahmin için genel güven 0–1")

        from pydantic_ai import Agent

        agent = Agent(model, output_type=MealEstimate, system_prompt=_YEMEK_SYSTEM)
        _agent_cache["yemek"] = agent
        return agent
    except Exception as err:
        logger.info("Foto-tahmin agent'ı kurulamadı: %s", err)
        _agent_failed = True
        return None


async def nutrition_estimate_llm(
    image_bytes: bytes, media_type: str, note: str | None = None
) -> dict | None:
    """Öğün fotoğrafından kalori/makro tahmini. LLM yoksa/başarısızsa None.

    Fotoğraf yalnızca çağrı sırasında sağlayıcıya gider; burada SAKLANMAZ.
    """
    agent = _build_yemek_agent()
    if agent is None:
        return None
    try:
        from pydantic_ai import BinaryContent

        prompt: list = ["Bu öğün fotoğrafındaki yiyecekleri ve tahmini kalorileri çıkar."]
        if note:
            prompt.append(f"Kullanıcı notu: {note}")
        prompt.append(BinaryContent(data=image_bytes, media_type=media_type))

        result = await agent.run(prompt)
        out = result.output
        items = [
            {
                "name": it.name,
                "qty_g": round(float(it.qty_g), 1),
                "kcal": round(float(it.kcal), 1),
                "protein_g": round(float(it.protein_g), 1),
                "carb_g": round(float(it.carb_g), 1),
                "fat_g": round(float(it.fat_g), 1),
                "confidence": max(0.0, min(1.0, float(it.confidence))),
            }
            for it in out.items
        ]
        return {
            "items": items,
            "total_kcal": round(float(out.total_kcal), 1),
            "confidence": max(0.0, min(1.0, float(out.confidence))),
        }
    except Exception as err:
        logger.info("Foto-tahmin çağrısı başarısız: %s", err)
        return None


def _build_reading_agent():
    """Okuma koçu ajanı — tembel kurulur, önbelleklenir. Hata → None (fallback)."""
    global _agent_failed
    if _agent_failed or not llm_available():
        return None
    if "okuma" in _agent_cache:
        return _agent_cache["okuma"]

    try:
        from pydantic import BaseModel, Field
        from pydantic_ai import Agent

        model = _make_model()
        if model is None:
            _agent_failed = True
            return None

        class ReadingSummary(BaseModel):
            summary: str = Field(description="2-3 cümlelik, sıcak ve motive edici Türkçe özet")
            motivation: str = Field(description="Tek cümlelik kısa motivasyon")

        agent = Agent(
            model,
            output_type=ReadingSummary,
            system_prompt=(
                "Sen destekleyici bir okuma koçusun. Türkçe, kısa ve nazik yaz. "
                "Verilen kural-temelli içgörüyü doğal dile çevir; suçlayıcı olma, "
                "hedefe ulaşamayan kullanıcıyı yargılama. Aşırı oyunlaştırma ve "
                "baskı yerine ilerlemeyi ve istikrarı öv; hedefi zorlayıcı bulan "
                "birine hedefi düşürmenin de sağlıklı olduğunu ima et. Yeni sayı/"
                "iddia UYDURMA, verilen verilere sadık kal."
            ),
        )
        _agent_cache["okuma"] = agent
        return agent
    except Exception as err:
        logger.info("Okuma LLM ajanı kurulamadı, kural-temeline düşülüyor: %s", err)
        _agent_failed = True
        return None


def _reading_prompt(base: dict, stats_data: dict) -> str:
    parts = [
        "Kural-temelli okuma içgörüsünü kullanıcı için sıcak bir dille özetle.",
        f"Durum: {base.get('headline', '')}",
        f"Yıllık hedef: {base.get('target_books')} kitap, tamamlanan: {base.get('completed_books')}.",
        f"Toplam okunan süre: {stats_data.get('total_minutes', 0)} dk, "
        f"bitirilen kitap: {stats_data.get('finished_count', 0)}.",
        f"Okuma serisi: {stats_data.get('streak', 0)} gün.",
    ]
    if base.get("notes"):
        parts.append("Notlar: " + " ".join(base["notes"]))
    return " ".join(parts)


async def okuma_insight_llm(base: dict, stats_data: dict) -> str | None:
    """Okuma içgörüsünü doğal dile çevirir. Başarısızsa None (fallback)."""
    agent = _build_reading_agent()
    if agent is None:
        return None
    try:
        result = await agent.run(_reading_prompt(base, stats_data))
        out = result.output
        summary = getattr(out, "summary", "") or ""
        motivation = getattr(out, "motivation", "") or ""
        text = summary if not motivation else f"{summary} {motivation}"
        return text.strip() or None
    except Exception as err:
        logger.info("Okuma LLM çağrısı başarısız, kural-temeli kullanılıyor: %s", err)
        return None

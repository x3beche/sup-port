"""Kitap metadata proxy — Google Books (birincil) + Open Library (yedek/kapak).

Gizlilik: istemci ASLA üçüncü tarafa doğrudan sormaz; kullanıcının okuma
alışkanlığı (kişisel veri) kendi IP'siyle Google/Open Library'ye sızmasın diye
tüm çağrılar backend'den, User-Agent + iletişim e-postasıyla yapılır. Open
Library bu başlığı görünce rate-limit'i 1→3 istek/sn'ye çıkarır.

Telif (en yüksek risk): kapak GÖRSELİNİN bit'leri asla saklanmaz/kopyalanmaz;
yalnızca ``covers.openlibrary.org`` URL'i tutulur ve istemcide <Image> src olarak
gösterilir — Open Library'nin açıkça izin verdiği kullanım. Metadata (başlık,
yazar, ISBN, sayfa) olgusal/CC0 mantığındadır ve önbelleğe alınabilir.

Sağlam degradasyon: ağ hatası / boş sonuç → None döner; çağıran uç 404 verir ve
istemci manuel girişe düşer (araştırma: manuel giriş fallback'i ZORUNLU).

Kaynaklar: docs/features/okuma/research.md
"""

import logging
import re

import httpx

from .config import settings

logger = logging.getLogger("sup-port.books")

_GOOGLE_VOLUMES = "https://www.googleapis.com/books/v1/volumes"
_OPENLIB_BOOKS = "https://openlibrary.org/api/books"
_OPENLIB_SEARCH = "https://openlibrary.org/search.json"
_COVER_BASE = "https://covers.openlibrary.org/b/isbn"

# Open Library'nin nezaket linki; branding gereği kapak gösteren yüzeyde kaynağa
# atıf verilir (istemci meta'dan alır).
COVER_ATTRIBUTION = "Kapak görselleri Open Library’den"
COVER_ATTRIBUTION_URL = "https://openlibrary.org"

_TIMEOUT = httpx.Timeout(6.0, connect=4.0)
_USER_AGENT = f"sup-port/1.0 (+{settings.contact_email})"
_HEADERS = {"User-Agent": _USER_AGENT, "Accept": "application/json"}


# ------------------------------------------------------------------ ISBN / EAN
def clean_isbn(raw: str | None) -> str:
    """Boşluk/tire vb. ayıklar; ISBN-10'daki sondaki X korunur."""
    if not raw:
        return ""
    return re.sub(r"[^0-9Xx]", "", raw).upper()


def _ean13_checksum_ok(code: str) -> bool:
    """EAN-13/ISBN-13 mod-10: soldan 1×,3× ağırlık, toplam 10'un katı olmalı."""
    if len(code) != 13 or not code.isdigit():
        return False
    total = sum((1 if i % 2 == 0 else 3) * int(d) for i, d in enumerate(code))
    return total % 10 == 0


def is_book_isbn13(code: str) -> bool:
    """Geçerli bir kitap ISBN-13'ü mü? 978/979 öneki + checksum.

    Kitap dışı ürünlerin (978/979 dışı önek) barkodu reddedilir; 979 önekinin
    ISBN-10 karşılığı yoktur, her zaman 13 haneyle sorgulanır.
    """
    return code[:3] in ("978", "979") and _ean13_checksum_ok(code)


def cover_url(isbn13: str, size: str = "L") -> str:
    # ?default=false → kapak yoksa varsayılan boş resim yerine 404 döner; istemci
    # bunu placeholder mantığında kullanır.
    return f"{_COVER_BASE}/{isbn13}-{size}.jpg?default=false"


def _year(value) -> int | None:
    if not value:
        return None
    m = re.search(r"\d{4}", str(value))
    return int(m.group()) if m else None


# ----------------------------------------------------------------- normalize
def _book_key(isbn13: str | None) -> str | None:
    return f"book_{isbn13}" if isbn13 else None


def _from_google(volume: dict) -> dict | None:
    info = volume.get("volumeInfo") or {}
    title = info.get("title")
    if not title:
        return None

    isbn13 = isbn10 = None
    for ident in info.get("industryIdentifiers", []) or []:
        if ident.get("type") == "ISBN_13":
            isbn13 = clean_isbn(ident.get("identifier"))
        elif ident.get("type") == "ISBN_10":
            isbn10 = clean_isbn(ident.get("identifier"))

    return {
        "key": _book_key(isbn13),
        "isbn13": isbn13,
        "isbn10": isbn10,
        "title": title,
        "subtitle": info.get("subtitle"),
        "authors": [a for a in (info.get("authors") or []) if a],
        # Kapağı DAİMA Open Library'den ver (gösterim izinli, http değil); Google
        # thumbnail'i ToS-yüklü ve http olduğu için kullanılmaz.
        "cover_url": cover_url(isbn13) if isbn13 else None,
        "cover_source": "openlibrary" if isbn13 else None,
        "page_count": info.get("pageCount"),
        "published_year": _year(info.get("publishedDate")),
        "publisher": info.get("publisher"),
        "subjects": [c for c in (info.get("categories") or []) if c][:6],
        "language": info.get("language"),
        "description": info.get("description"),
        "source": "google_books",
    }


def _from_openlibrary_data(isbn: str, data: dict) -> dict | None:
    title = data.get("title")
    if not title:
        return None

    ident = data.get("identifiers") or {}
    isbn13 = clean_isbn((ident.get("isbn_13") or [None])[0]) or (isbn if len(isbn) == 13 else None)
    isbn10 = clean_isbn((ident.get("isbn_10") or [None])[0]) or None

    return {
        "key": _book_key(isbn13),
        "isbn13": isbn13,
        "isbn10": isbn10,
        "title": title,
        "subtitle": data.get("subtitle"),
        "authors": [a.get("name") for a in (data.get("authors") or []) if a.get("name")],
        "cover_url": cover_url(isbn13) if isbn13 else None,
        "cover_source": "openlibrary" if isbn13 else None,
        "page_count": data.get("number_of_pages"),
        "published_year": _year(data.get("publish_date")),
        "publisher": (data.get("publishers") or [{}])[0].get("name"),
        "subjects": [s.get("name") for s in (data.get("subjects") or []) if s.get("name")][:6],
        "language": None,
        "description": None,
        "source": "openlibrary",
    }


def _from_openlibrary_doc(doc: dict) -> dict | None:
    title = doc.get("title")
    if not title:
        return None
    isbns = [clean_isbn(i) for i in (doc.get("isbn") or [])]
    isbn13 = next((i for i in isbns if len(i) == 13 and i[:3] in ("978", "979")), None)
    return {
        "key": _book_key(isbn13),
        "isbn13": isbn13,
        "isbn10": next((i for i in isbns if len(i) == 10), None),
        "title": title,
        "subtitle": None,
        "authors": [a for a in (doc.get("author_name") or []) if a][:3],
        "cover_url": cover_url(isbn13) if isbn13 else None,
        "cover_source": "openlibrary" if isbn13 else None,
        "page_count": None,
        "published_year": doc.get("first_publish_year"),
        "publisher": None,
        "subjects": [],
        "language": None,
        "description": None,
        "source": "openlibrary",
    }


# ------------------------------------------------------------------- fetching
async def _get_json(client: httpx.AsyncClient, url: str, params: dict) -> dict | list | None:
    try:
        resp = await client.get(url, params=params, headers=_HEADERS, timeout=_TIMEOUT)
        if resp.status_code != 200:
            return None
        return resp.json()
    except (httpx.HTTPError, ValueError) as err:
        logger.info("metadata isteği başarısız (%s): %s", url, err)
        return None


async def lookup_isbn(isbn13: str) -> dict | None:
    """ISBN-13 → tek kitap. Önce Google Books (TR), sonra Open Library.

    Çağıran taraf checksum'ı zaten doğrulamış olmalı (bkz. is_book_isbn13).
    """
    async with httpx.AsyncClient() as client:
        params = {"q": f"isbn:{isbn13}", "country": "TR"}
        if settings.google_books_api_key:
            params["key"] = settings.google_books_api_key
        google = await _get_json(client, _GOOGLE_VOLUMES, params)
        if isinstance(google, dict) and google.get("items"):
            book = _from_google(google["items"][0])
            if book:
                # Google'ın ISBN'i bazen eksik/farklı gelir; sorgulanan ISBN'i garanti et.
                book["isbn13"] = book.get("isbn13") or isbn13
                book["key"] = _book_key(book["isbn13"])
                book["cover_url"] = book["cover_url"] or cover_url(book["isbn13"])
                book["cover_source"] = "openlibrary"
                return book

        ol = await _get_json(
            client, _OPENLIB_BOOKS,
            {"bibkeys": f"ISBN:{isbn13}", "jscmd": "data", "format": "json"},
        )
        if isinstance(ol, dict):
            data = ol.get(f"ISBN:{isbn13}")
            if data:
                return _from_openlibrary_data(isbn13, data)
    return None


async def search_books(query: str, limit: int = 12) -> list[dict]:
    """Serbest metin araması. Google Books birincil, boşsa Open Library."""
    query = query.strip()
    if not query:
        return []
    async with httpx.AsyncClient() as client:
        params = {"q": query, "country": "TR", "maxResults": min(limit, 40)}
        if settings.google_books_api_key:
            params["key"] = settings.google_books_api_key
        google = await _get_json(client, _GOOGLE_VOLUMES, params)
        if isinstance(google, dict) and google.get("items"):
            books = [b for b in (_from_google(v) for v in google["items"]) if b]
            if books:
                return books[:limit]

        ol = await _get_json(
            client, _OPENLIB_SEARCH,
            {
                "q": query,
                "fields": "key,title,author_name,first_publish_year,cover_i,isbn",
                "limit": limit,
            },
        )
        if isinstance(ol, dict) and ol.get("docs"):
            return [b for b in (_from_openlibrary_doc(d) for d in ol["docs"]) if b][:limit]
    return []

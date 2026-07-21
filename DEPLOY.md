# Otomatik Deploy — Portainer + Git SHA takibi

Backend, `master`'a her push'ta Portainer üzerinden otomatik yeniden deploy olur
ve deploy'un gerçekten canlıya geçtiği **git SHA takibiyle** doğrulanır.

## Nasıl çalışır

1. `master`'a push (`backend/**`, `docker-compose.yml` veya deploy workflow'u
   değişmişse) → `.github/workflows/deploy.yml` tetiklenir.
2. Workflow Portainer'ın mevcut stack Env'ini çeker, zorunlu değişkenlerin
   (`MONGODB_URI`, `DB_NAME`, `JWT_SECRET`) durduğunu doğrular; eksikse
   **durur** (production'a bozuk Env basmamak için).
3. Stack Env'indeki `GIT_SHA`'yı yeni commit SHA'sıyla değiştirip Portainer'ın
   `git/redeploy` API'sini çağırır → Portainer `git pull` + `docker compose up`
   yapar, imajı yeniden derler.
4. Workflow backend'in herkese açık `/version` ucunu 30 sn'de bir yoklar;
   dönen `short_sha` push'lanan commit'e eşitlenene kadar bekler. Böylece
   "Portainer çağrıyı kabul etti" değil, **"canlı backend gerçekten yeni kodu
   çalıştırıyor"** doğrulanır.

`GIT_SHA` compose'da `backend` servisine ortam değişkeni olarak geçer; backend
`GET /version` ucundan `{ "sha": ..., "short_sha": ... }` döndürür (bkz.
`backend/app/main.py`).

## Bir kez ayarlanacaklar (GitHub repo)

**Settings > Secrets and variables > Actions > Variables:**

| Variable | Açıklama |
| --- | --- |
| `PORTAINER_HOST` | Portainer adresi, ör. `https://portainer.ornek.dev` |
| `PORTAINER_STACK_ID` | Bu backend'in stack numarası |
| `PORTAINER_ENDPOINT_ID` | Endpoint (environment) numarası |
| `VERSION_URL` | Backend'in herkese açık `/version` adresi (proxy üzerinden), ör. `https://api.ornek.dev/version` |
| `REPO_USERNAME` | GitHub kullanıcı adın (varsayılan `x3beche`) |

**Settings > Secrets and variables > Actions > Secrets:**

| Secret | Açıklama |
| --- | --- |
| `PORTAINER_TOKEN` | Portainer API anahtarı (X-API-Key) |
| `GH_PAT` | Repoyu çekmek için GitHub token (repo scope'lu) |

## Portainer stack ortam değişkenleri

Portainer'da stack'i Git kaynaklı oluştururken şu Env'leri gir (bunlar
container'a geçer, `config.yaml` container'a kopyalanmaz):

- `MONGODB_URI`, `DB_NAME`, `JWT_SECRET` — zorunlu
- `PORT` — opsiyonel (varsayılan 4000)

`GIT_SHA`'yı elle girmene gerek yok; deploy workflow her seferinde ayarlar.

## Ağ ve proxy

Backend **port yayınlamaz**; `main-network` (harici) üzerinden erişilir. Proxy
manager container'a adıyla ulaşır:

```
fastapi-backend-<DB_NAME>-app:4000
```

`VERSION_URL`, proxy'nin bu servise yönlendirdiği herkese açık adresin
`/version` yoludur (GitHub runner'ları iç docker ağına erişemez, bu yüzden
herkese açık URL şart).

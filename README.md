# gameKover

Сервис пополнения Steam-кошелька на Next.js + FastAPI + PostgreSQL + Redis + Celery.

## Git

Репозиторий инициализирован в корне проекта.

Проверка:

```powershell
git --version
git status
```

Если терминал не видит `git` сразу после установки, перезапустите терминал/IDE.

## Развертывание через Docker Compose

### 1) Подготовка переменных

Скопируйте пример и заполните значения:

```powershell
copy .env.example .env
```

Минимально проверьте:

- `JWT_SECRET_KEY`
- `GUEST_SESSION_TTL_MINUTES` / `GUEST_CLEANUP_INTERVAL_MINUTES` (временные guest-сессии)
- `WATA_*` и/или `YOOKASSA_*`
- `WATA_DG_*` (Steam top-up API)
- `FAZERCARDS_*` (PUBG Mobile gifts/top-up)
- `PLAYWALLET_*` (legacy, отключено)
- `SMTP_*` (если нужны письма)

Для PUBG цен через FazerCards:
- бэкенд обновляет пакеты каждые 5 минут;
- использует `real_price` из API;
- считает цену в RUB как `ceil(real_price * FAZERCARDS_RUB_RATE * 1.2)`.

### 2) Сборка и запуск

```powershell
docker compose up -d --build
```

После запуска доступны:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

### 3) Логи и остановка

```powershell
docker compose logs -f
docker compose down
```

## Примечание

`backend` сервис в compose запускает миграции Alembic автоматически перед стартом API:

- `alembic upgrade head`
- `uvicorn main:app --host 0.0.0.0 --port 8000`

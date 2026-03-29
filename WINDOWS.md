# Запуск на Windows

## Что нужно установить

1. **Node.js** (для фронтенда)  
   https://nodejs.org — выберите LTS. После установки перезапустите PowerShell/CMD.

2. **Python 3.11+** (для бэкенда)  
   https://www.python.org/downloads/ — при установке отметьте «Add Python to PATH».

3. **PostgreSQL и Redis** (для полной работы бэкенда):
   - либо **Docker Desktop для Windows** — тогда БД и Redis поднимутся через Docker;
   - либо установите PostgreSQL и Redis вручную и укажите их в `.env`.

---

## Быстрый старт (только фронтенд)

Если нужно просто открыть интерфейс (без создания заказов и оплаты):

```powershell
cd C:\Users\iMall\Desktop\project
npm install
npm run dev
```

Откройте в браузере: **http://localhost:3000**

---

## Полный запуск (фронт + бэкенд)

### Вариант A: через скрипт

В PowerShell в папке проекта:

```powershell
# Запустить всё (бэкенд в отдельном окне, фронт в текущем)
.\run-windows.ps1 -All
```

Если скрипт не запускается, выполните один раз:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Вариант B: вручную в двух терминалах

**Терминал 1 — бэкенд:**

```powershell
cd C:\Users\iMall\Desktop\project\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

**Терминал 2 — фронтенд:**

```powershell
cd C:\Users\iMall\Desktop\project
npm install
npm run dev
```

- Фронтенд: **http://localhost:3000**  
- Бэкенд (API/docs): **http://localhost:8000** и **http://localhost:8000/docs**

---

## Если есть Docker Desktop

Поднять только БД и Redis:

```powershell
cd C:\Users\iMall\Desktop\project
docker compose up -d postgres redis
```

Дальше запускайте бэкенд и фронт как в «Полный запуск» выше. В корне проекта создайте файл `.env` по образцу `.env.example` (укажите `DATABASE_URL` и `REDIS_URL` при необходимости).

---

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| `npm не найден` | Установите Node.js и перезапустите терминал. |
| `python не найден` | Установите Python и отметьте «Add to PATH» при установке. |
| Ошибки бэкенда про БД | Запустите PostgreSQL (или `docker compose up -d postgres redis`) и проверьте `DATABASE_URL` в `.env`. |
| Фронт не видит API | В `.env` или `.env.local` задайте `NEXT_PUBLIC_API_URL=http://localhost:8000`. |

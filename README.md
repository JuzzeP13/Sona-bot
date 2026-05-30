# Sofa CRM

Новая CRM-система для заявок на подбор диванов. Проект создан с нуля и состоит из отдельного frontend, backend, PostgreSQL и nginx reverse proxy.

## Стек

- Frontend: React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query.
- Backend: Node.js, Express, TypeScript, Prisma ORM.
- Database: PostgreSQL.
- Auth: HTTP-only JWT cookie, bcryptjs password hashing.
- Infra: Docker, Docker Compose, nginx.

## Структура

```text
frontend/        React/Vite SPA
backend/         Express API, Prisma, seed
nginx/           Reverse proxy config
docker-compose.yml
.env.example
README.md
```

## Env

Скопируйте пример:

```bash
cp .env.example .env
```

Заполните минимум:

```env
POSTGRES_DB=sofa_crm
POSTGRES_USER=sofa_crm_user
POSTGRES_PASSWORD=your_db_password
DATABASE_URL=postgresql://sofa_crm_user:your_db_password@localhost:5432/sofa_crm?schema=public
JWT_SECRET=long_random_secret
COOKIE_SECURE=false
FRONTEND_ORIGIN=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=strong_admin_password
TELEGRAM_ENABLED=false
```

`PUBLIC_SOFA_LEADS_ENABLED=false` означает, что заявки принимаются только через Telegram-бота. Чтобы временно вернуть веб-форму `/sofa-bot`, поставьте `true`.

Для локального запуска `DATABASE_URL` должен указывать на PostgreSQL, доступный с вашей машины, обычно `localhost:5432`. Backend и seed умеют читать корневой `.env` из `../.env`, когда вы запускаете команды из папки `backend`.

Prisma CLI для миграций читает `.env` из текущей папки. Поэтому для локальной миграции либо временно скопируйте env в backend:

```bash
cp .env backend/.env
cd backend
npm run prisma:migrate
```

Либо передайте `DATABASE_URL` как переменную окружения. В Docker Compose backend получает отдельный `DATABASE_URL` автоматически и ходит к сервису `postgres:5432`, поэтому в compose не нужно менять host на `localhost`.

В production укажите домен:

```env
NODE_ENV=production
COOKIE_SECURE=true
FRONTEND_ORIGIN=https://domain.ru
CORS_ORIGINS=https://domain.ru
```

## Локальный запуск

Backend:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Открыть:

- public mini-bot: `http://localhost:5173/sofa-bot`
- login: `http://localhost:5173/login`
- admin после входа: `http://localhost:5173/admin/dashboard`
- manager после входа: `http://localhost:5173/manager/leads`

## Первый admin

Seed берёт данные из `.env`:

```env
ADMIN_NAME=Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=strong_admin_password
```

Команда:

```bash
cd backend
npm run seed
```

Seed безопасный: если admin уже существует, он не пересоздаётся и пароль не меняется. Пароль не выводится в консоль.

## Docker Compose

На сервере:

```bash
cp .env.example .env
# отредактируйте .env
docker compose build
docker compose up -d postgres
docker compose run --rm backend npm run prisma:deploy
docker compose run --rm backend npm run seed
docker compose up -d
```

После запуска на сервере с доменом и HTTPS:

- `https://domain.ru/sofa-bot`
- `https://domain.ru/login`
- API healthcheck: `https://domain.ru/api/health`

Для домена направьте DNS на сервер. Если TLS завершается внешним reverse proxy, прокиньте трафик на nginx из этого compose. Если TLS будет на этом же сервере, добавьте certbot/SSL-конфиг поверх `nginx/default.conf`. В production cookie авторизации помечается `secure`, поэтому полноценный вход в CRM должен выполняться по HTTPS.

## Миграции Prisma

Локально:

```bash
cd backend
npm run prisma:migrate
```

Production:

```bash
docker compose run --rm backend npm run prisma:deploy
```

Backend container перед стартом выполняет `prisma generate`, но миграции в production запускаются отдельной командой.

## Telegram и VPN/proxy

Переменные:

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=123456:telegram_bot_token
TELEGRAM_LEAD_CHANNEL_ID=@your_channel_or_-1001234567890
TELEGRAM_ADMIN_CHAT_ID=123456789
TELEGRAM_PROXY_URL=
```

`TELEGRAM_LEAD_CHANNEL_ID` - основной канал, куда бот отправляет новые заявки. Можно указать публичный username канала вида `@channel_name` или числовой id приватного канала вида `-100...`. `TELEGRAM_ADMIN_CHAT_ID` остается запасным получателем: если канал не задан, заявки уйдут туда.

Чтобы узнать id приватного канала, добавьте бота в канал админом и отправьте в канал сообщение `/chatid`. Бот ответит `Telegram chat id: ...`; это значение нужно прописать в `TELEGRAM_LEAD_CHANNEL_ID`.

Сценарий заявки сейчас рассчитан на Telegram: пользователь пишет боту `/start`, выбирает модель, вводит телефон, после чего бот сохраняет заявку и отправляет карточку в канал.

### Deep links Telegram-бота

Замените `USERNAME_BOT` на username реального Telegram-бота:

- Общая ссылка: `https://t.me/USERNAME_BOT?start=all`
- Ссылка для базовых диванов: `https://t.me/USERNAME_BOT?start=base`
- Ссылка для стандартных диванов: `https://t.me/USERNAME_BOT?start=standard`
- Ссылка для новинок: `https://t.me/USERNAME_BOT?start=new`

Сегменты:

- `base` показывает базовые диваны + услуги + новинки.
- `standard` показывает стандартные диваны + услуги + новинки.
- `new` показывает новинки + услуги.
- `all` показывает все разделы.

Если Telegram API доступен напрямую, оставьте `TELEGRAM_PROXY_URL` пустым.

Если сервер находится в сети, где Telegram API недоступен, поднимите VPN/proxy отдельно и укажите URL:

```env
TELEGRAM_PROXY_URL=socks5://user:password@host:port
# или
TELEGRAM_PROXY_URL=http://user:password@host:port
```

Backend использует `proxy-agent` и поддерживает `http`, `https`, `socks` proxy. Если уведомление Telegram не отправилось, заявка всё равно сохраняется, ошибка только логируется.

## Backup базы

Пример backup:

```bash
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > sofa_crm_backup.sql
```

Восстановление:

```bash
cat sofa_crm_backup.sql | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

## Проверка MVP

1. Откройте `/sofa-bot`.
2. Выберите модель дивана.
3. Введите неверный телефон и проверьте ошибку.
4. Введите номер в формате `+7XXXXXXXXXX`.
5. Войдите как admin через `/login`.
6. Откройте `/admin/leads` и убедитесь, что заявка появилась.
7. Создайте менеджера в `/admin/managers`.
8. Назначьте заявку менеджеру.
9. Войдите менеджером и откройте `/manager/leads`.
10. Измените статус и комментарий.
11. Вернитесь под admin и проверьте статус, историю и dashboard.

## API

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/public/sofa-leads`
- `GET /api/admin/leads`
- `GET /api/admin/leads/:id`
- `PATCH /api/admin/leads/:id`
- `PATCH /api/admin/leads/:id/assign`
- `GET /api/admin/leads/stats`
- `GET /api/admin/managers`
- `POST /api/admin/managers`
- `PATCH /api/admin/managers/:id`
- `PATCH /api/admin/managers/:id/password`
- `PATCH /api/admin/managers/:id/activate`
- `PATCH /api/admin/managers/:id/deactivate`
- `GET /api/manager/leads`
- `GET /api/manager/leads/:id`
- `PATCH /api/manager/leads/:id/status`
- `PATCH /api/manager/leads/:id/comment`

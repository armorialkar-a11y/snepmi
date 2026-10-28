# SNEPMI AGENCY — Telegram Mini App

Порт сайта SNEPMI AGENCY в Telegram Mini App: лендинг, каталог блогеров с фильтрами и подборкой,
форма заявки, админ-панель для избранных Telegram-аккаунтов и бот, который этот Mini App открывает.
Проект один пакет: Express отдаёт API и собранный React-фронтенд, данные лежат в PostgreSQL.

## Что внутри

| Путь | Назначение |
| --- | --- |
| `server/index.js` | Express: API, статика `web/dist`, SPA-fallback, старт бота |
| `server/routes/public.js` | `GET /api/config`, `GET /api/bloggers`, `POST /api/leads`, `GET /media/:id` |
| `server/routes/admin.js` | Заявки, блогеры, настройки, загрузка файлов (только для админов) |
| `server/lib/telegramAuth.js` | Проверка `initData` (HMAC) и доступ по `ADMIN_USER_IDS` |
| `server/bot.js` | grammy-бот: `/start`, `/id`, `/help`, `/settings`, `/admin`, уведомления о заявках |
| `server/db/sql/*.sql` | Миграции схемы; `server/db/seed.js` — импорт `data/bloggers.seed.json` |
| `web/src` | React: `HomePage` (лендинг), `CatalogPage` (каталог), `AdminPage` (админка), `LeadDialog` |
| `tools/extract-from-preview.mjs` | Одноразовый экстрактор исходного preview-файла (не нужен для сборки) |

## Локальный запуск

Нужен Node ≥ 20.19 и PostgreSQL.

```bash
npm ci
cp .env.example .env          # заполнить DATABASE_URL, BOT_TOKEN, ADMIN_USER_IDS
npm run setup                 # миграции + импорт 38 блогеров из data/bloggers.seed.json
npm run build                 # собрать фронтенд в web/dist
npm start                     # http://localhost:8080
```

Для разработки фронтенда: `npm run dev:server` (порт 8080) и `npm run dev:web` (порт 5173,
проксирует `/api`, `/media`, `/images`). Чтобы открыть приложение в обычном браузере без Telegram,
поставьте в `.env` `AUTH_DISABLED=true` — в продакшене так делать нельзя.

## Настройка Telegram

1. `BOT_TOKEN` от @BotFather.
2. @BotFather → **Bot Settings → Menu Button → Configure web app** → укажите публичный HTTPS-адрес
   приложения, например `https://snepmi-miniapp.onrender.com`.
3. Если BotFather просит подтвердить домен — впишите выданный токен в
   `web/public/telegram-verification.txt` (файл-заготовка уже в репозитории, отдаётся по адресу
   `https://ваш-домен/telegram-verification.txt`) и пересоберите приложение.
4. `MINI_APP_ORIGIN` в окружении = тот же адрес без завершающего слеша: кнопки бота строят
   ссылки вида `?startapp=catalog` / `?startapp=admin`, и приложение открывает нужный экран.
5. Узнайте свой id: напишите боту `/id`, добавьте его в `ADMIN_USER_IDS` (через запятую) —
   позже список правится во вкладке «Настройки» админки.
6. `NOTIFY_CHAT_ID` — чат или user, которому бот присылает новые заявки.

Бот работает long polling. Для вебхука задайте `WEBHOOK_URL`
(`https://…/telegram/webhook`) и `WEBHOOK_SECRET`.

## Продакшен-деплой (Render)

### Шаг 1. Выложить код на GitHub

В репозиторий попадает ~90 файлов и 7 МБ (46 из них — картинки каталога). `node_modules`,
`web/dist` и `.env` уже исключены через `.gitignore`, поэтому перетаскивать файлы в окно браузера
не нужно — один `git push` уносит всё сразу:

```bash
git init -b main            # если репозиторий ещё не создан
git add -A
git commit -m "SNEPMI AGENCY: Telegram Mini App"
```

Дальше на github.com создайте **пустой** репозиторий (без README, license и `.gitignore`, иначе
истории разойдутся) и push:

```bash
git remote add origin https://github.com/<логин>/<репозиторий>.git
git push -u origin main
```

Если GitHub требует пароль — это ожидаемо: нужен Personal Access Token
(Settings → Developer settings → Personal access tokens → scope `repo`) вместо пароля, либо
GitHub Desktop, где авторизация и кнопка Push идут из графического интерфейса.

### Шаг 2. Поднять сервис на Render

`render.yaml` поднимает web-сервис и внутреннюю PostgreSQL одним blueprint'ом:

- Build command: `npm ci && npm run build`
- Start command: `node server/index.js`
- Health check: `/api/health`

В дашборде заполните `BOT_TOKEN`, `MINI_APP_ORIGIN`, `ADMIN_USER_IDS`, `NOTIFY_CHAT_ID`
(`DATABASE_URL`, `PORT` Render выдаёт сам). `AUTO_MIGRATE`/`AUTO_SEED` по умолчанию `true`,
поэтому схема создаётся, а каталог импортируется при первом старте.

Загруженные админом картинки хранятся в таблице `media`, а не на диске, — они переживают перезапуск
и редиплой. Файлы из `web/public/images` (исходный каталог) приходят из репозитория.

## Безопасность админ-доступа

Админка (`#/admin`, `/api/admin/*`) доступна только тем, чей Telegram `user_id` есть в доверенном
списке, и ничего кроме этого списка не даёт обхода:

- **Подпись вместо пароля.** Каждый запрос идёт с заголовком `Authorization: tma <initData>`.
  Сервер пересчитывает HMAC-SHA256 по ключу `secret=HMAC('WebAppData', BOT_TOKEN)` и сверяет
  `hash` через `timingSafeEqual`. Не совпало — 401, независимо от того, какой id написан в payload.
- **Источник истины — окружение.** Список = `ADMIN_USER_IDS` из env ∪ `settings.admin_user_ids`
  из базы. ENV-номера нельзя убрать из панели: попытка сохранить список пустым или без
  собственного id отклоняется с 422 (иначе один неверный клик закрывает доступ всем).
- **`AUTH_DISABLED` не является бэкдором.** Он действует только при `NODE_ENV ≠ production` и
  только для запросов, пришедших по loopback-адресу (сравнение по сокету, а не по
  `X-Forwarded-For`). В проде переменная игнорируется с явной ошибкой в логе.
- **Всё или ничего.** Без `BOT_TOKEN` проверка подписи невозможна, поэтому `/api/admin/*`
  отвечает 503, а не пропускает запросы. Пустой `ADMIN_USER_IDS` и пустая база = ни у кого нет
  доступа.
- **initData — это bearer-токен.** Он не пишется в базу, в `localStorage` и в логи; живёт
  `INIT_DATA_MAX_AGE_SECONDS` (по умолчанию 24 часа, кламп 300…604800), проверяется на
  «свежесть» и на заголовок из будущего. Утёк токена — переключите токен бота в @BotFather:
  все ранее выданные подписи перестанут сходиться мгновенно.
- **Лимит неудач.** 25 неверных подписей/отказов с одного адреса за 15 минут → 429. Успешная
  авторизация сбрасывает счётчик.
- **Заголовки.** CSP (`default-src 'self'`, скрипты — только свои и `telegram.org`,
  `frame-ancestors` — только Telegram, чтобы клиджэкинг чужого сайта был невозможен),
  `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, HSTS в проде,
  `X-Powered-By` выключен.
- **Запросы на запись** (POST/PUT/PATCH/DELETE под `/api`) принимаются только с того же
  хоста, что и `Origin` — защита от CSRF и DNS-rebinding.
- **Вебхук бота** поднимается лишь при заданном `WEBHOOK_SECRET` и сверяет заголовок
  `X-Telegram-Bot-Api-Secret-Token` через `timingSafeEqual`; без секрета эндпоинт не
  монтируется вовсе.
- **Загрузки.** Мультер принимает только webp/jpeg/png (и mime, и расширение) до 5 МБ; при
  отдаче тип контента проверяется повторно, а `/media/*` приходит с
  `Content-Security-Policy: default-src 'none'; sandbox` — файл из базы не сможет стать
  исполняемым HTML.
- **Ошибки наружу не текут.** Postgres-коды и 500 заменяются нейтральным текстом, SQL
  детали остаются в логе сервера.
- **Аудит.** Каждая запись админки пишется в лог: метод, путь, ответ и Telegram id автора.

## Пользовательские сценарии

- **Лендинг** (`#/`) — тот же состав, что у сайта: герой, витрина авторов с телефоном-слайдером,
  услуги, процесс, подход, форматы, кейсы, FAQ, контакты с конвертом.
- **Каталог** (`#/bloggers`) — поиск, фильтры по площадке и тематике, сетка по категориям,
  «Ваш выбор» с переходом в заявку, external-ссылки открываются через `openLink`/`openTelegramLink`.
- **Заявка** — диалог с валидацией на сервере (zod), throttling 5 заявок в час на аккаунт,
  honeypot и согласие на обработку данных; приём заявок включается/выключается в админке.
- **Админка** (`#/admin`) — доступ только для id из списка: заявки (поиск, статусы, заметки, CSV),
  блогеры (CRUD, загрузка изображения, порядок, категория, РКН, ссылки на площадки), настройки.

## Примечания

- `data/bloggers.seed.json` — исходный каталог из preview-файла. Поля `followers`,
  `average_views`, `price`, `formats`, `description` в нём пустые: в исходном сайте они не были
  заполнены. Данные добавляются через админку.
- Секреты не коммитятся: `.env` в `.gitignore`, значения только из окружения.
- Поиск по заявкам в админке складывает регистр кириллицы через `translate()`, а не `lower()`:
  на `C`-локали кластера (Windows, минимальные Docker-образы) `lower()`/`ILIKE` не сворачивают
  русский алфавит, и «тест» не находил бы «Тест».
- Экспорт CSV скачивается blob-ссылкой. В iOS-вебвью Telegram такой клик может молча
  игнорироваться — если файл не появился, выгрузку можно снять с обычного браузера по адресу
  `/api/admin/leads.csv` (нужен заголовок `Authorization: tma <initData>`), либо отфильтровать
  заявки и скопировать таблицу из админки.
- Картинки, загруженные через админку, лежат в таблице `media` и не удаляются автоматически при
  удалении блогера: осиротевшие строки чистят вручную (`DELETE FROM media WHERE id = …`).
- API админки принимает частичные payload: `PUT /api/admin/settings` обновляет только переданные
  поля, а `POST /api/admin/bloggers` достаточно `name` — остальные колонки становятся `NULL`.

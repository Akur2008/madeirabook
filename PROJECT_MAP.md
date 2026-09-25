# PROJECT MAP — Madeirabook

Frontend → Vercel → madeirabook.com  (~/projects/madeirabook-site/)
Backend  → Vercel → madeirabook-core.vercel.app  (~/projects/madeirabook-core/)
DB       → Neon Postgres (production / neondb)
Bot      → @Madeirabookbot (webhook → /webhook/telegram)
Email    → Resend (madeirabook.com)
PMS      → Zeevou (sandbox → live, ждём активацию)
Payments → Stripe Connect Express
Tours    → Viator (PID: P00321690)
DNS      → amen.pt

## BACKEND ROUTES
- GET  /admin                       дашборд owners + смена комиссии
- GET  /admin/owners                форма создания owner
- POST /admin/create-owner          создать owner + Stripe + permalink
- GET  /admin/success               возврат после KYC
- GET  /admin/reauth                пересоздать Stripe-ссылку
- POST /admin/update-commission     обновить %
- POST /checkout/create-booking-and-pay  Stripe Checkout (падает на getPrice)
- POST /webhook/stripe              Stripe webhook
- POST /webhook/zeevou              Zeevou callback (TODO строка 175)
- POST /webhook/telegram            grammY webhook
- GET  /owner/onboarding/:token     публичный редирект на Stripe
- GET  /owner/onboarding-complete   страница после KYC
- POST /api/subscribe               форма email → Neon + Resend + PDF

## BACKEND SERVICES
- services/stripe.js        Stripe Connect / Checkout / Webhook / Onboarding
- services/commission.js    расчёт %
- services/subscriptions.js €25/мес (TODO)
- services/pms/index.js     переключатель (env PMS_PROVIDER)
- services/pms/zeevou.js    8 методов (getToken, getPrice, createReservation...)
- services/pms/smoobu.js    старый PMS (не работает)

## ENV VARS (имена)
DATABASE_URL, NODE_ENV, APP_URL
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
ADMIN_USER, ADMIN_PASS, ADMIN_EMAIL
TELEGRAM_BOT_TOKEN
ZEEVOU_BASE_URL, ZEEVOU_OAUTH_CRED_CLIENT_ID, ZEEVOU_OAUTH_CRED_CLIENT_SECRET, ZEEVOU_SANDBOX_*
RESEND_API_KEY
PMS_PROVIDER (smoobu | zeevou)
LOG_LEVEL

## СТАТУС: РАБОТАЕТ
- Stripe Checkout: оплата → сплит 12%/88% (verified: application_fee=12000, transfer, on_behalf_of)
- Онбординг владельца: форма → Express → постоянная ссылка → Stripe KYC
- Форма email: /api/subscribe → Neon + Resend + PDF
- 42 страницы сайта + sitemap + llms.txt
- Stripe webhook endpoint создан, подпись настроена
- Zeevou: токен работает (getMe → ok)

## СТАТУС: НЕ ДОДЕЛАНО
- E2E Stripe через /checkout/create-booking-and-pay (падает на getPrice = Smoobu 401)
- Zeevou live (письмо отправлено 24.09, ждём активацию)
- Webhook Zeevou — строка 175 в webhook.js (TODO)
- Telegram-бот: webhook установлен, но бот не отвечает (grammY init issue)
- Resend CNAME resend: Pending (DNS корректен, проблема на стороне Resend)
- Подписки €25/мес (Шаг 5)
- Фото на страницах (28 фото в базе, не расставлены)
- 13 страниц-заглушек — нужен полный контент

## КЛЮЧЕВЫЕ ВНЕШНИЕ ID
- Stripe owner test: acct_1UFyXHKdXg3Yjoq3
- Stripe platform: acct_1ThDKM3ZmQk7WM8j
- Viator PID: P00321690
- Resend domain ID: b9358a3b-73d1-4c5d-b10a-fa910c8a9906
- Telegram bot: @Madeirabookbot
- Zeevou sandbox: sandbox.zeevou.com

## ПРАВИЛА РАБОТЫ
1. Один шаг — одно действие.
2. Перед правкой файла — сначала cat (прочитать целиком), потом менять.
3. GitHub = источник истины. Локально — копии.
4. Секреты только в .env и Vercel env.
5. Frontend деплой: git add . && git commit -m "..." && git push
6. Backend деплой: vercel --prod

## КАК ИСПОЛЬЗОВАТЬ ЭТОТ ФАЙЛ
В начале нового чата с AI — скинь PROJECT_MAP.md первым сообщением.
AI прочитает, увидит структуру, не будет предлагать дубли.
После крупных изменений — обновить файл.

---

## 🎨 WOW-ФИШКИ (одобрены, в разработку)

### 1. Winter Escape Radar — карта Европы в реальном времени
- 17 городов с погодой + дешёвым билетом
- Мадейра +22°C светится зелёным внизу
- Клик на город → наша страница /{city}-to-madeira
- Источники: OpenWeather API (free) + Travelpayouts API (уже есть PID)
- Аномалии 3 + 5
- Обновление: cron каждые 6 часов
- Срок: 2-3 часа
- Где: главная, под hero

### 2. "Save me from winter" — счётчик спасённых
- "Сегодня N человек искали билеты в Мадейру"
- Данные: Travelpayouts searches за 24ч
- Отложено до набора трафика (нужно >100/день, чтобы не стыдно)
- FOMO-механика

### 3. Cheapest Weekend Finder — виджет поиска выходных
- Юзер вводит город → график дешёвых выходных на 90 дней
- Cheapest weekend highlight + CTA на бронь
- Аномалия 2
- Срок: 2 часа

## 🛡 ЮРИДИЧЕСКИЕ СТРАНИЦЫ (критично перед ростом)
- /privacy — Политика конфиденциальности (GDPR)
- /terms — Условия использования
- Cookie banner (аналитика)
- Штраф GDPR до €20M / 4% оборота
- Португалия cookie consent: от €2000
- Срок: 30-40 мин

---

## 🎯 ГЛАВНЫЙ WOW-ПРОЕКТ (одобрен, приоритет №1 после бота)

### Winter Escape Radar (гибрид C)
**Цель:** взрывной WOW-эффект на главной + магнит для индексации + крючок для Telegram

**Десктоп:** интерактивная карта Leaflet
- 17 дуг от городов Европы до Мадейры
- Толщина дуги = объём рейсов из города
- У каждой точки: `+4°C` и `€27`
- Мадейра внизу светится + пульсирует `+22°C`
- Клик на город → плавный скролл к списку

**Мобильные:** список 17 городов (без Leaflet, чтобы не грузить)

**Источники данных:**
- OpenWeather API (free, 1000 req/day) — погода
- Travelpayouts API (PID P00321690) — цены
- Backend endpoint: `GET /api/radar` → JSON
- Кэш 6 часов

**Место:** главная, под hero. И в Telegram-бот.

**Срок:** 3-4 часа (разбить на 2 дня)

### Save me from winter (FOMO, часть радара)
- Счётчик: "Сегодня N человек искали билеты из холодной Европы"
- "Вспышки" на карте — реальные поиски за 24ч
- Активировать когда трафик > 500/день (иначе мёртво)
- В Telegram-боте — живая лента: "Ханна из Берлина только что купила €34"

**Почему это гениально:**
- Прямое продолжение аномалий 2, 3, 5
- Контраст холод/тепло = эмоциональный триггер
- FOMO = "все едут, а ты нет"
- Никто так не делает (Booking/Airbnb не показывают temp+price в одном блоке)
- Работает на главной + в боте одновременно

---

## 🏗 СТРАТЕГИЯ: PMS, домены, бренд (финал 25.09)

### Бренд — один: Madeirabook
Все каналы работают под именем Madeirabook. Никаких "apartmadeira" как бренда — только как технический канал.

### PMS-провайдеры
**Основной — Zeevou (free tier)**
- API (календарь, цены, брони) — бесплатно
- Channel Manager (Booking/Airbnb/Expedia) — бесплатно
- Google Travel — бесплатно
- НЕ используем: их Stripe, Custom Domain, White Label
- Их комиссия не касается нас (свой Stripe + свой портал)

**Резервный — Smoobu**
- Подключаем после ответа их support (тикет 17.09)
- Только для своих объектов
- Домен: apartmadeira.com
- Бренд на этом канале: всё равно Madeirabook
- Цель: сравнить работу, иметь план Б если Zeevou закроет free
- ⚠️ Синхронизации между Smoobu и Zeevou НЕТ — учитывать при бронировании

### Домены и роли
- `madeirabook.com` — основной, твой портал + SEO + блог
- `madeirabook.zeevou.direct` — сейчас временный booking engine (страховка)
- `apartmadeira.com` — канал Smoobu (когда подключим)
- `book.madeirabook.com` — НЕ покупаем (€39/мес косметика)

### Что НЕ делаем
- ❌ Кастомный домен у Zeevou (€39/мес)
- ❌ White Label у Zeevou (€100/мес)
- ❌ Их Stripe (комиссия ~2%)
- ❌ Параллельный PMS на одном объекте (риск двойного бронирования)

### Правила мульти-PMS
1. Один объект = один PMS (нельзя одновременно Zeevou + Smoobu на один объект)
2. Свои объекты → Smoobu (когда заработает)
3. Партнёрские объекты → Zeevou
4. Все прямые брони через свой Stripe (12/88)
5. Все OTA-брони — через Channel Manager того PMS, где объект

---

# 🚀 ФИНАЛЬНАЯ ФИКСАЦИЯ СЕССИИ 25.09.2026

## ✅ Задеплоено за сессию
- Stripe E2E: оплата → 12/88 сплит → webhook → status=paid (проверено)
- Resend: письма от hello@madeirabook.com
- 18 страниц с полным контентом + tours CTA
- 2 новые: /apartamentos-do-mar, /lido-funchal
- Sitemap 41 URL принят Google
- Webhook Stripe endpoint: we_1UJK8b3ZmQk7WM8jecqc4jvD
- PRICE_MOCK=500 на Vercel
- Альяс /webhook/stripe в app.js

## 🎯 ПРИОРИТЕТ #1 — Telegram Mini App (НЕ бот)
**Пользователь прав:** нужен TMA (React-приложение внутри Telegram), не бот с кнопками.

**Структура TMA:**
- React + Vite + Tailwind → madeirabook-app.vercel.app
- Guest TMA: одна динамическая кнопка + гид + еда + возврат
  - Новичок: "📅 Забронировать — получите −10%"
  - Вернулся: "🎁 Забронировать с −10%"
  - Есть бронь: "🔔 Детали заезда — X дней"
  - После заезда: "⭐ Оценить поездку 1–10"
- Owner TMA: 4 плитки 2×2
  - 🔔 Заездов сегодня
  - 💰 Выплата (сумма + дата)
  - 📅 Загрузка %
  - ⭐ Рейтинг
  - ➕ Добавить бронь
- В боте @Madeirabookbot кнопка `web_app: { url: 'https://madeirabook-app.vercel.app' }`
- Аутентификация через initData (Telegram WebApp)
- Схема БД: telegram_users, telegram_sessions (уже есть)

**Проверить:** @BotFather /mybots — возможно старое TMA осталось у другого бота.

**Срок:** 1-2 дня.

## 🎯 ПРИОРИТЕТ #2 — Booking-трафик (5000/мес)
**Контекст:** GBP на здание "Apartamentos do Mar" (чужой отель) — льёт 5000 визитов/мес, отзывы там же. Ссылка на madeirabook.com.

**Стратегия: GBP = вход, madeirabook.com = твой дом**

**5 идей максимизации:**
1. UTM-метки: `?utm_source=booking&utm_medium=listing&utm_campaign=apartamentos-do-mar`
2. Landing `/book-direct?from=booking` — калькулятор "−10% vs Booking", CTA → Zeevou
3. Обратный перехват: "скажите в Booking, что нашли напрямую — поздний чек-аут бесплатно"
4. Программа возврата (Аномалия 5): бронь через Booking → письмо "−10% на следующую напрямую"
5. Google Hotels: верифицировать официальный сайт в GBP для direct booking
6. Если GBP заберут — своя страница + email/Telegram база уже набраны

**Действия:** создать `/book-direct`, UTM в GBP, оптимизировать описание GBP.

## 🎯 ПРИОРИТЕТ #3 — Бот (в процессе)
- Работает в polling локально (3 кнопки: Book/Flights/Food)
- Webhook на Vercel — 404/200 без ответа (grammY init issue)
- Решение: Railway ($5/мес, постоянный процесс) вместо Vercel для бота
- Либо lazy-init fix

## 🎯 ПРИОРИТЕТ #4 — Юридические страницы
- /privacy, /terms, cookie-banner
- Штраф GDPR: до €20M/4%, PT: €2000+
- Срок: 30-40 мин

## 🎯 ПРИОРИТЕТ #5 — Winter Escape Radar (WOW, выходные)
- Leaflet: 17 дуг от городов Европы до Мадейры
- На каждой точке +4°C и €27
- Мадейра пульсирует +22°C
- Источники: OpenWeather (free) + Travelpayouts (PID P00321690)
- Backend GET /api/radar, кэш 6ч
- На главной + в TMA
- Срок: 3-4 часа

## 🎯 ПРИОРИТЕТ #6 — Save me from winter (FOMO)
- Счётчик: "N человек искали билеты из холодной Европы"
- Вспышки на карте = поиски за 24ч
- В TMA живая лента покупок
- При трафике >500/день

## 🏗 АРХИТЕКТУРА (зафиксировано)
- Бренд один: Madeirabook
- PMS основной: Zeevou (free) — API для календаря/цен/броней
- PMS резервный: Smoobu (свои объекты, домен apartmadeira.com)
- Синхронизации между PMS нет — учитывать
- Custom Domain у Zeevou (€39/мес) НЕ берём
- Их Stripe НЕ используем — свой сплит 12/88
- Один объект = один PMS
- Прямые брони через свой Stripe
- OTA через Channel Manager того PMS, где объект

## 🔑 КЛЮЧЕВЫЕ ID И ДОСТУПЫ
- Telegram bot token: 8884417047:AAH5FvkIFFERjpNArGCMqkvNro0tS3mz5vg
- Stripe webhook endpoint: we_1UJK8b3ZmQk7WM8jecqc4jvD
- Stripe owner test: acct_1UFyXHKdXg3Yjoq3
- Viator PID: P00321690
- Resend domain ID: b9358a3b-73d1-4c5d-b10a-fa910c8a9906
- Admin: /admin (admin / change_me_min_8_chars)
- Zeevou sandbox: sandbox.zeevou.com

## 📌 ТЕКУЩИЙ МОМЕНТ (25.09 вечер)
- Только что запушили /apartamentos-do-mar + /lido-funchal
- Следующий шаг: TMA (React + Vite)
- После: юр-страницы, TMA skeleton

## 🎬 КАК ПРОДОЛЖИТЬ В НОВОМ ЧАТЕ
1. Скинь этот PROJECT_MAP.md первым сообщением
2. Напиши "Продолжаем. Старт с TMA"
3. AI прочитает карту и начнём с Telegram Mini App

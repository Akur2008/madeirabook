---
title: "Madeirabook & MadeiraOasis — Единая архитектура v2 (FINAL)"
version: 2.0.0-final
date: 2026-09-28
status: approved
authors: [Andrei Kurochkin, Assistant 1, Assistant 2]
tags: [architecture, madeirabook, madeiraoasis, cliff-bay, payload_v3, nextjs15, neon_postgres, stripe-connect, tma, rare-oasis, aio]
---

# 🏗️ Единая архитектура Madeirabook & MadeiraOasis v2 FINAL

**Статус:** зафиксированное решение. Все спорные вопросы закрыты.

---

# ЧАСТЬ 1. СЕВЕРНАЯ ЗВЕЗДА

## Миссия

Гость ищет не Мадейру. Он ищет побег от массового туризма в честную роскошь природы, тишины и чистого океана. Мадейра — первый остров Атлантиды, где это ещё сохранилось.

**Мы не каталог отелей. Мы — издатель редких мест.**

Rare Oasis — ядро. Flights, Weather, Guides — приманка для трафика.

## Семантическое облако (12 фраз)

побег от массового туризма · честная роскошь · минимализм и эко-туризм · тишина и уединение · чистая Атлантика · воздух эвкалипта · slow travel · редкие места · без туристических автобусов · без Booking-конвейера · кураторская коллекция · Атлантида

## 4 стихии Rare Oasis

- Океан/Базальт → Oasis Hotel (Caniço)
- Лес/Облака → Quinta da Serra (Jardim da Serra)
- Солнце/Дизайн → Estalagem (Ponta do Sol)
- Дикость/Водопады → Aqua Natura (Seixal)

## 13 правил работы

1. 1 проект = 1 папка = 1 репо = 1 Vercel-проект
2. Деплой только через git push
3. ARCHITECTURA.md — источник правды
4. Ничего лишнего в корне репо
5. Один проект — один язык
6. Схема БД в репозитории
7. Бэкап перед изменением БД
8. Не удаляем таблицы (только deprecated_)
9. Одна таблица — одна ответственность
10. Секреты только в .env
11. Ассистент не видит файлы на Mac
12. Управление выводом команд (head/tail/sed/grep)
13. Тон работы: без ложных восторгов, честно, но с душой

---

# ЧАСТЬ 2. ДВУХБРЕНДОВАЯ МОДЕЛЬ

## Архитектура

Единый Headless Backend (Payload CMS v3 + Neon Postgres).
Три клиента:
- **madeirabook.com** — B2C масс-маркет, трафик, 43 страницы
- **madeiraoasis.com** — B2C VIP / B2B, Quiet Luxury, высокий чек
- **TMA в Telegram** — кабинет гостя (React+Vite, не переписывается)

## Позиционирование

| Параметр | Madeirabook | MadeiraOasis |
|---|---|---|
| Сегмент | B2C масс-маркет | B2C VIP / B2B |
| Цель | Трафик, конверсии | Высокий чек, инвестиции |
| Философия | Сервис, доступность | Rare Oasis: покой, стихии |
| Объекты | Апартаменты, гиды | Cliff Bay, Savoy, Praça do Carmo |
| Каналы | SEO, Telegram, партнёрки | Direct VIP, AIO/GEO |

## Домены

- madeirabook.com — существующий
- madeiraoasis.com — зарегистрирован 28.09.2026
- Один Next.js проект на Vercel, middleware маршрутизирует по домену

---

# ЧАСТЬ 3. ТЕХНОЛОГИЧЕСКИЙ СТЕК

- **Next.js 15** (App Router, RSC, Server Actions)
- **TypeScript** (строгая типизация)
- **Tailwind CSS**
- **Vercel** (деплой)
- **Neon Postgres** (единая БД, pgvector)
- **Payload CMS v3** — только админ-панель. Публичная часть работает с Neon напрямую через драйвер (страховка от багов Payload).
- **Stripe Connect** (сплит платежей)
- **Zeevou / Smoobu** (источник правды по броням и календарям)
- **Vercel Blob / CDN** (4K-видео, фото, аудио)

## Что остаётся как есть

- madeirabook-core (Express) — микросервис для бота и cron
- madeirabook-tma (React+Vite) — не переписывается
- madeirabook-site (43 HTML) — миграция по пакетам
- Бот @Madeirabookbot — живёт в core, переключается на новую БД


---

# ЧАСТЬ 4. СХЕМА ДАННЫХ

## Решение: одна БД + флаг brand

Одна база Neon. Поле `brand` в таблицах (`madeirabook` / `madeiraoasis` / `both`).
Причины: общая история гостя, общая аналитика, один TMA подключается к одной БД.

## Коллекции (Payload)

### Properties
id, title (RU/EN/DE), slug, brand, pmsPropertyId, pricePerNight, cleaningFee,
location → Locations, amenities → Amenities, media → Media[], audioTracks → Media[],
featured, status.

### Media
file, type (image / video_4k / audio_atmosphere), altText, caption.

### Bookings
property, checkIn, checkOut, guestInfo (name, email, phone, tgUserId),
totalAmount, platformCommission, stripePaymentIntentId, pmsReservationId, status.

### Locations
name, slug, description (RichText), geoCoordinates (lat, lng).

### InvestorDocs (B2B)
title, project, pdfFile, accessLevel (public / vip_requested / private).

### Дополнения (Assistant 2)
Affiliates (Travelpayouts, Aviasales, GetRentacar), GuestProfiles / TelegramUsers
(для TMA), BotWorkflows / AutoMessages (триггерные сообщения бота).

### AIO-поля в страницах
keywords, searchIntent, entityTags, aiSummary. Хранятся в БД, отдаются в JSON-LD
без генерации «на лету».

---

# ЧАСТЬ 5. ИНТЕГРАЦИИ

## Связи (без диаграммы)

Внешние системы, с которыми работает Next.js:
- **PMS Zeevou / Smoobu** — присылают webhooks о бронях, ценах, доступности.
- **Stripe Connect** — присылает webhooks об оплате и сплите.
- **External AI** (ChatGPT, Gemini, Perplexity) — читают JSON-LD.

Внутренние клиенты, которые обслуживает Next.js:
- **madeiraoasis.com** — премиум UI.
- **madeirabook.com** — сервисный портал, 43 страницы.
- **API** — для Telegram Mini App.

База данных: **Neon Postgres** (единая).

## Правила интеграций
- Сплит: Stripe Connect, комиссия удерживается автоматически.
- Овербукинг: webhook блокирует даты в Neon за 0.2 сек.
- Безопасность: JWT для админки, initData-валидация для TMA.

## Schema.org (обязательные типы)
Hotel · VacationRental · LodgingBusiness · ItemGrid · FAQPage · Article ·
AudioObject · Place · GeoCoordinates · Offer · AggregateRating · BreadcrumbList

---

# ЧАСТЬ 6. ПЛАН ФАЗ

## Фаза 1 — Фундамент (эта неделя)
- Схема Neon: одна БД + brand flag + AIO-поля
- PMS-подключение (Smoobu / Zeevou) — критический путь
- Stripe Connect + сплит на 3 апартаментах (тест модели)
- Первые AIO-страницы в семантике

## Фаза 2 — Payload + Next.js (1-2 недели)
- Payload v3 в Next.js 15
- Коллекции: Properties, Media, Guides, Audio, FAQ
- Проверка: админка → API → публичный сайт

## Фаза 3 — Cliff Bay Demo (эта неделя, параллельно)
- Demo-страница Cliff Bay (Porto Bay, Фуншал, 5*, 43 люкса)
- Показ директору (ва-банк, вариант A — прямая интеграция + сплит)
- При согласии — Cliff Bay становится флагманом проекта

## Фаза 4 — MadeiraOasis MVP (2 недели)
- Сайт на новой базе
- 1-2 объекта (Cliff Bay / Oasis Caniço)
- Валидный JSON-LD через Google Rich Results Test
- Биоакустика (Zoom H1n, 4 локации)

## Фаза 5 — Миграция Madeirabook (2-4 недели)
- 43 страницы по пакетам (5-10 за раз)
- Пакет 1: трафиковые (best-time, flights, 17 городов, penthouse)
- Пакет 2: контентные (guide, history, where-to-eat, safety, tours)
- Пакет 3: сервисные (остальные)
- 301-редиректы. URL сохраняются.
- TMA переключается на новый API

## Фаза 6 — Масштабирование (по мере готовности)
- Остальные отели по шаблону Cliff Bay / Oasis Caniço
- Второй остров Атлантиды (Азоры / Канары — если правила те же)

Общий срок до полной миграции: 5-9 недель.

---

# ЧАСТЬ 7. ПРИОРИТЕТ НЕДЕЛИ — CLIFF BAY

## Что за объект
- Cliff Bay — Porto Bay Hotels, Фуншал, 5*, 43 номера люкс.
- Контакт директора есть. Предварительная договорённость есть.
- Финал — за директором, после показа.

## Модель сделки (вариант A)
- Прямая интеграция.
- Деньги через Stripe Connect со сплитом.
- Комиссия Madeirabook — своя.
- Равные партнёры: мы отдаём им их долю, забираем «свободных людей,
  умеющих думать».

## Demo-страница (ва-банк)
- Делаем заранее, без договора.
- Полная концентрация. Уровень исполнения — 5*.
- Что показываем: биоакустика, AIO-семантика, JSON-LD schema Hotel,
  кураторский манифест, живые данные PMS (если подключим).

## Тайминг
- Пт-Сб: пилот готов.
- Показ директору — до конца недели.

---

# ЧАСТЬ 8. ЧТО ДЕЛАЕМ СЕЙЧАС

## Шаг 1 — Фундамент БД (первым делом)
1. Смотрим текущее состояние Neon.
2. Проектируем новую схему (одна БД + brand + AIO-поля).
3. Применяем миграцию.
4. Фиксируем в этом документе.

## Шаг 2 — PMS (критический путь)
1. Продолжаем с живой поддержкой Smoobu.
2. Параллельно проверяем Zeevou API.
3. Цель: рабочий PMS-адаптер за 2-3 дня.

## Шаг 3 — Stripe Connect
1. Настройка сплита.
2. Тест на 3 апартаментах.
3. Рабочая модель денег.

## Шаг 4 — Cliff Bay
1. Структура страницы на бумаге.
2. Тексты (Assistant 2).
3. AIO-семантика + JSON-LD.
4. Фото + биоакустика (Zoom H1n).
5. Сборка + проверка.

## Шаг 5 — AIO-семантика
1. Первые 5-10 страниц с новыми полями.
2. Начало накопления в БД.
3. Растёт параллельно с объектами и владельцами.

---

# ЧАСТЬ 9. ПРИНЯТЫЕ РЕШЕНИЯ

| # | Решение | Кто | Дата |
|---|---|---|---|
| 1 | Одна БД + флаг brand | Пользователь | 28.09 |
| 2 | Payload — только админка | Assistant 2 | 28.09 |
| 3 | Публичный сайт работает с Neon напрямую | Assistant 2 | 28.09 |
| 4 | Миграция по пакетам 5-10 страниц | Assistant 2 | 28.09 |
| 5 | URL сохраняются, 301-редиректы | Assistant 2 | 28.09 |
| 6 | Cliff Bay = флагман, вариант A | Пользователь | 28.09 |
| 7 | Cliff Bay demo заранее, ва-банк | Пользователь | 28.09 |
| 8 | madeirabook-core и бот остаются | Assistant 2 | 28.09 |
| 9 | TMA не переписывается | Assistant 2 | 28.09 |
| 10 | Фаза 1 = фундамент БД + PMS | Пользователь | 28.09 |
| 11 | Stripe Connect тестируем на 3 апартаментах | Пользователь | 28.09 |
| 12 | AIO-семантика начинается параллельно | Пользователь | 28.09 |

---

# ЧАСТЬ 10. ЧТО НЕ ДЕЛАЕМ

- Не выбрасываем то, что работает (TMA, site, core, бот).
- Не переписываем с нуля.
- Не запускаем «большой взрыв».
- Не двигаемся дальше Фазы 2, пока PMS не подключён.
- Не начинаем Фазу 4-5, пока Cliff Bay не даст ответ.

---

# ЧАСТЬ 11. РОЛИ

- Assistant 2 (Strategy): концепция, AIO, контент, бренды, аудитории,
  верхние маркетинговые слои. Генерирует тексты, структуру, промпты.
- Assistant 1 (Implementation): код, БД, Payload, Next.js, миграция, деплой,
  интеграции, PMS-адаптеры.
- Пользователь: решения, приоритеты, финальное слово, договорённости
  с владельцами отелей.

---

# ЧАСТЬ 12. СЛЕДУЮЩИЕ ШАГИ

1. Пользователь: пауза (1 час).
2. После паузы: старт Шага 1 (фундамент БД).
3. К концу недели: фундамент БД + Stripe Connect + Cliff Bay demo.

Никаких новых обсуждений. Всё согласовано. Работаем.

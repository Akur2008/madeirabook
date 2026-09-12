PROJECT.md — финальный вариант

```markdown
# Madeirabook — платформа бронирования Madeira

## Что это

Маркетплейс аренды апартаментов и небольших отелей на Мадейре (Португалия).
Связка: **Stripe Connect Express** (платежи) + **Smoobu** (PMS: брони, цены, каналы) + **собственный кабинет владельца** (интерфейс поверх Smoobu API).

**Ключевая идея:** владельцы работают только через твой кабинет, Smoobu — невидимый «движок» под капотом. Гости бронируют через твой домен, не уходят на сайт Smoobu.

## Бизнес-модель

- **100+ объектов** — апартаменты и небольшие отели (5–10 номеров)
- **Комиссия платформы: 12%** (включая ~2% на компенсацию Stripe processing fee)
- **Подписка владельца: €25/мес** за доступ к кабинету + Smoobu-интеграцию
- **Для отелей: €25/мес × количество номеров** (5–10 номеров = €125–250/мес)
- **Комиссия per-property настраивается:** 0% для своих, 10–15% для партнёров
- **MoR = владелец** (не платформа) через `on_behalf_of` в Stripe
- **Внутренний биллинг:** ты генерируешь внутренний счёт по каждой брони, отправляешь своему бухгалтеру и владельцу. Бухгалтер сам решает вопрос с владельцем в своей программе, а в твоей системе просто фиксирует «закрыто».
- Юрисдикция: **Португалия (Madeira)**, AT, RNAL, DAC7

## Стек

- Node.js + Express
- **Neon Postgres** — транзакции, аудит, связи
- **Stripe Connect Express** — destination charges + `on_behalf_of`
- **Smoobu API** (`https://login.smoobu.com/api`) — через абстракцию `services/pms/`
- **Vercel Functions** — деплой Express-приложения
- **Resend** — отправка транзакционных писем (внутренние счета)
- **Basic Auth** для `/admin`, **пароль + bcrypt** для `/owner`
- **zod** — валидация env и входа
- **pino** — структурированные логи

## Ключевые архитектурные решения

1. **Destination Charges**, НЕ Separate Charges. Причина: один владелец на бронь, `destination` известен заранее.
2. **Express accounts**, НЕ Standard/Custom. Причина: 100+ мелких владельцев, KYC делает Stripe.
3. **`on_behalf_of: accountId`** → MoR = владелец. Причина: снимает с платформы VAT-обязательства.
4. **Идемпотентность вебхуков** через `webhook_events` с `event.id`. Причина: Stripe повторяет доставку.
5. **Цена ВСЕГДА из Smoobu**, никогда от клиента.
6. **Комиссия ВСЕГДА из БД**, никогда из query string.
7. **Аудит комиссий** в `commission_history`.
8. **Одна цифра комиссии** (12%), включая компенсацию Stripe fee.
9. **Бронь в статусе `pending`** → `paid` через вебхук.
10. **Postgres транзакции** для мультизапросных операций.
11. **PMS: Smoobu, не Zeevou.** API включён во все платные планы, стабильность по опыту 3 аккаунтов. Заготовка под Zeevou — `services/pms/zeevou.js`.
12. **Абстракция PMS** через `services/pms/index.js`.
13. **Один домен — Madeirabook.com.** apartmadeira.com → 301-редирект.
14. **Smoobu-аккаунты владельцам НЕ выдаются.** Владельцы работают только через `/owner`. Плата €15/user за editing access не платится.
15. **API-ключ Smoobu — платформенный (один).** Все операции от имени платформы.
16. **Гость не покидает домен.** Бронирование через iframe или через твой Express-роут, не через редирект на Smoobu.
17. **Сайт Smoobu — на поддомене `stay.madeirabook.com`** через DNS (CNAME + A-записи). Каталог для гостей.
18. **Кабинет владельца — на `madeirabook.com/owner`.** Единый Express-проект на Vercel.
19. **Почта Smoobu НЕ используется для внутренних процессов.** Только для коммуникации с гостями (если вообще используется). Внутренние счета — через Resend из твоего Express-кода.
20. **Внутренний биллинг инициируется автоматически** после успешной оплаты Stripe. Бухгалтер сам взаимодействует с владельцем в своей программе, в твоей системе только фиксирует статус «закрыто».

## Схема БД (Postgres / Neon)

```

owners(id, email UNIQUE, stripe_account_id UNIQUE, stripe_customer_id,
password_hash, rnal, created_at)

properties(id, smoobu_id UNIQUE, owner_id → owners,
commission_percent NUMERIC(5,2) CHECK 0..100,
charges_enabled BOOL, pms TEXT DEFAULT 'smoobu',
type TEXT CHECK IN (apartment|hotel_room), created_at)

webhook_events(id PK, type, processed_at)

commission_history(id, property_id → properties, old_percent, new_percent,
changed_by, changed_at)

bookings(id, property_id → properties, smoobu_booking_id, stripe_session_id UNIQUE,
stripe_payment_intent, amount_cents, platform_fee_cents,
status CHECK IN (pending|paid|cancelled|refunded),
source TEXT, -- booking_channel | direct | owner_manual
guest_email, arrival_date, departure_date, created_at, updated_at)

subscription_plans(id, name, stripe_price_id UNIQUE, amount_cents, currency)

owner_subscriptions(id, owner_id → owners, stripe_subscription_id UNIQUE,
status, current_period_end, created_at, updated_at)

billing_notices(id, booking_id → bookings, property_id → properties,
owner_id → owners, amount_cents, currency,
status CHECK IN (pending_accountant_signoff|accountant_completed),
sent_at, completed_at, completed_by, notes)
-- внутренний счёт для бухгалтера

```

## Архитектура кабинета владельца (`/owner`)

```

Madeirabook.com (один Vercel-проект)
│
├── /                      → лендинг
├── /owner/*               → кабинет владельца (Express + серверный HTML)
│       ├── /login         → пароль + bcrypt
│       ├── /dashboard     → список объектов + броней
│       ├── /bookings      → все брони (Booking, Airbnb, direct, manual)
│       ├── /bookings/new  → создание брони вручную
│       ├── /bookings/:id  → отмена/редактирование
│       ├── /calendar      → календарь занятости (из Smoobu API)
│       ├── /finance       → выплаты, комиссии, Stripe Connect
│       └── /subscription  → управление подпиской €25/мес
├── /admin/*               → админка (Basic Auth)
│       └── /billing       → страница согласования внутренних счетов
├── /webhook               → Stripe вебхуки
└── /booking/:propertyId   → встроенная форма бронирования (iframe Smoobu)

```

**Что владелец видит в кабинете:**
- Брони со всех каналов
- Календарь занятости
- Финансы (выплаты, комиссии)
- Кнопка «Создать бронь» (для прямых гостей)
- Управление подпиской €25/мес
- Список внутренних счетов по своим броням (только чтение)

**Что владелец НЕ видит:**
- Интерфейс Smoobu
- Плату €15/user
- Сложность синхронизации

## Интеграция с Smoobu

**API endpoints (используются через `services/pms/smoobu.js`):**
- `GET /rates` — цены
- `POST /reservations` — создать бронь (Smoobu принимает как «booking from a booking channel», синхронизирует со всеми каналами)
- `PUT /reservations/:id` — обновить
- `DELETE /reservations/:id` — отменить
- `GET /reservations` — список броней

**Синхронизация каналов:**
- Smoobu — официальный партнёр Airbnb, двусторонняя API
- Smoobu — двусторонняя API с Booking.com
- Твой кабинет читает актуальное состояние через Smoobu API
- Овербукинга нет: Smoobu = single source of truth

## Стратегия удержания гостя на домене

**Каталог:** сайт Smoobu на `stay.madeirabook.com` (DNS CNAME + A-записи)

**Бронирование:** встроенная форма Smoobu через **iframe** на `madeirabook.com/booking/:propertyId`:
- В настройках Smoobu: Configuration → Booking Tool → Embed in Website → **HTML (iframe) code**
- Настройка Custom CSS в Booking Engine для брендинга
- Гость остаётся на `madeirabook.com`, форма внутри страницы
- Убираем ссылку «View other properties» через CSS `.iframe .show-in-iframe { visibility: hidden; }`

**Оплата:** через Stripe Checkout на `madeirabook.com` (не редирект на Smoobu)

## Внутренний биллинг (Шаг 5)

**Цель:** после успешной оплаты автоматически создать внутренний счёт и уведомить бухгалтера, владельца и тебя. Бухгалтер сам решает вопрос с владельцем в своей программе, в твоей системе только фиксирует статус «закрыто».

**Поток:**
```

Stripe webhook: checkout.session.completed (payment)
│
├── 1. Обновить bookings.status = 'paid'
├── 2. Создать запись billing_notices со статусом pending_accountant_signoff
├── 3. Отправить письмо через Resend:
│       ├── Кому: ACCOUNTANT_EMAIL (твой бухгалтер)
│       ├── Копия: owner.email + ADMIN_EMAIL
│       └── Тема: [Madeirabook] Внутренний счёт #<bookingId> — €<amount>
└── 4. Бухгалтер заходит в /admin/billing и жмёт «Отметить закрытым»
└── status → accountant_completed, completed_at = NOW()

```

**Почему не почта Smoobu:**
- Smoobu не умеет триггериться на события Stripe
- Smoobu требует @host.smoobu.com для PDF-счетов — бренд виден
- Smoobu не имеет механизма «статус согласования»

**Реализация:**
- Таблица `billing_notices` (см. схему БД)
- Сервис `src/services/notifications.js` (Resend API)
- Страница `/admin/billing` — список `pending_accountant_signoff` + кнопка закрытия
- Письма уходят от `billing@madeirabook.com`

## Структура проекта

```

/
package.json
.env.example
PROJECT.md
db/
schema.sql
client.js
migrate.js
src/
config.js
app.js
logger.js
middleware/
auth.js               ← Basic Auth для /admin
ownerAuth.js          ← сессия для /owner (пароль + bcrypt)
errorHandler.js
services/
pms/
index.js
smoobu.js
zeevou.js
stripe.js
commission.js
notifications.js      ← Resend (внутренние счета)
subscriptions.js      ← Шаг 5
routes/
admin.js
owner.js
checkout.js
webhook.js
pages.js
views/
owner/
login.html
dashboard.html
bookings.html
calendar.html
finance.html

```

## Порядок внедрения

**Шаг 1 — Основа:** БД + config + auth (admin + owner) + logger + middleware
**Шаг 2 — Сервисы:** pms/index.js, pms/smoobu.js, stripe.js, commission.js
**Шаг 3 — Роуты публичные:** checkout, webhook, pages, iframe-форма бронирования
**Шаг 4 — Кабинет владельца:** /owner/login, /owner/dashboard, /owner/bookings, /owner/calendar
**Шаг 5 — Подписки + внутренний биллинг:**
- subscriptions.js (€25/мес)
- notifications.js (Resend)
- billing_notices + /admin/billing
- Автосоздание внутреннего счёта в webhook

## Экономика (пример: бронь €1000, комиссия 12%)

```

Гость платит:                       €1000.00
Stripe processing fee (~1.5%):       −€15.00   ← с платформенного баланса
──────────────────────────────────────────────
Владельцу уходит:                     €880.00
Платформе (application_fee):          €120.00
Платформе net с брони:                €104.93
Плюс подписка:                         €25.00/мес
Плюс net с подписки:                  ~€24.10/мес

```

### Экономика на 30 и 50 объектов

**30 объектов (10 твоих + 20 платящих):**
- Smoobu: 30 × €11 = €330
- Stripe Connect: 20 × €2 = €40
- Infra: ~€5
- Доход с подписок: 20 × €25 = €500
- **Net без броней: +€125/мес**
- С 10% прямых броней: **+€200/мес**

**50 объектов (10 твоих + 40 платящих):**
- Smoobu: 50 × €11 = €550
- Stripe Connect: 40 × €2 = €80
- Infra: ~€5
- Доход с подписок: 40 × €25 = €1000
- **Net без броней: +€365/мес**
- С 10% прямых броней: **+€485/мес**

## Что платит платформа (я)

| Статья | Стоимость | Откуда |
|---|---|---|
| Stripe processing fee | ~1.5% + €0.25 | Stripe balance |
| Stripe Connect fee | €2 / активный Express / мес | Stripe balance |
| Neon Postgres | Free → $19/мес | Отдельно |
| Vercel | Hobby → $20/мес | Отдельно |
| Resend | Free (3000 писем/мес) → $20/мес | Отдельно |
| Домен + поддомены | ~€15/год | Отдельно |
| Smoobu | €11 / объект / мес | Отдельно |
| Бухгалтер / legal (PT) | €50–150/мес | Отдельно |

## Что платит владелец

- Комиссия 12% с каждой брони
- Подписка €25/мес (× количество номеров для отелей)
- Свои налоги (IRS Cat. B, IVA 5%)
- Фискальные документы гостям — **сам, через своего бухгалтера**

## Что платит гость

- Стоимость брони
- **Ничего сверху** — комиссия уже включена в цену

## Юридические обязательства

**Владельцы:**
- RNAL (Alojamento Local)
- Фискальные документы (certified software с номером AT)
- SAF-T PT ежемесячно
- IRS Cat. B (35% выручки облагается)
- IVA 5% на проживание
- **Взаимодействие со своим бухгалтером** — самостоятельно

**Платформа:**
- DAC7 reporting в AT
- Проверка RNAL перед листингом
- Хранение истории транзакций
- **Внутренний биллинг** — генерация счёта, отправка, фиксация закрытия

## Stripe Dashboard — настройка вебхуков

URL: `https://madeirabook.com/webhook`

**Основные события:**
- `account.updated`
- `checkout.session.completed`
- `checkout.session.expired`
- `charge.refunded`

**События для Шага 5 (подписки):**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.payment_succeeded`

## DNS-настройка

| Домен | Куда |
|---|---|
| `madeirabook.com` | Vercel (твой Express) |
| `www.madeirabook.com` | 301 → madeirabook.com |
| `stay.madeirabook.com` | CNAME → Smoobu (каталог) |
| `apartmadeira.com` | 301 → madeirabook.com |

## Переменные окружения (.env)

```

Stripe

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

Smoobu

SMOOBU_API_KEY=

Neon Postgres

DATABASE_URL=

Admin

ADMIN_USER=
ADMIN_PASS=
ADMIN_EMAIL=

Owner auth

SESSION_SECRET=

Resend

RESEND_API_KEY=

Billing

ACCOUNTANT_EMAIL=

App

APP_URL=https://madeirabook.com
NODE_ENV=production

```

## Тест-сценарии перед запуском

- [ ] Новый владелец → онбординг Stripe → `charges_enabled = true`
- [ ] Бронь → Checkout → оплата тестовой картой `4242 4242 4242 4242` → Smoobu paid
- [ ] Истечение Checkout → бронь отменена в Smoobu
- [ ] Refund → бронь отменена
- [ ] Дубликат вебхука → не обрабатывается дважды
- [ ] Изменение комиссии → запись в `commission_history`
- [ ] `/admin` без пароля → 401
- [ ] `/owner` без логина → редирект на `/owner/login`
- [ ] Гость бронирует через iframe → остаётся на madeirabook.com
- [ ] Владелец создаёт бронь вручную через `/owner/bookings/new` → появляется в Smoobu
- [ ] Владелец не имеет Smoobu-аккаунта, но видит свои брони
- [ ] (Шаг 5) После оплаты создаётся `billing_notices` + уходит письмо бухгалтеру
- [ ] (Шаг 5) Бухгалтер жмёт «Закрыть» → статус `accountant_completed`
- [ ] (Шаг 5) Владелец без подписки → кабинет блокируется

## Что ещё НЕ сделано (можно позже)

- Rate limiting на `/create-booking-and-pay`
- CSRF-защита на формах `/admin` и `/owner`
- Sentry для мониторинга
- Unit + E2E тесты
- Email-уведомления владельцам о новых бронях
- Backup-стратегия Neon
- 2FA для админа
- DAC7-отчёт
- Мультиязычность (PT, EN, RU)
- Кабинет для отелей с несколькими номерами
- Magic-link для входа владельцев (сейчас пароль + bcrypt)
- Генерация PDF внутреннего счёта (сейчас письмо без вложения)

## Как продолжить работу со мной (AI)

В начале каждой новой сессии пиши:

> «Прочитай PROJECT.md, продолжаем»

И укажи:
1. Что делали в прошлый раз
2. Что застряло / ошибка
3. Что нужно сделать сейчас

## Журнал решений

- **2026-09-11:** Зафиксирован стек (Express + Neon + Stripe Connect Express).
  Комиссия 12%. Подписка €25/мес. MoR = владелец. Идемпотентность через `webhook_events`.

- **2026-09-11 (позже):** Финальное решение по PMS и доменам.
  PMS: только Smoobu. Zeevou закрыт. Домен: только Madeirabook.com.

- **2026-09-11 (вечер):** Архитектура с кабинетом владельца.
  - Владельцы работают только через `/owner`, Smoobu-аккаунты им не выдаются.
  - API-ключ Smoobu — платформенный (один).
  - Сайт Smoobu — на `stay.madeirabook.com` (каталог).
  - Бронирование — через iframe на `madeirabook.com`, гость не уходит на Smoobu.
  - Отели (5–10 номеров) — тип `hotel_room`, каждый номер = unit в Smoobu.
  - Добавлено поле `type` в `properties`, `source` в `bookings`.
  - Stripe Connect Express для автоматических выплат владельцам.
  - Аутентификация владельца: пароль + bcrypt.

- **2026-09-11 (ночь):** Внутренний биллинг.
  - Отдельная таблица `billing_notices` для внутренних счетов.
  - Триггер: Stripe webhook `checkout.session.completed`.
  - Отправка через Resend (не через Smoobu).
  - Бухгалтер сам решает вопрос с владельцем в своей программе,
    в системе фиксирует статус через `/admin/billing`.
  - Владельцы сами работают со своими бухгалтерами.
  - Добавлен сервис `notifications.js`.
  - Шаг 5: подписки + внутренний биллинг.
```

---

Что делать

1. Скопируй весь блок выше в PROJECT.md на GitHub (Edit → вставить → Commit)
2. Скажи «го Шаг 1, вариант А» — выдам полный код Шага 1 (10 файлов) одним блоком

Готов к Шагу 1?

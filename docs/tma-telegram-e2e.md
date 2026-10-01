# TMA: e2e-проверка в реальном Telegram через cloudflared

Как открыть Mini App (`/tma/`) в настоящем клиенте Telegram, когда Express работает
локально на `localhost:3000`. Публичный HTTPS-адрес даёт quick tunnel cloudflared
(`*.trycloudflare.com`, без аккаунта Cloudflare).

## 0. Что нужно

- Заполненный `.env` в корне репозитория (`src/config.js` читает его через `dotenv`).
  Для этой проверки важен настоящий `TELEGRAM_BOT_TOKEN` того бота, из которого
  открывается Mini App: `validateInitData()` (`src/services/telegramAuth.js`) проверяет
  подпись initData этим токеном. С чужим или фиктивным токеном любой запрос из
  Telegram получит 401.
- `DATABASE_URL` на ту же базу Neon, где лежат тестовые брони.
- Доступ к боту в @BotFather.

Для e2e без внешних сервисов можно добавить в env процесса:
`STRIPE_MOCK=true SMOOBU_MOCK=true TELEGRAM_MOCK=true PRICE_MOCK=500`.

## 1. Установить cloudflared

macOS:

```bash
brew install cloudflared
cloudflared --version
```

Ubuntu/Debian (x86_64), фиксированная версия:

```bash
curl -sSLfo /tmp/cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/download/2026.9.1/cloudflared-linux-amd64.deb
sudo dpkg -i /tmp/cloudflared.deb
cloudflared --version   # cloudflared version 2026.9.1
```

## 2. Запустить приложение

```bash
cd madeirabook
npm start                       # Express на :3000, логи pino в stdout
curl -s localhost:3000/health   # {"status":"ok",...}
```

## 3. Поднять туннель

Во втором терминале:

```bash
cloudflared tunnel --no-autoupdate --url http://localhost:3000
```

В выводе появится строка вида:

```
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://<random-words>.trycloudflare.com
```

Если вывод перенаправлен в файл:

```bash
cloudflared tunnel --no-autoupdate --url http://localhost:3000 > cloudflared.log 2>&1 &
rg -o 'https://[a-z0-9-]+\.trycloudflare\.com' cloudflared.log | head -1
```

Проверка снаружи (подставить свой URL):

```bash
U=https://<random-words>.trycloudflare.com
for p in /tma/ /tma/my.html /tma/app.js /tma/style.css /health; do
  curl -s -o /dev/null -w "$p %{http_code} %{content_type}\n" "$U$p"
done
```

Ожидается 200 на всех пяти путях.

Особенности quick tunnel:
- адрес новый при каждом запуске — после перезапуска cloudflared нужно заново
  поменять Menu Button (шаг 4);
- туннель живёт, пока работает процесс cloudflared.

## 4. Переключить Menu Button на туннель

### Через @BotFather

`/mybots` → выбрать бота → **Bot Settings** → **Menu Button** → отправить URL
(`$U/tma/` или `$U/tma/my.html`) → отправить подпись кнопки (например, `Мои брони`).

### Через Bot API (то же самое одной командой)

```bash
U=https://<random-words>.trycloudflare.com
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setChatMenuButton" \
  -H 'Content-Type: application/json' \
  -d "{\"menu_button\":{\"type\":\"web_app\",\"text\":\"Мои брони\",\"web_app\":{\"url\":\"$U/tma/my.html\"}}}"
# {"ok":true,"result":true}

# Проверить текущую кнопку:
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getChatMenuButton"
```

Вернуть кнопку по умолчанию (после проверки, туннель всё равно умрёт):

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setChatMenuButton" \
  -H 'Content-Type: application/json' \
  -d '{"menu_button":{"type":"default"}}'
```

Клиент Telegram может кешировать кнопку: если открывается старый адрес —
закрыть и заново открыть чат с ботом.

## 5. Проверка в Telegram

1. Menu Button → `$U/tma/`. Открыть чат с ботом → кнопка меню. На странице
   «Mini App works» должны быть `initData length: <N>` с N > 0 и `user id: <ваш id>`.
2. Тестовая бронь привязана к `guest_telegram_id = 900000003` — это не настоящий
   аккаунт, поэтому у реального пользователя список будет пустым («У вас ещё нет
   броней»). Чтобы увидеть бронь, привязать её к своему id из п. 1:

   ```sql
   UPDATE bookings SET guest_telegram_id = <ваш id>, updated_at = NOW() WHERE id = 2;
   ```

   Вернуть после проверки:

   ```sql
   UPDATE bookings SET guest_telegram_id = 900000003, updated_at = NOW() WHERE id = 2;
   ```

3. Menu Button → `$U/tma/my.html`. Ожидается карточка «Бронь #2», объект, даты
   заезда/выезда, сумма в €, статус по-русски.
4. В логе Express должен быть запрос `GET /api/bookings/my` со статусом 200.

## 6. Поддельная initData → 401

```bash
U=https://<random-words>.trycloudflare.com

# мусор
curl -s -w ' [HTTP %{http_code}]\n' -H 'X-Telegram-Init-Data: garbage' "$U/api/bookings/my"

# корректный формат, неверный hash
FORGED="user=%7B%22id%22%3A900000003%2C%22first_name%22%3A%22Test%22%7D&auth_date=$(date +%s)&hash=$(printf '0%.0s' {1..64})"
curl -s -w ' [HTTP %{http_code}]\n' -H "X-Telegram-Init-Data: $FORGED" "$U/api/bookings/my"

# без заголовка
curl -s -w ' [HTTP %{http_code}]\n' "$U/api/bookings/my"
```

Все три: `{"ok":false,"error":"invalid_init_data"} [HTTP 401]`.

Можно также взять настоящую initData из Telegram и поменять в ней один символ
(например, `first_name`) — подпись перестанет сходиться, тоже 401.

## 7. Где смотреть логи

- **Express** — stdout `npm start` (pino, JSON; при `NODE_ENV=development` — pino-pretty).
  Заголовки `x-telegram-init-data`, `authorization`, `stripe-signature` вырезаются
  из лога (`redact` в `src/app.js`), поэтому initData в логе не будет.
- **cloudflared** — stdout процесса туннеля: адрес туннеля и ошибки соединения
  с `localhost:3000`.
- **Webview Telegram** — консоль страницы (`initData length`, ошибки JS). В Telegram
  Desktop нужно включить инспектирование webview в экспериментальных настройках;
  на Android — отладка WebView через `chrome://inspect`.

## 8. Погасить

```bash
# Ctrl+C в терминалах cloudflared и npm start, либо:
pkill -x cloudflared
```

Затем вернуть Menu Button по умолчанию (шаг 4) и, если меняли, `guest_telegram_id`
у брони 2 (шаг 5).

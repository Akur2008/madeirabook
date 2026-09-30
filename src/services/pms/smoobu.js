// Клиент Smoobu API (https://docs.smoobu.com) с HMAC-аутентификацией.
// Legacy-заголовок `Api-Key` Smoobu отключает, поэтому каждый запрос подписывается
// парой SMOOBU_API_KEY / SMOOBU_API_SECRET.
const crypto = require('crypto');
const https = require('https');
const config = require('../../config');

const HOST = 'login.smoobu.com';
const REQUEST_TIMEOUT_MS = 10000;

// SHA-256 (hex) пустой строки — хэш тела для запросов без body (GET, DELETE).
const EMPTY_BODY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

// Статусы оплаты в Smoobu (price/prepayment/deposit status).
const PAYMENT_STATUS = { OPEN: 0, PAID: 1 };

/**
 * Кодирование по RFC 3986: пробел → %20, а также !'()* экранируются.
 * Smoobu требует именно такое кодирование ключей и значений в canonical string.
 */
function rfc3986(value) {
  return encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

/**
 * Собирает query string: пары key=value, отсортированные по ключу (затем по значению).
 * Массивы разворачиваются в повторяющиеся ключи с суффиксом [] (apartments[]=1&apartments[]=2).
 * Одна и та же строка используется и в URL, и в canonical string.
 */
function buildQueryString(queryObj) {
  if (!queryObj) return '';
  const pairs = [];
  Object.keys(queryObj).forEach((key) => {
    const value = queryObj[key];
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => pairs.push([rfc3986(key + '[]'), rfc3986(v)]));
    } else {
      pairs.push([rfc3986(key), rfc3986(value)]);
    }
  });
  pairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
  return pairs.map(([k, v]) => k + '=' + v).join('&');
}

/**
 * Canonical string для подписи — 7 строк через \n:
 * METHOD, PATH, QUERY, TIMESTAMP, NONCE, SHA256_HEX(BODY), API_KEY.
 */
function buildCanonicalString({ method, path, query, timestamp, nonce, bodyHash, apiKey }) {
  return [method, path, query || '', timestamp, nonce, bodyHash, apiKey].join('\n');
}

/**
 * Подпись: Base64(HMAC-SHA256(API_SECRET, canonical)).
 */
function sign(canonical, secret) {
  return crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('base64');
}

/**
 * Формирует HMAC-заголовки для запроса.
 * Вынесено отдельно, чтобы подпись можно было проверить без сетевого вызова.
 */
function buildAuthHeaders({ method, path, query, bodyStr, apiKey, apiSecret, timestamp, nonce }) {
  const ts = timestamp || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const n = nonce || crypto.randomUUID();
  const bodyHash = bodyStr
    ? crypto.createHash('sha256').update(bodyStr, 'utf8').digest('hex')
    : EMPTY_BODY_HASH;
  const canonical = buildCanonicalString({
    method, path, query, timestamp: ts, nonce: n, bodyHash, apiKey,
  });
  return {
    'X-API-Key': apiKey,
    'X-Timestamp': ts,
    'X-Nonce': n,
    'X-Signature': sign(canonical, apiSecret),
  };
}

/**
 * Универсальный подписанный запрос к Smoobu API.
 * @param {string} method - HTTP-метод
 * @param {string} path - путь от корня хоста, например '/api/reservations'
 * @param {object} [bodyObj] - JSON-тело
 * @param {object} [queryObj] - query-параметры (массивы поддерживаются)
 * @returns {Promise<object>} распарсенный JSON-ответ
 */
function smoobuRequest(method, path, bodyObj, queryObj) {
  const bodyStr = bodyObj ? JSON.stringify(bodyObj) : '';
  const query = buildQueryString(queryObj);

  const headers = {
    ...buildAuthHeaders({
      method,
      path,
      query,
      bodyStr,
      apiKey: config.SMOOBU_API_KEY,
      apiSecret: config.SMOOBU_API_SECRET,
    }),
    Accept: 'application/json',
  };
  if (bodyStr) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(bodyStr);
  }

  const options = {
    hostname: HOST,
    port: 443,
    path: path + (query ? '?' + query : ''),
    method,
    headers,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
          return;
        }
        // Smoobu возвращает ошибки в формате { status, title, detail, validation_messages }.
        const detail = parsed.validation_messages || parsed.detail || parsed;
        const err = new Error(
          `Smoobu ${method} ${path} → ${res.statusCode}: ${JSON.stringify(detail).slice(0, 300)}`
        );
        err.status = res.statusCode;
        err.body = parsed;
        if (res.statusCode === 429) {
          // Лимит 700 запросов/мин; заголовок X-RateLimit-Retry-After — unix-время, когда можно повторить.
          err.retryAfter = res.headers['x-ratelimit-retry-after'];
        }
        reject(err);
      });
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Smoobu ${method} ${path}: timeout ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Список ночей проживания: [arrivalDate, departureDate) в формате YYYY-MM-DD.
 */
function listNights(arrivalDate, departureDate) {
  const start = new Date(arrivalDate + 'T00:00:00Z');
  const end = new Date(departureDate + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error(`Некорректный период: ${arrivalDate} — ${departureDate}`);
  }
  const nights = [];
  for (let d = start; d < end; d = new Date(d.getTime() + 86400000)) {
    nights.push(d.toISOString().slice(0, 10));
  }
  return nights;
}

// ─── Пользователь ───────────────────────────────────────────────────────────

/**
 * Текущий пользователь Smoobu (GET /api/me): { id, firstName, lastName, email }.
 * id нужен как customerId для checkAvailability.
 */
async function getMe() {
  return smoobuRequest('GET', '/api/me');
}

// ─── Объекты ────────────────────────────────────────────────────────────────

/**
 * Список объектов (GET /api/apartments): { apartments: [{ id, name }] }.
 */
async function getApartments() {
  return smoobuRequest('GET', '/api/apartments');
}

/**
 * Детали объекта (GET /api/apartments/{id}).
 */
async function getApartment(id) {
  return smoobuRequest('GET', `/api/apartments/${encodeURIComponent(id)}`);
}

// ─── Цены и доступность ─────────────────────────────────────────────────────

/**
 * Посуточные тарифы (GET /api/rates).
 * @param {Array<string|number>|string|number} apartmentIds
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD (включительно)
 * @returns {Promise<object>} { data: { [apartmentId]: { [date]: { price, min_length_of_stay, available } } } }
 */
async function getRates(apartmentIds, startDate, endDate) {
  const apartments = Array.isArray(apartmentIds) ? apartmentIds : [apartmentIds];
  return smoobuRequest('GET', '/api/rates', null, {
    apartments,
    start_date: startDate,
    end_date: endDate,
  });
}

/**
 * Создать/обновить тарифы (POST /api/rates).
 * @param {Array<number>} apartmentIds
 * @param {Array<{dates: string[], daily_price?: number, min_length_of_stay?: number}>} operations
 */
async function updateRates(apartmentIds, operations) {
  return smoobuRequest('POST', '/api/rates', { apartments: apartmentIds, operations });
}

/**
 * Проверка доступности с учётом ограничений booking tool
 * (POST /booking/checkApartmentAvailability).
 * @param {object} p
 * @param {string} p.arrivalDate
 * @param {string} p.departureDate
 * @param {Array<number>} p.apartments - пустой массив = все объекты
 * @param {number} p.customerId - id пользователя Smoobu (см. getMe)
 * @param {number} [p.guests]
 * @param {string} [p.discountCode]
 * @returns {Promise<object>} { availableApartments, prices, errorMessages }
 */
async function checkAvailability(p) {
  return smoobuRequest('POST', '/booking/checkApartmentAvailability', {
    arrivalDate: p.arrivalDate,
    departureDate: p.departureDate,
    apartments: (p.apartments || []).map(Number),
    customerId: Number(p.customerId),
    guests: p.guests,
    discountCode: p.discountCode,
  });
}

/**
 * Итоговая стоимость проживания: сумма посуточных цен за ночи [arrival, departure).
 * Бросает ошибку, если хотя бы одна ночь недоступна, без цены,
 * или не выполнен минимальный срок проживания.
 * @returns {Promise<number>}
 */
async function getPrice(propertyId, arrivalDate, departureDate) {
  const nights = listNights(arrivalDate, departureDate);
  const res = await getRates(propertyId, nights[0], nights[nights.length - 1]);
  const days = res && res.data && res.data[String(propertyId)];
  if (!days) {
    throw new Error('Smoobu не вернул тарифы для объекта ' + propertyId + ': ' + JSON.stringify(res).slice(0, 300));
  }

  const firstNight = days[nights[0]];
  const minStay = firstNight && firstNight.min_length_of_stay;
  if (minStay && nights.length < minStay) {
    throw new Error(`Минимальный срок проживания — ${minStay} ноч., запрошено ${nights.length}`);
  }

  let total = 0;
  for (const date of nights) {
    const day = days[date];
    if (!day || !day.available) {
      throw new Error(`Объект ${propertyId} недоступен на ${date}`);
    }
    const price = Number(day.price);
    if (day.price == null || !Number.isFinite(price)) {
      throw new Error(`Smoobu не вернул цену объекта ${propertyId} на ${date}`);
    }
    total += price;
  }
  return Math.round(total * 100) / 100;
}

// ─── Бронирования ───────────────────────────────────────────────────────────

/**
 * Создание брони (POST /api/reservations).
 * @param {object} p
 * @param {string|number} p.propertyId - apartmentId в Smoobu
 * @param {string} p.arrivalDate - YYYY-MM-DD
 * @param {string} p.departureDate - YYYY-MM-DD
 * @param {string} [p.guestName] - полное имя; делится на firstName/lastName
 * @param {string} [p.guestEmail]
 * @param {string} [p.guestPhone]
 * @param {number} [p.adults=2]
 * @param {number} [p.children]
 * @param {number} [p.price] - итоговая стоимость брони
 * @param {number} [p.channelId] - канал Smoobu (по умолчанию Smoobu использует 70)
 * @param {string} [p.language] - en, de, pt, ...
 * @param {string} [p.notice]
 * @returns {Promise<number>} id брони в Smoobu
 */
async function createReservation(p) {
  const nameParts = String(p.guestName || 'Guest').trim().split(/\s+/);
  const body = {
    apartmentId: Number(p.propertyId),
    arrivalDate: p.arrivalDate,
    departureDate: p.departureDate,
    channelId: p.channelId != null ? Number(p.channelId) : undefined,
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(' '),
    email: p.guestEmail,
    phone: p.guestPhone,
    adults: p.adults != null ? Number(p.adults) : 2,
    children: p.children != null ? Number(p.children) : undefined,
    price: p.price != null ? Number(p.price) : undefined,
    // Бронь создаётся до оплаты в Stripe — оплата отмечается позже через markPaid.
    priceStatus: p.price != null ? PAYMENT_STATUS.OPEN : undefined,
    language: p.language,
    notice: p.notice,
  };
  const res = await smoobuRequest('POST', '/api/reservations', body);
  if (!res || !res.id) throw new Error('Smoobu не вернул ID брони: ' + JSON.stringify(res));
  return res.id;
}

/**
 * Одна бронь (GET /api/reservations/{id}).
 */
async function getReservation(smoobuBookingId) {
  return smoobuRequest('GET', `/api/reservations/${encodeURIComponent(smoobuBookingId)}`);
}

/**
 * Список броней (GET /api/reservations).
 * @param {object} [filters] - query-параметры Smoobu: from, to, apartmentId, page, pageSize, ...
 */
async function getReservations(filters) {
  return smoobuRequest('GET', '/api/reservations', null, filters);
}

/**
 * Частичное обновление брони (PUT /api/reservations/{id}).
 * Допустимые поля: arrivalTime, departureTime, price, priceStatus, prepayment,
 * prepaymentStatus, deposit, depositStatus, guestName, guestEmail, guestPhone,
 * notice, assistantNotice, adults, children, language.
 */
async function updateReservation(smoobuBookingId, fields) {
  return smoobuRequest('PUT', `/api/reservations/${encodeURIComponent(smoobuBookingId)}`, fields);
}

/**
 * Отметить бронь оплаченной (priceStatus = 1).
 */
async function markPaid(smoobuBookingId) {
  return updateReservation(smoobuBookingId, { priceStatus: PAYMENT_STATUS.PAID });
}

/**
 * Отменить бронь (DELETE /api/reservations/{id}).
 * В Smoobu бронь остаётся в системе со статусом «отменена».
 */
async function cancelReservation(smoobuBookingId) {
  return smoobuRequest('DELETE', `/api/reservations/${encodeURIComponent(smoobuBookingId)}`);
}

module.exports = {
  PAYMENT_STATUS,
  buildQueryString,
  buildCanonicalString,
  buildAuthHeaders,
  smoobuRequest,
  getMe,
  getApartments,
  getApartment,
  getRates,
  updateRates,
  checkAvailability,
  getPrice,
  createReservation,
  getReservation,
  getReservations,
  updateReservation,
  markPaid,
  cancelReservation,
};

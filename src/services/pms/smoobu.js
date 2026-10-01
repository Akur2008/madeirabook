const crypto = require('crypto');
const https = require('https');
const config = require('../../config');

// SHA-256 hex hash пустого тела — используется для GET без body
const EMPTY_BODY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * Формирует правильный canonical string для подписи Smoobu.
 * 6 строк через \n: METHOD, PATH, QUERY, TIMESTAMP, NONCE, SHA256(BODY)
 */
function buildCanonicalString(method, path, query, timestamp, nonce, bodyHash) {
  return [method, path, query || '', timestamp, nonce, bodyHash].join('\n');
}

/**
 * Подпись: HMAC-SHA256(secret, canonical) → Base64.
 */
function sign(canonical) {
  return crypto
    .createHmac('sha256', config.SMOOBU_API_SECRET)
    .update(canonical, 'utf8')
    .digest('base64');
}

/**
 * Base URL без /api — добавляем в каждом запросе.
 */
const HOST = 'login.smoobu.com';

/**
 * Универсальный запрос к Smoobu API с HMAC-подписью.
 */
async function smoobuRequest(method, path, bodyObj, queryObj) {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = crypto.randomUUID();
  const bodyStr = bodyObj ? JSON.stringify(bodyObj) : '';
  const bodyHash = bodyStr
    ? crypto.createHash('sha256').update(bodyStr, 'utf8').digest('hex')
    : EMPTY_BODY_HASH;

  // Query string — сортируем ключи по алфавиту
  let query = '';
  if (queryObj && Object.keys(queryObj).length) {
    const params = new URLSearchParams();
    Object.keys(queryObj).sort().forEach((k) => {
      if (queryObj[k] !== undefined && queryObj[k] !== null) {
        params.append(k, String(queryObj[k]));
      }
    });
    query = params.toString();
  }

  const canonical = buildCanonicalString(method, path, query, timestamp, nonce, bodyHash);
  const signature = sign(canonical);

  const urlPath = path + (query ? '?' + query : '');

  const options = {
    hostname: HOST,
    port: 443,
    path: urlPath,
    method,
    headers: {
      'X-API-Key': config.SMOOBU_API_KEY,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Signature': signature,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try { parsed = data ? JSON.parse(data) : {}; } catch { parsed = { raw: data }; }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          const err = new Error(`Smoobu ${res.statusCode}: ${JSON.stringify(parsed).slice(0, 300)}`);
          err.status = res.statusCode;
          err.body = parsed;
          reject(err);
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Забирает список объектов (apartments) из Smoobu.
 */
async function getApartments() {
  return smoobuRequest('GET', '/api/apartments');
}

/**
 * Забирает один объект по id.
 */
async function getApartment(id) {
  return smoobuRequest('GET', `/api/apartments/${id}`);
}

/**
 * Цена за период.
 */
async function getPrice(propertyId, arrivalDate, departureDate) {
  const res = await smoobuRequest('GET', '/api/rates', null, {
    apartments: propertyId,
    arrivalDate,
    departureDate,
  });
  const price = res && res.totalPrice != null ? res.totalPrice : null;
  if (!Number.isFinite(Number(price))) {
    throw new Error('Smoobu вернул некорректную цену: ' + JSON.stringify(res));
  }
  return Number(price);
}

/**
 * Создание брони.
 */
async function createReservation(p) {
  const body = {
    apartmentId: Number(p.propertyId),
    arrivalDate: p.arrivalDate,
    departureDate: p.departureDate,
    firstName: p.guestName || 'Guest',
    lastName: '',
    email: p.guestEmail,
    adults: 2,
  };
  const res = await smoobuRequest('POST', '/api/reservations', body);
  if (!res || !res.id) throw new Error('Smoobu не вернул ID брони: ' + JSON.stringify(res));
  return res.id;
}

/**
 * Отметить бронь оплаченной.
 */
async function markPaid(smoobuBookingId) {
  if (process.env.SMOOBU_MOCK === 'true') {
    return { ok: true, mock: true };
  }
  return smoobuRequest('PUT', `/api/reservations/${smoobuBookingId}`, { paid: true });
}

/**
 * Отменить бронь.
 */
async function cancelReservation(smoobuBookingId) {
  return smoobuRequest('PUT', `/api/reservations/${smoobuBookingId}`, { status: 'cancelled' });
}

module.exports = {
  getApartments,
  getApartment,
  getPrice,
  createReservation,
  markPaid,
  cancelReservation,
};

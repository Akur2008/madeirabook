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
  return [method, path, query || '', timestamp, nonce, bodyHash, config.SMOOBU_API_KEY].join('\n');
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
      'Content-Length': Buffer.byteLength(bodyStr || '', 'utf8'),
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
  const customerId = Number(config.SMOOBU_USER_ID);
  const body = {
    arrivalDate,
    departureDate,
    apartments: [Number(propertyId)],
    customerId,
  };
  const res = await smoobuRequest('POST', '/booking/checkApartmentAvailability', body);
  const prices = res && res.prices ? res.prices : {};
  const entry = prices[String(propertyId)] || prices[Number(propertyId)];
  if (!entry || !Number.isFinite(Number(entry.price))) {
    const errs = res && res.errorMessages ? res.errorMessages : {};
    const reason = errs[String(propertyId)] ? JSON.stringify(errs[String(propertyId)]) : JSON.stringify(res);
    throw new Error('Smoobu не вернул цену: ' + reason);
  }
  return Number(entry.price);
}

/**
 * Массовая проверка доступности + цены для списка объектов.
 * Возвращает { [id]: { available: bool, price?: number, currency?: string } }.
 */
async function checkAvailability(apartmentIds, arrivalDate, departureDate) {
  const customerId = Number(config.SMOOBU_USER_ID);
  const ids = (apartmentIds || []).map(Number).filter(Number.isFinite);
  if (!ids.length) return {};
  const body = { arrivalDate, departureDate, apartments: ids, customerId };
  const res = await smoobuRequest('POST', '/booking/checkApartmentAvailability', body);
  const prices = (res && res.prices) || {};
  const errors = (res && res.errorMessages) || {};
  const result = {};
  for (const id of ids) {
    const key = String(id);
    const entry = prices[key];
    if (entry && Number.isFinite(Number(entry.price))) {
      result[id] = { available: true, price: Number(entry.price), currency: entry.currency || 'EUR' };
    } else {
      result[id] = { available: false, reason: errors[key] || null };
    }
  }
  return result;
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
    lastName: p.lastName || '-',
    email: p.guestEmail,
    phone: p.phone || '-',
    country: p.country || 'PT',
    address: {
      street: p.street || '-',
      postalCode: p.postalCode || '-',
      location: p.location || '-'
    },
    arrivalTime: p.arrivalTime || '15:00',
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
  if (process.env.SMOOBU_MOCK === 'true') {
    return { ok: true, mock: true };
  }
  return smoobuRequest('PUT', `/api/reservations/${smoobuBookingId}`, { status: 'cancelled' });
}

/**
 * Список броней (reservations) за период.
 * @param {string} from — YYYY-MM-DD
 * @param {string} to — YYYY-MM-DD
 * @param {number[]} apartmentIds — опционально, массив ID объектов
 * @returns {Promise<{total_items:number, bookings:Array}>}
 */
async function getReservations(from, to, apartmentIds, pageSize) {
  const query = { from, to, pageSize: pageSize || 100 };
  if (apartmentIds && apartmentIds.length) {
    query.apartments = apartmentIds.join(',');
  }
  return smoobuRequest('GET', '/api/reservations', null, query);
}

/**
 * Цены по дням для объекта.
 * @param {number[]} apartmentIds — массив ID объектов
 * @param {string} startDate — YYYY-MM-DD
 * @param {string} endDate — YYYY-MM-DD
 * @returns {Promise<{data:{[apartmentId]:{[date]:{price,min_length_of_stay,available}}}}>}
 */
async function getRates(apartmentIds, startDate, endDate) {
  // API отдаёт только первый объект из массива — делаем N запросов и мержим
  const merged = { data: {} };
  for (const aptId of apartmentIds) {
    try {
      const query = {
        'apartments[]': String(aptId),
        'end_date': endDate,
        'start_date': startDate
      };
      const r = await smoobuRequest('GET', '/api/rates', null, query);
      if (r && r.data) {
        Object.assign(merged.data, r.data);
      }
    } catch (e) {
      // Логируем и продолжаем — остальные объекты важнее
      console.warn('getRates failed for apt', aptId, e.message);
    }
    // Небольшая пауза между запросами — rate limit
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return merged;
}

/**
 * Установить цены для объекта на список дат.
 * @param {number[]} apartmentIds
 * @param {string[]} dates — массив YYYY-MM-DD
 * @param {number} dailyPrice
 * @param {number} minLengthOfStay
 */
async function setRates(apartmentIds, arrivalDate, departureDate, price, minNights) {
  const operation = {
    dates: [arrivalDate + ':' + departureDate],
    daily_price: price
  };
  if (minNights && minNights > 0) {
    operation.min_length_of_stay = minNights;
  }
  const body = {
    customerId: Number(config.SMOOBU_USER_ID),
    apartments: apartmentIds,
    operations: [operation]
  };
  return smoobuRequest('POST', '/api/rates', body);
}

module.exports = {
  checkAvailability,
  getRates,
  setRates,
  getReservations,
  getApartments,
  getApartment,
  getPrice,
  createReservation,
  markPaid,
  cancelReservation,
};

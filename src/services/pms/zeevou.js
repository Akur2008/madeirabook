const crypto = require('crypto');
const https = require('https');
const logger = require('../../logger');

// База URL — переключается через env (sandbox / live)
const BASE = process.env.ZEEVOU_BASE_URL || process.env.ZEEVOU_SANDBOX_URL || 'https://sandbox.zeevou.com';
const HOST = new URL(BASE).hostname;

/**
 * Персональный токен из env (OAuth flow — отдельная задача).
 */
function getToken() {
  const token = process.env.ZEEVOU_API_TOKEN;
  if (!token) throw new Error('ZEEVOU_API_TOKEN missing');
  return token;
}

/**
 * Универсальный HTTPS-запрос к Zeevou API (Bearer).
 * @param {string} method
 * @param {string} path - например '/apis/properties'
 * @param {object|null} bodyObj - JSON body
 * @param {object|null} queryObj - query params
 * @param {Buffer|null} rawBody - если задан, шлём как есть (multipart)
 * @param {string|null} rawContentType - Content-Type для rawBody
 */
async function zeevouRequest(method, path, bodyObj, queryObj, rawBody, rawContentType) {
  const token = getToken();
  const bodyStr = rawBody || (bodyObj ? JSON.stringify(bodyObj) : '');
  let urlPath = path;
  if (queryObj && Object.keys(queryObj).length) {
    const params = new URLSearchParams();
    Object.keys(queryObj).sort().forEach((k) => {
      if (queryObj[k] !== undefined && queryObj[k] !== null) {
        params.append(k, String(queryObj[k]));
      }
    });
    const qs = params.toString();
    if (qs) urlPath += '?' + qs;
  }

  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
    'Content-Length': rawBody ? rawBody.length : Buffer.byteLength(bodyStr || '', 'utf8'),
  };
  if (rawBody) {
    headers['Content-Type'] = rawContentType;
  } else if (bodyObj) {
    headers['Content-Type'] = 'application/json';
  }

  const options = {
    hostname: HOST,
    port: 443,
    path: urlPath,
    method,
    headers,
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
          logger.error({ path, method, status: res.statusCode, body: parsed }, 'zeevou request error');
          const err = new Error('Zeevou ' + method + ' ' + path + ' failed: ' + res.statusCode);
          err.status = res.statusCode;
          err.body = parsed;
          reject(err);
        }
      });
    });
    req.on('error', reject);
    if (rawBody) req.write(rawBody); else if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function apiGet(path, query) { return zeevouRequest('GET', path, null, query); }
function apiPost(path, body) { return zeevouRequest('POST', path, body); }
function apiPut(path, body) { return zeevouRequest('PUT', path, body); }

/**
 * Скачать файл по URL в Buffer (Vercel Blob и др.). Следует редиректам.
 */
function fetchBuffer(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: 'GET',
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        return resolve(fetchBuffer(res.headers.location, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('download failed: HTTP ' + res.statusCode + ' ' + url));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Загрузить файл в Zeevou (multipart POST /apis/files).
 * @returns {Promise<{id: number}>} file id
 */
async function uploadFile(localBuffer, fileName, mimeType) {
  const boundary = '----zeevou' + crypto.randomBytes(12).toString('hex');
  const head = Buffer.from(
    '--' + boundary + '\r\n'
    + 'Content-Disposition: form-data; name="file"; filename="' + String(fileName || 'file').replace(/"/g, '') + '"\r\n'
    + 'Content-Type: ' + (mimeType || 'application/octet-stream') + '\r\n\r\n',
    'utf8'
  );
  const tail = Buffer.from('\r\n--' + boundary + '--\r\n', 'utf8');
  const body = Buffer.concat([head, localBuffer, tail]);
  const parsed = await zeevouRequest('POST', '/apis/files', null, null, body, 'multipart/form-data; boundary=' + boundary);
  logger.info({ fileId: parsed.id, fileName }, 'zeevou file uploaded');
  return { id: parsed.id };
}

/**
 * Привязать файл к объекту как изображение.
 * @param {number} propertyId
 * @param {number} fileId
 * @param {string} caption
 * @param {number} priority
 */
async function uploadPropertyImage(propertyId, fileId, caption, priority) {
  return apiPost('/apis/property_images', {
    property: propertyId,
    file: fileId,
    image_caption: caption || null,
    priority: priority || null,
  });
}

/**
 * Создать объект (property) в Zeevou.
 * @param {object} data
 * @param {string} data.name
 * @param {string} [data.shortName]
 * @param {string} data.description
 * @param {object} [data.address] - {street, postalCode, city, country}
 * @param {number|string} data.area - id или IRI зоны
 * @param {number|string} data.currency - id или IRI валюты
 * @param {string} [data.unitTypeName]
 * @param {number} [data.maxCapacity]
 * @returns {Promise<object>} созданный property ({ id, ... })
 */
async function createProperty(data) {
  const body = {
    name: data.name,
    short_name: (data.shortName || data.name || '').slice(0, 50),
    description: data.description || '',
    address: {
      first_line: data.address && data.address.street,
      postal_code: data.address && data.address.postalCode,
      city: data.address && data.address.city,
      country: data.address && data.address.country,
    },
    area: data.area,
    default_currency: data.currency,
    is_active: true,
    google_enabled: true,
    allow_direct_booking: true,
    publish_on_zeevou_direct: true,
    unit_types: [{
      name: data.unitTypeName || 'Entire property',
      maximum_capacity: data.maxCapacity || 2,
    }],
  };
  const created = await apiPost('/apis/properties', body);
  logger.info({ id: created.id, name: data.name }, 'zeevou property created');
  return created;
}

/** Alias для обратной совместимости со старым стабом. */
async function createZeevouProperty(data) {
  return createProperty(data);
}

/**
 * Обновить объект.
 */
async function updateProperty(id, data) {
  return apiPut('/apis/properties/' + id, data);
}

/**
 * Получить объект по id.
 */
async function getProperty(id) {
  return apiGet('/apis/properties/' + id);
}

/**
 * Пакетная загрузка тарифов.
 * @param {number} propertyId
 * @param {number} [ratePlanId]
 * @param {Array<{date:string, rate:number}>} prices
 */
async function setRates(propertyId, ratePlanId, prices) {
  const items = (prices || []).map((p) => {
    const item = { date: p.date, rate: p.rate };
    if (ratePlanId) item.rate_plan = ratePlanId;
    if (propertyId) item.property = propertyId;
    return item;
  });
  return apiPost('/apis/rates_batch', items);
}

/**
 * Список объектов (properties).
 */
async function getProperties(limit = 50) {
  const data = await apiGet('/apis/properties', { limit });
  return Array.isArray(data) ? data : (data['hydra:member'] || data.data || []);
}

/**
 * Доступность объекта за период.
 * @param {string|number} propertyId
 * @param {string} from - YYYY-MM-DD
 * @param {string} to   - YYYY-MM-DD
 */
async function getAvailability(propertyId, from, to) {
  return apiGet('/apis/properties/' + propertyId + '/availabilities', {
    'date[after]': from,
    'date[before]': to,
  });
}

/**
 * Тарифы за период.
 * @returns {Promise<number|null>} минимальная цена за ночь (в EUR), или null если нет
 */
async function getPrice(propertyId, arrivalDate, departureDate) {
  try {
    const data = await apiGet('/apis/rate_and_availability', {
      'unit_type.property.id': propertyId,
      'date[after]': arrivalDate,
      'date[before]': departureDate,
    });
    const list = Array.isArray(data) ? data : (data['hydra:member'] || data.data || []);
    if (!list.length) return null;
    let min = Infinity;
    for (const r of list) {
      const price = r.price || r.amount || r.rate || (r.rate_plan && r.rate_plan.price);
      if (typeof price === 'number' && price < min) min = price;
    }
    return min === Infinity ? null : min;
  } catch (e) {
    logger.warn({ err: e.message }, 'getPrice via rate_and_availability failed');
    return null;
  }
}

/**
 * Создать запрос на бронь (BookingRequest) в Zeevou.
 * @param {object} p
 * @param {object} p.lead_guest - {first_name, last_name, email, mobile_number}
 * @param {number} p.property_id
 * @param {number} p.rate_plan_id
 * @param {string} p.arrival_date - YYYY-MM-DD
 * @param {string} p.departure_date - YYYY-MM-DD
 * @param {number} p.adults
 * @param {number} p.children
 * @param {number} p.total_price - число в EUR
 */
async function createReservation(p) {
  const body = {
    lead_guest: p.lead_guest,
    guests: p.guests || [],
    property: p.property_id,
    rate_plan: p.rate_plan_id,
    arrival_date: p.arrival_date,
    departure_date: p.departure_date,
    number_of_adult_guests: p.adults || 2,
    number_of_child_guests: p.children || 0,
    total_price: p.total_price,
  };
  return apiPost('/apis/booking_requests', body);
}

/**
 * Конвертировать BookingRequest в бронь после оплаты.
 */
async function convertBookingRequest(bookingRequestId, paymentId) {
  return apiPost('/apis/booking_request/convert', {
    booking_request_id: bookingRequestId,
    payment_id: paymentId,
  });
}

/**
 * Пометить бронь как оплаченную (если работаем не через convert).
 */
async function markPaid(zeevouBookingId) {
  return apiPost('/apis/bookings/changeStatus', {
    booking_id: zeevouBookingId,
    booking_status: 'confirmed',
  });
}

/**
 * Отменить бронь.
 */
async function cancelReservation(zeevouBookingId) {
  return apiPut('/apis/bookings/cancel', {
    id: zeevouBookingId,
    cancellation_reason: 'Cancelled by guest',
  });
}

module.exports = {
  getToken,
  zeevouRequest,
  fetchBuffer,
  uploadFile,
  uploadPropertyImage,
  createProperty,
  createZeevouProperty,
  updateProperty,
  getProperty,
  setRates,
  getProperties,
  getAvailability,
  getPrice,
  createReservation,
  convertBookingRequest,
  markPaid,
  cancelReservation,
};

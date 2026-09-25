const config = require('../../config');
const logger = require('../../logger');

// База URL — переключается через env (sandbox / live)
const BASE = process.env.ZEEVOU_BASE_URL || process.env.ZEEVOU_SANDBOX_URL || 'https://sandbox.zeevou.com';
const CLIENT_ID = process.env.ZEEVOU_OAUTH_CRED_CLIENT_ID;
const CLIENT_SECRET = process.env.ZEEVOU_OAUTH_CRED_CLIENT_SECRET;

// Кэш токена в памяти инстанса
let tokenCache = { value: null, expiresAt: 0 };

/**
 * Получает OAuth2 access_token (Client Credentials).
 * Кэширует до истечения.
 */
async function getToken() {
  const now = Date.now();
  if (tokenCache.value && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.value;
  }
  const res = await fetch(BASE + '/oauth2-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    logger.error({ status: res.status, body }, 'zeevou token error');
    throw new Error('Zeevou auth failed: ' + res.status);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('Zeevou: no access_token in response');
  tokenCache.value = data.access_token;
  tokenCache.expiresAt = now + (data.expires_in || 3600) * 1000;
  return tokenCache.value;
}

/**
 * Универсальный запрос к Zeevou API.
 */
async function apiGet(path, query) {
  const token = await getToken();
  const url = new URL(BASE + path);
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    logger.error({ path, status: res.status, body }, 'zeevou GET error');
    throw new Error('Zeevou GET ' + path + ' failed: ' + res.status);
  }
  return res.json();
}

async function apiPost(path, body) {
  const token = await getToken();
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error({ path, status: res.status, body: text }, 'zeevou POST error');
    throw new Error('Zeevou POST ' + path + ' failed: ' + res.status);
  }
  return res.json();
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
  // Пробуем rate_and_availability — это основной источник цены
  try {
    const data = await apiGet('/apis/rate_and_availability', {
      'unit_type.property.id': propertyId,
      'date[after]': arrivalDate,
      'date[before]': departureDate,
    });
    const list = Array.isArray(data) ? data : (data['hydra:member'] || data.data || []);
    if (!list.length) return null;
    // Ищем минимальную цену за ночь в списке
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
  const token = await getToken();
  const res = await fetch(BASE + '/apis/bookings/cancel', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ id: zeevouBookingId, cancellation_reason: 'Cancelled by guest' }),
  });
  if (!res.ok) throw new Error('Zeevou cancel failed: ' + res.status);
  return res.json();
}

module.exports = {
  getToken,
  getProperties,
  getAvailability,
  getPrice,
  createReservation,
  convertBookingRequest,
  markPaid,
  cancelReservation,
};

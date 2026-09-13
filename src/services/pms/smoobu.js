const axios = require('axios');
const config = require('../../config');

const client = axios.create({
  baseURL: 'https://login.smoobu.com/api',
  headers: {
    'Api-Key': config.SMOOBU_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

async function getPrice(propertyId, arrivalDate, departureDate) {
  const res = await client.get('/rates', {
    params: {
      apartmentId: propertyId,
      arrivalDate: arrivalDate,
      departureDate: departureDate
    }
  });
  var price = res.data.totalPrice;
  if (price == null) price = res.data.price;
  if (!Number.isFinite(Number(price))) {
    throw new Error(
      'Smoobu вернул некорректную цену: '
      + JSON.stringify(res.data)
    );
  }
  return Number(price);
}

async function createReservation(p) {
  const body = {
    propertyId: Number(p.propertyId),
    arrivalDate: p.arrivalDate,
    departureDate: p.departureDate,
    type: '1',
    price: Number(p.price),
    firstName: p.guestName || 'Guest',
    lastName: '',
    email: p.guestEmail
  };
  const res = await client.post('/reservations', body);
  if (!res.data || !res.data.id) {
    throw new Error('Smoobu не вернул ID брони');
  }
  return res.data.id;
}

async function markPaid(smoobuBookingId) {
  await client.put(
    '/reservations/' + smoobuBookingId,
    { paid: true }
  );
}

async function cancelReservation(smoobuBookingId) {
  await client.put(
    '/reservations/' + smoobuBookingId,
    { status: 'cancelled' }
  );
}

module.exports = {
  getPrice: getPrice,
  createReservation: createReservation,
  markPaid: markPaid,
  cancelReservation: cancelReservation
};

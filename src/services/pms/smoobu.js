import config from '../../config.js';

const BASE_URL = 'https://login.smoobu.com/api';

// Вспомогательная функция для запросов
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Api-Key': config.SMOOBU_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Smoobu API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// Получить список апартаментов
export async function getApartments() {
  return request('/apartments');
}

// Получить информацию по конкретному апартаменту
export async function getApartment(id) {
  return request(`/apartments/${id}`);
}

// Получить доступность и цены на период
export async function getAvailability(apartmentId, startDate, endDate) {
  const query = new URLSearchParams({
    arrivalDate: startDate,
    departureDate: endDate,
  });
  return request(`/apartments/${apartmentId}/availability?${query}`);
}

// Создать бронь в Smoobu (вызывается после успешной оплаты в Stripe)
export async function createBooking(apartmentId, bookingData) {
  return request(`/apartments/${apartmentId}/bookings`, {
    method: 'POST',
    body: JSON.stringify(bookingData),
  });
}

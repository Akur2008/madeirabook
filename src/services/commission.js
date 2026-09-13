/**
 * Расчет комиссии.
 * ВАЖНО: комиссия ВСЕГДА берется из БД (properties.commission_percent),
 * никогда из query string или тела запроса.
 */
export function calculateCommission(amountCents, commissionPercent) {
  if (commissionPercent < 0 || commissionPercent > 100) {
    throw new Error('Invalid commission percent');
  }
  
  // Округляем до целых центов
  const platformFeeCents = Math.round(amountCents * (commissionPercent / 100));
  const ownerAmountCents = amountCents - platformFeeCents;

  return {
    amountCents,
    platformFeeCents,
    ownerAmountCents,
    commissionPercent,
  };
}

/**
 * Форматирование центов в евро (для логов и UI)
 */
export function formatEur(cents) {
  return (cents / 100).toFixed(2) + ' €';
}

function calcFee(amountCents, commissionPercent) {
  const pct = Number(commissionPercent);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error(
      'Invalid commissionPercent: ' + commissionPercent
    );
  }
  return Math.round(amountCents * (pct / 100));
}

module.exports = { calcFee: calcFee };

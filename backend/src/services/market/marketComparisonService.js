function comparable(prices) {
  if (!prices.length) return { comparable: false, reason: 'No market records are available for this date.' };
  const units = new Set(prices.map((item) => item.unit));
  const currencies = new Set(prices.map((item) => item.currency));
  const dates = new Set(prices.map((item) => item.arrivalDate));
  if (units.size !== 1 || currencies.size !== 1 || dates.size !== 1) {
    return { comparable: false, reason: 'Prices use different units, currencies, or reporting dates.' };
  }
  return { comparable: true, reason: null };
}

module.exports = { comparable };

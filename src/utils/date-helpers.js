/**
 * Calculate the number of days between two YYYY-MM-DD date strings.
 * Returns a non-negative integer.
 */
export function daysBetween(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Calculate how many nights of a reservation (arrival→departure)
 * overlap with a date range (rangeStart→rangeEnd).
 *
 * All dates are YYYY-MM-DD strings. Departure/rangeEnd are exclusive
 * (a guest departing Apr 10 does NOT occupy night of Apr 10).
 */
export function overlapNights(arrival, departure, rangeStart, rangeEnd) {
  const overlapStart = arrival > rangeStart ? arrival : rangeStart;
  const overlapEnd = departure < rangeEnd ? departure : rangeEnd;
  return Math.max(0, daysBetween(overlapStart, overlapEnd));
}

/**
 * Format a Date object as YYYY-MM-DD (UTC).
 */
export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Return the first day of the month for a given Date, as YYYY-MM-DD.
 */
export function startOfMonth(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
  return formatDate(d);
}

/**
 * Return the last day of the month for a given Date, as YYYY-MM-DD.
 */
export function endOfMonth(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth() + 1, 0));
  return formatDate(d);
}

/**
 * Return today's date as YYYY-MM-DD.
 */
export function today() {
  return formatDate(new Date());
}

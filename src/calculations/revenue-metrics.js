import { daysBetween, overlapNights } from '../utils/date-helpers.js';

/**
 * Calculate portfolio-level revenue metrics for a date range.
 *
 * @param {Array} reservations — normalized, non-cancelled reservations
 * @param {Array} listings — normalized listing objects
 * @param {string} startDate — YYYY-MM-DD (inclusive)
 * @param {string} endDate — YYYY-MM-DD (exclusive, like a departure date)
 * @returns {{ availableRoomNights, bookedNights, totalRevenue, occupancyRate, adr, revpar }}
 */
export function calculateMetrics(reservations, listings, startDate, endDate) {
  const totalDays = daysBetween(startDate, endDate);
  const availableRoomNights = listings.length * totalDays;

  let bookedNights = 0;
  let totalRevenue = 0;

  for (const r of reservations) {
    const overlap = overlapNights(r.arrivalDate, r.departureDate, startDate, endDate);
    if (overlap > 0) {
      bookedNights += overlap;
      totalRevenue += (overlap / r.nights) * r.totalRevenue;
    }
  }

  totalRevenue = Math.round(totalRevenue * 100) / 100;

  const occupancyRate = availableRoomNights > 0
    ? Math.round((bookedNights / availableRoomNights) * 10000) / 100
    : 0;

  const adr = bookedNights > 0
    ? Math.round((totalRevenue / bookedNights) * 100) / 100
    : 0;

  const revpar = availableRoomNights > 0
    ? Math.round((totalRevenue / availableRoomNights) * 100) / 100
    : 0;

  return { availableRoomNights, bookedNights, totalRevenue, occupancyRate, adr, revpar };
}

/**
 * Calculate per-unit metrics. Same formulas filtered by listing.
 */
export function calculatePerUnitMetrics(reservations, listings, startDate, endDate) {
  const totalDays = daysBetween(startDate, endDate);

  return listings.map(listing => {
    const unitReservations = reservations.filter(r => r.listingId === listing.id);
    const metrics = calculateMetrics(unitReservations, [listing], startDate, endDate);

    return {
      listingId: listing.id,
      listingName: listing.name,
      availableNights: totalDays,
      bookedNights: metrics.bookedNights,
      totalRevenue: metrics.totalRevenue,
      occupancyRate: metrics.occupancyRate,
      adr: metrics.adr,
      revpar: metrics.revpar,
    };
  });
}

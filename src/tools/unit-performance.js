import { z } from 'zod';
import { getListings, getReservations } from '../pms/hostaway.js';
import { calculatePerUnitMetrics } from '../calculations/revenue-metrics.js';
import { startOfMonth, today } from '../utils/date-helpers.js';

export const name = 'get_unit_performance';

export const config = {
  title: 'Unit Performance',
  description: 'Get revenue metrics per unit, ranked by a chosen metric. Identifies top and bottom performers.',
  inputSchema: {
    start_date: z.string().describe('Start date YYYY-MM-DD').optional(),
    end_date: z.string().describe('End date YYYY-MM-DD').optional(),
    sort_by: z.enum(['revpar', 'occupancy', 'revenue', 'adr']).default('revpar').describe('Metric to sort by'),
    limit: z.number().int().min(1).optional().describe('How many units to return (default: all)'),
  },
  annotations: { readOnlyHint: true },
};

const sortKeys = {
  revpar: 'revpar',
  occupancy: 'occupancyRate',
  revenue: 'totalRevenue',
  adr: 'adr',
};

export async function handler({ start_date, end_date, sort_by = 'revpar', limit }) {
  const sd = start_date || startOfMonth(new Date());
  const ed = end_date || today();

  const [listings, reservations] = await Promise.all([
    getListings(),
    getReservations(sd, ed),
  ]);

  let units = calculatePerUnitMetrics(reservations, listings, sd, ed);

  const key = sortKeys[sort_by];
  units.sort((a, b) => b[key] - a[key]);

  if (limit) units = units.slice(0, limit);

  const formatted = units.map(u => {
    const entry = {
      listing_id: u.listingId,
      listing_name: u.listingName,
      total_revenue: u.totalRevenue,
      booked_nights: u.bookedNights,
      available_nights: u.availableNights,
      occupancy_rate: `${u.occupancyRate}%`,
      adr: u.adr,
      revpar: u.revpar,
    };
    if (u.multiRoomWarning) {
      entry.note = 'This listing appears to have multiple bookable rooms. Metrics are aggregated — per-room values would be lower.';
    }
    return entry;
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ period: `${sd} to ${ed}`, sorted_by: sort_by, units: formatted }, null, 2),
    }],
  };
}

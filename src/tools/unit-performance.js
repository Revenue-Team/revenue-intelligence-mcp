import { z } from 'zod';
import { getListings, getReservations, resolveListingId } from '../pms/hostaway.js';
import { calculatePerUnitMetrics } from '../calculations/revenue-metrics.js';
import { startOfMonth, today, inclusiveEnd } from '../utils/date-helpers.js';

export const name = 'get_unit_performance';

export const config = {
  title: 'Unit Performance',
  description: 'Get revenue metrics per unit, ranked by a chosen metric. Identifies top and bottom performers. Pass listing_id to scope to a single unit (much faster).',
  inputSchema: {
    start_date: z.string().describe('Start date YYYY-MM-DD').optional(),
    end_date: z.string().describe('End date YYYY-MM-DD').optional(),
    sort_by: z.enum(['revpar', 'occupancy', 'revenue', 'adr']).default('revpar').describe('Metric to sort by'),
    limit: z.number().int().min(1).optional().describe('How many units to return (default: all)'),
    listing_id: z.string().optional().describe('Optional: scope to a single unit. Accepts either a numeric Hostaway ID or a unit name (e.g. "AT_VIE_Duschel_01_00_01_W"). Strongly preferred when the user asks about a specific unit — avoids fetching all units.'),
  },
  annotations: { readOnlyHint: true },
};

const sortKeys = {
  revpar: 'revpar',
  occupancy: 'occupancyRate',
  revenue: 'totalRevenue',
  adr: 'adr',
};

export async function handler({ start_date, end_date, sort_by = 'revpar', limit, listing_id }) {
  const sd = start_date || startOfMonth(new Date());
  const userEnd = end_date || today();
  const ed = inclusiveEnd(userEnd);

  // If user scoped to a single unit, resolve name→ID and fetch only that unit's data.
  // This is dramatically faster than fetching all listings and all reservations.
  const resolvedId = listing_id ? await resolveListingId(listing_id) : null;

  const [allListings, reservations] = await Promise.all([
    getListings(),
    getReservations(sd, userEnd, resolvedId),
  ]);

  // When scoped, narrow the listings array to the requested unit before computing.
  const listings = resolvedId
    ? allListings.filter(l => l.id === resolvedId)
    : allListings;

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

  // Context-aware next steps — reference actual top/bottom unit names when available.
  const topUnit = formatted[0];
  const bottomUnit = formatted[formatted.length - 1];
  const _next_steps = [];
  if (topUnit && bottomUnit && topUnit !== bottomUnit) {
    _next_steps.push(`Show recent bookings for ${topUnit.listing_name}`);
    _next_steps.push(`What's the occupancy for ${bottomUnit.listing_name} over the same period?`);
  }
  _next_steps.push(`Compare ${sd} to ${userEnd} vs the previous period of the same length`);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        period: `${sd} to ${userEnd}`,
        sorted_by: sort_by,
        units: formatted,
        _next_steps,
      }, null, 2),
    }],
  };
}

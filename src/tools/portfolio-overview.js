import { z } from 'zod';
import { getListings, getReservations } from '../pms/hostaway.js';
import { calculateMetrics, calculatePerUnitMetrics } from '../calculations/revenue-metrics.js';
import { startOfMonth, today, inclusiveEnd } from '../utils/date-helpers.js';

export const name = 'get_portfolio_overview';

export const config = {
  title: 'Portfolio Overview',
  description: 'Get a high-level overview of your portfolio\'s key revenue metrics for a date range.',
  inputSchema: {
    start_date: z.string().describe('Start date YYYY-MM-DD (defaults to first day of current month)').optional(),
    end_date: z.string().describe('End date YYYY-MM-DD (defaults to today)').optional(),
  },
  annotations: { readOnlyHint: true },
};

export async function handler({ start_date, end_date }) {
  const sd = start_date || startOfMonth(new Date());
  const userEnd = end_date || today();           // user-facing (inclusive)
  const ed = inclusiveEnd(userEnd);              // internal (exclusive) for math

  const [listings, reservations] = await Promise.all([
    getListings(),
    getReservations(sd, userEnd),
  ]);

  const metrics = calculateMetrics(reservations, listings, sd, ed);

  const multiRoomListings = calculatePerUnitMetrics(reservations, listings, sd, ed)
    .filter(u => u.multiRoomWarning)
    .map(u => u.listingName);

  const result = {
    period: `${sd} to ${userEnd}`,
    total_listings: listings.length,
    total_revenue: metrics.totalRevenue,
    total_booked_nights: metrics.bookedNights,
    available_room_nights: metrics.availableRoomNights,
    occupancy_rate: `${metrics.occupancyRate}%`,
    adr: metrics.adr,
    revpar: metrics.revpar,
  };

  if (multiRoomListings.length > 0) {
    result.multi_room_note = `${multiRoomListings.length} listing(s) appear to have multiple bookable rooms, which inflates aggregated metrics: ${multiRoomListings.join(', ')}`;
  }

  result._next_steps = [
    `Show me my top 5 units by revenue for ${sd} to ${userEnd}`,
    `Compare ${sd} to ${userEnd} vs the previous period of the same length`,
    `Break revenue down by booking channel for this period`,
  ];

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  };
}

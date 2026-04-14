import { z } from 'zod';
import { getListings, getReservations } from '../pms/hostaway.js';
import { calculateMetrics } from '../calculations/revenue-metrics.js';
import { startOfMonth, today } from '../utils/date-helpers.js';

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
  const ed = end_date || today();

  const [listings, reservations] = await Promise.all([
    getListings(),
    getReservations(sd, ed),
  ]);

  const metrics = calculateMetrics(reservations, listings, sd, ed);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        period: `${sd} to ${ed}`,
        total_listings: listings.length,
        total_revenue: metrics.totalRevenue,
        total_booked_nights: metrics.bookedNights,
        available_room_nights: metrics.availableRoomNights,
        occupancy_rate: `${metrics.occupancyRate}%`,
        adr: metrics.adr,
        revpar: metrics.revpar,
      }, null, 2),
    }],
  };
}

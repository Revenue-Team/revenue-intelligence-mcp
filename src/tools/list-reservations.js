import { z } from 'zod';
import { getReservations, getReservationsAll } from '../pms/hostaway.js';
import { startOfMonth, today } from '../utils/date-helpers.js';

export const name = 'list_reservations';

export const config = {
  title: 'List Reservations',
  description: 'List reservations with filters. Raw booking data, not aggregated metrics.',
  inputSchema: {
    start_date: z.string().describe('Arrival start date YYYY-MM-DD').optional(),
    end_date: z.string().describe('Arrival end date YYYY-MM-DD').optional(),
    listing_id: z.string().optional().describe('Filter to a specific listing'),
    status: z.enum(['confirmed', 'cancelled', 'all']).default('confirmed').describe('Filter by status'),
    limit: z.number().int().min(1).max(100).default(25).describe('Max results to return'),
  },
  annotations: { readOnlyHint: true },
};

export async function handler({ start_date, end_date, listing_id, status = 'confirmed', limit = 25 }) {
  const sd = start_date || startOfMonth(new Date());
  const ed = end_date || today();

  let reservations;
  if (status === 'all' || status === 'cancelled') {
    reservations = await getReservationsAll(sd, ed, listing_id || null);
    if (status === 'cancelled') {
      reservations = reservations.filter(r => r.status === 'cancelled');
    }
  } else {
    reservations = await getReservations(sd, ed, listing_id || null);
  }

  reservations.sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  reservations = reservations.slice(0, limit);

  const formatted = reservations.map(r => ({
    guest_name: r.guestName,
    listing_name: r.listingName,
    arrival: r.arrivalDate,
    departure: r.departureDate,
    nights: r.nights,
    revenue: r.totalRevenue,
    channel: r.channel,
    status: r.status,
  }));

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        date_range: `${sd} to ${ed}`,
        status_filter: status,
        count: formatted.length,
        reservations: formatted,
      }, null, 2),
    }],
  };
}

import { z } from 'zod';
import { getReservationsPage, getReservationsByBookingDate, resolveListingId } from '../pms/hostaway.js';
import { startOfMonth, today } from '../utils/date-helpers.js';

export const name = 'list_reservations';

export const config = {
  title: 'List Reservations',
  description: 'List reservations with filters. Raw booking data, not aggregated metrics. Can filter by arrival date (when the guest checks in) or by booking date (when the reservation was created).',
  inputSchema: {
    start_date: z.string().describe('Start date YYYY-MM-DD').optional(),
    end_date: z.string().describe('End date YYYY-MM-DD').optional(),
    listing_id: z.string().optional().describe('Filter to a specific listing. Accepts either a numeric Hostaway ID or a unit name (e.g. "AT_VIE_Duschel_01_00_01_W").'),
    date_filter: z.enum(['arrival', 'booking']).default('arrival').describe('Whether start_date/end_date filter by guest arrival date or by booking creation date'),
    status: z.enum(['confirmed', 'cancelled', 'all']).default('confirmed').describe('Filter by status'),
    limit: z.number().int().min(1).max(100).default(25).describe('Max results to return'),
  },
  annotations: { readOnlyHint: true },
};

export async function handler({ start_date, end_date, listing_id, date_filter = 'arrival', status = 'confirmed', limit = 25 }) {
  const sd = start_date || startOfMonth(new Date());
  const ed = end_date || today();
  const includeCancelled = status === 'all' || status === 'cancelled';

  // Resolve numeric ID or unit name to a numeric ID before querying.
  const resolvedId = listing_id ? await resolveListingId(listing_id) : null;

  let reservations;

  if (date_filter === 'booking') {
    reservations = await getReservationsByBookingDate(sd, ed, {
      listingId: resolvedId,
      limit,
      includeCancelled,
    });
  } else {
    reservations = await getReservationsPage(sd, ed, {
      listingId: resolvedId,
      limit: includeCancelled ? limit : limit + 20, // fetch extra to account for cancelled being filtered out
      includeCancelled,
    });
  }

  if (status === 'cancelled') {
    reservations = reservations.filter(r => r.status === 'cancelled');
  }

  // Sort by the relevant date field
  if (date_filter === 'booking') {
    reservations.sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
  } else {
    reservations.sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate));
  }

  reservations = reservations.slice(0, limit);

  const formatted = reservations.map(r => ({
    guest_name: r.guestName,
    listing_name: r.listingName,
    booking_date: r.bookingDate,
    arrival: r.arrivalDate,
    departure: r.departureDate,
    nights: r.nights,
    revenue: r.totalRevenue,
    channel: r.channel,
    status: r.status,
  }));

  const _next_steps = [
    `Show a portfolio revenue overview for ${sd} to ${ed}`,
    `Break revenue down by channel for ${sd} to ${ed}`,
  ];
  if (!listing_id) {
    _next_steps.push(`Which units have the most recent bookings this week?`);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        date_range: `${sd} to ${ed}`,
        date_filter,
        status_filter: status,
        count: formatted.length,
        reservations: formatted,
        _next_steps,
      }, null, 2),
    }],
  };
}

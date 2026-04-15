import { z } from 'zod';
import { getListings, getReservations } from '../pms/hostaway.js';
import { calculateMetrics, calculatePerUnitMetrics } from '../calculations/revenue-metrics.js';
import { overlapNights, startOfMonth, today, formatDate, inclusiveEnd } from '../utils/date-helpers.js';

export const name = 'get_revenue_breakdown';

export const config = {
  title: 'Revenue Breakdown',
  description: 'Break down revenue by unit, by month, or by booking channel.',
  inputSchema: {
    start_date: z.string().describe('Start date YYYY-MM-DD').optional(),
    end_date: z.string().describe('End date YYYY-MM-DD').optional(),
    breakdown_by: z.enum(['unit', 'month', 'channel']).describe('Dimension to break down by'),
  },
  annotations: { readOnlyHint: true },
};

export async function handler({ start_date, end_date, breakdown_by }) {
  const sd = start_date || startOfMonth(new Date());
  const userEnd = end_date || today();
  const ed = inclusiveEnd(userEnd);

  const [listings, reservations] = await Promise.all([
    getListings(),
    getReservations(sd, userEnd),
  ]);

  let data;

  if (breakdown_by === 'unit') {
    const units = calculatePerUnitMetrics(reservations, listings, sd, ed);
    units.sort((a, b) => b.totalRevenue - a.totalRevenue);
    data = units.map(u => {
      const entry = {
        listing_name: u.listingName,
        revenue: u.totalRevenue,
        booked_nights: u.bookedNights,
        adr: u.adr,
      };
      if (u.multiRoomWarning) {
        entry.note = 'This listing appears to have multiple bookable rooms. Metrics are aggregated — per-room values would be lower.';
      }
      return entry;
    });
  } else if (breakdown_by === 'channel') {
    const channels = {};
    for (const r of reservations) {
      const overlap = overlapNights(r.arrivalDate, r.departureDate, sd, ed);
      if (overlap <= 0) continue;
      const prorated = Math.round(((overlap / r.nights) * r.totalRevenue) * 100) / 100;
      if (!channels[r.channel]) channels[r.channel] = { revenue: 0, bookings: 0 };
      channels[r.channel].revenue += prorated;
      channels[r.channel].bookings += 1;
    }
    data = Object.entries(channels)
      .map(([channel, vals]) => ({
        channel,
        revenue: Math.round(vals.revenue * 100) / 100,
        bookings: vals.bookings,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  } else {
    const months = [];
    let current = new Date(sd + 'T00:00:00Z');
    const end = new Date(ed + 'T00:00:00Z');
    while (current < end) {
      const monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
      const clampedEnd = monthEnd > end ? end : monthEnd;
      const metrics = calculateMetrics(reservations, listings, formatDate(current), formatDate(clampedEnd));
      months.push({
        month: formatDate(current).slice(0, 7),
        revenue: metrics.totalRevenue,
        booked_nights: metrics.bookedNights,
        occupancy_rate: `${metrics.occupancyRate}%`,
      });
      current = monthEnd;
    }
    data = months;
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        period: `${sd} to ${userEnd}`,
        breakdown_by,
        data,
      }, null, 2),
    }],
  };
}

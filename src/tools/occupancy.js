import { z } from 'zod';
import { getListings, getReservations } from '../pms/hostaway.js';
import { calculateMetrics } from '../calculations/revenue-metrics.js';
import { startOfMonth, today, formatDate } from '../utils/date-helpers.js';

export const name = 'get_occupancy';

export const config = {
  title: 'Occupancy',
  description: 'Get occupancy rates for your portfolio or a specific unit over a date range.',
  inputSchema: {
    start_date: z.string().describe('Start date YYYY-MM-DD').optional(),
    end_date: z.string().describe('End date YYYY-MM-DD').optional(),
    listing_id: z.string().optional().describe('Filter to a specific unit'),
    group_by: z.enum(['day', 'week', 'month']).default('month').describe('Group occupancy by interval'),
  },
  annotations: { readOnlyHint: true },
};

function generateIntervals(startDate, endDate, groupBy) {
  const intervals = [];
  let current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  while (current < end) {
    let intervalEnd;
    if (groupBy === 'day') {
      intervalEnd = new Date(current);
      intervalEnd.setUTCDate(intervalEnd.getUTCDate() + 1);
    } else if (groupBy === 'week') {
      intervalEnd = new Date(current);
      intervalEnd.setUTCDate(intervalEnd.getUTCDate() + 7);
    } else {
      intervalEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1));
    }
    if (intervalEnd > end) intervalEnd = end;

    intervals.push({
      start: formatDate(current),
      end: formatDate(intervalEnd),
    });

    current = intervalEnd;
  }

  return intervals;
}

export async function handler({ start_date, end_date, listing_id, group_by = 'month' }) {
  const sd = start_date || startOfMonth(new Date());
  const ed = end_date || today();

  const [listings, reservations] = await Promise.all([
    getListings(),
    getReservations(sd, ed, listing_id || null),
  ]);

  const filteredListings = listing_id
    ? listings.filter(l => l.id === listing_id)
    : listings;

  const intervals = generateIntervals(sd, ed, group_by);

  const overallMetrics = calculateMetrics(reservations, filteredListings, sd, ed);
  const isMultiRoom = overallMetrics.occupancyRate > 100;

  const data = intervals.map(interval => {
    const metrics = calculateMetrics(reservations, filteredListings, interval.start, interval.end);
    return {
      period: `${interval.start} to ${interval.end}`,
      occupancy_rate: `${metrics.occupancyRate}%`,
      booked_nights: metrics.bookedNights,
      available_nights: metrics.availableRoomNights,
    };
  });

  const result = {
    date_range: `${sd} to ${ed}`,
    grouped_by: group_by,
    listing: listing_id || 'all',
    data,
  };

  if (isMultiRoom) {
    result.note = 'This listing appears to have multiple bookable rooms. Occupancy exceeds 100% because metrics are aggregated across all rooms.';
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
  };
}

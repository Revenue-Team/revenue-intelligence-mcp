import { z } from 'zod';
import { getListings, getReservations } from '../pms/hostaway.js';
import { calculateMetrics } from '../calculations/revenue-metrics.js';
import { inclusiveEnd } from '../utils/date-helpers.js';

export const name = 'compare_periods';

export const config = {
  title: 'Compare Periods',
  description: 'Compare revenue metrics between two date ranges. Useful for month-over-month or period comparisons.',
  inputSchema: {
    current_start: z.string().describe('Current period start YYYY-MM-DD'),
    current_end: z.string().describe('Current period end YYYY-MM-DD'),
    previous_start: z.string().describe('Previous period start YYYY-MM-DD'),
    previous_end: z.string().describe('Previous period end YYYY-MM-DD'),
  },
  annotations: { readOnlyHint: true },
};

function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(pct * 10) / 10;
  return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
}

export async function handler({ current_start, current_end, previous_start, previous_end }) {
  const listings = await getListings();

  // Convert user-facing inclusive end dates to internal exclusive form for math.
  const currentEndExclusive = inclusiveEnd(current_end);
  const previousEndExclusive = inclusiveEnd(previous_end);

  const [currentRes, previousRes] = await Promise.all([
    getReservations(current_start, current_end),
    getReservations(previous_start, previous_end),
  ]);

  const current = calculateMetrics(currentRes, listings, current_start, currentEndExclusive);
  const previous = calculateMetrics(previousRes, listings, previous_start, previousEndExclusive);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        current_period: {
          dates: `${current_start} to ${current_end}`,
          revenue: current.totalRevenue,
          occupancy: `${current.occupancyRate}%`,
          adr: current.adr,
          revpar: current.revpar,
        },
        previous_period: {
          dates: `${previous_start} to ${previous_end}`,
          revenue: previous.totalRevenue,
          occupancy: `${previous.occupancyRate}%`,
          adr: previous.adr,
          revpar: previous.revpar,
        },
        change: {
          revenue: {
            absolute: Math.round((current.totalRevenue - previous.totalRevenue) * 100) / 100,
            percent: pctChange(current.totalRevenue, previous.totalRevenue),
          },
          occupancy: {
            absolute: Math.round((current.occupancyRate - previous.occupancyRate) * 100) / 100,
            percent: pctChange(current.occupancyRate, previous.occupancyRate),
          },
          adr: {
            absolute: Math.round((current.adr - previous.adr) * 100) / 100,
            percent: pctChange(current.adr, previous.adr),
          },
          revpar: {
            absolute: Math.round((current.revpar - previous.revpar) * 100) / 100,
            percent: pctChange(current.revpar, previous.revpar),
          },
        },
      }, null, 2),
    }],
  };
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMetrics, calculatePerUnitMetrics } from './revenue-metrics.js';

// Test data: 2 listings, April 1-15 (14 days, endDate is exclusive)
const listings = [
  { id: 'A', name: 'Unit A', address: '', bedrooms: 1, maxGuests: 2, basePrice: 100 },
  { id: 'B', name: 'Unit B', address: '', bedrooms: 2, maxGuests: 4, basePrice: 150 },
];

const reservations = [
  // Unit A: 10 nights fully within range, €1000
  { id: 'r1', listingId: 'A', listingName: 'Unit A', arrivalDate: '2026-04-01', departureDate: '2026-04-11', nights: 10, totalRevenue: 1000, status: 'confirmed', channel: 'airbnb', guestName: 'Alice' },
  // Unit B: 5 nights fully within range, €750
  { id: 'r2', listingId: 'B', listingName: 'Unit B', arrivalDate: '2026-04-05', departureDate: '2026-04-10', nights: 5, totalRevenue: 750, status: 'confirmed', channel: 'booking.com', guestName: 'Bob' },
  // Unit B: 6-night stay that overlaps partially (starts Apr 12, ends Apr 18 — only 3 nights in range Apr 12-15)
  { id: 'r3', listingId: 'B', listingName: 'Unit B', arrivalDate: '2026-04-12', departureDate: '2026-04-18', nights: 6, totalRevenue: 900, status: 'confirmed', channel: 'direct', guestName: 'Carol' },
];

const startDate = '2026-04-01';
const endDate = '2026-04-15'; // exclusive — 14 days

describe('calculateMetrics', () => {
  const result = calculateMetrics(reservations, listings, startDate, endDate);

  it('calculates available room nights', () => {
    // 2 listings × 14 days = 28
    assert.equal(result.availableRoomNights, 28);
  });

  it('calculates booked nights with overlap', () => {
    // r1: 10, r2: 5, r3: overlap Apr 12-15 = 3 nights
    assert.equal(result.bookedNights, 18);
  });

  it('calculates total revenue with proration', () => {
    // r1: 1000 (fully in range)
    // r2: 750 (fully in range)
    // r3: (3/6) × 900 = 450 (prorated)
    assert.equal(result.totalRevenue, 2200);
  });

  it('calculates occupancy rate', () => {
    // 18/28 = 64.285...% → rounds to 64.29
    assert.ok(Math.abs(result.occupancyRate - 64.29) < 0.01);
  });

  it('calculates ADR', () => {
    // 2200/18 = 122.222... → rounds to 122.22
    assert.ok(Math.abs(result.adr - 122.22) < 0.01);
  });

  it('calculates RevPAR', () => {
    // 2200/28 = 78.571... → rounds to 78.57
    assert.ok(Math.abs(result.revpar - 78.57) < 0.01);
  });
});

describe('calculateMetrics with no reservations', () => {
  const result = calculateMetrics([], listings, startDate, endDate);

  it('returns zero revenue', () => {
    assert.equal(result.totalRevenue, 0);
  });

  it('returns zero occupancy', () => {
    assert.equal(result.occupancyRate, 0);
  });

  it('returns zero ADR', () => {
    assert.equal(result.adr, 0);
  });

  it('returns zero RevPAR', () => {
    assert.equal(result.revpar, 0);
  });
});

describe('calculatePerUnitMetrics', () => {
  const units = calculatePerUnitMetrics(reservations, listings, startDate, endDate);

  it('returns one entry per listing', () => {
    assert.equal(units.length, 2);
  });

  it('calculates Unit A metrics correctly', () => {
    const a = units.find(u => u.listingId === 'A');
    assert.equal(a.bookedNights, 10);
    assert.equal(a.totalRevenue, 1000);
    assert.equal(a.availableNights, 14);
  });

  it('calculates Unit B metrics correctly (with prorated reservation)', () => {
    const b = units.find(u => u.listingId === 'B');
    assert.equal(b.bookedNights, 8);
    assert.equal(b.totalRevenue, 1200);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, overlapNights, formatDate, startOfMonth, endOfMonth } from './date-helpers.js';

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    assert.equal(daysBetween('2026-04-01', '2026-04-01'), 0);
  });

  it('returns 1 for consecutive dates', () => {
    assert.equal(daysBetween('2026-04-01', '2026-04-02'), 1);
  });

  it('returns 30 for full April', () => {
    assert.equal(daysBetween('2026-04-01', '2026-05-01'), 30);
  });

  it('returns 31 for full March', () => {
    assert.equal(daysBetween('2026-03-01', '2026-04-01'), 31);
  });
});

describe('overlapNights', () => {
  it('returns full nights when reservation is within range', () => {
    assert.equal(overlapNights('2026-04-05', '2026-04-10', '2026-04-01', '2026-04-30'), 5);
  });

  it('returns partial overlap when reservation starts before range', () => {
    assert.equal(overlapNights('2026-03-28', '2026-04-03', '2026-04-01', '2026-04-30'), 2);
  });

  it('returns partial overlap when reservation ends after range', () => {
    assert.equal(overlapNights('2026-04-28', '2026-05-03', '2026-04-01', '2026-04-30'), 2);
  });

  it('returns 0 when reservation is entirely before range', () => {
    assert.equal(overlapNights('2026-03-01', '2026-03-05', '2026-04-01', '2026-04-30'), 0);
  });

  it('returns 0 when reservation is entirely after range', () => {
    assert.equal(overlapNights('2026-05-05', '2026-05-10', '2026-04-01', '2026-04-30'), 0);
  });

  it('returns 0 when arrival equals range end', () => {
    assert.equal(overlapNights('2026-04-30', '2026-05-03', '2026-04-01', '2026-04-30'), 0);
  });
});

describe('startOfMonth / endOfMonth', () => {
  it('returns first day of current month', () => {
    const result = startOfMonth(new Date('2026-04-14'));
    assert.equal(result, '2026-04-01');
  });

  it('returns last day of current month', () => {
    const result = endOfMonth(new Date('2026-04-14'));
    assert.equal(result, '2026-04-30');
  });

  it('handles February in non-leap year', () => {
    const result = endOfMonth(new Date('2026-02-14'));
    assert.equal(result, '2026-02-28');
  });
});

describe('formatDate', () => {
  it('formats a Date to YYYY-MM-DD', () => {
    assert.equal(formatDate(new Date('2026-04-14T00:00:00Z')), '2026-04-14');
  });
});

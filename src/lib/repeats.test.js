import { describe, it, expect } from 'vitest';
import { nextOccurrence, dueOccurrences, monthlyEquivalent } from './repeats';
import { applyRules } from './rules';

describe('nextOccurrence', () => {
  it('advances by frequency', () => {
    expect(nextOccurrence('2026-01-01', 'Daily')).toBe('2026-01-02');
    expect(nextOccurrence('2026-01-01', 'Weekly')).toBe('2026-01-08');
    expect(nextOccurrence('2026-01-01', 'Bi-weekly')).toBe('2026-01-15');
    expect(nextOccurrence('2026-01-01', 'Yearly')).toBe('2027-01-01');
  });
  it('clamps month-end', () => {
    expect(nextOccurrence('2026-01-31', 'Monthly')).toBe('2026-02-28');
    expect(nextOccurrence('2028-01-31', 'Monthly')).toBe('2028-02-29');
  });
});

describe('dueOccurrences', () => {
  it('lists every missed occurrence up to today and the next future date', () => {
    const r = dueOccurrences({ nextDateISO: '2026-07-10', frequency: 'Monthly' }, '2026-10-12');
    expect(r.dates).toEqual(['2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10']);
    expect(r.next).toBe('2026-11-10');
  });
  it('returns nothing when not yet due', () => {
    expect(dueOccurrences({ nextDateISO: '2026-12-01', frequency: 'Monthly' }, '2026-10-12').dates).toEqual([]);
  });
  it('caps runaway schedules', () => {
    expect(dueOccurrences({ nextDateISO: '2000-01-01', frequency: 'Daily' }, '2026-10-12', 5).dates).toHaveLength(5);
  });
});

describe('monthlyEquivalent', () => {
  it('normalises to a month', () => {
    expect(monthlyEquivalent({ amount: -12, frequency: 'Yearly' })).toBeCloseTo(-1);
    expect(monthlyEquivalent({ amount: -10, frequency: 'Monthly' })).toBe(-10);
  });
});

describe('applyRules', () => {
  const rules = [
    { active: true, matchText: 'netflix', tagName: 'Subscription' },
    { active: false, matchText: 'coffee', tagName: 'Dining' },
  ];
  it('adds tags from active, matching rules (case-insensitive) without duplicating', () => {
    expect(applyRules('NETFLIX monthly', [], rules)).toEqual(['Subscription']);
    expect(applyRules('NETFLIX monthly', ['Subscription'], rules)).toEqual(['Subscription']);
  });
  it('ignores inactive rules', () => {
    expect(applyRules('coffee', [], rules)).toEqual([]);
  });
});

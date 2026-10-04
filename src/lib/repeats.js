/** repeats.js — recurring-transaction scheduling (pure). */
import { addDaysISO, addMonthsISO } from '../helpers';

export function nextOccurrence(iso, frequency) {
  switch (frequency) {
    case 'Daily':     return addDaysISO(iso, 1);
    case 'Weekly':    return addDaysISO(iso, 7);
    case 'Bi-weekly': return addDaysISO(iso, 14);
    case 'Yearly':    return addMonthsISO(iso, 12);
    case 'Monthly':
    default:          return addMonthsISO(iso, 1);
  }
}

/**
 * Occurrence dates that are due (<= today) for a repeat, and the date the
 * schedule should advance to. Capped so a stale schedule can't flood the ledger.
 */
export function dueOccurrences(repeat, today, cap = 60) {
  const dates = [];
  let next = repeat.nextDateISO;
  while (next <= today && dates.length < cap) {
    dates.push(next);
    next = nextOccurrence(next, repeat.frequency);
  }
  return { dates, next };
}

/** Monthly-equivalent amount of a repeat, for forecasting. */
export function monthlyEquivalent(repeat) {
  const f = { Daily: 30, Weekly: 52 / 12, 'Bi-weekly': 26 / 12, Monthly: 1, Yearly: 1 / 12 }[repeat.frequency] ?? 1;
  return repeat.amount * f;
}

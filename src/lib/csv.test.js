import { describe, it, expect } from 'vitest';
import { parseCSV, toCSV, parseDateString, parseAmount, normalizeRecords, parseTransactionsCSV, transactionsToCSV } from './csv';

describe('parseCSV', () => {
  it('handles quotes, commas, escaped quotes, CRLF and embedded newlines', () => {
    const rows = parseCSV('a,b\r\n"x, y","say ""hi"""\r\n"line1\nline2",z\r\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['line1\nline2', 'z']]);
  });
  it('strips a BOM and skips blank lines', () => {
    expect(parseCSV('﻿a,b\n\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('parseDateString', () => {
  it('accepts ISO, "5 Sep 2026" and day-first numeric', () => {
    expect(parseDateString('2026-09-05')).toBe('2026-09-05');
    expect(parseDateString('5 Sep 2026')).toBe('2026-09-05');
    expect(parseDateString('05/09/2026')).toBe('2026-09-05');
  });
  it('rejects impossible dates', () => {
    expect(parseDateString('2026-02-31')).toBeNull();
    expect(parseDateString('nonsense')).toBeNull();
  });
});

describe('parseAmount', () => {
  it('handles symbols, thousands separators and accounting negatives', () => {
    expect(parseAmount('$1,234.50')).toBe(1234.5);
    expect(parseAmount('-12.5')).toBe(-12.5);
    expect(parseAmount('(12.50)')).toBe(-12.5);
    expect(parseAmount('abc')).toBeNaN();
  });
});

describe('normalizeRecords', () => {
  it('reports bad rows with line numbers and keeps good ones', () => {
    const { items, errors } = normalizeRecords([
      { date: '2026-09-05', amount: '-10', description: 'Coffee', tags: 'Food; Treat' },
      { date: 'bad', amount: '1', description: 'x' },
      { date: '2026-09-06', amount: '', description: 'y' },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'expense', tags: ['Food', 'Treat'] });
    expect(errors).toEqual(['Row 3: invalid or missing date.', 'Row 4: invalid or missing amount.']);
  });
  it('can ignore tags', () => {
    expect(normalizeRecords([{ date: '2026-09-05', amount: '1', description: 'a', tags: 'X' }], { importTags: false }).items[0].tags).toEqual([]);
  });
});

describe('export → import round trip', () => {
  it('preserves awkward descriptions and neutralises formula injection', () => {
    const txns = [{ rawDate: '2026-09-05', description: 'Lunch, "big" one', amount: -12.5, type: 'expense', tags: ['Food', 'Out'], account: 'Main', currency: 'USD', notes: 'a\nb' }];
    const csv = transactionsToCSV(txns);
    const { items, errors } = parseTransactionsCSV(csv);
    expect(errors).toEqual([]);
    expect(items[0]).toMatchObject({ date: '2026-09-05', description: 'Lunch, "big" one', amount: -12.5, tags: ['Food', 'Out'], account: 'Main', notes: 'a\nb' });
    expect(toCSV([['=SUM(A1)']])).toBe("'=SUM(A1)");
  });
});

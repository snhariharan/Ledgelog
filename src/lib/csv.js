/**
 * csv.js — RFC 4180 CSV parsing/serialising and import normalisation.
 */
import { MONTHS_LOWER, toISODate } from '../helpers';

/** Parse CSV text into rows of cells. Handles quotes, escaped quotes, CRLF, embedded newlines and a BOM. */
export function parseCSV(text) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  return rows;
}

const escapeCell = v => {
  const s = String(v ?? '');
  // Quote when needed, and neutralise spreadsheet formula injection.
  const safe = /^[=+@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCSV(rows) {
  return rows.map(r => r.map(escapeCell).join(',')).join('\r\n');
}

export const EXPORT_HEADERS = ['Date', 'Description', 'Amount', 'Type', 'Tags', 'Account', 'Currency', 'Notes'];

export const transactionsToCSV = txns => toCSV([
  EXPORT_HEADERS,
  ...txns.map(t => [
    t.rawDate, t.description, t.amount, t.type ?? (t.amount < 0 ? 'expense' : 'income'),
    (t.tags ?? []).join('; '), t.account, t.currency ?? '', t.notes ?? '',
  ]),
]);

/** Accepts 2026-09-05, 5 Sep 2026, 05/09/2026 (day first) and returns ISO or null. */
export function parseDateString(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validISO(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/);
  if (m) { const mi = MONTHS_LOWER.indexOf(m[2].toLowerCase()); return mi < 0 ? null : validISO(+m[3], mi + 1, +m[1]); }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return validISO(+m[3], +m[2], +m[1]);
  return null;
}

function validISO(y, mo, d) {
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return toISODate(dt);
}

export const parseAmount = raw => {
  const s = String(raw ?? '').trim();
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
};

const TYPES = ['expense', 'income', 'refund', 'transfer_in', 'transfer_out'];
const splitTags = v => (Array.isArray(v) ? v : String(v ?? '').split(/[;,]/)).map(t => String(t).trim()).filter(Boolean);

/**
 * Normalise loosely-shaped records (from CSV or JSON) into import items.
 * Returns { items, errors } where errors are human-readable row messages.
 */
export function normalizeRecords(records, { importTags = true } = {}) {
  const items = [], errors = [];
  records.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const date = parseDateString(r.rawdate ?? r.rawDate ?? r.date);
    const amount = typeof r.amount === 'number' ? r.amount : parseAmount(r.amount);
    const description = String(r.description ?? '').trim();
    if (!date) return errors.push(`Row ${line}: invalid or missing date.`);
    if (!Number.isFinite(amount)) return errors.push(`Row ${line}: invalid or missing amount.`);
    if (!description) return errors.push(`Row ${line}: missing description.`);
    const type = String(r.type ?? '').toLowerCase().replace(/[\s-]/g, '_');
    items.push({
      date, amount, description,
      type: TYPES.includes(type) ? type : (amount < 0 ? 'expense' : 'income'),
      tags: importTags ? splitTags(r.tags) : [],
      account: String(r.account ?? '').trim() || undefined,
      currency: String(r.currency ?? '').trim().toUpperCase() || undefined,
      notes: String(r.notes ?? '').trim(),
    });
  });
  return { items, errors };
}

/** CSV text → normalised import result. */
export function parseTransactionsCSV(text, opts) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { items: [], errors: ['The file has no data rows.'] };
  const headers = rows[0].map(h => h.trim().toLowerCase());
  const records = rows.slice(1).map(cells => Object.fromEntries(headers.map((h, i) => [h, cells[i]])));
  return normalizeRecords(records, opts);
}

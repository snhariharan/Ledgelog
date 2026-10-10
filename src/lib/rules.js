/**
 * rules.js — auto-tag rules. A rule looks at the transaction description
 * (case-insensitive "contains") and adds `tagName` when it matches:
 *
 *   any   (OR)     at least one of these appears      — if non-empty
 *   all   (AND)    every one of these appears         — if non-empty
 *   none  (EXCEPT) none of these appear               — if non-empty
 *
 * A rule needs at least one `any` or `all` term. Rules that only have the
 * original single `matchText` keep working: it counts as one `any` term.
 */
const clean = list => (Array.isArray(list) ? list : []).map(s => String(s).trim()).filter(Boolean);
const lower = list => list.map(s => s.toLowerCase());

/** The rule's terms in their original case: { any, all, none }. */
export function ruleTerms(rule) {
  const any = clean(rule.any), all = clean(rule.all), none = clean(rule.none);
  if (!any.length && !all.length && rule.matchText?.trim()) any.push(rule.matchText.trim());
  return { any, all, none };
}

export function ruleMatches(rule, description) {
  const desc = String(description || '').toLowerCase();
  const { any, all, none } = ruleTerms(rule);
  if (!any.length && !all.length) return false;
  const has = t => desc.includes(t);
  return (!any.length || lower(any).some(has))
    && lower(all).every(has)
    && !lower(none).some(has);
}

/** Tags = the given tags plus the tag of every active rule that matches. */
export function applyRules(description, tags, rules = []) {
  const out = [...tags];
  for (const r of rules) {
    if (!r.active || !r.tagName) continue;
    if (ruleMatches(r, description) && !out.includes(r.tagName)) out.push(r.tagName);
  }
  return out;
}

const quoted = list => list.map(t => `"${t}"`);
const join = (list, word) => (list.length > 1 ? `${quoted(list).slice(0, -1).join(', ')} ${word} ${quoted(list).at(-1)}` : quoted(list)[0]);

/** Human-readable condition, e.g. `contains "S market" or "K market", except "indian"`. */
export function describeRule(rule) {
  const { any, all, none } = ruleTerms(rule);
  const parts = [];
  if (any.length) parts.push(`contains ${join(any, 'or')}`);
  if (all.length) parts.push(`${any.length ? 'and ' : ''}contains ${join(all, 'and')}`);
  if (none.length) parts.push(`except if it contains ${join(none, 'or')}`);
  return parts.join(', ');
}

/** Comma-separated text ↔ term list (for the rule form). */
export const parseTerms = text => clean(String(text ?? '').split(','));
export const termsToText = list => clean(list).join(', ');

/**
 * Starter rules ("Add standard rules" on the Rules page). Tags are created if
 * missing. The Grocery rule shows EXCEPT in action: Indian grocery shops get
 * their own tag instead.
 */
export const STANDARD_RULES = [
  { name: 'Salary → Income',      tag: 'Income',        any: ['salary', 'payroll'] },
  { name: 'Subscriptions',        tag: 'Subscription',  any: ['netflix', 'spotify', 'youtube premium', 'disney+', 'prime video', 'icloud'] },
  { name: 'Indian groceries',     tag: 'Indian Grocery', any: ['indian market', 'indian grocer', 'kairali', 'malligai', 'spice town'] },
  { name: 'Supermarkets',         tag: 'Grocery',       any: ['s market', 'k market', 'k-market', 'prisma', 'lidl', 'alepa', 'tesco', 'aldi', 'walmart'], none: ['indian'] },
  { name: 'Fuel & charging',      tag: 'Fuel',          any: ['fuel', 'petrol', 'diesel', 'neste', 'shell', 'teboil', 'st1', 'plugit', 'charging'] },
  { name: 'Parking',              tag: 'Parking',       any: ['parking', 'pysäköinti'] },
  { name: 'Public transport',     tag: 'Travel',        any: ['hsl', 'uber', 'bolt', 'metro', 'bus ticket', 'train ticket'] },
  { name: 'Phone & internet bills', tag: 'Bill',        all: ['bill'], any: ['elisa', 'dna', 'telia', 'internet', 'phone', 'electricity', 'water'] },
  { name: 'Loans & EMIs',         tag: 'Loan',          any: ['loan', 'emi'], none: ['payout'] },
  { name: 'Health',               tag: 'Health',        any: ['apteekki', 'pharmacy', 'doctor', 'dentist', 'clinic', 'hospital'] },
  { name: 'Eating out',           tag: 'Food',          any: ['mcd', 'mcdonald', 'burger king', 'restaurant', 'cafe', 'coffee', 'pizza', 'kebab'] },
];

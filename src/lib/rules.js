/**
 * rules.js — auto-tag rules. A rule matches when the transaction description
 * contains `matchText` (case-insensitive) and then adds `tagName`.
 */
export function applyRules(description, tags, rules = []) {
  const desc = String(description || '').toLowerCase();
  const out = [...tags];
  for (const r of rules) {
    if (!r.active || !r.matchText || !r.tagName) continue;
    if (desc.includes(r.matchText.toLowerCase()) && !out.includes(r.tagName)) out.push(r.tagName);
  }
  return out;
}

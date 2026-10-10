import { describe, it, expect } from 'vitest';
import { applyRules, ruleMatches, describeRule, parseTerms, STANDARD_RULES } from './rules';

const rule = (extra = {}) => ({ id: 1, name: 'r', tagName: 'T', active: true, ...extra });

describe('rule matching', () => {
  it('keeps single matchText rules working (case-insensitive contains)', () => {
    expect(ruleMatches(rule({ matchText: 'netflix' }), 'NETFLIX.com')).toBe(true);
    expect(ruleMatches(rule({ matchText: 'netflix' }), 'Spotify')).toBe(false);
  });

  it('OR: any one term is enough', () => {
    const r = rule({ any: ['s market', 'k market'] });
    expect(ruleMatches(r, 'K Market Espoo')).toBe(true);
    expect(ruleMatches(r, 'Lidl')).toBe(false);
  });

  it('AND: every term is needed', () => {
    const r = rule({ all: ['elisa', 'bill'] });
    expect(ruleMatches(r, 'Elisa bill')).toBe(true);
    expect(ruleMatches(r, 'Elisa')).toBe(false);
  });

  it('OR combined with AND', () => {
    const r = rule({ any: ['elisa', 'dna'], all: ['bill'] });
    expect(ruleMatches(r, 'DNA bill')).toBe(true);
    expect(ruleMatches(r, 'DNA')).toBe(false);
    expect(ruleMatches(r, 'water bill')).toBe(false);
  });

  it('EXCEPT: a blocked term cancels the match', () => {
    const r = rule({ any: ['market'], none: ['indian', 'refund'] });
    expect(ruleMatches(r, 'S market')).toBe(true);
    expect(ruleMatches(r, 'indian market kairali')).toBe(false);
    expect(ruleMatches(r, 'Market REFUND')).toBe(false);
  });

  it('a rule with only EXCEPT terms never matches', () => {
    expect(ruleMatches(rule({ none: ['x'] }), 'anything')).toBe(false);
  });

  it('applyRules skips inactive rules and does not duplicate tags', () => {
    const rules = [rule({ any: ['a'], tagName: 'A' }), rule({ id: 2, any: ['a'], tagName: 'B', active: false })];
    expect(applyRules('abc', ['A'], rules)).toEqual(['A']);
    expect(applyRules('abc', [], rules)).toEqual(['A']);
  });

  it('describes rules in words', () => {
    expect(describeRule(rule({ any: ['a', 'b'], all: ['c'], none: ['d'] })))
      .toBe('contains "a" or "b", and contains "c", except if it contains "d"');
    expect(describeRule(rule({ matchText: 'Netflix' }))).toBe('contains "Netflix"');
  });

  it('parses comma-separated terms', () => {
    expect(parseTerms(' a, b ,, c ')).toEqual(['a', 'b', 'c']);
  });
});

describe('standard rules', () => {
  const tagsFor = d => applyRules(d, [], STANDARD_RULES.map((r, i) => ({ id: i, name: r.name, tagName: r.tag, any: r.any, all: r.all, none: r.none, active: true })));
  it('tag common descriptions, and keep Indian groceries out of Grocery', () => {
    expect(tagsFor('S market')).toEqual(['Grocery']);
    expect(tagsFor('indian market kairali')).toEqual(['Indian Grocery']);
    expect(tagsFor('Elisa bill')).toEqual(['Bill']);
    expect(tagsFor('fuel 16th sep')).toEqual(['Fuel']);
    expect(tagsFor('May-June expense payout')).toEqual([]);
  });
});

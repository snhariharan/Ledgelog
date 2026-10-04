import { formatDisplayDate, monthShort, todayISO, toISODate } from './helpers';
import { nextOccurrence } from './lib/repeats';

// Demo data is authored around Aug 2026 and shifted so the newest month is
// always the current month — period filters ("This Month") then have data.
const BASE_MONTH_INDEX = 2026 * 12 + 7;
const NOW = new Date();
const SHIFT = NOW.getFullYear() * 12 + NOW.getMonth() - BASE_MONTH_INDEX;
const TODAY = todayISO();

const MONTHS = Array.from({ length: 12 }, (_, i) => monthShort(i));
/** '10 Aug 2026' → shifted ISO date, never later than today. */
const shiftDate = label => {
  const [d, mon, y] = label.split(' ');
  const idx = Number(y) * 12 + MONTHS.indexOf(mon) + SHIFT;
  const iso = toISODate(new Date(Math.floor(idx / 12), idx % 12, Number(d)));
  return iso > TODAY ? TODAY : iso;
};

// ─── Accounts ────────────────────────────────────────────────────────────────
export const accountsData = [
  { id: 1, name: 'OP Account',      balance: 4521.38,  type: 'checking', institution: 'OnePoint Bank', currency: 'EUR' },
  { id: 2, name: 'Savings Account', balance: 7950.00,  type: 'savings',  institution: 'OnePoint Bank', currency: 'EUR' },
  { id: 3, name: 'HDFC Credit',     balance: 1240.55, type: 'credit',   institution: 'HDFC Bank', currency: 'INR' },
  { id: 4, name: 'SBI Savings',     balance: 3100.00,  type: 'savings',  institution: 'State Bank', currency: 'INR' },
  { id: 6, name: 'ICICI Credit',    balance: 45000.00,type: 'credit',   institution: 'ICICI Bank', currency: 'INR', limit: 300000 },
];

export const archivedAccountsData = [
  { id: 5, name: 'Old Checking',    balance: 0,        type: 'checking', institution: 'Legacy Bank' },
];


// ─── Tags ─────────────────────────────────────────────────────────────────────
export const tagsData = [
  { id: 1,  name: 'Home',            color: '#ef4444' },
  { id: 2,  name: 'Car',             color: '#f59e0b' },
  { id: 3,  name: 'Loan',            color: '#8b5cf6' },
  { id: 4,  name: 'Grocery',         color: '#10b981' },
  { id: 5,  name: 'Bill',            color: '#3b82f6' },
  { id: 6,  name: 'India',           color: '#ec4899' },
  { id: 7,  name: 'Indian Grocery',  color: '#14b8a6' },
  { id: 8,  name: 'Dining',          color: '#f97316' },
  { id: 9,  name: 'Entertainment',   color: '#a855f7' },
  { id: 10, name: 'Travel',          color: '#0ea5e9' },
  { id: 11, name: 'Health',          color: '#84cc16' },
  { id: 12, name: 'Income',          color: '#22c55e' },
  { id: 13, name: 'Utilities',       color: '#64748b' },
  { id: 14, name: 'Subscription',    color: '#d946ef' },
];

// ─── Budgets ──────────────────────────────────────────────────────────────────
export const budgetsData = [
  { id: 1, tagId: 1, tag: 'Home',           monthlyLimit: 600.00,  color: '#ef4444' },
  { id: 2, tagId: 2, tag: 'Car',            monthlyLimit: 400.00,  color: '#f59e0b' },
  { id: 3, tagId: 4, tag: 'Grocery',        monthlyLimit: 500.00,  color: '#10b981' },
  { id: 4, tagId: 3, tag: 'Loan',           monthlyLimit: 1450.00, color: '#8b5cf6' },
  { id: 5, tagId: 7, tag: 'Indian Grocery', monthlyLimit: 300.00,  color: '#14b8a6' },
  { id: 6, tagId: 8, tag: 'Dining',         monthlyLimit: 250.00,  color: '#f97316' },
  { id: 7, tagId: 13, tag: 'Utilities',     monthlyLimit: 200.00,  color: '#64748b' },
  { id: 8, tagId: 14, tag: 'Subscription',  monthlyLimit: 80.00,   color: '#d946ef' },
];

// ─── Transactions ─────────────────────────────────────────────────────────────
let txId = 1;
const tx = (date, amount, description, tags, account, deleted = false) => {
  const rawDate = shiftDate(date);
  return {
    id: txId++,
    date: formatDisplayDate(rawDate),
    rawDate,
    amount, description, tags, account, deleted,
    untagged: tags.length === 0,
    type: amount < 0 ? 'expense' : 'income',
    notes: '',
  };
};

export const transactionsData = [
  // ── August 2026 ──
  tx('10 Aug 2026', -465.40, 'Home maintenance',          ['Home'],           'OP Account'),
  tx('10 Aug 2026',  -23.50, 'Swiggy order',              ['Dining'],         'HDFC Credit'),
  tx('9 Aug 2026',  -120.48, 'Loan 2 EMI',                ['Loan'],           'OP Account'),
  tx('9 Aug 2026',  -285.71, 'HDFC Loan 1',               ['Loan'],           'OP Account'),
  tx('8 Aug 2026',  -313.90, 'Car EMI',                   ['Car'],            'OP Account'),
  tx('8 Aug 2026',   -78.30, 'Weekly grocery run',        ['Grocery'],        'OP Account'),
  tx('7 Aug 2026',   -45.99, 'Netflix annual',            ['Subscription'],   'HDFC Credit'),
  tx('7 Aug 2026',  -206.04, 'Car Insurance bill',        ['Car', 'Bill'],    'OP Account'),
  tx('6 Aug 2026',  5200.00, 'Salary August',             ['Income'],         'OP Account'),
  tx('6 Aug 2026',  -119.00, 'Electricity bill',          ['Utilities'],      'OP Account'),
  tx('5 Aug 2026',   -88.50, 'Indian Grocery - Patel',    ['Indian Grocery'], 'OP Account'),
  tx('5 Aug 2026',  -2000.00,'Wire transfer to India',    ['India'],          'OP Account'),
  tx('4 Aug 2026',   -34.20, 'Movie tickets',             ['Entertainment'],  'HDFC Credit'),
  tx('4 Aug 2026',   -62.10, 'Restaurant - Olive Garden', ['Dining'],         'HDFC Credit'),
  tx('3 Aug 2026',  -250.00, 'Home cleaning service',     ['Home'],           'OP Account'),
  tx('3 Aug 2026',    -9.99, 'Spotify subscription',      ['Subscription'],   'HDFC Credit'),
  tx('2 Aug 2026',   -55.90, 'Walmart grocery',           ['Grocery'],        'OP Account'),
  tx('2 Aug 2026',   -24.75, 'Gas station',               ['Car'],            'OP Account'),
  tx('1 Aug 2026',  -870.00, 'Home insurance payment',    ['Home'],           'SBI Savings'),
  tx('1 Aug 2026',   -36.35, 'Phone bill',                ['Bill'],           'OP Account'),

  // ── July 2026 ──
  tx('31 Jul 2026', -120.00, 'Home repair parts',         ['Home'],           'OP Account'),
  tx('30 Jul 2026',  -87.40, 'Grocery - Costco',          ['Grocery'],        'OP Account'),
  tx('30 Jul 2026',  -45.00, 'Gym membership',            ['Health'],         'HDFC Credit'),
  tx('28 Jul 2026',   -9.00, 'Amazon Prime',              ['Subscription'],   'HDFC Credit'),
  tx('28 Jul 2026',  -156.20,'Dining out - birthday',     ['Dining'],         'HDFC Credit'),
  tx('27 Jul 2026',  -889.17,'Loan 1 EMI',                ['Loan'],           'OP Account'),
  tx('26 Jul 2026',  5200.00,'Salary July',               ['Income'],         'OP Account'),
  tx('25 Jul 2026', -2000.00,'India wire transfer',       ['India'],          'Savings Account'),
  tx('24 Jul 2026',   -48.00,'Car wash + detailing',      ['Car'],            'OP Account'),
  tx('22 Jul 2026',  -115.00,'Electricity + water bill',  ['Utilities'],      'OP Account'),
  tx('22 Jul 2026',   -73.10,'Indian Grocery - weekly',   ['Indian Grocery'], 'OP Account'),
  tx('20 Jul 2026',  -190.00,'Home décor purchase',       ['Home'],           'HDFC Credit'),
  tx('18 Jul 2026',  -120.48,'Loan 2 EMI',                ['Loan'],           'OP Account'),
  tx('16 Jul 2026',   -33.99,'Hulu subscription',         ['Subscription'],   'HDFC Credit'),
  tx('15 Jul 2026',  -313.90,'Car EMI July',              ['Car'],            'OP Account'),
  tx('12 Jul 2026',   -99.50,'Doctor visit copay',        ['Health'],         'OP Account'),
  tx('10 Jul 2026',  -102.20,'Grocery - Whole Foods',     ['Grocery'],        'OP Account'),
  tx('8 Jul 2026',    -55.75,'Restaurant dinner',         ['Dining'],         'HDFC Credit'),
  tx('5 Jul 2026',    -88.50,'Indian Grocery',            ['Indian Grocery'], 'OP Account'),
  tx('3 Jul 2026',    -29.00,'Phone bill July',           ['Bill'],           'OP Account'),

  // ── June 2026 ──
  tx('30 Jun 2026',  5200.00,'Salary June',               ['Income'],         'OP Account'),
  tx('28 Jun 2026', -2000.00,'India remittance',          ['India'],          'Savings Account'),
  tx('25 Jun 2026',  -889.17,'Loan 1 EMI June',           ['Loan'],           'OP Account'),
  tx('22 Jun 2026',  -313.90,'Car EMI June',              ['Car'],            'OP Account'),
  tx('20 Jun 2026',  -120.48,'Loan 2 EMI June',           ['Loan'],           'OP Account'),
  tx('18 Jun 2026',  -250.00,'Home repairs',              ['Home'],           'OP Account'),
  tx('15 Jun 2026',   -87.60,'Grocery run',               ['Grocery'],        'OP Account'),
  tx('12 Jun 2026',   -62.50,'Dining - sushi place',      ['Dining'],         'HDFC Credit'),
  tx('10 Jun 2026',  -115.00,'Electric bill June',        ['Utilities'],      'OP Account'),
  tx('5 Jun 2026',    -38.40,'Gas station',               ['Car'],            'OP Account'),

  // ── Deleted / Untagged ──
  tx('15 Jul 2026', -200.00, 'Unknown charge', [], 'HDFC Credit'),
  tx('1 Jun 2026',  -500.00, 'Old transaction deleted', ['Home'], 'OP Account', true),
];

// ─── IOUs ────────────────────────────────────────────────────────────────────
export const iousData = [
  { id: 1, person: 'Rahul Kumar',  amount: 250.00,  direction: 'owe_me',  note: 'Dinner split', date: formatDisplayDate(shiftDate('5 Aug 2026')) },
  { id: 2, person: 'Priya S',      amount: -80.00,  direction: 'i_owe',   note: 'Movie tickets', date: formatDisplayDate(shiftDate('4 Aug 2026')) },
  { id: 3, person: 'Arjun M',      amount: 120.50,  direction: 'owe_me',  note: 'Grocery split', date: formatDisplayDate(shiftDate('28 Jul 2026')) },
];

// ─── Repeating Transactions ───────────────────────────────────────────────────
const rawRepeats = [
  { id: 1, description: 'Loan 1 EMI',       amount: -889.17, frequency: 'Monthly', nextDate: '27 Aug 2026', tags: ['Loan'] },
  { id: 2, description: 'Car EMI',          amount: -313.90, frequency: 'Monthly', nextDate: '15 Aug 2026', tags: ['Car'] },
  { id: 3, description: 'Loan 2 EMI',       amount: -120.48, frequency: 'Monthly', nextDate: '18 Aug 2026', tags: ['Loan'] },
  { id: 4, description: 'Netflix',          amount:  -45.99, frequency: 'Monthly', nextDate: '7 Sep 2026',  tags: ['Subscription'] },
  { id: 5, description: 'India Wire',       amount: -2000.00,frequency: 'Monthly', nextDate: '5 Sep 2026',  tags: ['India'] },
  { id: 6, description: 'Salary',           amount:  5200.00,frequency: 'Monthly', nextDate: '6 Sep 2026',  tags: ['Income'] },
];

const upcoming = (label, frequency) => {
  let iso = shiftDate(label);
  while (iso <= TODAY) iso = nextOccurrence(iso, frequency);
  return iso;
};
export const repeatsData = rawRepeats.map(r => {
  const nextDateISO = upcoming(r.nextDate, r.frequency);
  return { ...r, account: 'OP Account', nextDateISO, nextDate: formatDisplayDate(nextDateISO) };
});

// ─── Rules ────────────────────────────────────────────────────────────────────
export const rulesData = [
  { id: 1, name: 'Auto-tag Salary',       matchText: 'Salary',   tagId: 12, tagName: 'Income',       active: true  },
  { id: 2, name: 'India wire → India',    matchText: 'India',    tagId: 6,  tagName: 'India',        active: true  },
  { id: 3, name: 'Loan EMIs',             matchText: 'EMI',      tagId: 3,  tagName: 'Loan',         active: true  },
  { id: 4, name: 'Swiggy → Dining',       matchText: 'Swiggy',   tagId: 8,  tagName: 'Dining',       active: false },
  { id: 5, name: 'Netflix subscription',  matchText: 'Netflix',  tagId: 14, tagName: 'Subscription', active: true  },
];

// ─── Holdings ─────────────────────────────────────────────────────────────────
export const holdingsData = [
  { id:1, name:'S&P 500 Index',    ticker:'SPY',  shares:12.5, price:445.20, cost:380.00, kind:'ETF',   color:'#3b82f6', currency:'USD' },
  { id:2, name:'Apple Inc.',       ticker:'AAPL', shares:8,    price:189.30, cost:155.00, kind:'Stock', color:'#6366f1', currency:'USD' },
  { id:3, name:'Gold ETF',         ticker:'GLD',  shares:5,    price:184.50, cost:170.00, kind:'ETF',   color:'#f59e0b', currency:'USD' },
  { id:4, name:'US Bond Fund',     ticker:'BND',  shares:20,   price:73.10,  cost:78.00,  kind:'ETF',   color:'#10b981', currency:'USD' },
  { id:5, name:'Emerging Markets', ticker:'VWO',  shares:30,   price:41.80,  cost:38.00,  kind:'ETF',   color:'#ec4899', currency:'USD' },
];

// ─── Favorite Reports ─────────────────────────────────────────────────────────
export const favoritesData = [
  { id: 1, name: 'Monthly Expense Summary', type: 'report', icon: 'bar-chart' },
  { id: 2, name: 'India Transfers',         type: 'filter', icon: 'filter' },
  { id: 3, name: 'Loan Tracker',            type: 'report', icon: 'trending-down' },
];

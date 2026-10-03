export const APP_SETTINGS = {
  theme: localStorage.getItem('app_theme') || 'light'
};

export const setSetting = (key, val) => {
  APP_SETTINGS[key] = val;
  localStorage.setItem(`app_${key}`, val);
};

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$'
};



export const fmt = (n, showSign = false, currencyCode = 'USD') => {
  const abs = Math.abs(n);
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sym = CURRENCY_SYMBOLS[currencyCode] || currencyCode || '$';
  if (showSign && n > 0) return '+' + sym + str;
  if (n < 0) return '-' + sym + str;
  return sym + str;
};
export const PERIODS = ['This Month','Last Month','Last 3 Months','This Year','Last Year','All Time'];
export const PAGE_SIZE = 15;
export const TODAY = new Date().toISOString().slice(0, 10);
export const TX_TYPES = [{key:'expense',label:'EXPENSE',sign:'-',color:'#ef4444'},{key:'transfer_out',label:'TRANSFER OUT',sign:'-',color:'#f59e0b'},{key:'income',label:'INCOME',sign:'+',color:'#10b981'},{key:'refund',label:'REFUND',sign:'+',color:'#3b82f6'},{key:'transfer_in',label:'TRANSFER IN',sign:'+',color:'#8b5cf6'}];
export const PRESET_COLORS = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#64748b'];
export const ACCOUNT_TYPES = ['checking','savings','credit','investment','loan','cash','other'];
export const IOU_FREQS = ['Monthly','Weekly','Bi-weekly','Yearly','One-time'];

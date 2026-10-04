import React from 'react';
import { TrendingUp } from 'lucide-react';
import { fmt, monthShort } from '../helpers';
import { monthlySeries } from '../lib/derive';
import { monthlyEquivalent } from '../lib/repeats';

/** Average of the last `n` COMPLETED months that have any activity. */
const avgCompleted = (series, key, n = 3) => {
  const done = series.slice(0, -1).filter(r => r.income || r.expense).slice(-n);
  return done.length ? done.reduce((s, r) => s + r[key], 0) / done.length : 0;
};

function ForecastPage({ appData }) {
  const { repeats, accounts, baseCurrency, baseTransactions, netWorthByCurrency } = appData;
  const now = new Date();

  const inBase = repeats.filter(r => (accounts.find(a => a.name === r.account)?.currency ?? baseCurrency) === baseCurrency);
  const recurringExp = inBase.filter(r => r.amount < 0).reduce((s, r) => s - monthlyEquivalent(r), 0);
  const recurringInc = inBase.filter(r => r.amount > 0).reduce((s, r) => s + monthlyEquivalent(r), 0);

  const series = monthlySeries(baseTransactions, 6, now);
  const histIncome = avgCompleted(series, 'income');
  const histExpense = avgCompleted(series, 'expense');
  const hasHistory = histIncome > 0 || histExpense > 0;

  // Recurring items already appear in history, so only the remainder is "variable".
  const monthlyIncome  = hasHistory ? histIncome : recurringInc;
  const variableExp    = hasHistory ? Math.max(0, histExpense - recurringExp) : 0;
  const monthlyExpense = recurringExp + variableExp;
  const monthlyNet     = monthlyIncome - monthlyExpense;

  let balance = netWorthByCurrency.find(([c]) => c === baseCurrency)?.[1] ?? 0;
  const projections = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
    balance += monthlyNet;
    return { month: `${monthShort(d.getMonth())} ${d.getFullYear()}`, income: monthlyIncome, expense: -monthlyExpense, net: monthlyNet, balance };
  });
  const maxBal = Math.max(...projections.map(p => Math.abs(p.balance)), 1);
  const upcoming = [...repeats].sort((a, b) => a.nextDateISO.localeCompare(b.nextDateISO));

  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <TrendingUp size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Forecast</span>
        </div>
      </div>
      <div className="main-scroll">
        <div className="summary-strip">
          <div className="sum-card">
            <span className="sum-label">Expected Monthly Income</span>
            <span className="sum-val val-green">{fmt(monthlyIncome, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Recurring Expenses</span>
            <span className="sum-val val-red">{fmt(recurringExp, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Projected Monthly Savings</span>
            <span className="sum-val" style={{color:monthlyNet>=0?'var(--green)':'var(--red)'}}>{fmt(monthlyNet, true, baseCurrency)}</span>
          </div>
        </div>
        <div className="form-note" style={{margin:'0.25rem'}}>
          {hasHistory
            ? 'Based on your average of up to the last 3 completed months. Recurring transactions are counted once; the rest is treated as variable spending.'
            : 'No completed months of history yet — using your recurring transactions only.'}
        </div>

        <div className="widget-card" style={{marginTop:'1rem'}}>
          <div className="widget-hdr"><span className="widget-ttl">6-Month Projection</span></div>
          <table className="page-table">
            <thead>
              <tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th><th>Projected Net Worth</th></tr>
            </thead>
            <tbody>
              {projections.map(p => (
                <tr key={p.month}>
                  <td style={{fontWeight:600}}>{p.month}</td>
                  <td style={{color:'var(--green)'}}>{fmt(p.income, true, baseCurrency)}</td>
                  <td style={{color:'var(--red)'}}>{fmt(p.expense, false, baseCurrency)}</td>
                  <td style={{color:p.net>=0?'var(--green)':'var(--red)',fontWeight:600}}>{fmt(p.net, true, baseCurrency)}</td>
                  <td>
                    <div style={{fontSize:'0.72rem',marginBottom:3}}>{fmt(p.balance, false, baseCurrency)}</div>
                    <div style={{height:6,background:'var(--border)',borderRadius:4,width:'100%'}}>
                      <div style={{height:'100%',width:`${Math.min(Math.abs(p.balance)/maxBal*100,100)}%`,
                        background:p.balance>=0?'var(--green)':'var(--red)',borderRadius:4}}/>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="widget-card" style={{marginTop:'1rem'}}>
          <div className="widget-hdr"><span className="widget-ttl">Upcoming Recurring Transactions</span></div>
          {upcoming.length === 0 && <div className="empty-state" style={{padding:'1.5rem'}}>No recurring transactions. Add one from the Repeats tab.</div>}
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',marginTop:'0.5rem'}}>
            {upcoming.map(r => (
              <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 0.25rem',borderBottom:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontWeight:600,fontSize:'0.82rem'}}>{r.description}</div>
                  <div style={{fontSize:'0.7rem',color:'var(--text-3)'}}>{r.frequency} · Next: {r.nextDate}</div>
                </div>
                <span style={{fontWeight:700,color:r.amount<0?'var(--red)':'var(--green)',fontSize:'0.85rem'}}>
                  {fmt(r.amount, true, accounts.find(a => a.name === r.account)?.currency ?? baseCurrency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
export default ForecastPage;

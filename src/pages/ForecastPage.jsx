import React from 'react';
import { TrendingUp } from 'lucide-react';
import { fmt } from '../helpers';

function ForecastPage({ appData }) {
  const { repeats, summaryData } = appData;
  const baseCurrency = appData.accounts?.[0]?.currency || 'USD';
  const months = ['Sep 2026','Oct 2026','Nov 2026','Dec 2026','Jan 2027','Feb 2027'];
  const monthlyIncome = summaryData.incomeThisMonth;
  const recurringExp  = repeats.filter(r=>r.amount<0).reduce((s,r)=>s+Math.abs(r.amount),0);
  const projections   = months.map((m,i) => ({
    month: m,
    income: monthlyIncome,
    expense: -(recurringExp + 800 + Math.sin(i)*200),
    net: monthlyIncome - (recurringExp + 800 + Math.sin(i)*200),
  }));

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
            <span className="sum-label">Monthly Income</span>
            <span className="sum-val val-green">{fmt(monthlyIncome, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Recurring Expenses</span>
            <span className="sum-val val-red">{fmt(recurringExp, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Projected Savings</span>
            <span className="sum-val val-green">{fmt(monthlyIncome - recurringExp - 800, false, baseCurrency)}</span>
          </div>
        </div>

        {/* Projection table */}
        <div className="widget-card" style={{marginTop:'1rem'}}>
          <div className="widget-hdr"><span className="widget-ttl">6-Month Projection</span></div>
          <table className="page-table">
            <thead>
              <tr>
                <th>Month</th><th>Income</th><th>Expenses</th><th>Net</th><th>Balance Trend</th>
              </tr>
            </thead>
            <tbody>
              {projections.map((p) => (
                <tr key={p.month}>
                  <td style={{fontWeight:600}}>{p.month}</td>
                  <td style={{color:'var(--green)'}}>+{fmt(p.income, false, baseCurrency)}</td>
                  <td style={{color:'var(--red)'}}>{fmt(p.expense, false, baseCurrency)}</td>
                  <td style={{color:p.net>=0?'var(--green)':'var(--red)',fontWeight:600}}>
                    {p.net>=0?'+':''}{fmt(p.net, false, baseCurrency)}
                  </td>
                  <td>
                    <div style={{height:8,background:'var(--border)',borderRadius:4,width:'100%'}}>
                      <div style={{height:'100%',width:`${Math.min((p.net/monthlyIncome)*100+50,100)}%`,
                        background:p.net>=0?'var(--green)':'var(--red)',borderRadius:4}}/>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Upcoming recurring */}
        <div className="widget-card" style={{marginTop:'1rem'}}>
          <div className="widget-hdr"><span className="widget-ttl">Upcoming Recurring Transactions</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',marginTop:'0.5rem'}}>
            {[...appData.repeats].sort((a,b)=>new Date(a.nextDate)-new Date(b.nextDate)).map(r => (
              <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.5rem 0.25rem',borderBottom:'1px solid var(--border)'}}>
                <div>
                  <div style={{fontWeight:600,fontSize:'0.82rem'}}>{r.description}</div>
                  <div style={{fontSize:'0.7rem',color:'var(--text-3)'}}>{r.frequency} · Next: {r.nextDate}</div>
                </div>
                <span style={{fontWeight:700,color:r.amount<0?'var(--red)':'var(--green)',fontSize:'0.85rem'}}>
                  {fmt(r.amount,true, baseCurrency)}
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

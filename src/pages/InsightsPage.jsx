import React, { useState, useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import { fmt, formatDisplayDate } from '../helpers';
import { dailyCumulative, monthlySeries, previousRange, inRange, topMovers, netWorthByCurrency } from '../lib/derive';
import DonutChart from '../components/DonutChart';
import TransactionsTable from '../components/TransactionsTable';
import PeriodSelect from '../components/PeriodSelect';

const ymOf = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;

function Timeline({ current, previous, labelCur, labelPrev }) {
  const max = Math.max(...current, ...previous, 1);
  const W = 280, H = 105;
  const path = vals => vals.map((v, i) => `${i ? 'L' : 'M'}${(10 + (i / Math.max(vals.length - 1, 1)) * W).toFixed(1)},${(115 - (v / max) * H).toFixed(1)}`).join(' ');
  return (
    <svg width="100%" height="145" viewBox="0 0 300 130" preserveAspectRatio="none" role="img" aria-label={`Cumulative spending, ${labelCur} vs ${labelPrev}`}>
      <path d={path(previous)} fill="none" stroke="var(--text-3)" strokeWidth="1.4" strokeDasharray="4 3" strokeLinejoin="round"/>
      <path d={path(current)} fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  );
}

function InsightsPage({ appData, period, onPeriod }) {
  const { tags, expensesData, incomeData, summaryData, baseCurrency, baseTransactions, normalizedRanged, rangedTransactions, accounts, range } = appData;
  const [tab, setTab] = useState('expense');

  const series = useMemo(() => monthlySeries(baseTransactions, 12), [baseTransactions]);
  const maxVal = Math.max(...series.flatMap(r => [r.income, r.expense]), 1);
  const firstActive = series.findIndex(r => r.income || r.expense);
  const activeSeries = firstActive < 0 ? [] : series.slice(firstActive);
  const avgExpense = activeSeries.length ? activeSeries.reduce((s, r) => s + r.expense, 0) / activeSeries.length : 0;

  const movers = useMemo(() => {
    const prev = previousRange(period);
    if (!prev) return null;
    return topMovers(normalizedRanged, baseTransactions.filter(t => inRange(t.rawDate, prev)), tags).slice(0, 10);
  }, [period, normalizedRanged, baseTransactions, tags]);
  const prevRange = previousRange(period);

  const now = new Date();
  const curYM = ymOf(now.getFullYear(), now.getMonth());
  const prevD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYM = ymOf(prevD.getFullYear(), prevD.getMonth());
  const curCum = useMemo(() => dailyCumulative(baseTransactions, curYM).slice(0, now.getDate()), [baseTransactions, curYM]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevCum = useMemo(() => dailyCumulative(baseTransactions, prevYM), [baseTransactions, prevYM]);

  const totalExp = expensesData.reduce((s,e)=>s+Math.abs(e.amount),0);
  const savings = summaryData.income + summaryData.expense;
  const worth = netWorthByCurrency(accounts);

  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <Lightbulb size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Insights</span>
          <PeriodSelect period={period} onChange={onPeriod}/>
        </div>
      </div>
      <div className="main-scroll">
        <div className="summary-strip">
          <div className="sum-card">
            <span className="sum-label">INCOME</span>
            <span className="sum-val val-green">{fmt(summaryData.income, true, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">EXPENSE</span>
            <span className="sum-val val-red">{fmt(summaryData.expense, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">SAVINGS</span>
            <span className="sum-val" style={{color:savings>=0?'var(--green)':'var(--red)'}}>{fmt(savings, true, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label" style={{fontSize:'0.6rem'}}>AVG EXPENSE / MONTH<br/><span style={{fontWeight:400,color:'var(--text-3)'}}>LAST 12 MONTHS</span></span>
            <span className="sum-val" style={{color:'var(--blue)'}}>{fmt(avgExpense, false, baseCurrency)}</span>
          </div>
        </div>

        <div className="ins-tab-row" style={{marginTop:'1rem'}}>
          {['expense','income','net worth'].map(t=>(
            <div key={t} className={`ins-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t.toUpperCase()}</div>
          ))}
        </div>

        <div className="ins-cols">
          <div className="widget-card">
            {tab === 'net worth' ? (
              <>
                <div className="widget-hdr"><span className="widget-ttl">NET WORTH</span></div>
                <table className="ins-tag-table">
                  <thead><tr><th>ACCOUNT</th><th>BALANCE</th></tr></thead>
                  <tbody>
                    {accounts.map(a => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        <td style={{color:a.type==='credit'?'var(--red)':'var(--text-1)',fontWeight:600}}>
                          {fmt(a.type==='credit' ? -a.balance : a.balance, false, a.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {worth.map(([c, v]) => <tr key={c}><td style={{fontWeight:700}}>TOTAL ({c})</td><td style={{fontWeight:700}}>{fmt(v, false, c)}</td></tr>)}
                  </tfoot>
                </table>
              </>
            ) : (
              <>
                <div className="widget-hdr"><span className="widget-ttl">{tab.toUpperCase()}</span></div>
                <DonutChart data={tab === 'expense' ? expensesData : incomeData.map(r => ({ ...r, amount: -r.amount }))} currency={baseCurrency}/>
                <table className="ins-tag-table" style={{marginTop:'0.75rem'}}>
                  <thead><tr><th>TAG</th><th>{tab.toUpperCase()}</th></tr></thead>
                  <tbody>
                    {(tab === 'expense' ? expensesData : incomeData).map(e=>(
                      <tr key={e.id}>
                        <td><span className="tag-dot-cell"><span style={{width:8,height:8,borderRadius:'50%',background:e.color,display:'inline-block',flexShrink:0}}/>{e.name}</span></td>
                        <td style={{color:tab==='expense'?'var(--red)':'var(--green)',fontWeight:600}}>{fmt(Math.abs(e.amount), false, baseCurrency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td style={{fontWeight:700}}>TOTAL</td><td style={{fontWeight:700}}>{fmt(tab === 'expense' ? totalExp : summaryData.income, false, baseCurrency)}</td></tr></tfoot>
                </table>
              </>
            )}
          </div>

          <div className="widget-card">
            <div className="widget-hdr">
              <span className="widget-ttl">TOP MOVERS</span>
              <span style={{fontSize:'0.65rem',color:'var(--text-3)'}}>
                {range && prevRange ? `${formatDisplayDate(range.start)} – ${formatDisplayDate(range.end)} vs previous` : ''}
              </span>
            </div>
            {movers === null ? (
              <div className="empty-state" style={{padding:'1.5rem'}}>Pick a specific period to compare against the one before it.</div>
            ) : movers.length === 0 ? (
              <div className="empty-state" style={{padding:'1.5rem'}}>No change in spending versus the previous period.</div>
            ) : (
              <table className="ins-tag-table" style={{marginTop:'0.5rem'}}>
                <thead><tr><th>TAG</th><th>NOW</th><th>CHANGE</th></tr></thead>
                <tbody>
                  {movers.map(m=>(
                    <tr key={m.name}>
                      <td><span className="tag-dot-cell"><span style={{width:8,height:8,borderRadius:'50%',background:m.color,display:'inline-block',flexShrink:0}}/>{m.name}</span></td>
                      <td>{fmt(m.current, false, baseCurrency)}</td>
                      <td style={{color:m.delta>0?'var(--red)':'var(--green)',fontWeight:600}}>{fmt(m.delta, true, baseCurrency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="ins-cols">
          <div className="widget-card">
            <div className="widget-hdr">
              <span className="widget-ttl">TREND &nbsp;<span style={{color:'var(--green)',fontWeight:600}}>◆ INCOME</span> vs <span style={{color:'var(--red)',fontWeight:600}}>EXPENSE</span></span>
              <span style={{fontSize:'0.65rem',color:'var(--text-3)'}}>LAST 12 MONTHS</span>
            </div>
            <div className="bar-chart-wrap">
              {series.map(r => (
                <div key={r.key} className="bar-group">
                  <div className="bar-pair">
                    <div className="bar bar-income" style={{height:`${Math.round((r.income/maxVal)*120)}px`}} title={`Income: ${fmt(r.income, false, baseCurrency)}`}/>
                    <div className="bar bar-expense" style={{height:`${Math.round((r.expense/maxVal)*120)}px`}} title={`Expense: ${fmt(r.expense, false, baseCurrency)}`}/>
                  </div>
                  <div className="bar-label">{r.label}</div>
                </div>
              ))}
              <div className="bar-legend">
                <span className="bleg-item"><span className="bleg-dot" style={{background:'var(--green)'}}/> Income</span>
                <span className="bleg-item"><span className="bleg-dot" style={{background:'var(--red)'}}/> Expense</span>
              </div>
            </div>
          </div>

          <div className="widget-card">
            <div className="widget-hdr">
              <span className="widget-ttl">TIMELINE</span>
              <span style={{fontSize:'0.65rem',color:'var(--text-3)'}}>Cumulative expense · this month vs last (dashed)</span>
            </div>
            <div className="chart-svg-wrap" style={{height:150,marginTop:'0.5rem'}}>
              <Timeline current={curCum} previous={prevCum} labelCur="this month" labelPrev="last month"/>
            </div>
          </div>
        </div>

        <div style={{marginTop:'0.5rem'}}>
          <TransactionsTable transactions={rangedTransactions} tags={tags} accounts={accounts} readOnly/>
        </div>
      </div>
    </>
  );
}
export default InsightsPage;

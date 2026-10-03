import React, { useState } from 'react';
import { Lightbulb, ChevronDown } from 'lucide-react';
import { fmt, PERIODS } from '../helpers';
import DonutChart from '../components/DonutChart';
import TransactionsTable from '../components/TransactionsTable';

function InsightsPage({ appData }) {
  const { transactions, tags, expensesData, summaryData } = appData;
  const baseCurrency = appData.accounts?.[0]?.currency || 'USD';
  const [tab, setTab] = useState('expense');
  const [period, setPeriod] = useState('This Month');
  const [perOpen, setPerOpen] = useState(false);

  const TREND_MONTHS = ['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'];
  const trendIncome  = [3800,4100,5200,5200,5200,5200,5200,5200,5200,5200,5200,5200];
  const trendExpense = [2800,3200,3100,4500,2900,3400,3800,4100,3800,4600,5008,2420];
  const maxVal = Math.max(...trendIncome,...trendExpense);

  const totalExp = expensesData.reduce((s,e)=>s+Math.abs(e.amount),0);
  const sortedCats = [...expensesData].sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount));

  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <Lightbulb size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Insights</span>
          <div className="period-sel" onClick={()=>setPerOpen(o=>!o)}>
            {period} <ChevronDown size={12}/>
            {perOpen && (
              <div className="period-dd" onClick={e=>e.stopPropagation()}>
                {PERIODS.map(p=>(
                  <div key={p} className={`period-opt ${period===p?'sel':''}`}
                    onClick={()=>{setPeriod(p);setPerOpen(false);}}>{p}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="main-scroll">
        {/* KPI strip */}
        <div className="summary-strip">
          <div className="sum-card">
            <span className="sum-label">INCOME</span>
            <span className="sum-val val-green">+{fmt(summaryData.incomeThisMonth, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">EXPENSE</span>
            <span className="sum-val val-red">{fmt(summaryData.expenseThisMonth, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">SAVINGS</span>
            <span className="sum-val val-green">+{fmt(summaryData.incomeThisMonth + summaryData.expenseThisMonth, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label" style={{fontSize:'0.6rem'}}>AVG EXPENSE / MONTH<br/><span style={{fontWeight:400,color:'var(--text-3)'}}>LAST 12 MONTHS</span></span>
            <span className="sum-val" style={{color:'var(--blue)'}}>{fmt(Math.abs(summaryData.expenseThisMonth), false, baseCurrency)}</span>
          </div>
        </div>

        {/* Tabs: EXPENSE / INCOME / NET WORTH */}
        <div className="ins-tab-row" style={{marginTop:'1rem'}}>
          {['expense','income','net worth'].map(t=>(
            <div key={t} className={`ins-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
              {t.toUpperCase()}
            </div>
          ))}
        </div>

        {/* Two-column: Expense donut+table | Top Movers */}
        <div className="ins-cols">
          <div className="widget-card">
            <div className="widget-hdr"><span className="widget-ttl">EXPENSE</span></div>
            <DonutChart data={expensesData} currency={baseCurrency}/>
            <table className="ins-tag-table" style={{marginTop:'0.75rem'}}>
              <thead><tr><th>TAG</th><th>EXPENSE</th></tr></thead>
              <tbody>
                {sortedCats.map(e=>(
                  <tr key={e.id}>
                    <td><span className="tag-dot-cell"><span style={{width:8,height:8,borderRadius:'50%',background:e.color,display:'inline-block',flexShrink:0}}/>{e.name}</span></td>
                    <td style={{color:'var(--red)',fontWeight:600}}>{fmt(e.amount, false, baseCurrency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td style={{fontWeight:700}}>TOTAL</td><td style={{color:'var(--red)',fontWeight:700}}>{fmt(-totalExp, false, baseCurrency)}</td></tr></tfoot>
            </table>
          </div>

          <div className="widget-card">
            <div className="widget-hdr">
              <span className="widget-ttl">TOP MOVERS</span>
              <span style={{fontSize:'0.65rem',color:'var(--text-3)'}}>1-20 Sep vs 1-20 Aug</span>
            </div>
            <table className="ins-tag-table" style={{marginTop:'0.5rem'}}>
              <thead><tr><th>TAG</th><th>EXPENSE</th></tr></thead>
              <tbody>
                {sortedCats.slice(0,10).map(e=>(
                  <tr key={e.id}>
                    <td><span className="tag-dot-cell"><span style={{width:8,height:8,borderRadius:'50%',background:e.color,display:'inline-block',flexShrink:0}}/>{e.name}</span></td>
                    <td style={{color:'var(--red)',fontWeight:600}}>{fmt(e.amount, false, baseCurrency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td style={{fontWeight:700}}>TOTAL</td><td style={{color:'var(--green)',fontWeight:700}}>+{fmt(totalExp * 0.18, false, baseCurrency)}</td></tr></tfoot>
            </table>
          </div>
        </div>

        {/* Two-column: Trend Bar chart | Timeline SVG */}
        <div className="ins-cols">
          <div className="widget-card">
            <div className="widget-hdr">
              <span className="widget-ttl">TREND &nbsp;<span style={{color:'var(--green)',fontWeight:600}}>◆ INCOME</span> vs <span style={{color:'var(--red)',fontWeight:600}}>EXPENSE</span></span>
              <span style={{fontSize:'0.65rem',color:'var(--text-3)',cursor:'pointer'}}>MONTH ▾</span>
            </div>
            <div className="bar-chart-wrap">
              {TREND_MONTHS.map((m,i) => (
                <div key={m} className="bar-group">
                  <div className="bar-pair">
                    <div className="bar bar-income" style={{height:`${Math.round((trendIncome[i]/maxVal)*120)}px`}} title={`Income: {fmt(trendIncome[i])}`}/>
                    <div className="bar bar-expense" style={{height:`${Math.round((trendExpense[i]/maxVal)*120)}px`}} title={`Expense: {fmt(trendExpense[i])}`}/>
                  </div>
                  <div className="bar-label">{m}</div>
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
              <span style={{fontSize:'0.65rem',color:'var(--text-3)'}}>Sep vs Aug</span>
            </div>
            <div className="chart-svg-wrap" style={{height:150,marginTop:'0.5rem'}}>
              <svg width="100%" height="145" viewBox="0 0 300 130" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="tlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2"/>
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                {(()=>{
                  const pts = Array.from({length:28},(_,i)=>({
                    x: (i/27)*280+10,
                    y: 115 - Math.min(Math.max(20 + i*3.2 + Math.sin(i*0.6)*18,5),115)
                  }));
                  const d = pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                  const fill = d + ` L${pts[pts.length-1].x},115 L${pts[0].x},115 Z`;
                  return (<>
                    <path d={fill} fill="url(#tlGrad)"/>
                    <path d={d} fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinejoin="round"/>
                  </>);
                })()}
              </svg>
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div style={{marginTop:'0.5rem'}}>
          <TransactionsTable transactions={transactions} tags={tags} accounts={appData.accounts} onAdd={()=>{}} onDelete={()=>{}}/>
        </div>
      </div>
    </>
  );
}
export default InsightsPage;

import React, { useState } from 'react';
import { Target, ChevronDown, Plus } from 'lucide-react';
import { fmt, PERIODS } from '../helpers';
import TransactionsTable from '../components/TransactionsTable';

function BudgetsPage({ appData }) {
  const { budgets, transactions, tags } = appData;
  const baseCurrency = appData.accounts?.[0]?.currency || 'USD';
  const [period, setPeriod] = useState('This Month');
  const [perOpen, setPerOpen] = useState(false);
  const [tab, setTab] = useState('expense');
  const totalSpent = budgets.reduce((s,b)=>s+b.spent,0);
  const totalLimit = budgets.reduce((s,b)=>s+b.limit,0);
  const totalAvail = totalLimit - totalSpent;
  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <Target size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Budgets</span>
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
        <div className="sub-hdr-right">
          <button className="btn-pri"><Plus size={12}/> Add Budget</button>
        </div>
      </div>
      <div className="main-scroll">
        {/* Tabs */}
        <div className="ins-tab-row">
          {['expense','income'].map(t=>(
            <div key={t} className={`ins-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
              {t.toUpperCase()}
            </div>
          ))}
        </div>

        {/* KPI strip */}
        <div className="summary-strip" style={{marginTop:'0.5rem'}}>
          <div className="sum-card">
            <span className="sum-label">BUDGETED</span>
            <span className="sum-val" style={{color:'var(--text-1)'}}>{fmt(totalLimit, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">EXPENSE</span>
            <span className="sum-val val-red">{fmt(-totalSpent, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">AVAILABLE</span>
            <span className="sum-val" style={{color:totalAvail>=0?'var(--green)':'var(--red)'}}>
              {totalAvail>=0?'+':''}{fmt(totalAvail, false, baseCurrency)}
            </span>
          </div>
        </div>

        {/* Budgets table — exact Buxfer layout */}
        <div className="widget-card" style={{marginTop:'1rem'}}>
          <div className="widget-hdr"><span className="widget-ttl">BUDGETS</span></div>
          <table className="budgets-table" style={{marginTop:'0.5rem'}}>
            <thead>
              <tr>
                <th>TAG ↕</th>
                <th>BUDGETED ↕</th>
                <th>EXPENSE ↕</th>
                <th>AVAILABLE ↕</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map(b => {
                const avail = b.limit - b.spent;
                const pct   = b.limit > 0 ? Math.min((b.spent/b.limit)*100,100) : 0;
                const over  = b.spent > b.limit;
                return (
                  <tr key={b.id}>
                    <td style={{fontWeight:600}}>{b.tag}</td>
                    <td>{fmt(b.limit, false, baseCurrency)}</td>
                    <td>
                      <div style={{color:'var(--red)'}}>{fmt(-b.spent, false, baseCurrency)}</div>
                      <div className="mini-bar">
                        <div className="mini-bar-fill" style={{width:`${pct}%`,background:over?'var(--red)':b.color}}/>
                      </div>
                    </td>
                    <td style={{color:avail>=0?'var(--green)':'var(--red)',fontWeight:600}}>
                      {avail>=0?'+':''}{fmt(avail, false, baseCurrency)}
                      {over && <span style={{fontSize:'0.6rem',color:'var(--red)',marginLeft:4}}>OVER</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL</td>
                <td>{fmt(totalLimit, false, baseCurrency)}</td>
                <td style={{color:'var(--red)'}}>{fmt(-totalSpent, false, baseCurrency)}</td>
                <td style={{color:totalAvail>=0?'var(--green)':'var(--red)'}}>{totalAvail>=0?'+':''}{fmt(totalAvail, false, baseCurrency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Transactions */}
        <div style={{marginTop:'1rem'}}>
          <TransactionsTable transactions={transactions} tags={tags} accounts={appData.accounts} onAdd={()=>{}} onDelete={()=>{}}/>
        </div>
      </div>
    </>
  );
}
export default BudgetsPage;

import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { fmt } from '../helpers';
import { incomeDelta, spendDelta } from '../lib/derive';

function TagDetailPage({ tag, allTransactions, accounts = [], onBack }) {
  const txns   = allTransactions.filter(t => !t.deleted && t.tags?.includes(tag.name)).sort((a,b) => b.rawDate.localeCompare(a.rawDate));
  const baseCur = accounts[0]?.currency || 'USD';
  const curOf = t => accounts.find(a => a.name === t.account)?.currency || 'USD';
  const sameCur = txns.filter(t => curOf(t) === baseCur);
  const base = sameCur;
  const income  = base.reduce((s,t) => s + incomeDelta(t), 0);
  const expense = base.reduce((s,t) => s + spendDelta(t), 0);
  const [page, setPage] = useState(1);
  const PER = 15;
  const paged = txns.slice((page-1)*PER, page*PER);
  const totalPages = Math.max(1, Math.ceil(txns.length / PER));

  // Monthly bar data
  const months = {};
  base.forEach(t => {
    const k = t.rawDate.slice(0, 7);
    if (!months[k]) months[k] = { income:0, expense:0 };
    months[k].income += incomeDelta(t);
    months[k].expense += spendDelta(t);
  });
  const bars = Object.entries(months).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8);
  const maxBar = Math.max(...bars.flatMap(([,v])=>[v.income, v.expense]), 1);
  const avgPerMonth = bars.length > 0 ? (expense / bars.length) : 0;

  return (
    <div className="detail-page">
      <div className="detail-hdr">
        <button className="back-btn" onClick={onBack}><ChevronLeft size={15}/> Back</button>
        <span style={{width:18,height:18,borderRadius:'50%',background:tag.color,display:'inline-block',flexShrink:0}}/>
        <h1 className="detail-title">{tag.name}</h1>
        <span className="detail-sub">Tag</span>
      </div>

      <div className="detail-kpi-row">
        <div className="detail-kpi">
          <div className="detail-kpi-label">EXPENSE</div>
          <div className="detail-kpi-val" style={{color:'var(--red)'}}>-{fmt(expense, false, baseCur)}</div>
          <div className="detail-kpi-sub">ALL TIME</div>
        </div>
        <div className="detail-kpi">
          <div className="detail-kpi-label">INCOME</div>
          <div className="detail-kpi-val" style={{color:'var(--green)'}}>+{fmt(income, false, baseCur)}</div>
          <div className="detail-kpi-sub">ALL TIME</div>
        </div>
        <div className="detail-kpi">
          <div className="detail-kpi-label">AVG / MONTH</div>
          <div className="detail-kpi-val" style={{color:'var(--red)'}}>-{fmt(avgPerMonth, false, baseCur)}</div>
        </div>
        <div className="detail-kpi">
          <div className="detail-kpi-label">TRANSACTIONS</div>
          <div className="detail-kpi-val">{txns.length}</div>
        </div>
      </div>

      {bars.length > 0 && (
        <div className="detail-charts">
          <div className="widget-card">
            <div className="widget-hdr"><span>MONTHLY TREND</span></div>
            <div className="trend-bar-chart">
              {bars.map(([mo, v]) => (
                <div key={mo} className="tbc-col">
                  <div className="tbc-bars">
                    <div className="tbc-bar income" style={{height:`${(v.income/maxBar)*100}%`,background:tag.color+'55'}} title={`+${fmt(v.income, false, baseCur)}`}/>
                    <div className="tbc-bar expense" style={{height:`${(v.expense/maxBar)*100}%`,background:tag.color}} title={`-${fmt(v.expense, false, baseCur)}`}/>
                  </div>
                  <div className="tbc-label">{mo.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="widget-card" style={{marginTop:'1rem'}}>
        <div className="widget-hdr">
          <span>TRANSACTIONS</span>
          <span style={{fontSize:'0.72rem',color:'var(--text-3)'}}>{txns.length} total</span>
        </div>
        {txns.length === 0 ? (
          <div style={{padding:'2rem',textAlign:'center',color:'var(--text-3)',fontSize:'0.82rem'}}>No transactions with this tag.</div>
        ) : (
          <>
            <table className="txn-table">
              <thead><tr>
                <th className="th-s">DATE</th>
                <th className="th-s" style={{textAlign:'right'}}>AMOUNT</th>
                <th className="th-s">DESCRIPTION</th>
                <th className="th-s">ACCOUNT</th>
              </tr></thead>
              <tbody>
                {paged.map(t => (
                  <tr key={t.id} className="txn-row">
                    <td className="td-date">{t.date}</td>
                    <td style={{textAlign:'right',fontWeight:600,color:t.amount<0?'var(--red)':'var(--green)',fontSize:'0.82rem',whiteSpace:'nowrap'}}>
                      {t.amount<0?'-':'+'}{fmt(Math.abs(t.amount), false, accounts.find(a=>a.name===t.account)?.currency || 'USD')}
                    </td>
                    <td style={{fontSize:'0.82rem',color:'var(--text-1)'}}>{t.description}</td>
                    <td style={{fontSize:'0.72rem',color:'var(--text-3)'}}>{t.account}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{display:'flex',justifyContent:'flex-end',gap:'0.5rem',padding:'0.5rem 0.875rem',borderTop:'1px solid var(--border)'}}>
                <button className="btn-sec" style={{padding:'3px 10px',fontSize:'0.72rem'}} onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>‹ Prev</button>
                <span style={{fontSize:'0.72rem',color:'var(--text-3)',display:'flex',alignItems:'center'}}>{page}/{totalPages}</span>
                <button className="btn-sec" style={{padding:'3px 10px',fontSize:'0.72rem'}} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>Next ›</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
export default TagDetailPage;

import React, { useState } from 'react';
import { Target, Plus, Pencil, Trash2 } from 'lucide-react';
import { fmt } from '../helpers';
import TransactionsTable from '../components/TransactionsTable';
import PeriodSelect from '../components/PeriodSelect';
import Modal from '../components/Modal';

function BudgetModal({ tags, budgets, initial, onClose, onSave, currency }) {
  const free = tags.filter(t => !budgets.some(b => b.tagId === t.id) || t.id === initial?.tagId);
  const [tagId, setTagId] = useState(initial?.tagId ?? free[0]?.id ?? '');
  const [limit, setLimit] = useState(initial ? String(initial.monthlyLimit) : '');
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault();
    const v = parseFloat(limit);
    if (!tagId) return setErr('Choose a tag.');
    if (!(v > 0)) return setErr('Enter a monthly limit greater than zero.');
    if (await onSave({ tagId: Number(tagId), monthlyLimit: v })) onClose();
  };
  return (
    <Modal title={initial ? 'Edit Budget' : 'Add Budget'} onClose={onClose}>
      <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        {err && <div className="form-err">{err}</div>}
        {free.length === 0 && <div className="form-note">Every tag already has a budget. Create a tag first.</div>}
        <div className="form-group">
          <label className="form-label">TAG</label>
          <select className="form-input" value={tagId} onChange={e => setTagId(e.target.value)} disabled={!!initial}>
            {free.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">MONTHLY LIMIT ({currency})</label>
          <input className="form-input" type="number" step="0.01" min="0.01" value={limit} onChange={e => setLimit(e.target.value)} autoFocus/>
        </div>
        <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
          <button type="button" className="btn-sec" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-pri" disabled={free.length === 0}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

function BudgetsPage({ appData, actions, period, onPeriod }) {
  const { budgets, tags, baseCurrency, rangedTransactions, summaryData, incomeData: incomeRows } = appData;
  const [tab, setTab] = useState('expense');
  const [modal, setModal] = useState(null); // null | {} | budget
  const totalSpent = budgets.reduce((s,b)=>s+b.spent,0);
  const totalLimit = budgets.reduce((s,b)=>s+b.limit,0);
  const totalAvail = totalLimit - totalSpent;
  const tracked = new Set(budgets.map(b => b.tag));
  const txns = rangedTransactions.filter(t => (t.tags ?? []).some(n => tracked.has(n)));

  const remove = b => { if (window.confirm(`Remove the budget for "${b.tag}"?`)) actions.deleteBudget(b.id); };

  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <Target size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Budgets</span>
          <PeriodSelect period={period} onChange={onPeriod}/>
        </div>
        <div className="sub-hdr-right">
          <button className="btn-pri" onClick={() => setModal({})}><Plus size={12}/> Add Budget</button>
        </div>
      </div>
      <div className="main-scroll">
        <div className="ins-tab-row">
          {['expense','income'].map(t=>(
            <div key={t} className={`ins-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t.toUpperCase()}</div>
          ))}
        </div>

        {tab === 'expense' ? (
          <>
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
                  {fmt(totalAvail, true, baseCurrency)}
                </span>
              </div>
            </div>
            <div className="form-note" style={{margin:'0.25rem'}}>
              Spending is counted per tag, so a transaction with two tagged budgets counts toward both; the total can exceed overall spending.
            </div>

            <div className="widget-card" style={{marginTop:'1rem'}}>
              <div className="widget-hdr"><span className="widget-ttl">BUDGETS</span></div>
              {budgets.length === 0 ? (
                <div className="empty-state" style={{padding:'1.5rem'}}>No budgets yet. Add one to start tracking.</div>
              ) : (
                <table className="budgets-table" style={{marginTop:'0.5rem'}}>
                  <thead>
                    <tr><th>TAG</th><th>BUDGETED</th><th>EXPENSE</th><th>AVAILABLE</th><th></th></tr>
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
                            {fmt(avail, true, baseCurrency)}
                            {over && <span style={{fontSize:'0.6rem',color:'var(--red)',marginLeft:4}}>OVER</span>}
                          </td>
                          <td style={{whiteSpace:'nowrap'}}>
                            <button className="icon-btn" title="Edit" onClick={() => setModal(b)}><Pencil size={12}/></button>
                            <button className="icon-btn" title="Remove" style={{color:'var(--red)'}} onClick={() => remove(b)}><Trash2 size={12}/></button>
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
                      <td style={{color:totalAvail>=0?'var(--green)':'var(--red)'}}>{fmt(totalAvail, true, baseCurrency)}</td>
                      <td/>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </>
        ) : (
          <div className="widget-card" style={{marginTop:'1rem'}}>
            <div className="widget-hdr">
              <span className="widget-ttl">INCOME BY TAG</span>
              <span className="widget-per">{fmt(summaryData.income, false, baseCurrency)}</span>
            </div>
            {incomeRows.length === 0 ? (
              <div className="empty-state" style={{padding:'1.5rem'}}>No income in this period.</div>
            ) : (
              <table className="budgets-table" style={{marginTop:'0.5rem'}}>
                <thead><tr><th>TAG</th><th>INCOME</th></tr></thead>
                <tbody>
                  {incomeRows.map(r => (
                    <tr key={r.id}>
                      <td style={{fontWeight:600}}>{r.name}</td>
                      <td style={{color:'var(--green)',fontWeight:600}}>{fmt(r.amount, true, baseCurrency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div style={{marginTop:'1rem'}}>
          <TransactionsTable transactions={txns} tags={tags} accounts={appData.accounts} readOnly/>
        </div>
      </div>

      {modal && (
        <BudgetModal
          tags={tags} budgets={budgets} initial={modal.id ? modal : null} currency={baseCurrency}
          onClose={() => setModal(null)} onSave={actions.upsertBudget}
        />
      )}
    </>
  );
}
export default BudgetsPage;

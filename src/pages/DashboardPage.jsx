import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ChevronDown, Star, Settings, RefreshCw } from 'lucide-react';
import { fmt, PERIODS } from '../helpers';
import { supabase, IS_SUPABASE_CONFIGURED } from '../lib/supabase';
import * as db from '../lib/db';
import { DonutChart, BudgetsWidget } from '../components/DonutChart';
import TransactionsTable from '../components/TransactionsTable';
import AddTransactionModal from '../components/AddTransactionModal';

// DASHBOARD PAGE
// ══════════════════════════════════════════════════════════════════════════════
function DashboardPage({ appData, setAppData, userId, onRefresh }) {
  const { accounts, tags, budgets, expensesData, summaryData } = appData;
  const baseCurrency = appData.accounts?.[0]?.currency || 'USD';
  const [period, setPeriod]     = useState('This Month');
  const [perOpen, setPerOpen]   = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [editTxn, setEditTxn]   = useState(null);

  const getBalanceDelta = (amt, type) => type === 'credit' ? -amt : amt;

  const handleAdd = async ({ id, amount, description, date, account, tags: tagNames }) => {
    if (IS_SUPABASE_CONFIGURED && userId) {
      // Supabase not currently supporting edit via handleAdd, sticking to mockData mode for local changes
    } else {
      setAppData(prev => {
        let updatedAccounts = [...(prev.accounts || [])];
        
        if (id) {
          const oldTx = prev.transactions.find(t => t.id === id);
          if (oldTx) {
            const oldAcc = updatedAccounts.find(a => a.name === oldTx.account);
            if (oldAcc) oldAcc.balance -= getBalanceDelta(oldTx.amount, oldAcc.type);
          }
          const newAcc = updatedAccounts.find(a => a.name === account);
          if (newAcc) newAcc.balance += getBalanceDelta(amount, newAcc.type);

          const updatedTx = {
            ...oldTx, amount, description, account, tags: tagNames, 
            date: new Date(date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}),
            rawDate: date, untagged: tagNames.length === 0
          };
          return {
            ...prev,
            transactions: prev.transactions.map(t => t.id === id ? updatedTx : t),
            accounts: updatedAccounts
          };
        }

        const newAcc = updatedAccounts.find(a => a.name === account);
        if (newAcc) newAcc.balance += getBalanceDelta(amount, newAcc.type);

        const newTx = {
          id: Date.now() + Math.random(), date: new Date(date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}),
          rawDate: date, amount, description, tags: tagNames, account, deleted: false, untagged: tagNames.length===0,
        };
        return { ...prev, transactions: [newTx, ...prev.transactions], accounts: updatedAccounts };
      });
    }
  };

  const handleEdit = (txnId) => {
    const txn = appData.transactions.find(t => t.id === txnId);
    if (txn) {
      setEditTxn(txn);
      setShowAdd(true);
    }
  };

  const handleDuplicate = (txnIds) => {
    if (!setAppData) return;
    setAppData(prev => {
      const toDup = prev.transactions.filter(t => txnIds.includes(t.id));
      let updatedAccounts = [...(prev.accounts || [])];
      
      const duplicatedTxns = toDup.map(t => {
        const acc = updatedAccounts.find(a => a.name === t.account);
        if (acc) acc.balance += getBalanceDelta(t.amount, acc.type);
        return { ...t, id: Date.now() + Math.random() };
      });

      return {
        ...prev,
        transactions: [...duplicatedTxns, ...prev.transactions],
        accounts: updatedAccounts
      };
    });
  };

  const handleDel = async txId => {
    if (IS_SUPABASE_CONFIGURED && userId) {
      await db.deleteTransaction(txId);
      const fresh = await db.fetchTransactions(userId);
      if (setAppData) setAppData(prev => ({ ...prev, transactions: fresh }));
    } else {
      if (setAppData) {
        setAppData(prev => {
          const oldTx = prev.transactions.find(t => t.id === txId);
          let updatedAccounts = [...(prev.accounts || [])];
          if (oldTx && !oldTx.deleted) {
            const acc = updatedAccounts.find(a => a.name === oldTx.account);
            if (acc) acc.balance -= getBalanceDelta(oldTx.amount, acc.type);
          }
          return {
            ...prev,
            transactions: prev.transactions.map(t => t.id === txId ? { ...t, deleted: true } : t),
            accounts: updatedAccounts
          };
        });
      }
    }
  };

  const net = summaryData.incomeThisMonth + summaryData.expenseThisMonth;

  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <LayoutDashboard size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Dashboard</span>
          <div className="period-sel" onClick={()=>setPerOpen(o=>!o)}>
            {period} <ChevronDown size={12}/>
            {perOpen && (
              <div className="period-dd" onClick={e=>e.stopPropagation()}>
                {PERIODS.map(p=>(
                  <div key={p} className={`period-opt ${period===p?'sel':''}`}
                    onClick={()=>{setPeriod(p);setPerOpen(false);}}>
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="sub-hdr-right">
          <button className="btn-ghost"><Star size={13}/> Favorite</button>
          <button className="btn-ghost"><Settings size={13}/> Customize</button>
          {IS_SUPABASE_CONFIGURED && (
            <button className="btn-ghost" onClick={onRefresh}><RefreshCw size={13}/> Refresh</button>
          )}
        </div>
      </div>

      <div className="main-scroll">
        {/* Summary */}
        <div className="summary-strip">
          <div className="sum-card">
            <span className="sum-label">Income This Month</span>
            <span className="sum-val val-green">+{fmt(summaryData.incomeThisMonth, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Expense This Month</span>
            <span className="sum-val val-red">{fmt(summaryData.expenseThisMonth, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Net This Month</span>
            <span className="sum-val" style={{color:net>=0?'var(--green)':'var(--red)'}}>
              {fmt(net, true, baseCurrency)}
            </span>
          </div>
        </div>

        {/* Widgets */}
        <div className="widgets-grid">
          <div className="widget-card">
            <div className="widget-hdr">
              <span className="widget-ttl">Expenses by Tag</span>
              <span className="widget-per">{period} <ChevronDown size={12}/></span>
            </div>
            <DonutChart data={expensesData} currency={baseCurrency}/>
          </div>
          <BudgetsWidget budgets={budgets} period={period} currency={baseCurrency}/>
        </div>

        {/* Transactions */}
        <TransactionsTable
          transactions={appData.transactions}
          tags={tags}
          accounts={accounts}
          onAdd={() => { setEditTxn(null); setShowAdd(true); }}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDel}
        />
      </div>

      {showAdd && (
        <AddTransactionModal
          onClose={() => { setShowAdd(false); setEditTxn(null); }}
          onAdd={handleAdd}
          tagsList={tags}
          accountsList={accounts}
          editData={editTxn}
        />
      )}
    </>
  );
}

export default DashboardPage;

import React, { useState } from 'react';
import { LayoutDashboard, RefreshCw } from 'lucide-react';
import { fmt } from '../helpers';
import { DonutChart, BudgetsWidget } from '../components/DonutChart';
import TransactionsTable from '../components/TransactionsTable';
import AddTransactionModal from '../components/AddTransactionModal';
import PeriodSelect from '../components/PeriodSelect';

function DashboardPage({ appData, actions, period, onPeriod, onRefresh, refreshing }) {
  const { accounts, tags, budgets, expensesData, summaryData, baseCurrency, multiCurrency } = appData;
  const [showAdd, setShowAdd] = useState(false);
  const [editTxn, setEditTxn] = useState(null);

  const handleEdit = txnId => {
    const txn = appData.transactions.find(t => t.id === txnId);
    if (txn) { setEditTxn(txn); setShowAdd(true); }
  };

  const net = summaryData.income + summaryData.expense;

  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <LayoutDashboard size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Dashboard</span>
          <PeriodSelect period={period} onChange={onPeriod}/>
        </div>
        <div className="sub-hdr-right">
          {onRefresh && (
            <button className="btn-ghost" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw size={13} style={refreshing ? {animation:'spin 0.8s linear infinite'} : undefined}/> Refresh
            </button>
          )}
        </div>
      </div>

      <div className="main-scroll">
        <div className="summary-strip">
          <div className="sum-card">
            <span className="sum-label">Income · {period}</span>
            <span className="sum-val val-green">{fmt(summaryData.income, true, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Expense · {period}</span>
            <span className="sum-val val-red">{fmt(summaryData.expense, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Net · {period}</span>
            <span className="sum-val" style={{color:net>=0?'var(--green)':'var(--red)'}}>
              {fmt(net, true, baseCurrency)}
            </span>
          </div>
        </div>
        {multiCurrency && (
          <div className="form-note" style={{margin:'0.25rem 0.25rem 0'}}>
            Totals, charts and budgets include <strong>{baseCurrency}</strong> accounts only. See the sidebar for per-currency net worth — click <em>Fetch rates for total</em> to see a unified figure.
          </div>
        )}

        <div className="widgets-grid">
          <div className="widget-card">
            <div className="widget-hdr">
              <span className="widget-ttl">Expenses by Tag</span>
              <span className="widget-per">{period}</span>
            </div>
            <DonutChart data={expensesData} currency={baseCurrency}/>
          </div>
          <BudgetsWidget budgets={budgets} period={period} currency={baseCurrency}/>
        </div>

        <TransactionsTable
          transactions={appData.transactions}
          tags={tags}
          accounts={accounts}
          onAdd={() => { setEditTxn(null); setShowAdd(true); }}
          onEdit={handleEdit}
          actions={actions}
        />
      </div>

      {showAdd && (
        <AddTransactionModal
          onClose={() => { setShowAdd(false); setEditTxn(null); }}
          actions={actions}
          tagsList={tags}
          accountsList={accounts}
          editData={editTxn}
        />
      )}
    </>
  );
}

export default DashboardPage;

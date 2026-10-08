import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { fmt, currencySymbol, MONTHS_SHORT } from '../helpers';
import AddTransactionModal from './AddTransactionModal';
import PeriodSelect from './PeriodSelect';

const STEP = 50;

/** rawDate-sorted transactions → [[label, txns]] in display order. */
function groupByDate(txns) {
  const groups = new Map();
  for (const tx of txns) {
    const [y, m, d] = tx.rawDate.split('-').map(Number);
    const label = `${d} ${MONTHS_SHORT[m - 1].toUpperCase()}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(tx);
  }
  return [...groups.entries()];
}

/** Phone-sized dashboard: summary + date-grouped transaction list + add button. */
function MobileDashboard({ appData, actions, period, onPeriod }) {
  const { summaryData, baseCurrency, rangedTransactions, accounts, tags } = appData;
  const [showAdd, setShowAdd] = useState(false);
  const [editTxn, setEditTxn] = useState(null);
  const [limit, setLimit] = useState(STEP);

  const sorted = [...rangedTransactions].sort((a, b) => (a.rawDate < b.rawDate ? 1 : a.rawDate > b.rawDate ? -1 : b.id - a.id));
  const groups = groupByDate(sorted.slice(0, limit));
  const periodLabel = period.toUpperCase();

  return (
    <div className="mobile-dashboard">
      <div className="md-content">
        <div className="md-period"><PeriodSelect period={period} onChange={onPeriod}/></div>
        <div className="md-summary">
          <div className="md-sum-row">
            <div className="md-sum-left">
              <div className="md-sum-title">INCOME</div>
              <div className="md-sum-sub">{periodLabel}</div>
            </div>
            <div className="md-sum-val green">{fmt(summaryData.income, true, baseCurrency)}</div>
          </div>
          <div className="md-sum-divider"/>
          <div className="md-sum-row">
            <div className="md-sum-left">
              <div className="md-sum-title">EXPENSE</div>
              <div className="md-sum-sub">{periodLabel}</div>
            </div>
            <div className="md-sum-val red">{fmt(summaryData.expense, false, baseCurrency)}</div>
          </div>
        </div>

        <div className="md-tx-header">TRANSACTIONS</div>

        <div className="md-tx-list">
          {groups.length === 0 && <div className="md-empty">No transactions in {period.toLowerCase()}.</div>}
          {groups.map(([label, txns]) => (
            <React.Fragment key={label}>
              <div className="md-date-header">{label}</div>
              {txns.map((tx, idx) => (
                <button
                  type="button"
                  className={`md-tx-item ${idx !== txns.length - 1 ? 'md-border' : ''}`}
                  key={tx.id}
                  onClick={() => { setEditTxn(tx); setShowAdd(true); }}
                >
                  <div className="md-tx-info">
                    <div className="md-tx-desc">{tx.description}</div>
                    <div className="md-tx-cat">{tx.tags?.[0] || tx.account}</div>
                  </div>
                  <div className={`md-tx-amt ${tx.amount < 0 ? 'red' : 'green'}`}>
                    {fmt(tx.amount, true, tx.currency)} <ChevronRight size={16} className="md-chevron"/>
                  </div>
                </button>
              ))}
            </React.Fragment>
          ))}
          {sorted.length > limit && (
            <button type="button" className="md-more" onClick={() => setLimit(l => l + STEP)}>Show more</button>
          )}
        </div>
      </div>

      <button className="md-fab" aria-label="Add transaction" onClick={() => { setEditTxn(null); setShowAdd(true); }}>
        <span className="md-fab-plus">+</span>
        <span className="md-fab-sign">{currencySymbol(baseCurrency)}</span>
      </button>

      {showAdd && (
        <AddTransactionModal
          onClose={() => { setShowAdd(false); setEditTxn(null); }}
          actions={actions}
          tagsList={tags}
          accountsList={accounts}
          editData={editTxn}
          displayCurrency={baseCurrency}
        />
      )}
    </div>
  );
}

export default MobileDashboard;

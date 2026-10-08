import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { fmt } from '../helpers';

function SearchModal({ transactions, onClose }) {
  const [q, setQ] = useState('');
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const lq = q.toLowerCase();
    return transactions.filter(t =>
      t.description.toLowerCase().includes(lq) ||
      (t.tags??[]).some(tag => tag.toLowerCase().includes(lq)) ||
      t.account.toLowerCase().includes(lq)
    ).slice(0, 18);
  }, [q, transactions]);

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="search-box">
        <div className="search-input-row">
          <Search size={16} style={{color:'var(--text-3)',flexShrink:0}}/>
          <input ref={ref} className="search-input-field"
            placeholder="Search transactions, tags, accounts… (⌘K)"
            value={q} onChange={e=>setQ(e.target.value)}/>
          <button className="modal-close" onClick={onClose}><X size={15}/></button>
        </div>
        <div className="search-results">
          {!q.trim() && <div className="search-empty">Start typing to search…</div>}
          {q.trim() && results.length===0 && <div className="search-empty">No results for "{q}"</div>}
          {results.map(tx => (
            <div className="search-result" key={tx.id} onClick={onClose}>
              <div>
                <div className="sr-desc">{tx.description}</div>
                <div className="sr-meta">{tx.date} · {tx.account}</div>
              </div>
              <span className="sr-amt" style={{color:tx.amount<0?'var(--red)':'var(--green)'}}>
                {fmt(tx.amount, true, tx.currency)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SearchModal;

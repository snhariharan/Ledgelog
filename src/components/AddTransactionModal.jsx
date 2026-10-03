import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';
import { TX_TYPES, TODAY } from '../helpers';
import TagInput from './TagInput';
import TypePicker from './TypePicker';

const NUM_ROWS = 5;
function makeRow(accountName) {
  return { id: Math.random(), desc: '', tags: [], amount: '', txType: 'expense', date: TODAY, account: accountName };
}

const CURRENCY_SYMBOLS = { USD:'$', EUR:'€', GBP:'£', INR:'₹', JPY:'¥', AUD:'A$', CAD:'C$' };

function AddTransactionModal({ onClose, onAdd, tagsList, accountsList, editData }) {
  const defaultAcc = accountsList[0]?.name ?? '';
  const getCurrencySymbol = (accName) => {
    const code = accountsList.find(a => a.name === accName)?.currency || 'USD';
    return CURRENCY_SYMBOLS[code] || code;
  };
  const [mode, setMode]     = useState(editData ? 'single' : 'multi');
  const [rows, setRows]     = useState(() => Array.from({ length: NUM_ROWS }, () => makeRow(defaultAcc)));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const firstRef            = useRef();

  // Single-form state
  const [sDesc, setSDesc]       = useState(editData?.description ?? '');
  const [sTxType, setSTxType]   = useState(editData ? (editData.amount < 0 ? 'expense' : 'income') : 'expense');
  const [sAmount, setSAmount]   = useState(editData ? Math.abs(editData.amount).toString() : '');
  const [sDate, setSDate]       = useState(editData?.rawDate ?? TODAY);
  const [sAccount, setSAccount] = useState(editData?.account ?? defaultAcc);
  const [sTags, setSTags]       = useState(editData?.tags ?? []);
  const [sRepeat, setSRepeat]   = useState('never');
  const [sMemo, setSMemo]       = useState('');
  const [sStatus, setSStatus]   = useState('cleared');
  const [sUrl, setSUrl]         = useState('');
  const [sErrors, setSErrors]   = useState({});

  useEffect(() => { firstRef.current?.focus(); }, [mode]);

  // ── Multi helpers ──────────────────────────────────────────────────────────
  const setField = (idx, field, val) => {
    setRows(r => r.map((row, i) => i === idx ? { ...row, [field]: val } : row));
    setErrors(e => { const n = { ...e }; delete n[idx]; return n; });
  };

  const addRows = () => setRows(r => [...r, ...Array.from({ length: 3 }, () => makeRow(defaultAcc))]);

  const filledRows = rows.filter(r => r.desc.trim() || r.amount.trim());

  const validateMulti = () => {
    const errs = {};
    rows.forEach((r, i) => {
      if (!r.desc.trim() && !r.amount.trim()) return;
      if (!r.desc.trim()) errs[i] = { desc: true };
      if (!r.amount || isNaN(parseFloat(r.amount)) || parseFloat(r.amount) <= 0)
        errs[i] = { ...(errs[i] ?? {}), amount: true };
    });
    return errs;
  };

  const handleMultiSubmit = async () => {
    const errs = validateMulti();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (filledRows.length === 0) { onClose(); return; }
    setSaving(true);
    for (const r of filledRows) {
      const meta = TX_TYPES.find(t => t.key === r.txType) ?? TX_TYPES[0];
      const num  = parseFloat(r.amount);
      const amt  = meta.sign === '-' ? -num : num;
      await onAdd({ amount: amt, description: r.desc.trim(), date: r.date, account: r.account, tags: r.tags });
    }
    setSaving(false);
    onClose();
  };

  // ── Single helpers ─────────────────────────────────────────────────────────
  const validateSingle = () => {
    const e = {};
    if (!sDesc.trim()) e.desc = true;
    if (!sAmount || isNaN(parseFloat(sAmount)) || parseFloat(sAmount) <= 0) e.amount = true;
    return e;
  };

  const handleSingleSubmit = async () => {
    const e = validateSingle();
    if (Object.keys(e).length) { setSErrors(e); return; }
    setSaving(true);
    const meta = TX_TYPES.find(t => t.key === sTxType) ?? TX_TYPES[0];
    const num  = parseFloat(sAmount);
    const amt  = meta.sign === '-' ? -num : num;
    await onAdd({ id: editData?.id, amount: amt, description: sDesc.trim(), date: sDate, account: sAccount, tags: sTags });
    setSaving(false);
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box ${mode === 'multi' ? 'multi-modal' : 'single-modal'}`}>

        {/* Header */}
        <div className="modal-hdr mtx-hdr">
          <div className="modal-ttl" style={{ color: '#fff' }}>
            <Plus size={17} />
            {mode === 'multi' ? 'Add Transactions' : (editData ? 'Edit Transaction' : 'Add Transaction')}
          </div>
          <button className="modal-close mtx-close" onClick={onClose}><X size={15} /></button>
        </div>

        {/* ══ MULTI MODE ══ */}
        {mode === 'multi' && (
          <>
            {/* Column labels */}
            <div className="mtx-grid-hdr">
              <span className="mtx-col-desc">DESCRIPTION</span>
              <span className="mtx-col-tags">TAGS</span>
              <span className="mtx-col-amt">AMOUNT</span>
              <span className="mtx-col-date">DATE</span>
              <span className="mtx-col-acc">ACCOUNT</span>
            </div>

            {/* Rows */}
            <div className="mtx-rows">
              {rows.map((row, idx) => (
                <div key={row.id} className={`mtx-row ${errors[idx] ? 'row-err' : ''}`}>
                  <input
                    ref={idx === 0 ? firstRef : null}
                    className={`mtx-input${errors[idx]?.desc ? ' invalid' : ''}`}
                    style={{ flex: '2.2' }}
                    placeholder="Description…"
                    value={row.desc}
                    onChange={e => setField(idx, 'desc', e.target.value)}
                  />
                  <div className="mtx-tags-cell">
                    <TagInput tagsList={tagsList} value={row.tags} onChange={v => setField(idx, 'tags', v)} />
                  </div>
                  <div className="mtx-amt-cell">
                    <TypePicker value={row.txType} onChange={v => setField(idx, 'txType', v)} />
                    <span style={{fontSize:'0.7rem',color:'var(--text-3)',fontWeight:600,minWidth:14,flexShrink:0}}>{getCurrencySymbol(row.account)}</span>
                    <input
                      type="number" min="0" step="0.01"
                      className={`mtx-input amt-input${errors[idx]?.amount ? ' invalid' : ''}`}
                      placeholder="–"
                      value={row.amount}
                      onChange={e => setField(idx, 'amount', e.target.value)}
                    />
                  </div>
                  <input
                    type="date"
                    className="mtx-input date-input"
                    value={row.date}
                    onChange={e => setField(idx, 'date', e.target.value)}
                  />
                  <select
                    className="mtx-select"
                    value={row.account}
                    onChange={e => setField(idx, 'account', e.target.value)}
                  >
                    {accountsList.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Footer — Buxfer-style */}
            <div className="mtx-footer">
              <div className="mtx-footer-left">
                <button className="btn-pri" onClick={handleMultiSubmit} disabled={saving || filledRows.length === 0}
                  style={{ opacity: filledRows.length === 0 ? 0.45 : 1, letterSpacing: '0.06em' }}>
                  {saving
                    ? <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                    : null}
                  ADD TRANSACTION{filledRows.length > 1 ? 'S' : ''}
                  {filledRows.length > 0 && <span className="mtx-count-inline">({filledRows.length})</span>}
                </button>
                <span className="mtx-or">OR</span>
                <button className="mtx-switch-link" onClick={() => setMode('single')}>
                  ADD SINGLE TRANSACTION
                </button>
              </div>
              <div className="mtx-footer-right">
                <button className="btn-ghost" onClick={addRows}><Plus size={12} /> More rows</button>
                <button className="btn-sec" onClick={onClose}>Cancel</button>
              </div>
            </div>
          </>
        )}

        {/* ══ SINGLE MODE ══ */}
        {mode === 'single' && (
          <>
            <div className="sgl-body">

              {/* Row 1: TYPE dropdown */}
              <div className="sgl-field-group">
                <label className="sgl-label">TYPE</label>
                <select
                  className="sgl-select"
                  value={sTxType}
                  onChange={e => setSTxType(e.target.value)}
                >
                  {TX_TYPES.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Row 2: DESCRIPTION + TAGS */}
              <div className="sgl-row">
                <div className="sgl-field-group sgl-col-wide">
                  <label className="sgl-label">DESCRIPTION</label>
                  <input
                    ref={firstRef}
                    type="text"
                    className={`sgl-input${sErrors.desc ? ' invalid' : ''}`}
                    value={sDesc}
                    onChange={e => { setSDesc(e.target.value); setSErrors(p => ({ ...p, desc: false })); }}
                  />
                </div>
                <div className="sgl-field-group sgl-col-narrow">
                  <label className="sgl-label">TAGS</label>
                  <div style={{ position: 'relative' }}>
                    <TagInput tagsList={tagsList} value={sTags} onChange={setSTags} />
                  </div>
                </div>
              </div>

              {/* Row 3: AMOUNT + DATE */}
              <div className="sgl-row">
                <div className="sgl-field-group sgl-col-wide">
                  <label className="sgl-label">AMOUNT {sAccount && <span style={{fontSize:'0.68rem',color:'var(--blue)',fontWeight:700,marginLeft:4}}>{getCurrencySymbol(sAccount)}</span>}</label>
                  <input
                    type="number" min="0" step="0.01"
                    className={`sgl-input${sErrors.amount ? ' invalid' : ''}`}
                    placeholder=""
                    value={sAmount}
                    onChange={e => { setSAmount(e.target.value); setSErrors(p => ({ ...p, amount: false })); }}
                  />
                </div>
                <div className="sgl-field-group sgl-col-narrow">
                  <label className="sgl-label">DATE</label>
                  <input type="date" className="sgl-input" value={sDate} onChange={e => setSDate(e.target.value)} />
                </div>
              </div>

              {/* Row 4: ACCOUNT + REPEAT */}
              <div className="sgl-row">
                <div className="sgl-field-group sgl-col-wide">
                  <label className="sgl-label">ACCOUNT</label>
                  <select className="sgl-select" value={sAccount} onChange={e => setSAccount(e.target.value)}>
                    {accountsList.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
                <div className="sgl-field-group sgl-col-narrow">
                  <label className="sgl-label">REPEAT</label>
                  <select className="sgl-select" value={sRepeat} onChange={e => setSRepeat(e.target.value)}>
                    <option value="never">NEVER</option>
                    <option value="daily">DAILY</option>
                    <option value="weekly">WEEKLY</option>
                    <option value="biweekly">BI-WEEKLY</option>
                    <option value="monthly">MONTHLY</option>
                    <option value="yearly">YEARLY</option>
                  </select>
                </div>
              </div>

              {/* Row 5: MEMO + STATUS */}
              <div className="sgl-row sgl-row-top">
                <div className="sgl-field-group sgl-col-wide">
                  <label className="sgl-label">MEMO</label>
                  <textarea
                    className="sgl-textarea"
                    value={sMemo}
                    onChange={e => setSMemo(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="sgl-field-group sgl-col-narrow">
                  <label className="sgl-label">STATUS</label>
                  <select className="sgl-select" value={sStatus} onChange={e => setSStatus(e.target.value)}>
                    <option value="cleared">CLEARED</option>
                    <option value="pending">PENDING</option>
                    <option value="reconciled">RECONCILED</option>
                  </select>
                </div>
              </div>

              {/* Row 6: URL */}
              <div className="sgl-field-group">
                <label className="sgl-label">URL</label>
                <input
                  type="url"
                  className="sgl-input"
                  placeholder=""
                  value={sUrl}
                  onChange={e => setSUrl(e.target.value)}
                />
              </div>

            </div>

            {/* Footer — single mode, Buxfer-exact */}
            <div className="mtx-footer">
              <div className="mtx-footer-left">
                <button className="btn-pri sgl-submit-btn" onClick={handleSingleSubmit} disabled={saving}>
                  {saving ? <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
                  {editData ? 'SAVE CHANGES' : 'ADD TRANSACTION'}
                </button>
                {!editData && (
                  <>
                    <span className="mtx-or">OR</span>
                    <button className="mtx-switch-link" onClick={() => setMode('multi')}>
                      ADD MULTIPLE TRANSACTIONS
                    </button>
                  </>
                )}
              </div>
              <div className="mtx-footer-right">
                <button className="btn-sec" onClick={onClose}>Cancel</button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default AddTransactionModal;

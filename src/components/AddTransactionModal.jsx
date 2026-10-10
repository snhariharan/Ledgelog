import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';
import { TX_TYPES, todayISO, currencySymbol } from '../helpers';
import { nextOccurrence } from '../lib/repeats';
import { applyRules } from '../lib/rules';
import TagInput from './TagInput';
import TypePicker from './TypePicker';

const NUM_ROWS = 5;
function makeRow(accountId) {
  return { id: Math.random(), desc: '', tags: [], amount: '', txType: 'expense', date: todayISO(), account: accountId };
}

const isTransferType = t => t === 'transfer' || t === 'transfer_in' || t === 'transfer_out';
/** Investment subtypes that bring money into the account (the rest take it out). */
const INVESTMENT_INFLOWS = ['sell', 'dividend', 'capital_gain'];

function AddTransactionModal({ onClose, actions, tagsList, accountsList, editData, displayCurrency, rules = [] }) {
  const defaultAcc = accountsList[0]?.id ?? null;
  const getCurrencySymbol = accId => currencySymbol(accountsList.find(a => a.id === accId)?.currency || 'USD');
  const groupedAccounts = (() => {
    const groups = {};
    for (const acc of accountsList) {
      const cur = acc.currency || 'USD';
      if (!groups[cur]) groups[cur] = [];
      groups[cur].push(acc);
    }
    // Sort so displayCurrency comes first (unless it's "All")
    const sorted = {};
    if (displayCurrency && displayCurrency !== 'All' && groups[displayCurrency]) sorted[displayCurrency] = groups[displayCurrency];
    for (const [cur, accs] of Object.entries(groups)) {
      if (cur !== displayCurrency) sorted[cur] = accs;
    }
    return sorted;
  })();
  
  const [mode, setMode]     = useState(editData || window.innerWidth <= 768 ? 'single' : 'multi');
  const [rows, setRows]     = useState(() => Array.from({ length: NUM_ROWS }, () => makeRow(defaultAcc)));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const firstRef            = useRef();

  // Single-form state
  const [sDesc, setSDesc]       = useState(editData?.description ?? '');
  const [sTxType, setSTxType]   = useState(editData ? (editData.type ?? (editData.amount < 0 ? 'expense' : 'income')) : 'expense');
  const [sAmount, setSAmount]   = useState(editData ? Math.abs(editData.amount).toString() : '');
  const [sDate, setSDate]       = useState(editData?.rawDate ?? todayISO());
  const [sAccount, setSAccount] = useState(editData?.accountId ?? accountsList.find(a => a.name === editData?.account)?.id ?? defaultAcc);
  const [sCounter, setSCounter] = useState('');
  const [sTags, setSTags]       = useState(editData?.tags ?? []);
  const [sRepeat, setSRepeat]   = useState('never');
  const [sMemo, setSMemo]       = useState(editData?.notes ?? '');
  const det = editData?.details ?? {};
  const [sInvestmentType, setSInvestmentType] = useState(det.investmentType ?? 'buy');
  const [sIouType, setSIouType] = useState(det.iouType ?? 'shared_bill');
  const [sPaidBy, setSPaidBy] = useState(det.paidBy ?? 'Me');
  const [sSharedBy, setSSharedBy] = useState(det.sharedBy ?? 'Me');
  const [sSharedByEmail, setSSharedByEmail] = useState(det.sharedByEmail ?? '');
  const [sStatus, setSStatus] = useState(editData?.status ?? 'cleared');
  const [sUrl, setSUrl] = useState(editData?.url ?? '');
  const [sErrors, setSErrors]   = useState({});

  useEffect(() => { firstRef.current?.focus(); }, [mode]);

  // Auto-apply rules to suggested tags based on description
  useEffect(() => {
    if (!rules || !rules.length || !sDesc.trim()) return;
    const suggestedTags = applyRules(sDesc, [], rules);
    setSTags(prev => [...new Set([...prev, ...suggestedTags])]);
  }, [sDesc, rules]);

  // ── Multi helpers ──────────────────────────────────────────────────────────
  const setField = (idx, field, val) => {
    setRows(r => r.map((row, i) => {
      if (i !== idx) return row;
      if (field !== 'desc') return { ...row, [field]: val };
      // Swap the tags the rules added for the previous text with those for the new text.
      const auto = applyRules(val, [], rules);
      const tags = [...new Set([...row.tags.filter(t => !(row.autoTags ?? []).includes(t)), ...auto])];
      return { ...row, desc: val, tags, autoTags: auto };
    }));
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
    const ok = await actions.addTransactions(filledRows.map(r => {
      const meta = TX_TYPES.find(t => t.key === r.txType) ?? TX_TYPES[0];
      const num  = parseFloat(r.amount);
      return {
        accountId: r.account, amount: meta.sign === '-' ? -num : num, description: r.desc.trim(),
        date: r.date, tags: r.tags, type: r.txType,
      };
    }));
    setSaving(false);
    if (ok) onClose();
  };

  // ── Single helpers ─────────────────────────────────────────────────────────
  const validateSingle = () => {
    const e = {};
    if (!sDesc.trim()) e.desc = true;
    if (!sAmount || isNaN(parseFloat(sAmount)) || parseFloat(sAmount) <= 0) e.amount = true;
    if (sAccount == null) e.account = true;
    if (sTxType === 'transfer' && !editData && !sCounter) e.counter = true;
    return e;
  };

  const handleSingleSubmit = async () => {
    const e = validateSingle();
    if (Object.keys(e).length) { setSErrors(e); return; }
    setSaving(true);
    const meta = TX_TYPES.find(t => t.key === sTxType) ?? TX_TYPES[0];
    const num  = parseFloat(sAmount);
    const inflow = sTxType === 'investment' ? INVESTMENT_INFLOWS.includes(sInvestmentType) : meta.sign === '+';
    const amt  = inflow ? num : -num;
    const details =
      sTxType === 'investment' ? { investmentType: sInvestmentType } :
      sTxType === 'iou' ? { iouType: sIouType, paidBy: sPaidBy.trim(), sharedBy: sSharedBy.trim(), sharedByEmail: sSharedByEmail.trim() } :
      {};
    const base = {
      accountId: sAccount, amount: amt, description: sDesc.trim(), date: sDate, tags: sTags, notes: sMemo.trim(), type: sTxType,
      status: sStatus, url: sUrl.trim(), details,
    };
    let ok;
    if (editData) {
      ok = await actions.updateTransaction({ id: editData.id, ...base });
    } else {
      ok = await actions.addTransactions([{ ...base, counterAccountId: isTransferType(sTxType) && sCounter ? Number(sCounter) : undefined }]);
      if (ok && sRepeat !== 'never') {
        const freq = { daily: 'Daily', weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly', yearly: 'Yearly' }[sRepeat];
        await actions.addRepeat({
          description: base.description, amount: amt, frequency: freq, nextDate: nextOccurrence(sDate, freq),
          tags: sTags, accountId: sAccount,
        });
      }
    }
    setSaving(false);
    if (ok) onClose();
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
                    onChange={e => setField(idx, 'account', Number(e.target.value))}
                  >
                    {Object.entries(groupedAccounts).map(([cur, accs]) => (
                      <optgroup key={cur} label={`${cur}${cur === displayCurrency && displayCurrency !== 'All' ? ' ★' : ''}`}>
                        {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </optgroup>
                    ))}
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
              <div className="sgl-row">
                <div className="sgl-field-group">
                  <label className="sgl-label">TYPE <span title="Expense and income count toward totals. Transfers move money between your accounts. Investment and IOU entries change the account balance but are not counted as income or expense.">?</span></label>
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
                {sTxType === 'investment' && (
                  <div className="sgl-field-group">
                    <label className="sgl-label">INVESTMENT TYPE</label>
                    <select className="sgl-select" value={sInvestmentType} onChange={e=>setSInvestmentType(e.target.value)}>
                      <option value="buy">BUY</option>
                      <option value="sell">SELL</option>
                      <option value="dividend">DIVIDEND</option>
                      <option value="capital_gain">CAPITAL GAIN</option>
                      <option value="capital_loss">CAPITAL LOSS</option>
                    </select>
                  </div>
                )}
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
                  <label className="sgl-label">{sTxType === 'transfer' ? 'ACCOUNT - SOURCE' : 'ACCOUNT'}</label>
                  <select className="sgl-select" value={sAccount ?? ''} onChange={e => setSAccount(Number(e.target.value))}>
                    {editData && sAccount === editData.accountId && !accountsList.some(a => a.id === sAccount) && (
                      <option value={sAccount}>{editData.account} (archived)</option>
                    )}
                    {Object.entries(groupedAccounts).map(([cur, accs]) => (
                      <optgroup key={cur} label={`${cur}${cur === displayCurrency && displayCurrency !== 'All' ? ' ★' : ''}`}>
                        {accs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {isTransferType(sTxType) && !editData && (
                    <div style={{marginTop:'1rem'}}>
                      <label className="sgl-label">ACCOUNT - DESTINATION</label>
                      <select className={`sgl-select${sErrors.counter ? ' invalid' : ''}`} value={sCounter} onChange={e => setSCounter(e.target.value)}>
                        <option value="">{sTxType === 'transfer' ? 'SELECT' : 'SELECT (optional)'}</option>
                        {Object.entries(groupedAccounts).map(([cur, accs]) => (
                          <optgroup key={cur} label={`${cur}${cur === displayCurrency && displayCurrency !== 'All' ? ' ★' : ''}`}>
                            {accs.filter(a => a.id !== sAccount).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="sgl-field-group sgl-col-narrow">
                  <label className="sgl-label">REPEAT</label>
                  <select className="sgl-select" value={sRepeat} onChange={e => setSRepeat(e.target.value)} disabled={!!editData}>
                    <option value="never">NEVER</option>
                    <option value="daily">DAILY</option>
                    <option value="weekly">WEEKLY</option>
                    <option value="biweekly">BI-WEEKLY</option>
                    <option value="monthly">MONTHLY</option>
                    <option value="yearly">YEARLY</option>
                  </select>
                </div>
              </div>

              {/* Row 4.5: IOU Fields */}
              {sTxType === 'iou' && (
                <>
                  <div className="sgl-row">
                    <div className="sgl-field-group sgl-col-wide">
                      <label className="sgl-label">IOU TYPE <span title="Shared bill: a cost split with others. Loan: money lent or borrowed.">?</span></label>
                      <select className="sgl-select" value={sIouType} onChange={e=>setSIouType(e.target.value)}>
                        <option value="shared_bill">SHARED BILL</option>
                        <option value="loan">LOAN</option>
                      </select>
                    </div>
                  </div>
                  <div className="sgl-row" style={{marginTop:'1rem'}}>
                    <div className="sgl-field-group sgl-col-wide">
                      <label className="sgl-label">PAID BY</label>
                      <input type="text" className="sgl-input" value={sPaidBy} onChange={e=>setSPaidBy(e.target.value)} />
                    </div>
                  </div>
                  <div className="sgl-row" style={{marginTop:'1rem',flexDirection:'column',gap:'0.5rem'}}>
                    <div className="sgl-field-group sgl-col-wide">
                      <label className="sgl-label">SHARED BY</label>
                      <input type="text" className="sgl-input" value={sSharedBy} onChange={e=>setSSharedBy(e.target.value)} />
                    </div>
                    <div className="sgl-field-group sgl-col-wide">
                      <input type="text" className="sgl-input" placeholder="Email or name" value={sSharedByEmail} onChange={e=>setSSharedByEmail(e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              {/* Row 5: MEMO + STATUS */}
              <div className="sgl-row sgl-row-top" style={{marginTop:'1.5rem'}}>
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
                  <label className="sgl-label">STATUS <span title="Uncleared: not yet posted by the bank.">?</span></label>
                  <select className="sgl-select" value={sStatus} onChange={e=>setSStatus(e.target.value)}>
                    <option value="cleared">CLEARED</option>
                    <option value="uncleared">UNCLEARED</option>
                  </select>

                </div>
              </div>
              
              <div className="sgl-row" style={{marginTop:'1rem'}}>
                <div className="sgl-field-group sgl-col-wide">
                  <label className="sgl-label">URL</label>
                  <input type="url" className="sgl-input" placeholder="https://…" value={sUrl} onChange={e=>setSUrl(e.target.value)} />
                </div>
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

import React, { useState, useRef } from 'react';
import { X, User, Shield, FileText, Download, Upload as UploadIcon, Check, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { transactionsToCSV, parseTransactionsCSV, normalizeRecords } from '../lib/csv';
import { addDaysISO, todayISO } from '../helpers';

const labelStyle = { display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: '0.4rem' };
const cardStyle = { marginBottom: '1.5rem', background: 'var(--surface-alt)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' };
const h3Style = { marginTop: 0, marginBottom: '1.5rem', fontSize: '1.15rem', color: 'var(--text-1)', fontWeight: 700 };
const h4Style = { marginTop: 0, marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-1)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' };

const TABS = [
  { key: 'profile', label: 'Profile', Icon: User },
  { key: 'security', label: 'Security', Icon: Shield },
  { key: 'transactions', label: 'Transactions', Icon: FileText },
];

function download(content, mime, filename) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function PasswordForm({ notify }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) return setErr('Use at least 8 characters.');
    if (pw !== pw2) return setErr('Passwords do not match.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    setPw(''); setPw2('');
    notify('Password updated.');
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxWidth: 320 }}>
      {err && <div className="form-err">{err}</div>}
      <div className="form-group">
        <label className="form-label">NEW PASSWORD</label>
        <input className="form-input" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)}/>
      </div>
      <div className="form-group">
        <label className="form-label">CONFIRM PASSWORD</label>
        <input className="form-input" type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)}/>
      </div>
      <div><button className="btn-pri" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Change Password'}</button></div>
    </form>
  );
}

export default function SettingsModal({ onClose, appData, actions, demoMode, theme, onTheme, notify, initialTab = 'profile' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [exportPeriod, setExportPeriod] = useState('ALL');
  const [exportFormat, setExportFormat] = useState('JSON');
  const [importAccount, setImportAccount] = useState('auto');
  const [importTags, setImportTags] = useState(true);
  const [importFile, setImportFile] = useState(null);
  const [importState, setImportState] = useState({ status: '', msg: '', errors: [] }); // status: '', busy, success, error
  const fileInputRef = useRef(null);

  const handleExport = () => {
    const today = todayISO();
    let txns = appData.transactions.filter(t => !t.deleted);
    if (exportPeriod === '30D') txns = txns.filter(t => t.rawDate >= addDaysISO(today, -30));
    else if (exportPeriod === 'YEAR') txns = txns.filter(t => t.rawDate >= `${today.slice(0, 4)}-01-01`);

    if (exportFormat === 'CSV') {
      download('﻿' + transactionsToCSV(txns), 'text/csv;charset=utf-8', `ledgelog_export_${today}.csv`);
    } else {
      download(JSON.stringify({
        transactions: txns.map(({ rawDate, description, amount, type, tags, account, currency, notes }) => ({ date: rawDate, description, amount, type, tags, account, currency, notes })),
        accounts: appData.accounts, tags: appData.tags,
      }, null, 2), 'application/json', `ledgelog_export_${today}.json`);
    }
    notify(`Exported ${txns.length} transaction${txns.length === 1 ? '' : 's'}.`);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportState({ status: 'busy', msg: 'Reading file…', errors: [] });
    try {
      const text = await importFile.text();
      let parsed;
      if (importFile.name.toLowerCase().endsWith('.csv')) {
        parsed = parseTransactionsCSV(text, { importTags });
      } else {
        const json = JSON.parse(text);
        if (!Array.isArray(json.transactions)) throw new Error('JSON file must contain a "transactions" array.');
        parsed = normalizeRecords(json.transactions, { importTags });
      }
      if (parsed.items.length === 0) {
        setImportState({ status: 'error', msg: 'No importable transactions found.', errors: parsed.errors.slice(0, 5) });
        return;
      }
      setImportState({ status: 'busy', msg: `Importing ${parsed.items.length} transactions…`, errors: [] });
      const result = await actions.importTransactions(parsed.items, { accountId: importAccount === 'auto' ? undefined : Number(importAccount) });
      if (!result) { setImportState({ status: '', msg: '', errors: [] }); return; } // action already showed the error
      const bits = [`Imported ${result.added}`];
      if (result.skipped) bits.push(`skipped ${result.skipped} duplicate${result.skipped > 1 ? 's' : ''}`);
      if (parsed.errors.length) bits.push(`${parsed.errors.length} invalid row${parsed.errors.length > 1 ? 's' : ''} ignored`);
      setImportState({ status: 'success', msg: bits.join(', ') + '.', errors: parsed.errors.slice(0, 5) });
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setImportState({ status: 'error', msg: err.message || 'Could not read that file. Use a valid CSV or JSON export.', errors: [] });
    }
  };

  const banner = (kind, children) => (
    <div className="animate-fade-in" style={{
      padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, marginTop: '1rem',
      background: kind === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: kind === 'ok' ? 'var(--green)' : 'var(--red)',
      border: `1px solid ${kind === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
    }}>{children}</div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '90vw', display: 'flex', flexDirection: 'column', height: '70vh', minHeight: 450, padding: 0 }}>
        <div className="modal-hdr" style={{ padding: '1.25rem', borderBottom: '1px solid var(--modal-border)', flexShrink: 0 }}>
          <div className="modal-title">Settings</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16}/></button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: 180, borderRight: '1px solid var(--modal-border)', background: 'var(--surface-alt)', padding: '0.75rem 0', flexShrink: 0, overflowY: 'auto' }}>
            {TABS.map(({ key, label, Icon }) => (
              <div key={key} onClick={() => setActiveTab(key)} style={{
                padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem',
                background: activeTab === key ? 'var(--hover)' : 'transparent',
                color: activeTab === key ? 'var(--blue)' : 'var(--text-2)',
                fontWeight: activeTab === key ? 600 : 500,
                borderRight: activeTab === key ? '3px solid var(--blue)' : '3px solid transparent',
              }}>
                <Icon size={16}/> {label}
              </div>
            ))}
          </div>

          <div style={{ flex: 1, padding: '1.75rem', overflowY: 'auto', background: 'var(--modal-bg)' }}>
            {activeTab === 'profile' && (
              <div className="animate-fade-in">
                <h3 style={h3Style}>Profile Settings</h3>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ ...labelStyle, fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Theme</label>
                  <select className="fselect" value={theme} onChange={e => onTheme(e.target.value)} style={{ maxWidth: 300 }}>
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                  </select>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ ...labelStyle, fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Account</label>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-1)' }}>{demoMode ? 'Demo account (data resets on reload)' : 'Signed in'}</div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="animate-fade-in">
                <h3 style={h3Style}>Security</h3>
                {demoMode ? (
                  <div style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: '0.85rem', background: 'var(--surface-alt)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                    Security settings are disabled in demo mode.
                  </div>
                ) : <PasswordForm notify={notify}/>}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="animate-fade-in">
                <h3 style={h3Style}>Data & Transactions</h3>

                <div style={cardStyle}>
                  <h4 style={h4Style}><Download size={16} color="var(--blue)"/> Download Data</h4>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={labelStyle}>PERIOD</label>
                      <select className="fselect" value={exportPeriod} onChange={e => setExportPeriod(e.target.value)}>
                        <option value="ALL">All Time</option>
                        <option value="30D">Last 30 Days</option>
                        <option value="YEAR">This Year</option>
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={labelStyle}>FORMAT</label>
                      <select className="fselect" value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
                        <option value="JSON">JSON Backup</option>
                        <option value="CSV">Spreadsheet (.csv)</option>
                      </select>
                    </div>
                  </div>
                  <button className="btn-pri" onClick={handleExport} style={{ fontWeight: 600 }}>DOWNLOAD</button>
                </div>

                <div style={cardStyle}>
                  <h4 style={h4Style}><UploadIcon size={16} color="var(--blue)"/> Upload Transactions</h4>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={labelStyle}>ACCOUNT</label>
                    <select className="fselect" value={importAccount} onChange={e => setImportAccount(e.target.value)}>
                      <option value="auto">Use the Account column (creates missing accounts)</option>
                      {appData.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={labelStyle}>FILE (.csv or .json)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="file" accept=".json,.csv" ref={fileInputRef} onChange={e => { setImportFile(e.target.files?.[0] || null); setImportState({ status: '', msg: '', errors: [] }); }} style={{ display: 'none' }}/>
                      <button className="btn-sec" onClick={() => fileInputRef.current?.click()} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>Choose file</button>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                        {importFile ? importFile.name : 'No file chosen'}
                      </span>
                    </div>
                    <div className="form-note">Columns: Date, Description, Amount (required); Type, Tags, Account, Currency, Notes (optional). Rows already in your ledger are skipped.</div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: '1rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={importTags} onChange={e => setImportTags(e.target.checked)}/> Import tags from file
                  </label>
                  <button className="btn-pri" onClick={handleImport} disabled={!importFile || importState.status === 'busy'} style={{ fontWeight: 600, opacity: importFile ? 1 : 0.5 }}>
                    {importState.status === 'busy' ? <><RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }}/> {importState.msg}</> : 'UPLOAD'}
                  </button>

                  {importState.status === 'success' && banner('ok', <><Check size={16} style={{ verticalAlign: 'text-bottom' }}/> {importState.msg}</>)}
                  {importState.status === 'error' && banner('err', importState.msg)}
                  {importState.errors.length > 0 && (
                    <ul style={{ fontSize: '0.72rem', color: 'var(--text-3)', margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
                      {importState.errors.map(e => <li key={e}>{e}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--modal-border)', flexShrink: 0 }}>
          <button className="btn-sec" onClick={onClose} style={{ fontWeight: 600 }}>Close</button>
        </div>
      </div>
    </div>
  );
}

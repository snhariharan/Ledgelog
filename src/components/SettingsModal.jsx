import React, { useState, useRef } from 'react';
import { X, Save, User, Shield, FileText, Download, Upload as UploadIcon, Check } from 'lucide-react';
import { APP_SETTINGS, setSetting } from '../helpers';

export default function SettingsModal({ onClose, appData, setAppData, demoMode, initialTab = 'profile' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [theme, setTheme] = useState(APP_SETTINGS.theme);
  const [msg, setMsg] = useState('');
  
  // Export states
  const [exportPeriod, setExportPeriod] = useState('ALL');
  const [exportFormat, setExportFormat] = useState('JSON');
  
  // Import states
  const [importAccount, setImportAccount] = useState('auto');
  const [importFile, setImportFile] = useState(null);
  const [importStatus, setImportStatus] = useState(''); // '', 'uploading', 'success', 'error'
  const [importProgress, setImportProgress] = useState(0);
  
  const fileInputRef = useRef(null);

  const handleSave = () => {
    let reloadsNeeded = false;
    if (theme !== APP_SETTINGS.theme) {
      setSetting('theme', theme);
      reloadsNeeded = true;
    }
    
    if (reloadsNeeded) {
      window.location.reload();
    } else {
      onClose();
    }
  };

  const handleExport = () => {
    let exportData = '';
    let mimeType = '';
    let ext = '';

    const txns = appData?.transactions || [];
    let filteredTxns = txns;
    if (exportPeriod === '30D') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filteredTxns = txns.filter(t => new Date(t.date) >= thirtyDaysAgo);
    } else if (exportPeriod === 'YEAR') {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      filteredTxns = txns.filter(t => new Date(t.date) >= startOfYear);
    }

    if (exportFormat === 'CSV') {
      mimeType = 'text/csv';
      ext = 'csv';
      const header = 'Date,Description,Amount,Type,Tags\n';
      const rows = filteredTxns.map(t => {
        const desc = `"${(t.description || '').replace(/"/g, '""')}"`;
        const tags = `"${(t.tags || []).join(', ')}"`;
        return `${t.date},${desc},${t.amount},${t.type},${tags}`;
      }).join('\n');
      exportData = header + rows;
    } else {
      mimeType = 'application/json';
      ext = 'json';
      exportData = JSON.stringify({
        transactions: filteredTxns,
        accounts: appData?.accounts || [],
        tags: appData?.tags || []
      }, null, 2);
    }

    const blob = new Blob([exportData], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledgelog_export_${new Date().toISOString().split('T')[0]}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMsg('Data exported successfully.');
    setTimeout(() => setMsg(''), 3000);
  };

  const onFileSelect = (e) => {
    setImportFile(e.target.files?.[0] || null);
  };

  const handleImport = () => {
    if (!importFile) return;
    setImportStatus('uploading');
    setImportProgress(0);
    setMsg('Reading file...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        let importedTxns = [];
        if (importFile.name.toLowerCase().endsWith('.csv')) {
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (lines.length > 1) {
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
              const rowObj = {};
              headers.forEach((h, idx) => { rowObj[h] = cols[idx]; });
              
              const amt = parseFloat(rowObj.amount || '0');
              const rawDate = rowObj.date || new Date().toISOString().slice(0, 10);
              const tx = {
                id: rowObj.id || Date.now() + Math.random(),
                date: new Date(rawDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}),
                rawDate,
                amount: amt,
                description: rowObj.description || '',
                tags: rowObj.tags && rowObj.tags.trim() ? rowObj.tags.split(',').map(t => t.replace(/^"|"$/g, '').trim()).filter(Boolean) : [],
                account: importAccount === 'auto' ? (rowObj.account || 'Default') : appData?.accounts?.find(a=>a.id==importAccount)?.name || 'Default',
                type: rowObj.type ? rowObj.type.toLowerCase() : (amt < 0 ? 'expense' : 'income'),
                deleted: false,
                untagged: !rowObj.tags,
                _csvCurrency: rowObj.currency || 'USD'
              };
              importedTxns.push(tx);
            }
          }
        } else {
          const imported = JSON.parse(text);
          importedTxns = imported.transactions || [];
        }

        if (importedTxns.length === 0) {
          throw new Error('No transactions found in file.');
        }

        const total = importedTxns.length;
        setMsg(`Processing ${total} transactions...`);
        
        // Organic simulated progress delay since local parse is instant
        const chunks = 10;
        for (let i = 0; i < chunks; i++) {
           await new Promise(r => setTimeout(r, 60));
           setImportProgress(Math.floor(((i + 1) / chunks) * 100));
        }

        if (setAppData) {
          setAppData(prev => {
            const existingIds = new Set(prev?.transactions?.map(t => String(t.id)) || []);
            const newTxns = importedTxns.filter(t => !existingIds.has(String(t.id)));

            const accountMap = new Map((prev?.accounts || []).map(a => [a.name, a]));
            let maxAccId = prev?.accounts?.length > 0 ? Math.max(...prev.accounts.map(a => a.id)) : 0;
            
            const tagMap = new Map((prev?.tags || []).map(t => [t.name, t]));
            let maxTagId = prev?.tags?.length > 0 ? Math.max(...prev.tags.map(t => t.id)) : 0;

            const getBalanceDelta = (amt, type) => type === 'credit' ? -amt : amt;

            newTxns.forEach(tx => {
              if (tx.account && !accountMap.has(tx.account)) {
                accountMap.set(tx.account, {
                  id: ++maxAccId,
                  name: tx.account,
                  balance: 0,
                  type: 'checking',
                  currency: tx._csvCurrency || 'USD'
                });
              }

              // Update account balance
              if (tx.account) {
                const acc = accountMap.get(tx.account);
                if (acc) acc.balance += getBalanceDelta(tx.amount, acc.type);
              }

              if (tx.tags && tx.tags.length > 0) {
                tx.tags.forEach(tagName => {
                  if (!tagMap.has(tagName)) {
                    tagMap.set(tagName, {
                      id: ++maxTagId,
                      name: tagName,
                      color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
                    });
                  }
                });
              }
              delete tx._csvCurrency;
            });

            return { 
              ...prev, 
              transactions: [...newTxns, ...(prev?.transactions || [])],
              accounts: Array.from(accountMap.values()),
              tags: Array.from(tagMap.values())
            };
          });
        }
        
        setImportProgress(100);
        setImportStatus('success');
        setMsg('Data imported successfully!');

        setTimeout(() => {
          setMsg('');
          setImportStatus('');
          setImportProgress(0);
          onClose();
        }, 1500);

      } catch (err) {
        setImportStatus('error');
        setMsg(err.message || 'Error processing file. Ensure it is valid JSON or CSV.');
        setTimeout(() => {
          setMsg('');
          setImportStatus('');
          setImportProgress(0);
        }, 4000);
      }
      
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setImportStatus('error');
      setMsg('Failed to read file from disk.');
    };
    reader.readAsText(importFile);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, width: '90vw', display: 'flex', flexDirection: 'column', height: '60vh', minHeight: 450, padding: 0 }}>
        <div className="modal-hdr" style={{padding: '1.25rem', borderBottom: '1px solid var(--modal-border)', flexShrink: 0}}>
          <div className="modal-title">Settings</div>
          <button className="icon-btn" onClick={onClose}><X size={16}/></button>
        </div>
        
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{ width: 180, borderRight: '1px solid var(--modal-border)', background: 'var(--surface-alt)', padding: '0.75rem 0', flexShrink: 0, overflowY: 'auto' }}>
            <div 
              onClick={() => setActiveTab('profile')}
              style={{ padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', background: activeTab==='profile' ? 'var(--hover)' : 'transparent', color: activeTab==='profile' ? 'var(--blue)' : 'var(--text-2)', fontSize: '0.85rem', fontWeight: activeTab==='profile' ? 600 : 500, borderRight: activeTab==='profile' ? '3px solid var(--blue)' : '3px solid transparent' }}
            >
              <User size={16}/> Profile
            </div>
            <div 
              onClick={() => setActiveTab('security')}
              style={{ padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', background: activeTab==='security' ? 'var(--hover)' : 'transparent', color: activeTab==='security' ? 'var(--blue)' : 'var(--text-2)', fontSize: '0.85rem', fontWeight: activeTab==='security' ? 600 : 500, borderRight: activeTab==='security' ? '3px solid var(--blue)' : '3px solid transparent' }}
            >
              <Shield size={16}/> Security
            </div>
            <div 
              onClick={() => setActiveTab('transactions')}
              style={{ padding: '0.65rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', background: activeTab==='transactions' ? 'var(--hover)' : 'transparent', color: activeTab==='transactions' ? 'var(--blue)' : 'var(--text-2)', fontSize: '0.85rem', fontWeight: activeTab==='transactions' ? 600 : 500, borderRight: activeTab==='transactions' ? '3px solid var(--blue)' : '3px solid transparent' }}
            >
              <FileText size={16}/> Transactions
            </div>
          </div>
          
          {/* Main content */}
          <div style={{ flex: 1, padding: '1.75rem', overflowY: 'auto', background: 'var(--modal-bg)' }}>
            {activeTab === 'profile' && (
              <div className="animate-fade-in">
                <h3 style={{marginTop: 0, marginBottom: '1.5rem', fontSize: '1.15rem', color: 'var(--text-1)', fontWeight: 700}}>Profile Settings</h3>
                <div style={{marginBottom: '1.5rem'}}>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Theme Preferences</label>
                  <select className="fselect" value={theme} onChange={e => setTheme(e.target.value)} style={{maxWidth: 300}}>
                    <option value="light">Light Mode</option>
                    <option value="dark">Dark Mode</option>
                  </select>
                </div>
                <div style={{marginBottom: '1.5rem'}}>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>Account Type</label>
                  <div style={{fontSize: '0.9rem', color: 'var(--text-1)'}}>{demoMode ? 'Demo Account' : 'Standard User'}</div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="animate-fade-in">
                <h3 style={{marginTop: 0, marginBottom: '1.5rem', fontSize: '1.15rem', color: 'var(--text-1)', fontWeight: 700}}>Security</h3>
                <div style={{fontSize: '0.9rem', color: 'var(--text-2)', marginBottom: '1.5rem'}}>
                  Manage your security preferences and password.
                </div>
                {!demoMode ? (
                  <button className="btn-sec" style={{fontSize: '0.85rem', fontWeight: 600}}>Change Password</button>
                ) : (
                  <div style={{color: 'var(--text-3)', fontStyle: 'italic', fontSize: '0.85rem', background: 'var(--surface-alt)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border)'}}>
                    Security settings are disabled in demo mode.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="animate-fade-in">
                <h3 style={{marginTop: 0, marginBottom: '1.5rem', fontSize: '1.15rem', color: 'var(--text-1)', fontWeight: 700}}>Data & Transactions</h3>
                
                {/* Export Card */}
                <div style={{marginBottom: '2rem', background: 'var(--surface-alt)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)'}}>
                  <h4 style={{marginTop: 0, marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-1)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <Download size={16} color="var(--blue)"/> Download Data
                  </h4>
                  <div style={{display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap'}}>
                    <div style={{flex: 1, minWidth: 140}}>
                      <label style={{display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: '0.4rem'}}>PERIOD</label>
                      <select className="fselect" value={exportPeriod} onChange={e => setExportPeriod(e.target.value)}>
                        <option value="ALL">All Time</option>
                        <option value="30D">Last 30 Days</option>
                        <option value="YEAR">This Year</option>
                      </select>
                    </div>
                    <div style={{flex: 1, minWidth: 140}}>
                      <label style={{display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: '0.4rem'}}>FORMAT</label>
                      <select className="fselect" value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
                        <option value="JSON">JSON Backup</option>
                        <option value="CSV">EXCEL (.csv)</option>
                      </select>
                    </div>
                  </div>
                  <button className="btn-pri" onClick={handleExport} style={{fontWeight: 600}}>DOWNLOAD</button>
                </div>

                {/* Import Card */}
                <div style={{marginBottom: '1rem', background: 'var(--surface-alt)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)'}}>
                  <h4 style={{marginTop: 0, marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-1)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <UploadIcon size={16} color="var(--blue)"/> Upload Transactions
                  </h4>
                  <div style={{display: 'flex', gap: '2rem', flexWrap: 'wrap'}}>
                    <div style={{flex: 1, minWidth: 200}}>
                      <div style={{marginBottom: '1rem'}}>
                        <label style={{display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: '0.4rem'}}>ACCOUNT</label>
                        <select className="fselect" value={importAccount} onChange={e => setImportAccount(e.target.value)}>
                          <option value="auto">Auto-detect from file</option>
                          {appData?.accounts?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                      <div style={{marginBottom: '1.25rem'}}>
                        <label style={{display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: '0.4rem'}}>SELECT FILE</label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                          <input type="file" accept=".json,.csv" ref={fileInputRef} onChange={onFileSelect} style={{display: 'none'}} />
                          <button className="btn-sec" onClick={() => fileInputRef.current?.click()} style={{fontSize: '0.75rem', padding: '0.3rem 0.6rem'}}>Choose file</button>
                          <span style={{fontSize: '0.75rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120}}>
                            {importFile ? importFile.name : 'No file chosen'}
                          </span>
                        </div>
                      </div>
                      <button className="btn-pri" onClick={handleImport} disabled={!importFile} style={{fontWeight: 600, opacity: importFile ? 1 : 0.5}}>UPLOAD</button>
                    </div>
                    
                    <div style={{flex: 1, minWidth: 200, borderLeft: '1px solid var(--border)', paddingLeft: '2rem'}}>
                      <label style={{display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.75rem'}}>SETTINGS</label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: '0.5rem', cursor: 'pointer'}}>
                        <input type="checkbox" defaultChecked /> Auto-detect character encoding
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: '0.5rem', cursor: 'pointer'}}>
                        <input type="checkbox" defaultChecked /> Import tags from uploaded file
                      </label>
                      <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: '0.5rem', cursor: 'pointer'}}>
                        <input type="checkbox" /> Remind me when statement is due
                      </label>
                    </div>
                  </div>
                </div>

                  {importStatus === 'uploading' && (
                    <div className="animate-fade-in" style={{marginTop: '1.5rem'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-2)', marginBottom: '0.4rem', fontWeight: 600}}>
                        <span>{msg}</span>
                        <span>{importProgress}%</span>
                      </div>
                      <div style={{height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden'}}>
                        <div style={{height: '100%', width: `${importProgress}%`, background: 'var(--blue)', transition: 'width 0.3s ease'}} />
                      </div>
                    </div>
                  )}

                  {importStatus === 'success' && (
                    <div className="animate-fade-in" style={{padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.1)', color: 'var(--green)', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', border: '1px solid rgba(16,185,129,0.3)'}}>
                      <Check size={16} /> {msg}
                    </div>
                  )}

                  {importStatus === 'error' && (
                    <div className="animate-fade-in" style={{padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', border: '1px solid rgba(239,68,68,0.3)'}}>
                      <X size={16} /> {msg}
                    </div>
                  )}

                {msg && !importStatus && (
                  <div className="animate-fade-in" style={{padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.1)', color: 'var(--green)', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid rgba(16,185,129,0.3)'}}>
                    <Check size={16} /> {msg}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--modal-border)', flexShrink: 0}}>
          <button className="btn-sec" onClick={onClose} style={{fontWeight: 600}}>Cancel</button>
          <button className="btn-pri" onClick={handleSave} style={{fontWeight: 600}}><Save size={14}/> Save Changes</button>
        </div>
      </div>
    </div>
  );
}

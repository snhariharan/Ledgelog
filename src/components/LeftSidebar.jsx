import React, { useState, useEffect } from 'react';
import {
  Landmark, Calendar, Tag, Users, Star, Plus,
  PlusCircle, Edit2, Trash2, Archive, LogOut,
  ChevronDown, X, Check, RefreshCw,
} from 'lucide-react';
import { fmt, PRESET_COLORS, ACCOUNT_TYPES, IOU_FREQS } from '../helpers';

// ══════════════════════════════════════════════════════════════════════════════
// LEFT SIDEBAR — vertical nav, collapsible, with full CRUD modals
// ══════════════════════════════════════════════════════════════════════════════
const SIDEBAR_TABS = [
  { key:'accounts',  label:'Accounts',  Icon:Landmark },
  { key:'repeats',   label:'Repeats',   Icon:Calendar },
  { key:'tags',      label:'Tags',      Icon:Tag      },
  { key:'ious',      label:'IOUs',      Icon:Users    },
  { key:'favorites', label:'Favorites', Icon:Star     },
];


/* ──── Shared small modal shell ──── */
function SbModal({ title, onClose, children }) {
  useEffect(() => {
    const esc = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{maxWidth:440}} onClick={e=>e.stopPropagation()}>
        <div className="modal-hdr">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}><X size={14}/></button>
        </div>
        <div style={{padding:'1.25rem'}}>{children}</div>
      </div>
    </div>
  );
}

/* ──── Add Account Modal ──── */
function AddAccountModal({ onClose, onAdd }) {
  const [name,  setName]   = useState('');
  const [inst,  setInst]   = useState('');
  const [type,  setType]   = useState('checking');
  const [currency, setCurrency] = useState('USD');
  const [bal,   setBal]    = useState('');
  const [err,   setErr]    = useState('');

  const submit = e => {
    e.preventDefault();
    if (!name.trim()) return setErr('Account name is required.');
    onAdd({ id: Date.now(), name: name.trim(), institution: inst.trim()||'—', type, currency, balance: parseFloat(bal)||0 });
    onClose();
  };
  return (
    <SbModal title="Add Account" onClose={onClose}>
      <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        {err && <div className="form-err">{err}</div>}
        <div className="form-group">
          <label className="form-label">ACCOUNT NAME *</label>
          <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. HDFC Savings" autoFocus/>
        </div>
        <div className="form-group">
          <label className="form-label">BANK / INSTITUTION</label>
          <input className="form-input" value={inst} onChange={e=>setInst(e.target.value)} placeholder="e.g. HDFC Bank"/>
        </div>
        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label">ACCOUNT TYPE</label>
            <select className="form-input" value={type} onChange={e=>setType(e.target.value)}>
              {ACCOUNT_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">CURRENCY</label>
            <select className="form-input" value={currency} onChange={e=>setCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="INR">INR</option>
              <option value="JPY">JPY</option>
              <option value="AUD">AUD</option>
              <option value="CAD">CAD</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">INITIAL BALANCE</label>
          <input className="form-input" type="number" step="0.01" value={bal} onChange={e=>setBal(e.target.value)} placeholder="0.00"/>
        </div>
        <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end',marginTop:'0.25rem'}}>
          <button type="button" className="btn-sec" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-pri">Add Account</button>
        </div>
      </form>
    </SbModal>
  );
}

/* ──── Edit Accounts Modal ──── */
function EditAccountsModal({ accounts, onClose, onUpdate, onDelete, onArchive }) {
  const [editing, setEditing] = useState(null); // account id being edited
  const [draft,   setDraft]   = useState({});

  const startEdit = acc => { setEditing(acc.id); setDraft({...acc}); };
  const save = () => { onUpdate(draft); setEditing(null); };

  return (
    <SbModal title="Edit Accounts" onClose={onClose}>
      <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
        {accounts.map(acc => editing === acc.id ? (
          <div key={acc.id} className="acc-edit-row">
            <div style={{display:'flex',flexDirection:'column',gap:'0.4rem',flex:1}}>
              <input className="form-input" style={{fontSize:'0.75rem'}} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Name"/>
              <input className="form-input" style={{fontSize:'0.75rem'}} value={draft.institution} onChange={e=>setDraft({...draft,institution:e.target.value})} placeholder="Institution"/>
              <div style={{display:'flex',gap:'0.4rem'}}>
                <select className="form-input" style={{fontSize:'0.72rem',flex:1}} value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value})}>
                  {ACCOUNT_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
                <select className="form-input" style={{fontSize:'0.72rem',flex:1}} value={draft.currency || 'USD'} onChange={e=>setDraft({...draft,currency:e.target.value})}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                  <option value="JPY">JPY</option>
                  <option value="AUD">AUD</option>
                  <option value="CAD">CAD</option>
                </select>
                <input className="form-input" style={{fontSize:'0.72rem',width:90}} type="number" step="0.01" value={draft.balance} onChange={e=>setDraft({...draft,balance:parseFloat(e.target.value)||0})}/>
              </div>
              <div style={{display:'flex',gap:'0.4rem'}}>
                <button className="btn-pri" style={{fontSize:'0.7rem',padding:'3px 10px'}} onClick={save}>Save</button>
                <button className="btn-sec" style={{fontSize:'0.7rem',padding:'3px 10px'}} onClick={()=>setEditing(null)}>Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <div key={acc.id} className="acc-edit-row">
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:'0.78rem'}}>{acc.name}</div>
              <div style={{fontSize:'0.68rem',color:'var(--text-3)'}}>{acc.institution} · {acc.type} · <span style={{color:acc.balance>=0?'var(--green)':'var(--red)'}}>{fmt(acc.balance, false, acc.currency)}</span></div>
            </div>
            <div style={{display:'flex',gap:'0.3rem',alignItems:'center'}}>
              <button className="icon-btn" title="Edit" onClick={()=>startEdit(acc)}><Edit2 size={12}/></button>
              <button className="icon-btn" title="Archive" onClick={()=>onArchive(acc.id)}><Archive size={12}/></button>
              <button className="icon-btn" title="Delete" style={{color:'var(--red)'}} onClick={()=>onDelete(acc.id)}><Trash2 size={12}/></button>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:'1rem'}}>
        <button className="btn-sec" onClick={onClose}>Done</button>
      </div>
    </SbModal>
  );
}

/* ──── Add Tag Modal ──── */
function AddTagModal({ tags, onClose, onAdd }) {
  const [name,   setName]   = useState('');
  const [color,  setColor]  = useState('#3b82f6');
  const [parent, setParent] = useState('');
  const [err,    setErr]    = useState('');

  const submit = e => {
    e.preventDefault();
    if (!name.trim()) return setErr('Tag name is required.');
    if (tags.some(t=>t.name.toLowerCase()===name.trim().toLowerCase())) return setErr('Tag already exists.');
    onAdd({ id: Date.now(), name: name.trim(), color, parent: parent||null });
    onClose();
  };
  return (
    <SbModal title="Add Tag" onClose={onClose}>
      <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        {err && <div className="form-err">{err}</div>}
        <div className="form-group">
          <label className="form-label">TAG NAME *</label>
          <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Food" autoFocus/>
        </div>
        <div className="form-group">
          <label className="form-label">PARENT TAG (optional)</label>
          <select className="form-input" value={parent} onChange={e=>setParent(e.target.value)}>
            <option value="">— None —</option>
            {tags.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">COLOR</label>
          <div className="color-grid">
            {PRESET_COLORS.map(c=>(
              <div key={c} className={`color-swatch ${color===c?'selected':''}`}
                style={{background:c}} onClick={()=>setColor(c)}/>
            ))}
            <input type="color" className="color-custom" value={color} onChange={e=>setColor(e.target.value)} title="Custom color"/>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginTop:'0.4rem'}}>
            <span style={{width:16,height:16,borderRadius:'50%',background:color,display:'inline-block',border:'2px solid var(--border)'}}/>
            <span style={{fontSize:'0.72rem',color:'var(--text-3)'}}>{name||'Preview'}</span>
          </div>
        </div>
        <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
          <button type="button" className="btn-sec" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-pri">Add Tag</button>
        </div>
      </form>
    </SbModal>
  );
}

/* ──── Edit Tags Modal ──── */
function EditTagsModal({ tags, onClose, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [draft,   setDraft]   = useState({});

  const startEdit = tag => { setEditing(tag.id); setDraft({...tag}); };
  const save = () => { onUpdate(draft); setEditing(null); };

  return (
    <SbModal title="Edit Tags" onClose={onClose}>
      <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',maxHeight:340,overflowY:'auto'}}>
        {tags.map(tag => editing === tag.id ? (
          <div key={tag.id} className="acc-edit-row">
            <div style={{display:'flex',gap:'0.4rem',flex:1,alignItems:'center'}}>
              <input className="form-input" style={{fontSize:'0.75rem',flex:1}} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/>
              <div style={{position:'relative'}}>
                <input type="color" style={{width:28,height:28,padding:0,border:'none',background:'none',cursor:'pointer',borderRadius:4}} value={draft.color} onChange={e=>setDraft({...draft,color:e.target.value})}/>
              </div>
              <button className="btn-pri" style={{fontSize:'0.7rem',padding:'3px 10px'}} onClick={save}>✓</button>
              <button className="btn-sec" style={{fontSize:'0.7rem',padding:'3px 6px'}} onClick={()=>setEditing(null)}>✕</button>
            </div>
          </div>
        ) : (
          <div key={tag.id} className="acc-edit-row">
            <span style={{width:10,height:10,borderRadius:'50%',background:tag.color,display:'inline-block',flexShrink:0}}/>
            <span style={{flex:1,fontSize:'0.78rem'}}>{tag.name}</span>
            <button className="icon-btn" onClick={()=>startEdit(tag)}><Edit2 size={12}/></button>
            <button className="icon-btn" style={{color:'var(--red)'}} onClick={()=>onDelete(tag.id)}><Trash2 size={12}/></button>
          </div>
        ))}
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:'1rem'}}>
        <button className="btn-sec" onClick={onClose}>Done</button>
      </div>
    </SbModal>
  );
}

/* ──── Add IOU Modal ──── */
function AddIOUModal({ onClose, onAdd }) {
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [dir,    setDir]    = useState('owe_me');
  const [note,   setNote]   = useState('');
  const [date,   setDate]   = useState(new Date().toISOString().slice(0,10));
  const [err,    setErr]    = useState('');

  const submit = e => {
    e.preventDefault();
    if (!person.trim()) return setErr('Person name is required.');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setErr('Enter a valid amount.');
    onAdd({ id: Date.now(), person: person.trim(), amount: dir==='i_owe'?-amt:amt, direction: dir, note: note.trim()||'IOU', date: new Date(date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) });
    onClose();
  };
  return (
    <SbModal title="Add IOU" onClose={onClose}>
      <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        {err && <div className="form-err">{err}</div>}
        {/* Direction toggle */}
        <div className="iou-dir-toggle">
          <button type="button" className={dir==='owe_me'?'active':''} onClick={()=>setDir('owe_me')}>They owe me</button>
          <button type="button" className={dir==='i_owe'?'active':''} onClick={()=>setDir('i_owe')}>I owe them</button>
        </div>
        <div className="form-group">
          <label className="form-label">PERSON *</label>
          <input className="form-input" value={person} onChange={e=>setPerson(e.target.value)} placeholder="e.g. Rahul Kumar" autoFocus/>
        </div>
        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label">AMOUNT *</label>
            <input className="form-input" type="number" step="0.01" min="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/>
          </div>
          <div className="form-group">
            <label className="form-label">DATE</label>
            <input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">NOTE / REASON</label>
          <input className="form-input" value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Dinner split"/>
        </div>
        <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
          <button type="button" className="btn-sec" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-pri" style={{background:dir==='owe_me'?'var(--green)':'var(--red)'}}>
            {dir==='owe_me'?'Record — they owe me':'Record — I owe them'}
          </button>
        </div>
      </form>
    </SbModal>
  );
}

/* ──── Add Repeat Modal ──── */
function AddRepeatModal({ tags, onClose, onAdd }) {
  const [desc,  setDesc]  = useState('');
  const [amt,   setAmt]   = useState('');
  const [type,  setType]  = useState('expense');
  const [freq,  setFreq]  = useState('Monthly');
  const [next,  setNext]  = useState(new Date().toISOString().slice(0,10));
  const [selTags, setSelTags] = useState([]);
  const [err,   setErr]   = useState('');

  const submit = e => {
    e.preventDefault();
    if (!desc.trim()) return setErr('Description is required.');
    const a = parseFloat(amt);
    if (!a || a <= 0) return setErr('Enter a valid amount.');
    const finalAmt = type==='expense' ? -a : a;
    const nextFmt = new Date(next).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    onAdd({ id: Date.now(), description: desc.trim(), amount: finalAmt, frequency: freq, nextDate: nextFmt, tags: selTags });
    onClose();
  };
  const toggleTag = name => setSelTags(prev => prev.includes(name)?prev.filter(t=>t!==name):[...prev,name]);

  return (
    <SbModal title="Add Recurring Transaction" onClose={onClose}>
      <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        {err && <div className="form-err">{err}</div>}
        <div className="iou-dir-toggle">
          <button type="button" className={type==='expense'?'active':''} onClick={()=>setType('expense')}>Expense</button>
          <button type="button" className={type==='income'?'active':''} onClick={()=>setType('income')}>Income</button>
        </div>
        <div className="form-group">
          <label className="form-label">DESCRIPTION *</label>
          <input className="form-input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Netflix subscription" autoFocus/>
        </div>
        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label">AMOUNT *</label>
            <input className="form-input" type="number" step="0.01" min="0.01" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0.00"/>
          </div>
          <div className="form-group">
            <label className="form-label">FREQUENCY</label>
            <select className="form-input" value={freq} onChange={e=>setFreq(e.target.value)}>
              {IOU_FREQS.map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">NEXT DATE</label>
          <input className="form-input" type="date" value={next} onChange={e=>setNext(e.target.value)}/>
        </div>
        <div className="form-group">
          <label className="form-label">TAGS</label>
          <div className="tag-multi-pick">
            {tags.map(t=>(
              <span key={t.id} className={`tag-pick-chip ${selTags.includes(t.name)?'sel':''}`}
                style={selTags.includes(t.name)?{background:t.color,color:'#fff',borderColor:t.color}:{}}
                onClick={()=>toggleTag(t.name)}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
          <button type="button" className="btn-sec" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-pri">Add Recurring</button>
        </div>
      </form>
    </SbModal>
  );
}

/* ──── Main LeftSidebar ──── */
function LeftSidebar({ accounts: initAccounts, archivedAccounts: initArchived, netWorth: initNW, tags: initTags, ious: initIous, repeats: initRepeats, favorites, onSignOut, onNavigate }) {
  const [activeTab, setActiveTab] = useState('accounts');
  const [showArchived, setShowArchived] = useState(false);

  // Local state for CRUD
  const [accounts, setAccounts]     = useState(initAccounts);
  const [archived, setArchived]     = useState(initArchived);
  const [tags,     setTags]         = useState(initTags);
  const [ious,     setIous]         = useState(initIous);
  const [repeats,  setRepeats]      = useState(initRepeats);

  // Multi-currency net worth: group accounts by currency, sum assets - credit debt per group
  const netWorthByCurrency = (() => {
    const map = {};
    accounts.forEach(a => {
      const cur = a.currency || 'USD';
      if (!map[cur]) map[cur] = 0;
      map[cur] += a.type === 'credit' ? -a.balance : a.balance;
    });
    return Object.entries(map); // [[currency, value], ...]
  })();
  const isMultiCurrency = netWorthByCurrency.length > 1;
  // For single-currency mode: backwards-compat
  const netWorth = accounts.reduce((s,a)=>s + (a.type === 'credit' ? -a.balance : a.balance), 0);
  const baseCurrency = accounts?.[0]?.currency || 'USD';

  // Modal visibility
  const [showAddAcc,  setShowAddAcc]  = useState(false);
  const [showEditAcc, setShowEditAcc] = useState(false);
  const [showAddTag,  setShowAddTag]  = useState(false);
  const [showEditTag, setShowEditTag] = useState(false);
  const [showAddIOU,  setShowAddIOU]  = useState(false);
  const [showAddRep,  setShowAddRep]  = useState(false);

  // ── Account handlers ─────────────────────────────
  const addAccount    = acc => setAccounts(prev=>[...prev,acc]);
  const updateAccount = upd => setAccounts(prev=>prev.map(a=>a.id===upd.id?upd:a));
  const deleteAccount = id  => setAccounts(prev=>prev.filter(a=>a.id!==id));
  const archiveAccount= id  => {
    const acc = accounts.find(a=>a.id===id);
    if (acc) { setAccounts(prev=>prev.filter(a=>a.id!==id)); setArchived(prev=>[...prev,acc]); }
  };

  // ── Tag handlers ─────────────────────────────────
  const addTag    = tag => setTags(prev=>[...prev,tag]);
  const updateTag = upd => setTags(prev=>prev.map(t=>t.id===upd.id?upd:t));
  const deleteTag = id  => setTags(prev=>prev.filter(t=>t.id!==id));

  // ── IOU handlers ─────────────────────────────────
  const addIOU    = iou => setIous(prev=>[...prev,iou]);
  const settleIOU = id  => setIous(prev=>prev.filter(i=>i.id!==id));

  // ── Repeat handlers ──────────────────────────────
  const addRepeat    = r => setRepeats(prev=>[...prev,r]);
  const deleteRepeat = id=> setRepeats(prev=>prev.filter(r=>r.id!==id));

  return (
    <>
    <aside className="left-sidebar">
      {/* ── Vertical nav ── */}
      <div className="sb-nav">
        {SIDEBAR_TABS.map(({ key, label, Icon }) => (
          <div key={key} className={`sb-nav-item ${activeTab===key?'active':''}`}
            onClick={() => setActiveTab(key)}>
            <Icon size={15}/>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="sb-body">

        {/* ── ACCOUNTS ── */}
        {activeTab === 'accounts' && (
          <>
            <div className="nw-box">
              <div className="nw-label">NET WORTH{isMultiCurrency && <span style={{fontSize:'0.5rem',marginLeft:4,opacity:0.7,fontWeight:500}}>BY CURRENCY</span>}</div>
              {isMultiCurrency ? (
                <div style={{display:'flex',flexDirection:'column',gap:'0.18rem',marginTop:'0.15rem'}}>
                  {netWorthByCurrency.map(([cur, val]) => (
                    <div key={cur} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:'0.5rem'}}>
                      <span style={{fontSize:'0.62rem',fontWeight:600,color:'var(--text-3)',letterSpacing:'0.05em'}}>{cur}</span>
                      <span style={{fontSize:'0.95rem',fontWeight:700,color:val>=0?'var(--green)':'var(--red)',letterSpacing:'-0.02em'}}>
                        {val>=0?'+':''}{fmt(val, false, cur)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="nw-value" style={{color:netWorth>=0?'var(--green)':'var(--red)'}}>
                  {netWorth>=0?'+':'-'}{fmt(Math.abs(netWorth), false, baseCurrency)}
                </div>
              )}
            </div>
            <div className="sb-sec-hdr">
              <span>ACCOUNTS</span>
              <span className="sb-sec-count">{accounts.length}</span>
            </div>
            {accounts.map(acc => (
              <div className="acc-item" key={acc.id}
                onClick={() => onNavigate('account-detail', acc)}
                style={{cursor:'pointer'}}
              >
                <div>
                  <div className="acc-name">{acc.name}</div>
                  <div className="acc-inst">
                    {acc.institution}
                    {acc.limit ? ` · Limit: ${fmt(acc.limit, false, acc.currency)}` : ''}
                  </div>
                </div>
                <div className={`acc-bal ${(acc.type==='credit' ? acc.balance<=0 : acc.balance>=0) ? 'pos' : 'neg'}`}>{fmt(acc.balance, false, acc.currency)}</div>
              </div>
            ))}
            <div className="archived-row" onClick={() => setShowArchived(o=>!o)}>
              <Archive size={12}/> Show Archived ({archived.length})
              <ChevronDown size={11} style={{marginLeft:'auto',transform:showArchived?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
            </div>
            {showArchived && archived.map(acc => (
              <div className="acc-item archived" key={acc.id}>
                <div>
                  <div className="acc-name">{acc.name}</div>
                  <div className="acc-inst">Archived</div>
                </div>
                <div className={`acc-bal ${(acc.type==='credit' ? acc.balance<=0 : acc.balance>=0) ? 'pos' : 'neg'}`}>{fmt(acc.balance, false, acc.currency)}</div>
              </div>
            ))}
          </>
        )}

        {/* ── REPEATS ── */}
        {activeTab === 'repeats' && (
          <>
            <div className="sb-sec-hdr">
              <span>RECURRING</span>
              <span className="sb-sec-count">{repeats.length}</span>
            </div>
            {repeats.length === 0 && <div className="sb-empty">No recurring transactions</div>}
            {repeats.map(r => (
              <div className="sb-card" key={r.id}>
                <div className="sb-card-main">
                  <span className="sb-card-title">{r.description}</span>
                  <span className="sb-card-amt" style={{color:r.amount<0?'var(--red)':'var(--green)'}}>
                    {fmt(r.amount, true, baseCurrency)}
                  </span>
                </div>
                <div className="sb-card-sub" style={{display:'flex',justifyContent:'space-between'}}>
                  <span>{r.frequency} · Next {r.nextDate}</span>
                  <button className="icon-btn" style={{color:'var(--red)',padding:0}} onClick={()=>deleteRepeat(r.id)} title="Delete"><Trash2 size={11}/></button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── TAGS ── */}
        {activeTab === 'tags' && (
          <>
            <div className="sb-sec-hdr">
              <span>TAGS</span>
              <span className="sb-sec-count">{tags.length}</span>
            </div>
            <div className="tags-list">
              {tags.map(tag => (
                <div key={tag.id} className="tag-list-row"
                  onClick={() => onNavigate('tag-detail', tag)}
                >
                  <span style={{width:10,height:10,borderRadius:'50%',background:tag.color,display:'inline-block',flexShrink:0}}/>
                  <span style={{flex:1,fontSize:'0.78rem'}}>{tag.name}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── IOUs ── */}
        {activeTab === 'ious' && (
          <>
            <div className="sb-sec-hdr">
              <span>IOUs</span>
              <span className="sb-sec-count">{ious.length}</span>
            </div>
            {ious.length === 0 && <div className="sb-empty">No IOUs recorded</div>}
            {ious.map(iou => (
              <div className="sb-card" key={iou.id}>
                <div className="sb-card-main">
                  <span className="sb-card-title">{iou.person}</span>
                  <span className="sb-card-amt" style={{color:iou.direction==='owe_me'?'var(--green)':'var(--red)'}}>
                    {iou.direction==='owe_me'?'owes ':'I owe '}<strong>{fmt(Math.abs(iou.amount), false, baseCurrency)}</strong>
                  </span>
                </div>
                <div className="sb-card-sub" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span>{iou.note} · {iou.date}</span>
                  <button className="settle-btn" onClick={()=>settleIOU(iou.id)} title="Mark settled">Settle</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── FAVORITES ── */}
        {activeTab === 'favorites' && (
          <>
            <div className="sb-sec-hdr">
              <span>SAVED</span>
              <span className="sb-sec-count">{favorites.length}</span>
            </div>
            {favorites.map(fav => (
              <div className="sb-card" key={fav.id} style={{cursor:'pointer'}}>
                <div className="sb-card-main">
                  <span className="sb-card-title">{fav.name}</span>
                </div>
                <div className="sb-card-sub" style={{textTransform:'capitalize'}}>{fav.type}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Footer action links (like Buxfer) ── */}
      <div className="sb-action-bar">
        {activeTab === 'accounts' && (
          <>
            <button className="sb-action-btn" onClick={()=>setShowAddAcc(true)}><PlusCircle size={12}/> ADD</button>
            <button className="sb-action-btn" onClick={()=>setShowEditAcc(true)}><Edit2 size={12}/> EDIT</button>
          </>
        )}
        {activeTab === 'tags' && (
          <>
            <button className="sb-action-btn" onClick={()=>setShowAddTag(true)}><PlusCircle size={12}/> ADD</button>
            <button className="sb-action-btn" onClick={()=>setShowEditTag(true)}><Edit2 size={12}/> EDIT</button>
          </>
        )}
        {activeTab === 'ious' && (
          <button className="sb-action-btn" onClick={()=>setShowAddIOU(true)}><PlusCircle size={12}/> ADD IOU</button>
        )}
        {activeTab === 'repeats' && (
          <button className="sb-action-btn" onClick={()=>setShowAddRep(true)}><PlusCircle size={12}/> ADD</button>
        )}
      </div>

      {/* ── Footer: sign out ── */}
      <div className="sb-footer">
        <button className="sb-signout" onClick={onSignOut}>
          <LogOut size={13}/> Sign Out
        </button>
      </div>
    </aside>

    {/* ── Modals ── */}
    {showAddAcc  && <AddAccountModal onClose={()=>setShowAddAcc(false)} onAdd={addAccount}/>}
    {showEditAcc && <EditAccountsModal accounts={accounts} onClose={()=>setShowEditAcc(false)} onUpdate={updateAccount} onDelete={deleteAccount} onArchive={archiveAccount}/>}
    {showAddTag  && <AddTagModal tags={tags} onClose={()=>setShowAddTag(false)} onAdd={addTag}/>}
    {showEditTag && <EditTagsModal tags={tags} onClose={()=>setShowEditTag(false)} onUpdate={updateTag} onDelete={deleteTag}/>}
    {showAddIOU  && <AddIOUModal onClose={()=>setShowAddIOU(false)} onAdd={addIOU}/>}
    {showAddRep  && <AddRepeatModal tags={tags} onClose={()=>setShowAddRep(false)} onAdd={addRepeat}/>}
    </>
  );
}

export default LeftSidebar;

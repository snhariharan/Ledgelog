import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowUpDown, Edit2, Copy, Printer, Trash2, Search,
  MoreHorizontal, FileText, Plus, RotateCcw,
} from 'lucide-react';
import { fmt, PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../helpers';

function TransactionsTable({ transactions: txns, tags, accounts = [], onAdd, onEdit, actions, readOnly = false }) {
  const [activeTab, setActiveTab] = useState('all');
  const [selected, setSelected]   = useState(new Set());
  const [sortCol, setSortCol]     = useState('date');
  const [sortDir, setSortDir]     = useState('desc');
  const [searchQ, setSearchQ]     = useState('');
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(PAGE_SIZE);
  const [ctxMenu, setCtxMenu]     = useState(null);
  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const tabFiltered = useMemo(() => {
    if (activeTab==='untagged') return txns.filter(t=>!t.deleted&&t.untagged);
    if (activeTab==='deleted')  return txns.filter(t=>t.deleted);
    return txns.filter(t=>!t.deleted&&!t.untagged);
  }, [txns, activeTab]);

  const searched = useMemo(() => {
    if (!searchQ.trim()) return tabFiltered;
    const lq = searchQ.toLowerCase();
    return tabFiltered.filter(t =>
      t.description.toLowerCase().includes(lq) ||
      (t.tags??[]).some(tag=>tag.toLowerCase().includes(lq)) ||
      t.account.toLowerCase().includes(lq)
    );
  }, [tabFiltered, searchQ]);

  const sorted = useMemo(() => {
    return [...searched].sort((a,b) => {
      let va, vb;
      if (sortCol==='date')   { va=a.rawDate; vb=b.rawDate; }
      else if (sortCol==='amount') { va=a.amount; vb=b.amount; }
      else { va=a.description.toLowerCase(); vb=b.description.toLowerCase(); }
      return sortDir==='asc' ? (va>vb?1:-1) : (va<vb?1:-1);
    });
  }, [searched, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length/pageSize));
  const curPage    = Math.min(page, totalPages);
  const paginated  = sorted.slice((curPage-1)*pageSize, curPage*pageSize);

  const handleSort = col => {
    if (col === 'date') {
      // Date always sorts descending (newest first)
      setSortCol('date');
      setSortDir('desc');
    } else if (sortCol===col) {
      setSortDir(d=>d==='asc'?'desc':'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const allPageSel = paginated.length>0 && paginated.every(t=>selected.has(t.id));
  const toggleAll = () => {
    if (allPageSel) setSelected(p=>{ const n=new Set(p); paginated.forEach(t=>n.delete(t.id)); return n; });
    else setSelected(p=>{ const n=new Set(p); paginated.forEach(t=>n.add(t.id)); return n; });
  };
  const toggleSel = id => setSelected(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });

  const isDeletedTab = activeTab === 'deleted';
  const delSelected = async () => {
    const ids=[...selected];
    setSelected(new Set());
    if (isDeletedTab) {
      if (window.confirm(`Permanently delete ${ids.length} transaction(s)? This cannot be undone.`)) await actions?.purgeTransactions(ids);
    } else await actions?.deleteTransactions(ids);
  };
  const restoreSelected = async () => {
    const ids=[...selected];
    setSelected(new Set());
    await actions?.restoreTransactions(ids);
  };

  const delOne = async id => {
    setCtxMenu(null);
    if (isDeletedTab) {
      if (window.confirm('Permanently delete this transaction? This cannot be undone.')) await actions?.purgeTransactions([id]);
    } else await actions?.deleteTransactions([id]);
  };

  const SortIco = ({col}) => <ArrowUpDown size={10} style={{opacity:sortCol===col?1:0.4,marginLeft:3}}/>;

  const counts = {
    all:      txns.filter(t=>!t.deleted&&!t.untagged).length,
    untagged: txns.filter(t=>!t.deleted&&t.untagged).length,
    deleted:  txns.filter(t=>t.deleted).length,
  };

  return (
    <div className="txn-section">
      <div className="txn-tabs-row">
        <div className="txn-tabs">
          {[{key:'all',label:'Transactions'},{key:'untagged',label:'Untagged'},{key:'deleted',label:'Deleted'}].map(({key,label})=>(
            <div key={key} className={`txn-tab ${activeTab===key?'active':''}`}
              onClick={()=>{setActiveTab(key);setPage(1);setSelected(new Set());}}>
              {label} <span className="tab-ct">{counts[key]}</span>
            </div>
          ))}
        </div>
        {onAdd && (
          <button className="btn-add-txn" onClick={onAdd}>
            <Plus size={12}/> ADD TRANSACTION
          </button>
        )}
      </div>

      <div className="txn-toolbar">
        <div className="tb-left">
          {!readOnly && (<>
          <button className="btn-tool" disabled={selected.size!==1 || isDeletedTab} onClick={()=>{
            if (selected.size===1 && onEdit) {
              const id = [...selected][0];
              onEdit(id);
            }
          }}><Edit2 size={11}/> EDIT</button>
          <button className="btn-tool" disabled={selected.size===0 || isDeletedTab} onClick={()=>{
            actions?.duplicateTransactions([...selected]);
            setSelected(new Set());
          }}><Copy size={11}/> DUPLICATE</button>
          {isDeletedTab && (
            <button className="btn-tool" disabled={selected.size===0} onClick={restoreSelected}><RotateCcw size={11}/> RESTORE</button>
          )}
          <button className="btn-tool" disabled={selected.size===0} onClick={()=>window.print()}><Printer size={11}/> PRINT</button>
          <button className="btn-tool danger" disabled={selected.size===0} onClick={delSelected}><Trash2 size={11}/> {isDeletedTab ? 'DELETE FOREVER' : 'DELETE'}</button>
          </>)}
          <div className="search-wrap">
            <Search size={12}/>
            <input className="txn-search" placeholder="Search…" value={searchQ}
              onChange={e=>{setSearchQ(e.target.value);setPage(1);}}/>
          </div>
        </div>
        <div className="tb-right">
          {sorted.length>0 ? (
            <>
              <select className="page-size" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>
                {PAGE_SIZE_OPTIONS.map(n=><option key={n} value={n}>{n} / page</option>)}
              </select>
              <span className="page-info">{(curPage-1)*pageSize+1}–{Math.min(curPage*pageSize,sorted.length)} of {sorted.length}</span>
              <button className="pnav" disabled={curPage===1} onClick={()=>setPage(1)}>«</button>
              <button className="pnav" disabled={curPage===1} onClick={()=>setPage(p=>p-1)}>‹</button>
              <button className="pnav" disabled={curPage===totalPages} onClick={()=>setPage(p=>p+1)}>›</button>
              <button className="pnav" disabled={curPage===totalPages} onClick={()=>setPage(totalPages)}>»</button>
            </>
          ) : <span className="page-info">No results</span>}
        </div>
      </div>

      <div style={{overflowX:'auto'}}>
        <table className="txn-table">
          <thead>
            <tr>
              <th className="th-chk">{!readOnly && <input type="checkbox" checked={allPageSel} onChange={toggleAll}/>}</th>
              <th className="th-s" onClick={()=>handleSort('date')}>Date<SortIco col="date"/></th>
              <th className="th-s th-r" onClick={()=>handleSort('amount')}>Amount<SortIco col="amount"/></th>
              <th className="th-s" onClick={()=>handleSort('desc')}>Description<SortIco col="desc"/></th>
              <th>Tags</th>
              <th>Account</th>
              <th className="th-act"></th>
            </tr>
          </thead>
          <tbody>
            {paginated.length===0 && (
              <tr><td colSpan={7} className="empty-state">
                <FileText size={24} style={{display:'block',margin:'0 auto 0.4rem',opacity:.25}}/>
                {searchQ ? `No results for "${searchQ}"` : 'No transactions here.'}
              </td></tr>
            )}
            {paginated.map(tx=>(
              <tr key={tx.id} className={selected.has(tx.id)?'row-sel':''}>
                <td className="th-chk">{!readOnly && <input type="checkbox" checked={selected.has(tx.id)} onChange={()=>toggleSel(tx.id)}/>}</td>
                <td className="td-date">{tx.date}</td>
                <td className="td-amt" style={{color:tx.amount<0?'var(--red)':'var(--green)'}}>{fmt(tx.amount, true, accounts.find(a => a.name === tx.account)?.currency || tx.currency || 'USD')}</td>
                <td className="td-desc">{tx.description}{tx.scheduled && <span className="scheduled-badge">Scheduled</span>}</td>
                <td>
                  <div className="tx-tags">
                    {!(tx.tags?.length)
                      ? <span style={{color:'var(--text-3)',fontSize:'0.72rem'}}>—</span>
                      : tx.tags.map(tname=>{
                          const meta=tags.find(t=>t.name===tname);
                          return <span key={tname} className="tx-tag"><span className="tag-dot" style={{background:meta?.color??'#94a3b8',width:5,height:5}}/>{tname}</span>;
                        })
                    }
                  </div>
                </td>
                <td className="td-acc">{tx.account}</td>
                <td className="th-act">
                  {!readOnly && <button className="ctx-btn" onClick={e=>{
                    e.stopPropagation();
                    const r=e.currentTarget.getBoundingClientRect();
                    setCtxMenu({x:r.left-120,y:r.bottom+2,id:tx.id});
                  }}><MoreHorizontal size={14}/></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ctxMenu && (
        <div className="ctx-menu" style={{left:ctxMenu.x,top:ctxMenu.y}} onClick={e=>e.stopPropagation()}>
          {isDeletedTab ? (
            <div className="ctx-item" onClick={() => { setCtxMenu(null); actions?.restoreTransactions([ctxMenu.id]); }}><RotateCcw size={12}/> Restore</div>
          ) : (
            <>
              <div className="ctx-item" onClick={() => { setCtxMenu(null); onEdit?.(ctxMenu.id); }}><Edit2 size={12}/> Edit</div>
              <div className="ctx-item" onClick={() => { setCtxMenu(null); actions?.duplicateTransactions([ctxMenu.id]); }}><Copy size={12}/> Duplicate</div>
            </>
          )}
          <div className="ctx-item danger" onClick={()=>delOne(ctxMenu.id)}><Trash2 size={12}/> {isDeletedTab ? 'Delete forever' : 'Delete'}</div>
        </div>
      )}
    </div>
  );
}

export default TransactionsTable;

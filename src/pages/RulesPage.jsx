import React, { useState } from 'react';
import { ListChecks, Plus, Trash2, Sparkles } from 'lucide-react';
import Modal from '../components/Modal';
import { describeRule, parseTerms, ruleMatches } from '../lib/rules';

function RuleModal({ tags, onClose, onSave }) {
  const [name, setName] = useState('');
  const [anyText, setAnyText] = useState('');
  const [allText, setAllText] = useState('');
  const [noneText, setNoneText] = useState('');
  const [tagId, setTagId] = useState(tags[0]?.id ?? '');
  const [sample, setSample] = useState('');
  const [err, setErr] = useState('');

  const draft = { any: parseTerms(anyText), all: parseTerms(allText), none: parseTerms(noneText) };
  const ready = draft.any.length > 0 || draft.all.length > 0;
  const tagName = tags.find(t => t.id === Number(tagId))?.name;

  const submit = async e => {
    e.preventDefault();
    if (!ready) return setErr('Enter at least one text to look for in the description.');
    if (!tagId) return setErr('Choose a tag to apply.');
    const label = name.trim() || `${draft.any[0] ?? draft.all[0]} → ${tagName}`;
    if (await onSave({ name: label, ...draft, tagId: Number(tagId) })) onClose();
  };
  return (
    <Modal title="New Rule" onClose={onClose}>
      <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        {err && <div className="form-err">{err}</div>}
        <div className="form-group">
          <label className="form-label">IF DESCRIPTION CONTAINS ANY OF (OR)</label>
          <input className="form-input" value={anyText} onChange={e => setAnyText(e.target.value)} placeholder="e.g. S market, K market, Prisma" autoFocus/>
        </div>
        <div className="form-group">
          <label className="form-label">AND ALSO CONTAINS ALL OF (AND) — optional</label>
          <input className="form-input" value={allText} onChange={e => setAllText(e.target.value)} placeholder="e.g. bill"/>
        </div>
        <div className="form-group">
          <label className="form-label">EXCEPT IF IT CONTAINS (NOT) — optional</label>
          <input className="form-input" value={noneText} onChange={e => setNoneText(e.target.value)} placeholder="e.g. indian, refund"/>
        </div>
        <div className="form-note">Separate several texts with commas. Matching ignores upper/lower case.</div>
        <div className="form-group">
          <label className="form-label">THEN ADD TAG</label>
          <select className="form-input" value={tagId} onChange={e => setTagId(e.target.value)}>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">NAME (optional)</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)}/>
        </div>
        <div className="form-group">
          <label className="form-label">TRY IT — type a sample description</label>
          <input className="form-input" value={sample} onChange={e => setSample(e.target.value)} placeholder="e.g. Prisma Iso Omena"/>
          {sample.trim() && ready && (
            <div style={{fontSize:'0.72rem',marginTop:'0.3rem',color: ruleMatches(draft, sample) ? 'var(--green)' : 'var(--text-3)'}}>
              {ruleMatches(draft, sample) ? `✓ Would add tag: ${tagName}` : '✗ Rule would not match'}
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
          <button type="button" className="btn-sec" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-pri">Create Rule</button>
        </div>
      </form>
    </Modal>
  );
}

function RulesPage({ appData, actions }) {
  const { rules, tags } = appData;
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  const addStandard = async () => {
    setBusy(true);
    const n = await actions.addStandardRules();
    setBusy(false);
    if (n !== undefined) setInfo(n ? `Added ${n} standard rule${n > 1 ? 's' : ''}.` : 'All standard rules are already there.');
  };

  const remove = r => { if (window.confirm(`Delete rule "${r.name}"?`)) actions.deleteRule(r.id); };

  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <ListChecks size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Rules</span>
        </div>
        <div className="sub-hdr-right">
          <button className="btn-outline" style={{marginRight:6}} onClick={addStandard} disabled={busy}><Sparkles size={12}/> Add Standard Rules</button>
          <button className="btn-pri" onClick={() => setShowNew(true)} disabled={tags.length === 0}><Plus size={12}/> New Rule</button>
        </div>
      </div>
      <div className="main-scroll">
        <div className="widget-card" style={{marginTop:'0.5rem'}}>
          <div className="widget-hdr">
            <span className="widget-ttl">Auto-tag Rules</span>
            <span style={{fontSize:'0.7rem',color:'var(--text-3)'}}>{rules.filter(r=>r.active).length} active</span>
          </div>
          {info && <div style={{fontSize:'0.75rem',color:'var(--green)',padding:'0.4rem 0.5rem'}}>{info}</div>}
          {rules.length === 0 && <div className="empty-state" style={{padding:'1.5rem'}}>No rules yet. Create one, or use “Add Standard Rules” for a starter set.</div>}
          <div style={{display:'flex',flexDirection:'column',marginTop:'0.5rem'}}>
            {rules.map((rule,i) => (
              <div key={rule.id} style={{
                display:'flex',alignItems:'center',gap:'0.75rem',padding:'0.7rem 0.5rem',
                borderBottom: i < rules.length-1 ? '1px solid var(--border)' : 'none',
                opacity: rule.active ? 1 : 0.5,
              }}>
                <button
                  role="switch" aria-checked={rule.active} aria-label={`Toggle ${rule.name}`}
                  onClick={()=>actions.setRuleActive(rule.id, !rule.active)}
                  style={{
                    width:34,height:20,borderRadius:10,border:'none',cursor:'pointer',
                    background: rule.active ? 'var(--blue)' : 'var(--border)',
                    position:'relative',transition:'background 0.2s',flexShrink:0
                  }}>
                  <span style={{
                    position:'absolute',top:3,left: rule.active ? 17 : 3,
                    width:14,height:14,borderRadius:'50%',background:'#fff',
                    transition:'left 0.2s',display:'block'
                  }}/>
                </button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:'0.82rem'}}>{rule.name}</div>
                  <div style={{fontSize:'0.7rem',color:'var(--text-3)',marginTop:'2px'}}>
                    IF description {describeRule(rule)} → add tag: {rule.tagName}
                  </div>
                </div>
                <button
                  onClick={()=>remove(rule)}
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',padding:'4px',opacity:0.6}}
                  title="Delete rule">
                  <Trash2 size={13}/>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="widget-card" style={{marginTop:'1rem'}}>
          <div className="widget-hdr"><span className="widget-ttl">How Rules Work</span></div>
          <div style={{fontSize:'0.8rem',color:'var(--text-2)',lineHeight:'1.6',padding:'0.5rem 0'}}>
            When you add or import a transaction, every active rule that matches the description
            (case-insensitive) adds its tag. A rule can combine conditions: <strong>any of</strong> a list of
            texts (OR), <strong>all of</strong> another list (AND), and <strong>except</strong> when certain
            texts appear (NOT). Rules run on new transactions only; editing an existing transaction never
            changes its tags.
          </div>
        </div>
      </div>
      {showNew && <RuleModal tags={tags} onClose={() => setShowNew(false)} onSave={actions.addRule}/>}
    </>
  );
}
export default RulesPage;

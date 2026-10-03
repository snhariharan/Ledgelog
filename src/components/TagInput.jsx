import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';

function TagInput({ tagsList, value, onChange }) {
  const [q, setQ]           = useState('');
  const [open, setOpen]     = useState(false);
  const wrapRef             = useRef();

  // Close on outside click
  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = useMemo(() => {
    const lq = q.toLowerCase();
    return lq ? tagsList.filter(t => t.name.toLowerCase().includes(lq)) : tagsList;
  }, [q, tagsList]);

  const toggle = (name) => {
    const next = value.includes(name) ? value.filter(t => t !== name) : [...value, name];
    onChange(next);
  };

  const removeTag = (name, e) => { e.stopPropagation(); onChange(value.filter(t => t !== name)); };

  return (
    <div className="mtag-wrap" ref={wrapRef}>
      <div className="mtag-box" onClick={() => setOpen(o => !o)}>
        {value.map(t => {
          const meta = tagsList.find(tg => tg.name === t);
          return (
            <span key={t} className="mtag-chip">
              <span className="mtag-dot" style={{ background: meta?.color ?? '#94a3b8' }} />
              {t}
              <button className="mtag-remove" onMouseDown={e => removeTag(t, e)}>×</button>
            </span>
          );
        })}
        <input
          className="mtag-input"
          placeholder={value.length ? '' : 'Tag…'}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onClick={e => e.stopPropagation()}
        />
      </div>
      {open && (
        <div className="mtag-dd">
          {filtered.length === 0 && <div className="mtag-dd-empty">No matching tags</div>}
          {filtered.map(tag => (
            <div key={tag.id}
              className={`mtag-opt ${value.includes(tag.name) ? 'sel' : ''}`}
              onMouseDown={e => { e.preventDefault(); toggle(tag.name); setQ(''); }}>
              <span className="mtag-dot" style={{ background: tag.color }} />
              <span className="mtag-opt-name">{tag.name}</span>
              {value.includes(tag.name) && <Check size={11} style={{ marginLeft: 'auto', color: 'var(--blue)' }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TagInput;

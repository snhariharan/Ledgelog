import React, { useState, useRef, useEffect } from 'react';
import { TX_TYPES } from '../helpers';


function TypePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef();
  const current = TX_TYPES.find(t => t.key === value) ?? TX_TYPES[0];

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="type-picker" ref={wrapRef}>
      <button
        className={`type-pick-btn ${current.sign === '-' ? 'tp-neg' : 'tp-pos'}`}
        onClick={() => setOpen(o => !o)}
        title={current.label}
      >
        <span className="tp-sign">{current.sign}</span>
        <span className="tp-arrow">▾</span>
      </button>
      {open && (
        <div className="type-pick-dd">
          {TX_TYPES.map(t => (
            <div
              key={t.key}
              className={`type-pick-opt ${value === t.key ? 'active' : ''}`}
              style={{ '--tcolor': t.color }}
              onMouseDown={e => { e.preventDefault(); onChange(t.key); setOpen(false); }}
            >
              <span className="tp-opt-sign">{t.sign}</span>
              <span className="tp-opt-label">{t.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TypePicker;

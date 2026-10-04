import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PERIODS } from '../helpers';

function PeriodSelect({ period, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="period-sel" onClick={() => setOpen(o => !o)}>
      {period} <ChevronDown size={12}/>
      {open && (
        <div className="period-dd" onClick={e => e.stopPropagation()}>
          {PERIODS.map(p => (
            <div key={p} className={`period-opt ${period === p ? 'sel' : ''}`}
              onClick={() => { onChange(p); setOpen(false); }}>
              {p}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default PeriodSelect;

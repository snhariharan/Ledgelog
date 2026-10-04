import React, { useState, useCallback } from 'react';
import { fmt, fmtCompact } from '../helpers';

// ══════════════════════════════════════════════════════════════════════════════
// DONUT CHART
// ══════════════════════════════════════════════════════════════════════════════
function DonutChart({ data, currency = 'USD' }) {
  const [hovered, setHovered] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const total  = data.reduce((s, d) => s + Math.abs(d.amount), 0);
  const R=50, CX=75, CY=75, CIRC = 2*Math.PI*R;
  let offset = 0;
  const segments = data.map(item => {
    const pct  = total > 0 ? Math.abs(item.amount)/total : 0;
    const dash = pct*CIRC;
    const seg  = { ...item, pct, dash, offset };
    offset += dash;
    return seg;
  });

  const onMove  = useCallback((e,item) => { setHovered(item.id); setTooltip({x:e.clientX,y:e.clientY,item}); }, []);
  const onLeave = useCallback(() => { setHovered(null); setTooltip(null); }, []);

  if (!data.length) return <div className="donut-empty">No expense data for this period</div>;

  const hItem = data.find(d=>d.id===hovered);

  return (
    <div className="donut-wrap">
      <div className="donut-left">
        <svg viewBox="0 0 150 150" className="donut-svg">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth={24}/>
          {segments.map(seg => (
            <circle key={seg.id} cx={CX} cy={CY} r={R} fill="none"
              stroke={seg.color}
              strokeWidth={hovered===seg.id ? 30 : 24}
              strokeDasharray={`${seg.dash} ${CIRC-seg.dash}`}
              strokeDashoffset={-seg.offset}
              className="donut-seg"
              style={{ opacity: hovered!==null && hovered!==seg.id ? 0.2 : 1, cursor:'pointer' }}
              onMouseMove={e=>onMove(e,seg)} onMouseLeave={onLeave}
            />
          ))}
        </svg>
        <div className="donut-center">
          <div className="donut-val" style={{ color: hItem?.color }} title={fmt(hItem ? hItem.amount : -total, false, currency)}>
            {fmtCompact(hItem ? hItem.amount : total, currency)}
          </div>
          <div className="donut-lbl" style={{ color: hItem?.color }}>
            {hItem ? hItem.name : 'Total'}
          </div>
        </div>
      </div>

      <div className="donut-legend">
        {data.map(item => (
          <div key={item.id} className={`legend-row ${hovered!==null&&hovered!==item.id?'dimmed':''}`}
            onMouseEnter={()=>setHovered(item.id)} onMouseLeave={()=>setHovered(null)}>
            <div className="legend-dot" style={{background:item.color}}/>
            <span className="legend-name">{item.name}</span>
            <span className="legend-amt">{fmt(item.amount, false, currency)}</span>
          </div>
        ))}
      </div>

      {tooltip && (
        <div className="donut-tip" style={{left:tooltip.x+10,top:tooltip.y-28}}>
          <span style={{color:tooltip.item.color}}>●</span>{' '}
          {tooltip.item.name}: {fmt(tooltip.item.amount, false, currency)} ({(tooltip.item.pct*100).toFixed(1)}%)
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BUDGETS WIDGET
// ══════════════════════════════════════════════════════════════════════════════
function BudgetsWidget({ budgets, period, currency = 'USD' }) {
  const totalAvail = budgets.reduce((s,b) => s + (b.limit - b.spent), 0);
  return (
    <div className="widget-card">
      <div className="widget-hdr">
        <span className="widget-ttl">Budgets</span>
        <span className="widget-per">{period}</span>
      </div>
      <div className="budget-list">
        <div className="budget-list-hdr">
          <span>Tag</span><span>Available</span>
        </div>
        {budgets.map(b => {
          const avail = b.limit - b.spent;
          const pct   = b.limit > 0 ? Math.min((b.spent/b.limit)*100,100) : 0;
          const over  = b.spent > b.limit;
          return (
            <div className="budget-row" key={b.id}>
              <div className="budget-row-top">
                <span className="budget-name">{b.tag}</span>
                <span className="budget-avail" style={{color: over?'var(--red)':'var(--green)'}}>
                  {avail>=0?'+':''}{fmt(avail, false, currency)}
                </span>
              </div>
              <div className="budget-track">
                <div className="budget-fill" style={{width:`${pct}%`, background: over?'var(--red)':b.color}}/>
              </div>
            </div>
          );
        })}
        <div className="budget-total">
          <span>Total</span>
          <span style={{color: totalAvail>=0?'var(--green)':'var(--red)', fontWeight:600}}>
            {totalAvail>=0?'+':''}{fmt(totalAvail, false, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
export { DonutChart, BudgetsWidget };
export default DonutChart;

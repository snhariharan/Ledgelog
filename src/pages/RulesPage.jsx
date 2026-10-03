import React, { useState } from 'react';
import { ListChecks, Plus, Trash2 } from 'lucide-react';

const RULES_MOCK = [
  { id:1, name:'Auto-tag Salary',         condition:'description contains "Salary"',    action:'Add tag: Income',     active:true  },
  { id:2, name:'India Wire → India tag',   condition:'description contains "India"',     action:'Add tag: India',      active:true  },
  { id:3, name:'Loan EMIs',               condition:'description contains "EMI"',       action:'Add tag: Loan',       active:true  },
  { id:4, name:'Swiggy → Dining',         condition:'description contains "Swiggy"',    action:'Add tag: Dining',     active:false },
  { id:5, name:'Netflix subscription',    condition:'description contains "Netflix"',   action:'Add tag: Subscription',active:true },
  { id:6, name:'Car expenses',            condition:'description contains "Car"',        action:'Add tag: Car',        active:false },
];

function RulesPage({ appData }) {
  const [rules, setRules] = useState(RULES_MOCK);
  const toggleRule = id => setRules(rs => rs.map(r => r.id===id ? {...r, active:!r.active} : r));
  const deleteRule = id => setRules(rs => rs.filter(r => r.id!==id));

  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <ListChecks size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Rules</span>
        </div>
        <div className="sub-hdr-right">
          <button className="btn-pri"><Plus size={12}/> New Rule</button>
        </div>
      </div>
      <div className="main-scroll">
        <div className="widget-card" style={{marginTop:'0.5rem'}}>
          <div className="widget-hdr">
            <span className="widget-ttl">Auto-tag Rules</span>
            <span style={{fontSize:'0.7rem',color:'var(--text-3)'}}>{rules.filter(r=>r.active).length} active</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'0',marginTop:'0.5rem'}}>
            {rules.map((rule,i) => (
              <div key={rule.id} style={{
                display:'flex',alignItems:'center',gap:'0.75rem',
                padding:'0.7rem 0.5rem',
                borderBottom: i < rules.length-1 ? '1px solid var(--border)' : 'none',
                opacity: rule.active ? 1 : 0.5,
              }}>
                {/* Toggle */}
                <button
                  onClick={()=>toggleRule(rule.id)}
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
                    IF {rule.condition} → {rule.action}
                  </div>
                </div>
                <button
                  onClick={()=>deleteRule(rule.id)}
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
            Rules automatically tag and categorize your transactions as they are imported or added.
            Rules are processed in order — drag to reorder. Each rule can match on description, amount, account, or date patterns.
          </div>
        </div>
      </div>
    </>
  );
}
export default RulesPage;

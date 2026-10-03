import React, { useState } from 'react';
import { Umbrella } from 'lucide-react';
import { fmt } from '../helpers';

function RetirementPage() {
  const [currentAge, setCurrentAge]   = useState(32);
  const [retireAge, setRetireAge]     = useState(60);
  const [currentSavings, setCurrentSavings] = useState(45000);
  const [monthlyContrib, setMonthlyContrib] = useState(500);
  const [annualReturn, setAnnualReturn]   = useState(7);

  const years = retireAge - currentAge;
  const monthlyRate = annualReturn / 100 / 12;
  const months = years * 12;
  const futureValue = currentSavings * Math.pow(1 + monthlyRate, months)
    + monthlyContrib * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  const target = futureValue * 0.04; // 4% rule annual withdrawal

  const milestones = [10,20,30].map(y => {
    const m = y * 12;
    const fv = currentSavings * Math.pow(1 + monthlyRate, m)
      + monthlyContrib * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate);
    return { year: currentAge + y, fv };
  }).filter(m => m.year <= retireAge);

  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <Umbrella size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Retirement Planner</span>
        </div>
      </div>
      <div className="main-scroll">
        <div className="widgets-grid">
          {/* Calculator */}
          <div className="widget-card">
            <div className="widget-hdr"><span className="widget-ttl">Inputs</span></div>
            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem',marginTop:'0.5rem'}}>
              {[
                {label:'Current Age',          val:currentAge,      set:setCurrentAge,       min:18, max:80, step:1,   unit:'yrs'},
                {label:'Retirement Age',        val:retireAge,       set:setRetireAge,        min:40, max:80, step:1,   unit:'yrs'},
                {label:'Current Savings',       val:currentSavings,  set:setCurrentSavings,   min:0,  max:2e6,step:1000,unit:'$'},
                {label:'Monthly Contribution',  val:monthlyContrib,  set:setMonthlyContrib,   min:0,  max:5000,step:50,  unit:'$'},
                {label:'Annual Return (%)',      val:annualReturn,    set:setAnnualReturn,     min:1,  max:20, step:0.5, unit:'%'},
              ].map(({label,val,set,min,max,step,unit})=>(
                <div key={label}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem',marginBottom:'4px'}}>
                    <span style={{color:'var(--text-2)',fontWeight:600}}>{label}</span>
                    <span style={{fontWeight:700}}>{unit === '$' ? '$' : ''}{val.toLocaleString()}{unit !== '$' ? unit : ''}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={val}
                    onChange={e=>set(Number(e.target.value))}
                    style={{width:'100%',accentColor:'var(--blue)'}}/>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="widget-card">
            <div className="widget-hdr"><span className="widget-ttl">Projection at Age {retireAge}</span></div>
            <div style={{textAlign:'center',padding:'1.5rem 0'}}>
              <div style={{fontSize:'0.75rem',color:'var(--text-3)',marginBottom:'0.25rem',fontWeight:600,letterSpacing:'0.05em'}}>PROJECTED SAVINGS</div>
              <div style={{fontSize:'2rem',fontWeight:800,color:'var(--green)',marginBottom:'0.5rem'}}>{(futureValue/1e6).toFixed(2)}M</div>
              <div style={{fontSize:'0.75rem',color:'var(--text-3)'}}>Estimated annual income (4% rule)</div>
              <div style={{fontSize:'1.3rem',fontWeight:700,color:'var(--blue)',marginBottom:'1.5rem'}}>{fmt(target, false, baseCurrency)}/yr</div>
              <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
                {milestones.map(m=>(
                  <div key={m.year} style={{display:'flex',justifyContent:'space-between',fontSize:'0.78rem',padding:'0.4rem 0.5rem',background:'var(--bg-2)',borderRadius:'var(--radius-sm)'}}>
                    <span>Age {m.year}</span>
                    <span style={{fontWeight:700,color:'var(--blue)'}}>{(m.fv/1000).toFixed(0)}K</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
export default RetirementPage;

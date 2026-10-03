import React from 'react';
import { PiggyBank, Plus } from 'lucide-react';
import { fmt } from '../helpers';
import DonutChart from '../components/DonutChart';

const INVESTMENTS_MOCK = [
  { id:1, name:'S&P 500 Index',    ticker:'SPY',  shares:12.5, price:445.20, cost:380.00, type:'ETF',   color:'#3b82f6' },
  { id:2, name:'Apple Inc.',       ticker:'AAPL', shares:8,    price:189.30, cost:155.00, type:'Stock', color:'#6366f1' },
  { id:3, name:'Gold ETF',         ticker:'GLD',  shares:5,    price:184.50, cost:170.00, type:'ETF',   color:'#f59e0b' },
  { id:4, name:'US Bond Fund',     ticker:'BND',  shares:20,   price:73.10,  cost:78.00,  type:'ETF',   color:'#10b981' },
  { id:5, name:'Emerging Markets', ticker:'VWO',  shares:30,   price:41.80,  cost:38.00,  type:'ETF',   color:'#ec4899' },
];

function InvestmentsPage() {
  const portfolio = INVESTMENTS_MOCK.map(inv => ({
    ...inv,
    value: inv.shares * inv.price,
    gain: inv.shares * (inv.price - inv.cost),
    gainPct: ((inv.price - inv.cost) / inv.cost) * 100,
  }));
  const totalValue = portfolio.reduce((s,p)=>s+p.value,0);
  const totalCost  = portfolio.reduce((s,p)=>s+p.shares*p.cost,0);
  const totalGain  = totalValue - totalCost;

  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <PiggyBank size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Investments</span>
        </div>
        <div className="sub-hdr-right">
          <button className="btn-pri"><Plus size={12}/> Add Holding</button>
        </div>
      </div>
      <div className="main-scroll">
        <div className="summary-strip">
          <div className="sum-card">
            <span className="sum-label">Portfolio Value</span>
            <span className="sum-val" style={{color:'var(--blue)'}}>{fmt(totalValue, false, baseCurrency)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Total Gain / Loss</span>
            <span className="sum-val" style={{color:totalGain>=0?'var(--green)':'var(--red)'}}>
              {totalGain>=0?'+':''}{fmt(totalGain, false, baseCurrency)}
            </span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Overall Return</span>
            <span className="sum-val" style={{color:totalGain>=0?'var(--green)':'var(--red)'}}>
              {((totalGain/totalCost)*100).toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="widgets-grid" style={{marginTop:'1rem'}}>
          {/* Allocation donut */}
          <div className="widget-card">
            <div className="widget-hdr"><span className="widget-ttl">Allocation</span></div>
            <DonutChart data={portfolio.map(p=>({id:p.id,name:p.name,amount:-p.value,color:p.color}))}/>
          </div>

          {/* Holdings table */}
          <div className="widget-card">
            <div className="widget-hdr"><span className="widget-ttl">Holdings</span></div>
            <table className="page-table">
              <thead><tr><th>Name</th><th>Price</th><th>Value</th><th>Gain</th></tr></thead>
              <tbody>
                {portfolio.map(p=>(
                  <tr key={p.id}>
                    <td>
                      <div style={{fontWeight:600,fontSize:'0.8rem'}}>{p.ticker}</div>
                      <div style={{fontSize:'0.68rem',color:'var(--text-3)'}}>{p.name}</div>
                    </td>
                    <td>{p.price.toFixed(2)}</td>
                    <td style={{fontWeight:600}}>{fmt(p.value, false, baseCurrency)}</td>
                    <td style={{color:p.gain>=0?'var(--green)':'var(--red)',fontWeight:600}}>
                      {p.gain>=0?'+':''}{fmt(p.gain, false, baseCurrency)}<br/>
                      <span style={{fontSize:'0.68rem',fontWeight:400}}>({p.gainPct.toFixed(1)}%)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
export default InvestmentsPage;

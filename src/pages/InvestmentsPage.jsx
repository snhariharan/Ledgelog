import React, { useState, useCallback } from 'react';
import { PiggyBank, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { fmt, CURRENCIES, PRESET_COLORS, round2 } from '../helpers';
import { fetchTickerPrice } from '../lib/fx';
import DonutChart from '../components/DonutChart';
import Modal from '../components/Modal';

const KINDS = ['Stock', 'ETF', 'Mutual Fund', 'Bond', 'Crypto', 'Other'];

function HoldingModal({ initial, onClose, onSave, defaultCurrency }) {
  const [f, setF] = useState(() => initial ?? { name: '', ticker: '', kind: 'Stock', shares: '', price: '', cost: '', currency: defaultCurrency });
  const [err, setErr] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async e => {
    e.preventDefault();
    const shares = parseFloat(f.shares), price = parseFloat(f.price), cost = parseFloat(f.cost);
    if (!f.name.trim() || !f.ticker.trim()) return setErr('Name and ticker are required.');
    if (!(shares >= 0) || !(price >= 0) || !(cost >= 0)) return setErr('Shares, price and cost must be numbers ≥ 0.');
    const color = f.color ?? PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
    if (await onSave({ id: initial?.id, name: f.name.trim(), ticker: f.ticker.trim().toUpperCase(), kind: f.kind, shares, price, cost, currency: f.currency, color })) onClose();
  };
  return (
    <Modal title={initial ? 'Edit Holding' : 'Add Holding'} onClose={onClose}>
      <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:'0.85rem'}}>
        {err && <div className="form-err">{err}</div>}
        <div className="form-row-2">
          <div className="form-group"><label className="form-label">NAME</label>
            <input className="form-input" value={f.name} onChange={e => set('name', e.target.value)} autoFocus/></div>
          <div className="form-group"><label className="form-label">TICKER</label>
            <input className="form-input" value={f.ticker} onChange={e => set('ticker', e.target.value)}/></div>
        </div>
        <div className="form-row-2">
          <div className="form-group"><label className="form-label">TYPE</label>
            <select className="form-input" value={f.kind} onChange={e => set('kind', e.target.value)}>{KINDS.map(k => <option key={k}>{k}</option>)}</select></div>
          <div className="form-group"><label className="form-label">CURRENCY</label>
            <select className="form-input" value={f.currency} onChange={e => set('currency', e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
        </div>
        <div className="form-row-2">
          <div className="form-group"><label className="form-label">SHARES / UNITS</label>
            <input className="form-input" type="number" step="any" min="0" value={f.shares} onChange={e => set('shares', e.target.value)}/></div>
          <div className="form-group"><label className="form-label">AVG COST / SHARE</label>
            <input className="form-input" type="number" step="any" min="0" value={f.cost} onChange={e => set('cost', e.target.value)}/></div>
        </div>
        <div className="form-group"><label className="form-label">CURRENT PRICE / SHARE</label>
          <input className="form-input" type="number" step="any" min="0" value={f.price} onChange={e => set('price', e.target.value)}/>
          <div className="form-note">Prices are entered by hand; there is no market-data feed.</div></div>
        <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
          <button type="button" className="btn-sec" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-pri">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function InvestmentsPage({ appData, actions }) {
  const { holdings, baseCurrency } = appData;
  const [modal, setModal] = useState(null);
  const [cur, setCur] = useState(null);
  const [priceStatus, setPriceStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refreshPrices = useCallback(async () => {
    const tickers = [...new Set(portfolio.map(p => p.ticker))];
    if (!tickers.length) return;
    setRefreshing(true);
    setPriceStatus(`Fetching ${tickers.length} price${tickers.length > 1 ? 's' : ''}…`);
    let updated = 0, failed = 0;
    for (const ticker of tickers) {
      const price = await fetchTickerPrice(ticker);
      if (price != null) {
        const h = holdings.find(h => h.ticker === ticker);
        if (h) { await actions.saveHolding({ ...h, price }); updated++; }
      } else failed++;
    }
    setRefreshing(false);
    setPriceStatus(`Updated ${updated}${failed ? `, ${failed} failed (enter manually)` : ''}.`);
    setTimeout(() => setPriceStatus(''), 6000);
  }, [portfolio, holdings, actions]);

  // Holdings can be in different currencies; never add across them.
  const currencies = [...new Set(holdings.map(h => h.currency))];
  const active = cur && currencies.includes(cur) ? cur : (currencies.includes(baseCurrency) ? baseCurrency : currencies[0] ?? baseCurrency);
  const portfolio = holdings.filter(h => h.currency === active).map(h => ({
    ...h,
    value: h.shares * h.price,
    gain: h.shares * (h.price - h.cost),
    gainPct: h.cost > 0 ? ((h.price - h.cost) / h.cost) * 100 : 0,
  }));
  const totalValue = portfolio.reduce((s,p)=>s+p.value,0);
  const totalCost  = portfolio.reduce((s,p)=>s+p.shares*p.cost,0);
  const totalGain  = totalValue - totalCost;
  const returnPct  = totalCost > 0 ? (totalGain/totalCost)*100 : 0;

  const remove = h => { if (window.confirm(`Remove ${h.ticker}?`)) actions.deleteHolding(h.id); };

  return (
    <>
      <div className="sub-hdr">
        <div className="sub-hdr-left">
          <PiggyBank size={17} style={{color:'var(--blue)'}}/>
          <span className="page-ttl">Investments</span>
          {currencies.length > 1 && (
            <select className="fselect" value={active} onChange={e => setCur(e.target.value)} style={{marginLeft:'0.5rem'}}>
              {currencies.map(c => <option key={c}>{c}</option>)}
            </select>
          )}
        </div>
        <div className="sub-hdr-right">
          {portfolio.length > 0 && (
            <button className="btn-ghost" onClick={refreshPrices} disabled={refreshing} title="Fetch current prices from Yahoo Finance">
              <RefreshCw size={12} style={refreshing ? {animation:'spin 0.8s linear infinite'} : undefined}/> Refresh Prices
            </button>
          )}
          <button className="btn-pri" onClick={() => setModal({})}><Plus size={12}/> Add Holding</button>
        </div>
      </div>
      <div className="main-scroll">
        <div className="summary-strip">
          <div className="sum-card">
            <span className="sum-label">Portfolio Value</span>
            <span className="sum-val" style={{color:'var(--blue)'}}>{fmt(totalValue, false, active)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Total Gain / Loss</span>
            <span className="sum-val" style={{color:totalGain>=0?'var(--green)':'var(--red)'}}>{fmt(totalGain, true, active)}</span>
          </div>
          <div className="sum-card">
            <span className="sum-label">Overall Return</span>
            <span className="sum-val" style={{color:totalGain>=0?'var(--green)':'var(--red)'}}>{returnPct.toFixed(2)}%</span>
          </div>
        </div>
        {priceStatus && (
          <div className="form-note" style={{margin:'0.25rem 0.25rem 0',color:'var(--blue)'}}>{priceStatus}</div>
        )}

        {portfolio.length === 0 ? (
          <div className="widget-card" style={{marginTop:'1rem'}}>
            <div className="empty-state" style={{padding:'2rem'}}>No holdings yet. Add one to see allocation and returns.</div>
          </div>
        ) : (
          <div className="widgets-grid" style={{marginTop:'1rem'}}>
            <div className="widget-card">
              <div className="widget-hdr"><span className="widget-ttl">Allocation</span></div>
              <DonutChart currency={active} data={portfolio.map(p=>({id:p.id,name:p.name,amount:-p.value,color:p.color}))}/>
            </div>
            <div className="widget-card">
              <div className="widget-hdr"><span className="widget-ttl">Holdings</span></div>
              <table className="page-table">
                <thead><tr><th>Name</th><th>Price</th><th>Value</th><th>Gain</th><th></th></tr></thead>
                <tbody>
                  {portfolio.map(p=>(
                    <tr key={p.id}>
                      <td>
                        <div style={{fontWeight:600,fontSize:'0.8rem'}}>{p.ticker}</div>
                        <div style={{fontSize:'0.68rem',color:'var(--text-3)'}}>{p.name}</div>
                      </td>
                      <td>{fmt(p.price, false, active)}</td>
                      <td style={{fontWeight:600}}>{fmt(p.value, false, active)}</td>
                      <td style={{color:p.gain>=0?'var(--green)':'var(--red)',fontWeight:600}}>
                        {fmt(p.gain, true, active)}<br/>
                        <span style={{fontSize:'0.68rem',fontWeight:400}}>({p.gainPct.toFixed(1)}%)</span>
                      </td>
                      <td style={{whiteSpace:'nowrap'}}>
                        <button className="icon-btn" title="Edit" onClick={() => setModal(p)}><Pencil size={12}/></button>
                        <button className="icon-btn" title="Remove" style={{color:'var(--red)'}} onClick={() => remove(p)}><Trash2 size={12}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {modal && <HoldingModal initial={modal.id ? holdings.find(h => h.id === modal.id) : null} defaultCurrency={active} onClose={() => setModal(null)} onSave={actions.saveHolding}/>}
    </>
  );
}
export default InvestmentsPage;

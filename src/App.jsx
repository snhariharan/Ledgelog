import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Lightbulb, Target, TrendingUp, PiggyBank,
  Umbrella, ListChecks, Search, Upload, Menu, RefreshCw,
  AlertCircle, Contact, Settings, LogOut, Sun, Moon, User,
} from 'lucide-react';

import { supabase, IS_SUPABASE_CONFIGURED } from './lib/supabase';
import * as db from './lib/db';
import { createActions } from './lib/actions';
import { withDerived } from './lib/derive';
import { getExchangeRates, invalidateRatesCache } from './lib/fx';
import { getStored, setStored } from './helpers';

import {
  budgetsData, transactionsData, accountsData, archivedAccountsData, tagsData,
  iousData, repeatsData, favoritesData, rulesData, holdingsData,
} from './mockData';

import AuthPage from './components/AuthPage';
import LoadingScreen from './components/LoadingScreen';
import LeftSidebar from './components/LeftSidebar';
import SearchModal from './components/SearchModal';
import SettingsModal from './components/SettingsModal';
import ErrorBoundary from './components/ErrorBoundary';

import DashboardPage from './pages/DashboardPage';
import InsightsPage from './pages/InsightsPage';
import BudgetsPage from './pages/BudgetsPage';
import ForecastPage from './pages/ForecastPage';
import InvestmentsPage from './pages/InvestmentsPage';
import RetirementPage from './pages/RetirementPage';
import RulesPage from './pages/RulesPage';
import AccountDetailPage from './pages/AccountDetailPage';
import TagDetailPage from './pages/TagDetailPage';

const NAV = [
  {key:'dashboard',   label:'Dashboard',   Icon:LayoutDashboard},
  {key:'insights',    label:'Insights',    Icon:Lightbulb},
  {key:'budgets',     label:'Budgets',     Icon:Target},
  {key:'forecast',    label:'Forecast',    Icon:TrendingUp},
  {key:'investments', label:'Investments', Icon:PiggyBank},
  {key:'retirement',  label:'Retirement',  Icon:Umbrella},
  {key:'rules',       label:'Rules',       Icon:ListChecks},
];

const demoData = () => ({
  accounts:         accountsData,
  archivedAccounts: archivedAccountsData,
  tags:             tagsData,
  budgets:          budgetsData,
  transactions:     transactionsData,
  ious:             iousData,
  repeats:          repeatsData,
  favorites:        favoritesData,
  rules:            rulesData,
  holdings:         holdingsData,
});

export default function App() {
  const [authLoading, setAuthLoading] = useState(IS_SUPABASE_CONFIGURED);
  const [session, setSession]         = useState(null);
  const [demoMode, setDemoMode]       = useState(!IS_SUPABASE_CONFIGURED);
  const [raw, setRawState]            = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [dataError, setDataError]     = useState('');
  const [navPage, setNavPage]         = useState('dashboard');
  const [navDetail, setNavDetail]     = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSearch, setShowSearch]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [accMenu, setAccMenu]         = useState(false);
  const [period, setPeriod]           = useState('This Month');
  const [theme, setTheme]             = useState(() => getStored('app_theme', 'light'));
  const [toast, setToast]             = useState(null);
  const [fxRates, setFxRates]         = useState({});
  const [currency, setCurrency]       = useState(null); // display currency; null = first account's

  const userId = session?.user?.id ?? null;

  // Latest data is mirrored in a ref and updated synchronously, so actions that
  // run back-to-back see each other's changes and updaters run exactly once.
  const rawRef = useRef(null);
  const setRaw = useCallback(update => {
    const next = typeof update === 'function' ? update(rawRef.current) : update;
    rawRef.current = next;
    setRawState(next);
  }, []);

  const notify = useCallback((message, kind = 'success') => setToast({ message, kind, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── theme ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    setStored('app_theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  // ── auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED) return;
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session); setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── data loading ───────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    if (!userId) return;
    setRaw(await db.loadAllData(userId));
  }, [userId, setRaw]);

  const loadInitial = useCallback(async () => {
    setDataLoading(true); setDataError('');
    try { await reload(); }
    catch (e) { setDataError(e.message); }
    finally { setDataLoading(false); }
  }, [reload]);

  useEffect(() => {
    if (demoMode) { setRaw(demoData()); return; }
    if (!userId) { setRaw(null); return; }
    loadInitial();
  }, [userId, demoMode, loadInitial, setRaw]);

  const actions = useMemo(
    () => createActions({ userId, demo: demoMode, getRaw: () => rawRef.current, setRaw, reload, notify }),
    [userId, demoMode, setRaw, reload, notify],
  );

  // Materialise recurring transactions that have come due (once per session/user).
  const repeatsRan = useRef(null);
  useEffect(() => {
    if (!raw) return;
    const key = demoMode ? 'demo' : userId;
    if (repeatsRan.current === key) return;
    repeatsRan.current = key;
    actions.processDueRepeats().then(n => { if (n > 0) notify(`Added ${n} recurring transaction${n > 1 ? 's' : ''}.`); });
  }, [raw, demoMode, userId, actions, notify]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await reload(); } catch (e) { notify(e.message, 'error'); }
    finally { setRefreshing(false); }
  };

  const handleSignOut = async () => {
    if (IS_SUPABASE_CONFIGURED && session) await supabase.auth.signOut();
    setSession(null); setDemoMode(false); setRaw(null); setAccMenu(false); setNavDetail(null);
    repeatsRan.current = null;
  };

  // ── keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setShowSearch(true); }
      if (e.key === 'Escape') { setShowSearch(false); setAccMenu(false); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const view = useMemo(() => (raw ? withDerived(raw, period, undefined, fxRates, currency) : null), [raw, period, fxRates, currency]);

  // Fetch FX rates whenever we have multi-currency accounts
  useEffect(() => {
    if (!view) return;
    if (!view.multiCurrency) return;
    getExchangeRates().then(rates => { if (rates && Object.keys(rates).length) setFxRates(rates); });
  }, [view?.multiCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshRates = async () => {
    invalidateRatesCache();
    const rates = await getExchangeRates();
    if (rates && Object.keys(rates).length) { setFxRates(rates); notify('Exchange rates updated.'); }
    else notify('Could not fetch exchange rates — using cached values.', 'error');
  };

  if (authLoading) return <LoadingScreen message="Checking authentication…"/>;
  if (!session && !demoMode) return <AuthPage onDemo={() => setDemoMode(true)}/>;
  if (dataError && !view) return (
    <div className="loading-screen">
      <AlertCircle size={36} style={{color:'var(--red)',marginBottom:'0.75rem'}}/>
      <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:'0.25rem'}}>Failed to load</div>
      <div style={{color:'var(--text-3)',fontSize:'0.82rem',maxWidth:360,textAlign:'center',marginBottom:'1rem'}}>{dataError}</div>
      <div style={{display:'flex',gap:'0.5rem'}}>
        <button className="btn-pri" onClick={loadInitial}><RefreshCw size={13}/> Retry</button>
        <button className="btn-sec" onClick={handleSignOut}>Sign out</button>
      </div>
    </div>
  );
  if (dataLoading || !view) return <LoadingScreen message="Loading your data…"/>;

  const handlePageNav = key => { setNavPage(key); setNavDetail(null); };
  const displayEmail = session?.user?.email ?? 'Demo Mode';
  const pageKey = navDetail ? `${navDetail.type}:${navDetail.item?.id}` : navPage;
  const pageProps = { appData: view, actions, period, onPeriod: setPeriod };

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <button className="icon-btn" title="Toggle sidebar" onClick={()=>setSidebarOpen(o=>!o)}>
          <Menu size={16}/>
        </button>
        <div className="nav-brand" onClick={()=>handlePageNav('dashboard')}>
          <div className="brand-logo">L</div>
          Ledgelog
          {demoMode && <span className="demo-badge">DEMO</span>}
        </div>
        <div className="nav-links">
          {NAV.map(({key,label,Icon})=>(
            <div key={key} className={`nav-item ${navPage===key?'active':''}`} onClick={()=>handlePageNav(key)}>
              <Icon size={13}/>{label.toUpperCase()}
            </div>
          ))}
        </div>
        <div className="nav-right">
          {view.multiCurrency && (
            <div className="ccy-switch" role="tablist" aria-label="Display currency" title="Show data in selected currency (converted with exchange rates if available)">
              <button role="tab" aria-selected={view.baseCurrency === 'All'}
                className={view.baseCurrency === 'All' ? 'active' : ''} onClick={() => setCurrency('All')}>All</button>
              {view.currencies.map(c => (
                <button key={c} role="tab" aria-selected={view.baseCurrency === c}
                  className={view.baseCurrency === c ? 'active' : ''} onClick={() => setCurrency(c)}>{c}</button>
              ))}
            </div>
          )}
          <button
            className="icon-btn theme-toggle"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={15}/> : <Moon size={15}/>}
          </button>
          <button className="icon-btn" title="Search (⌘K)" onClick={()=>setShowSearch(true)}>
            <Search size={15}/>
          </button>
          <button className="icon-btn" title="Export / Import" onClick={() => { setSettingsTab('transactions'); setShowSettings(true); }}>
            <Upload size={15}/>
          </button>
          <div style={{position:'relative',display:'flex',alignItems:'center'}}>
            <button className="icon-btn user-btn" onClick={()=>setAccMenu(o=>!o)} title={displayEmail}>
              <Contact size={15}/>
            </button>
            {accMenu && (
              <div className="ctx-menu" style={{top:'calc(100% + 4px)',right:0,left:'auto',minWidth:210}}
                onClick={e=>e.stopPropagation()}>
                <div style={{padding:'0.6rem 0.875rem 0.5rem',borderBottom:'1px solid var(--border)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <User size={13} color="#fff"/>
                    </div>
                    <div>
                      <div style={{fontSize:'0.72rem',fontWeight:600,color:'var(--text-1)',lineHeight:1.2}}>{demoMode ? 'Demo Account' : 'My Account'}</div>
                      <div style={{fontSize:'0.62rem',color:'var(--text-3)',lineHeight:1.3}}>{displayEmail}</div>
                    </div>
                  </div>
                </div>
                <div style={{padding:'0.25rem 0'}}>
                  <div className="ctx-item" onClick={() => { setSettingsTab('profile'); setShowSettings(true); setAccMenu(false); }}><Settings size={13}/> Settings</div>
                </div>
                <div style={{borderTop:'1px solid var(--border)',padding:'0.25rem 0'}}>
                  <div className="ctx-item danger" onClick={handleSignOut}><LogOut size={13}/> Sign Out</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="body-layout">
        {sidebarOpen && (
          <LeftSidebar
            appData={view}
            actions={actions}
            onSignOut={handleSignOut}
            onNavigate={(type, item) => setNavDetail({ type, item })}
            onRefreshRates={view.multiCurrency ? refreshRates : undefined}
          />
        )}
        <div className="main-area">
          <ErrorBoundary resetKey={pageKey}>
            {navDetail?.type === 'account-detail' && (
              <AccountDetailPage account={[...view.accounts, ...view.archivedAccounts].find(a => a.id === navDetail.item.id) ?? navDetail.item} allTransactions={view.transactions} onBack={() => setNavDetail(null)}/>
            )}
            {navDetail?.type === 'tag-detail' && (
              <TagDetailPage tag={view.tags.find(t => t.id === navDetail.item.id) ?? navDetail.item} allTransactions={view.transactions} accounts={view.accounts} currency={view.baseCurrency} onBack={() => setNavDetail(null)}/>
            )}
            {!navDetail && navPage === 'dashboard'   && <DashboardPage   {...pageProps} onRefresh={IS_SUPABASE_CONFIGURED && !demoMode ? handleRefresh : null} refreshing={refreshing}/>}
            {!navDetail && navPage === 'insights'    && <InsightsPage    {...pageProps}/>}
            {!navDetail && navPage === 'budgets'     && <BudgetsPage     {...pageProps}/>}
            {!navDetail && navPage === 'forecast'    && <ForecastPage    {...pageProps}/>}
            {!navDetail && navPage === 'investments' && <InvestmentsPage {...pageProps}/>}
            {!navDetail && navPage === 'retirement'  && <RetirementPage  {...pageProps}/>}
            {!navDetail && navPage === 'rules'       && <RulesPage       {...pageProps}/>}
          </ErrorBoundary>
        </div>
      </div>
      {showSearch && <SearchModal transactions={view.transactions} onClose={()=>setShowSearch(false)}/>}
      {showSettings && (
        <SettingsModal
          onClose={()=>setShowSettings(false)}
          appData={view} actions={actions} demoMode={demoMode}
          theme={theme} onTheme={setTheme} notify={notify}
          initialTab={settingsTab}
        />
      )}
      {toast && <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">{toast.message}</div>}
    </div>
  );
}

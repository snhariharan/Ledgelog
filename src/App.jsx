import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Lightbulb, Target, TrendingUp, PiggyBank,
  Umbrella, ListChecks, Search, Upload, Menu, RefreshCw,
  AlertCircle, Contact, Settings, Download, LogOut,
  Sun, Moon, FileDown, Keyboard, Bell, User,
} from 'lucide-react';

import { supabase, IS_SUPABASE_CONFIGURED } from './lib/supabase';
import * as db from './lib/db';

import {
  expensesData   as MOCK_EXPENSES,
  budgetsData    as MOCK_BUDGETS,
  transactionsData as MOCK_TXN,
  summaryData    as MOCK_SUMMARY,
  accountsData   as MOCK_ACCOUNTS,
  archivedAccountsData as MOCK_ARCHIVED,
  netWorth       as MOCK_NET_WORTH,
  tagsData       as MOCK_TAGS,
  iousData       as MOCK_IOUS,
  repeatsData    as MOCK_REPEATS,
  favoritesData  as MOCK_FAVORITES,
} from './mockData';

import AuthPage from './components/AuthPage';
import LoadingScreen from './components/LoadingScreen';
import LeftSidebar from './components/LeftSidebar';
import SearchModal from './components/SearchModal';
import SettingsModal from './components/SettingsModal';
import { APP_SETTINGS } from './helpers';

import DashboardPage from './pages/DashboardPage';
import InsightsPage from './pages/InsightsPage';
import BudgetsPage from './pages/BudgetsPage';
import ForecastPage from './pages/ForecastPage';
import InvestmentsPage from './pages/InvestmentsPage';
import RetirementPage from './pages/RetirementPage';
import RulesPage from './pages/RulesPage';
import AccountDetailPage from './pages/AccountDetailPage';
import TagDetailPage from './pages/TagDetailPage';

const PAGE_MAP = {
  insights:    { title:'Insights',    Icon:Lightbulb,  desc:'Visual breakdowns and spending patterns.' },
  budgets:     { title:'Budgets',     Icon:Target,     desc:'Set monthly limits and track spending goals.' },
  forecast:    { title:'Forecast',    Icon:TrendingUp, desc:'Projected cash flow for the next 12 months.' },
  investments: { title:'Investments', Icon:PiggyBank,  desc:'Track your portfolio, allocation, and returns.' },
  retirement:  { title:'Retirement',  Icon:Umbrella,   desc:'Plan and monitor your retirement savings.' },
  rules:       { title:'Rules',       Icon:ListChecks, desc:'Auto-tag and categorize transaction rules.' },
};

export default function App() {
  const [authLoading, setAuthLoading] = useState(IS_SUPABASE_CONFIGURED);
  const [session, setSession]         = useState(null);
  const [demoMode, setDemoMode]       = useState(!IS_SUPABASE_CONFIGURED);
  const [appData, setAppData]         = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError]     = useState('');
  const [navPage, setNavPage]         = useState('dashboard');
  const [navDetail, setNavDetail]      = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSearch, setShowSearch]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab]   = useState('profile');
  const [accMenu, setAccMenu]         = useState(false);
  const [theme, setTheme]             = useState(() => localStorage.getItem('app_theme') || 'light');

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app_theme', next);
      document.body.classList.toggle('dark-mode', next === 'dark');
      return next;
    });
  };

  useEffect(() => {
    if (APP_SETTINGS.theme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, []);

  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED) return;
    supabase.auth.getSession().then(({data:{session}}) => {
      setSession(session); setAuthLoading(false);
    });
    const { data:{subscription} } = supabase.auth.onAuthStateChange((_,session) => {
      setSession(session); setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (demoMode) {
      setAppData({
        accounts:         MOCK_ACCOUNTS,
        archivedAccounts: MOCK_ARCHIVED,
        netWorth:         MOCK_NET_WORTH,
        tags:             MOCK_TAGS,
        budgets:          MOCK_BUDGETS.map((b,i)=>({id:i+1,tagId:i+1,tag:b.tag,color:b.color,limit:b.limit,spent:b.spent})),
        transactions:     MOCK_TXN,
        expensesData:     MOCK_EXPENSES,
        summaryData:      MOCK_SUMMARY,
        ious:             MOCK_IOUS,
        repeats:          MOCK_REPEATS,
        favorites:        MOCK_FAVORITES,
      });
      return;
    }
    if (!session) { setAppData(null); return; }
    setDataLoading(true); setDataError('');
    db.loadAllData(session.user.id)
      .then(d => { setAppData(d); setDataLoading(false); })
      .catch(err => { setDataError(err.message); setDataLoading(false); });
  }, [session, demoMode]);

  const handleRefresh = useCallback(async () => {
    if (!session || demoMode) return;
    setDataLoading(true);
    try { const d=await db.loadAllData(session.user.id); setAppData(d); }
    catch(e) { setDataError(e.message); }
    finally { setDataLoading(false); }
  }, [session, demoMode]);

  const handleSignOut = async () => {
    if (IS_SUPABASE_CONFIGURED && session) await supabase.auth.signOut();
    setSession(null); setDemoMode(false); setAppData(null); setAccMenu(false);
    setNavDetail(null);
  };

  const handleNavigate = (type, item) => {
    setNavDetail({ type, item });
  };

  const handleBack = () => {
    setNavDetail(null);
  };

  useEffect(() => {
    const h = e => {
      if ((e.metaKey||e.ctrlKey) && e.key==='k') { e.preventDefault(); setShowSearch(true); }
      if (e.key==='Escape') { setShowSearch(false); setShowUpload(false); setAccMenu(false); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (authLoading) return <LoadingScreen message="Checking authentication…"/>;
  if (!session && !demoMode) return <AuthPage onDemo={() => setDemoMode(true)}/>;
  if (dataLoading || !appData) return <LoadingScreen message="Loading your data…"/>;
  if (dataError) return (
    <div className="loading-screen">
      <AlertCircle size={36} style={{color:'var(--red)',marginBottom:'0.75rem'}}/>
      <div style={{fontWeight:700,color:'var(--text-1)',marginBottom:'0.25rem'}}>Failed to load</div>
      <div style={{color:'var(--text-3)',fontSize:'0.82rem',maxWidth:360,textAlign:'center',marginBottom:'1rem'}}>{dataError}</div>
      <button className="btn-pri" onClick={handleRefresh}><RefreshCw size={13}/> Retry</button>
    </div>
  );

  const NAV = [
    {key:'dashboard',   label:'Dashboard',   Icon:LayoutDashboard},
    {key:'insights',    label:'Insights',    Icon:Lightbulb},
    {key:'budgets',     label:'Budgets',     Icon:Target},
    {key:'forecast',    label:'Forecast',    Icon:TrendingUp},
    {key:'investments', label:'Investments', Icon:PiggyBank},
    {key:'retirement',  label:'Retirement',  Icon:Umbrella},
    {key:'rules',       label:'Rules',       Icon:ListChecks},
  ];

  const handlePageNav = (key) => {
    setNavPage(key);
    setNavDetail(null);
  };

  const displayEmail = session?.user?.email ?? 'Demo Mode';

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <button className="icon-btn" title="Toggle sidebar" onClick={()=>setSidebarOpen(o=>!o)}>
          <Menu size={16}/>
        </button>
        <div className="nav-brand" onClick={()=>setNavPage('dashboard')}>
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
                {/* User info header */}
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
                {/* Menu items */}
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
            accounts={appData.accounts}
            archivedAccounts={appData.archivedAccounts}
            netWorth={appData.netWorth}
            tags={appData.tags}
            ious={appData.ious}
            repeats={appData.repeats}
            favorites={appData.favorites}
            onSignOut={handleSignOut}
            onNavigate={handleNavigate}
          />
        )}
        <div className="main-area">
          {navDetail?.type === 'account-detail' && (
            <AccountDetailPage
              account={navDetail.item}
              allTransactions={appData.transactions}
              onBack={handleBack}
            />
          )}
          {navDetail?.type === 'tag-detail' && (
            <TagDetailPage
              tag={navDetail.item}
              allTransactions={appData.transactions}
              accounts={appData.accounts}
              onBack={handleBack}
            />
          )}
          {!navDetail && navPage === 'dashboard'    && <DashboardPage   appData={appData} setAppData={setAppData} userId={session?.user?.id??null} onRefresh={handleRefresh}/>}
          {!navDetail && navPage === 'insights'     && <InsightsPage    appData={appData}/>}
          {!navDetail && navPage === 'budgets'      && <BudgetsPage     appData={appData}/>}
          {!navDetail && navPage === 'forecast'     && <ForecastPage    appData={appData}/>}
          {!navDetail && navPage === 'investments'  && <InvestmentsPage appData={appData}/>}
          {!navDetail && navPage === 'retirement'   && <RetirementPage  appData={appData}/>}
          {!navDetail && navPage === 'rules'        && <RulesPage       appData={appData}/>}
        </div>
      </div>
      {showSearch && <SearchModal transactions={appData.transactions} onClose={()=>setShowSearch(false)}/>}
      {showSettings && <SettingsModal onClose={()=>setShowSettings(false)} appData={appData} setAppData={setAppData} demoMode={demoMode} initialTab={settingsTab} />}
    </div>
  );
}

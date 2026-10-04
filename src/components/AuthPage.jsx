import React, { useState } from 'react';
import { AlertCircle, Mail, Lock, Eye, EyeOff, Check } from 'lucide-react';
import { supabase, IS_SUPABASE_CONFIGURED } from '../lib/supabase';

// ══════════════════════════════════════════════════════════════════════════════
// AUTH / LANDING PAGE
// ══════════════════════════════════════════════════════════════════════════════
function AuthPage({ onDemo }) {
  const [mode, setMode]       = useState('signin');
  const [email, setEmail]     = useState('');
  const [password, setPw]     = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const forgotPassword = async () => {
    setError(''); setSuccess('');
    if (!email) return setError('Enter your email above first.');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setLoading(false);
    if (err) setError(err.message);
    else setSuccess('If that email has an account, a reset link is on its way. After using it, set a new password in Settings → Security.');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setSuccess('Account created! Check your email to verify, then sign in.');
        setMode('signin');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-logo">L</div>
          <div>
            <div className="auth-title">Ledgelog</div>
            <div className="auth-subtitle">Personal Finance Tracker</div>
          </div>
        </div>

        {IS_SUPABASE_CONFIGURED ? (
          <>
            <div className="auth-tab-row">
              {['signin','signup'].map(m => (
                <button key={m} className={`auth-tab ${mode === m ? 'active' : ''}`}
                  onClick={() => { setMode(m); setError(''); setSuccess(''); }}>
                  {m === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="auth-form">
              <div className="auth-field">
                <label className="field-label">Email</label>
                <div className="field-wrap">
                  <Mail size={14} className="field-icon" />
                  <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
                    placeholder="you@example.com" className="field-input" />
                </div>
              </div>
              <div className="auth-field">
                <label className="field-label">Password</label>
                <div className="field-wrap">
                  <Lock size={14} className="field-icon" />
                  <input type={showPw ? 'text' : 'password'} required minLength={8}
                    value={password} onChange={e=>setPw(e.target.value)}
                    placeholder="••••••••" className="field-input has-toggle" />
                  <button type="button" className="field-toggle" onClick={() => setShowPw(s=>!s)}>
                    {showPw ? <EyeOff size={13}/> : <Eye size={13}/>}
                  </button>
                </div>
              </div>

              {error   && <div className="auth-msg error"><AlertCircle size={13}/> {error}</div>}
              {success && <div className="auth-msg success"><Check size={13}/> {success}</div>}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
              {mode === 'signin' && (
                <button type="button" className="auth-note" style={{background:'none',border:'none',cursor:'pointer',textDecoration:'underline'}} onClick={forgotPassword} disabled={loading}>
                  Forgot password?
                </button>
              )}
            </form>

            <div className="auth-divider"><span>or</span></div>
          </>
        ) : (
          <div className="auth-msg info" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={13}/> Supabase not configured — demo mode only.
            See <code>.env.example</code> to enable full auth.
          </div>
        )}

        <button className="auth-demo-btn" onClick={onDemo}>
          Continue in Demo Mode
        </button>
        {IS_SUPABASE_CONFIGURED && (
          <p className="auth-note">Demo mode uses sample data · nothing is saved</p>
        )}
      </div>
    </div>
  );
}

export default AuthPage;

/**
 * Sign-in, on the Astrikos auth layout: a two-panel spread. The identity panel
 * paints brand ink and states what the product does. The form panel stays quiet.
 * Below 1024 px the spread collapses to the form alone, so the fields are never
 * under a fold on a phone.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Moon, Sun, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { applyTheme, useTheme } from '../lib/theme';

const PILLARS = [
  { k: 'Rules', v: 'SOLAS, the LSA Code and classification rules, built in and cited' },
  { k: 'Documents', v: 'PDF, Word, Excel, CAD drawings, scans and photos' },
  { k: 'Procurement', v: 'Offer evaluation, binding-data gaps, pre-bid queries, BOM, SOTR and cost' },
  { k: 'Governance', v: 'Role-based access and a full audit trail' },
];

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const passwordRef = useRef(null);
  const userRef = useRef(null);
  const theme = useTheme();

  useEffect(() => { userRef.current?.focus(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      // AuthContext sets the user, and the router moves on to the app.
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.');
      setPassword('');
      passwordRef.current?.focus();
      setBusy(false);
    }
  };

  return (
    <div className="pt-auth">
      <button
        type="button"
        className="icon-btn pt-auth-theme"
        onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
      >
        {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
      </button>

      {/* Identity panel */}
      <aside className="pt-auth-brand astk-aurora astk-on-ink" aria-label="Design Validator">
        <div className="pt-auth-logo">
          <img src="/astrikos-lockup.png" alt="Astrikos" />
        </div>

        <div className="pt-auth-copy">
          <p className="pt-auth-eyebrow">AI-driven design validation</p>
          <h1 className="pt-auth-h1">Ship design review, grounded in the rules</h1>
          <p className="pt-auth-lede">Check specifications, drawings and vendor documents against maritime rules, and see the evidence behind every finding.</p>
        </div>

        <ul className="pt-auth-pillars">
          {PILLARS.map((p, i) => (
            <li key={p.k} style={{ animationDelay: `${0.06 * i + 0.1}s` }}>
              <b>{p.k}</b>
              <span>{p.v}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Form panel */}
      <main className="pt-auth-main">
        <div className="pt-auth-form-wrap">
          {/* The mark repeats here only when the identity panel is hidden. */}
          <div className="pt-auth-mobile-logo">
            <img src="/astrikos-mark.png" alt="Astrikos" />
          </div>

          <p className="pt-auth-kicker">Design Validator</p>
          <h2 className="pt-auth-h2">Sign in</h2>
          <p className="pt-auth-sub">Use your Design Validator account.</p>

          <form onSubmit={submit} className="pt-auth-form" noValidate>
            <div>
              <label className="pt-auth-label" htmlFor="nx-user">Username</label>
              <div className="pt-auth-field">
                <User size={16} strokeWidth={1.75} />
                <input
                  id="nx-user"
                  ref={userRef}
                  className="pt-auth-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="admin"
                />
              </div>
            </div>

            <div>
              <label className="pt-auth-label" htmlFor="nx-pass">Password</label>
              <div className="pt-auth-field">
                <Lock size={16} strokeWidth={1.75} />
                <input
                  id="nx-pass"
                  ref={passwordRef}
                  className="pt-auth-input has-eye"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button type="button" className="pt-auth-eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="pt-auth-error" key={error}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="app-btn pt-auth-submit" disabled={busy || !username.trim() || !password}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
        </div>

        <div className="powered-by inline">
          <span>Powered by</span>
          <img src="/astrikos-lockup.png" alt="Astrikos" />
        </div>
      </main>
    </div>
  );
}

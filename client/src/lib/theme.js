import { useEffect, useState } from 'react';

// Astrikos UI Theme v2.0 §5.7. The attribute lives on <body>; dark is the default.
const KEY = 'astrikos-theme';
const EVENT = 'astrikos:theme';

export function applyTheme(mode) {
  document.body.setAttribute('data-theme', mode);
  try { localStorage.setItem(KEY, mode); } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
}

export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  applyTheme(saved || (prefersLight ? 'light' : 'dark'));
}

export function useTheme() {
  const [theme, setTheme] = useState(() => document.body.getAttribute('data-theme') || 'dark');
  useEffect(() => {
    const onChange = (e) => setTheme(e.detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return theme;
}

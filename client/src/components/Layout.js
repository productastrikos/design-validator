import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen, CircleHelp, ClipboardCheck, DraftingCompass, FileOutput, FileSearch, FolderTree, GitCompare,
  History, IndianRupee, LayoutDashboard, ListChecks, ListTree, LogOut, Menu, MessageSquare, Moon, PackageCheck,
  ScrollText, Search, Settings, ShieldCheck, Sun, Users, X,
} from 'lucide-react';

/* ─── Navigation structure (roles: who can see each item) ── */
const ALL = ['admin', 'user'];
const NAV_SECTIONS = [
  { label: 'Overview', items: [
    { path: '/', roles: ALL, icon: LayoutDashboard, label: 'Dashboard' },
  ] },
  { label: 'AI assistant', items: [
    { path: '/chatbot', roles: ALL, icon: MessageSquare, label: 'Rules & Regulations' },
    { path: '/history', roles: ALL, icon: History, label: 'Interaction History' },
  ] },
  { label: 'Document intelligence', items: [
    { path: '/documents', roles: ALL, icon: FileSearch, label: 'Document Intel' },
    { path: '/workspace', roles: ALL, icon: FolderTree, label: 'Workspace' },
    { path: '/converter', roles: ALL, icon: FileOutput, label: 'Document Converter' },
    { path: '/compare', roles: ALL, icon: GitCompare, label: 'Document Comparison' },
    { path: '/drawings', roles: ALL, icon: DraftingCompass, label: 'Drawing Intelligence' },
    { path: '/inspection', roles: ALL, icon: ClipboardCheck, label: 'Inspection Report Analytics' },
    { path: '/lessons', roles: ALL, icon: BookOpen, label: 'Lessons Learnt' },
  ] },
  { label: 'Procurement & generation', items: [
    { path: '/compliance', roles: ALL, icon: ListChecks, label: 'Technical Offer Eval.' },
    { path: '/binding', roles: ALL, icon: PackageCheck, label: 'Binding Data Gap Analysis' },
    { path: '/prebid', roles: ALL, icon: CircleHelp, label: 'Pre-Bid Queries' },
    { path: '/bom', roles: ALL, icon: ListTree, label: 'BOM & SOTR' },
    { path: '/cost', roles: ALL, icon: IndianRupee, label: 'Ship Cost Estimation' },
    { path: '/design-review', roles: ALL, icon: ShieldCheck, label: 'Design Review Assistant' },
  ] },
  { label: 'Administration', items: [
    { path: '/users', roles: ['admin'], icon: Users, label: 'Role-Based Access Control' },
    { path: '/audit', roles: ['admin'], icon: ScrollText, label: 'Audit Log' },
    { path: '/settings', roles: ['admin'], icon: Settings, label: 'Settings & AI Config' },
  ] },
];

/* ─── Page finder index: extra words matched against, not displayed ── */
const SEARCH_KEYWORDS = {
  '/': 'overview kpi summary home main metrics validator analytics',
  '/chatbot': 'chatbot ai assistant rules regulations query interpret design natural language irs dnv abs iacs imo iec naval follow-up',
  '/history': 'user interaction history previous prompts queries responses revisit reuse export',
  '/documents': 'document intel ocr scanned pdf extraction parse manual text searchable compare validate rule validator upload',
  '/workspace': 'workspace management hierarchical project repository discipline folder organise upload retrieve move documents tree',
  '/converter': 'intelligent document converter extract custom columns prompt excel word convert information table format summarize rewrite',
  '/compare': 'document comparison compare differences diff pots binding offer deviation table',
  '/drawings': 'drawing intelligence extraction cable schedule sld single line diagram general arrangement ga dwg dxf autocad equipment legend compartment validation vision',
  '/inspection': 'inspection reports analytics dashboard equipment observation non conformity ncr remark status open closed handwritten ocr sat unsat',
  '/lessons': 'lessons learnt learned repository recurring issues design considerations proactive knowledge defects',
  '/compliance': 'technical offer evaluation scrutiny compliance matrix tts sotr tender specification deviation vendor comparison recommendation',
  '/binding': 'vendor binding data gap analysis review pots purchase order drawings calculations certificates manuals test procedures missing',
  '/prebid': 'pre bid query generation rfp tender ambiguity contradiction missing requirement risk clarification',
  '/bom': 'bom bill of materials generation rfp build specification equipment oem capacity estimation sotr statement technical requirements ela load',
  '/cost': 'ship cost estimation bom unit rate vendor budgetary quotation bq enquiry email discipline summary',
  '/design-review': 'design review risk assessment checklist recurring deficiency preventive measure',
  '/users': 'users accounts roles admin engineer access management permissions department rbac password',
  '/audit': 'audit log trail activity login logout upload download query status traceability export',
  '/settings': 'settings configuration knowledge base kb rag backend server connection inference',
};

const ROLE_DISPLAY = { admin: 'Administrator', user: 'Design Engineer' };

export default function Layout({ children, user, onLogout, theme = 'dark', onThemeToggle }) {
  const userRole = user?.role || 'user';
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const profileRef = useRef(null);
  const finderRef = useRef(null);
  const mainRef = useRef(null);

  const sections = useMemo(() => NAV_SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(userRole)) }))
    .filter((s) => s.items.length), [userRole]);

  const results = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return sections.flatMap((s) => s.items.map((item) => {
      const hay = `${item.label} ${s.label} ${SEARCH_KEYWORDS[item.path] || ''}`.toLowerCase();
      return { item, section: s.label, score: words.filter((w) => hay.includes(w)).length + (item.label.toLowerCase().includes(query.trim().toLowerCase()) ? words.length : 0) };
    })).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
  }, [query, sections]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setNavOpen(true);
        finderRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* On route change: close the mobile nav and scroll the page to the top. */
  useEffect(() => {
    setNavOpen(false);
    mainRef.current?.scrollTo?.(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!showProfile) return undefined;
    const onDocClick = (e) => { if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setShowProfile(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [showProfile]);

  const go = (path) => { navigate(path); setQuery(''); setHi(0); };
  const initial = user?.fullName?.charAt(0) || 'U';

  const onFinderKey = (e) => {
    if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % results.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h - 1 + results.length) % results.length); }
    if (e.key === 'Enter') go(results[Math.min(hi, results.length - 1)].item.path);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <button type="button" className="icon-btn only-mobile" onClick={() => setNavOpen(true)} aria-label="Open navigation">
          <Menu size={16} strokeWidth={1.75} />
        </button>

        <Link to="/" className="brand-link" title="Design Validator by Astrikos">
          <span className="astk-lockup">
            <img src="/astrikos-mark.png" alt="" />
            <span className="astk-lockup-rule" />
            <span className="astk-lockup-text">
              <span className="astk-lockup-name">ASTRIKOS</span>
              <span className="astk-lockup-product">Design Validator</span>
            </span>
          </span>
        </Link>

        <div className="header-spacer" />

        <button
          type="button"
          className="icon-btn"
          onClick={onThemeToggle}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
        </button>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            className="profile-trigger"
            onClick={() => setShowProfile((s) => !s)}
            aria-haspopup="menu"
            aria-expanded={showProfile}
            aria-label={`Account: ${user?.fullName || 'User'}`}
          >
            {initial}
          </button>
          {showProfile && (
            <div className="profile-menu" role="menu">
              <div className="profile-menu-header" style={{ justifyContent: 'flex-start' }}>
                <div className="avatar">{initial}</div>
                <div className="min-w-0">
                  <div className="name truncate">{user?.fullName || 'Account'}</div>
                  <div className="status">{ROLE_DISPLAY[userRole] || userRole}</div>
                </div>
              </div>
              {userRole === 'admin' && (
                <div className="profile-menu-section">
                  <button type="button" className="profile-menu-item" role="menuitem" onClick={() => { setShowProfile(false); navigate('/users'); }}>
                    <Users /> User management
                  </button>
                </div>
              )}
              <div className="profile-menu-section">
                <button type="button" className="profile-menu-item danger" role="menuitem" onClick={() => { setShowProfile(false); onLogout?.(); }}>
                  <LogOut /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="app-body">
        {navOpen && <div className="drawer-backdrop" onClick={() => setNavOpen(false)} />}

        <aside className={`app-sidebar ${navOpen ? 'is-open' : ''}`} aria-label="Primary navigation">
          <button type="button" className="icon-btn sm only-mobile drawer-close" onClick={() => setNavOpen(false)} aria-label="Close navigation">
            <X size={14} />
          </button>

          <div className="nav-finder">
            <Search size={13} />
            <input
              ref={finderRef}
              className="app-input"
              placeholder="Find a page (Ctrl+K)"
              aria-label="Find a page"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHi(0); }}
              onKeyDown={onFinderKey}
            />
          </div>

          {query.trim() ? (
            <nav className="nav-list" style={{ marginTop: 8 }} aria-label="Search results">
              {results.length === 0 && <div className="nav-empty">No page matches "{query}".</div>}
              {results.map(({ item }, i) => (
                <button key={item.path} type="button" className={`nav-item ${i === hi ? 'is-hi' : ''}`} onMouseDown={(e) => { e.preventDefault(); go(item.path); }}>
                  <item.icon size={16} strokeWidth={1.75} />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </nav>
          ) : sections.map((section) => (
            <div key={section.label}>
              <p className="nav-section-label">{section.label}</p>
              <nav className="nav-list" aria-label={section.label}>
                {section.items.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => go(item.path)}
                    className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    aria-current={location.pathname === item.path ? 'page' : undefined}
                  >
                    <item.icon size={16} strokeWidth={1.75} />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          ))}

          <div className="powered-by" style={{ marginTop: 'auto', marginBottom: 0, marginLeft: 0, marginRight: 0 }}>
            <span>Powered by</span>
            <img src="/astrikos-lockup.png" alt="Astrikos" />
          </div>
        </aside>

        <main className="app-main" ref={mainRef}>{children}</main>
      </div>
    </div>
  );
}

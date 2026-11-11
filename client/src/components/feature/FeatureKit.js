import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Check, Copy, Download, Frown, Meh, Smile } from 'lucide-react';
import { sendFeedback } from '../../services/featureApi';
import { openStudio } from '../studio/DocumentStudio';
import { chat } from '../../services/aiService';
import { listSelectableDocs, getSelectableDoc } from '../../services/docStore';

/* ─── Layout primitives ──────────────────────────────────────────────────── */
export function Page({ title, subtitle, children, actions }) {
  return (
    <div className="page">
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header-block">
      <div className="page-title-wrap">
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, desc, children, right, className = '' }) {
  return (
    <div className={`astk-panel space-y-4 ${className}`}>
      {(title || right) && (
        <div className="panel-head" style={{ marginBottom: 0 }}>
          <div>
            {title && <h2 className="panel-title">{title}</h2>}
            {desc && <p className="panel-desc">{desc}</p>}
          </div>
          {right && <div className="panel-actions">{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

const STAT_TONE = { emerald: 'is-success', amber: 'is-warning', orange: 'is-warning', red: 'is-danger' };

/* A result figure inside a panel (spec 7.24). These are not KPI cards. */
export function StatTile({ label, value, tone }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value astk-numeric ${STAT_TONE[tone] || ''}`}>{value}</div>
    </div>
  );
}

export function Spinner({ className = '' }) {
  return <span className={`app-spinner ${className}`} role="status" aria-label="Working" />;
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <div className="callout callout-danger" role="alert" style={{ marginBottom: 0 }}>
      <AlertTriangle size={14} className="callout-icon" />
      <div className="callout-body">{children}</div>
    </div>
  );
}

export function RunButton({ onClick, busy, disabled, children, busyLabel = 'Working…' }) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} className="app-primary-btn btn-lg btn-block">
      {busy ? (<><Spinner /> {busyLabel}</>) : children}
    </button>
  );
}

/* ─── Severity / status colour mapping ───────────────────────────────────── */
const TONE = {
  critical: 'danger', high: 'warning', medium: 'info', low: 'neutral', info: 'info',
  complied: 'success', submitted: 'success', adequate: 'success', closed: 'success', sat: 'success',
  'partially complied': 'warning', partial: 'warning', deviation: 'warning', insufficient: 'warning', inadequate: 'warning',
  exclusion: 'danger', 'not addressed': 'danger', missing: 'danger', unsat: 'danger', open: 'warning',
  ambiguous: 'accent', yes: 'danger', no: 'neutral',
};

export function Pill({ children, value }) {
  const key = String(value ?? children ?? '').toLowerCase();
  return <span className={`status-chip status-chip-${TONE[key] || 'neutral'}`}>{children ?? value}</span>;
}

const PILL_COLS = /sever|status|risk|likeli|impact|recurring|priority|type|categ/i;

/* ─── Document source: pick one of the user's uploaded documents ──────────────
   Documents are uploaded once on the Documents page and persist (in the browser)
   for the rest of the session. Every feature selects from that shared list. */
export function DocSource({ label, value, onChange, filter }) {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    const load = () => listSelectableDocs().then(all => setDocs(filter ? all.filter(filter) : all)).catch(() => setDocs([]));
    load();
    window.addEventListener('docstore:changed', load);
    return () => window.removeEventListener('docstore:changed', load);
  }, [filter]);

  const onPick = async (id) => {
    if (!id) { onChange(null); return; }
    const d = await getSelectableDoc(id);
    if (d) onChange({ id: d.id, name: d.name, text: d.text, libraryFile: d.libraryFile, source: d.source });
  };

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold text-app-text">{label}</label>
      {docs.length === 0 ? (
        <div className="text-[11px] text-app-muted px-3 py-2 rounded-lg bg-app-surface-soft border border-app-border">
          No documents available — upload one on the <span className="text-app-accent">Documents</span> page.
        </div>
      ) : (
        <select
          value={value?.id || ''}
          onChange={(e) => onPick(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-app-surface-soft border border-app-border text-[11px] text-app-text"
        >
          <option value="">Select a document…</option>
          {docs.map(d => <option key={d.id} value={d.id}>{d.name} · {d.type}</option>)}
        </select>
      )}
      {value && <div className="text-[10px] text-app-success">✓ {value.name}{value.text ? ` · ${(value.text.length / 1000).toFixed(0)}k chars` : ''}</div>}
    </div>
  );
}

/* ─── Multi document source: select several documents at once ──────────────── */
export function MultiDocSource({ label, values = [], onChange, filter }) {
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    const load = () => listSelectableDocs().then(all => setDocs(filter ? all.filter(filter) : all)).catch(() => setDocs([]));
    load();
    window.addEventListener('docstore:changed', load);
    return () => window.removeEventListener('docstore:changed', load);
  }, [filter]);

  const toggle = async (id, on) => {
    if (on) {
      const d = await getSelectableDoc(id);
      if (d) onChange([...values, { id: d.id, name: d.name, text: d.text, libraryFile: d.libraryFile, source: d.source }]);
    } else {
      onChange(values.filter(v => v.id !== id));
    }
  };

  const selectAll = async () => {
    const missing = docs.filter(d => !values.some(v => v.id === d.id));
    const loaded = (await Promise.all(missing.map(d => getSelectableDoc(d.id)))).filter(Boolean)
      .map(d => ({ id: d.id, name: d.name, text: d.text, libraryFile: d.libraryFile, source: d.source }));
    onChange([...values, ...loaded]);
  };
  const clearAll = () => onChange([]);
  const allSelected = docs.length > 0 && docs.every(d => values.some(v => v.id === d.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-semibold text-app-text">{label}</label>
        {docs.length > 0 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={selectAll} disabled={allSelected}
              className="text-[10px] font-semibold text-app-accent hover:text-app-accent disabled:opacity-40">Select all</button>
            <span className="text-app-faint">·</span>
            <button type="button" onClick={clearAll} disabled={!values.length}
              className="text-[10px] font-semibold text-app-muted hover:text-app-text disabled:opacity-40">Clear</button>
          </div>
        )}
      </div>
      {docs.length === 0 ? (
        <div className="text-[11px] text-app-muted px-3 py-2 rounded-lg bg-app-surface-soft border border-app-border">
          No documents available — upload one on the <span className="text-app-accent">Documents</span> page.
        </div>
      ) : (
        <div className="max-h-44 overflow-y-auto rounded-lg bg-app-surface-soft border border-app-border divide-y divide-app-border-soft">
          {docs.map(d => {
            const on = values.some(v => v.id === d.id);
            return (
              <label key={d.id} className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-app-text cursor-pointer hover:bg-app-accent-bg">
                <input type="checkbox" checked={on} onChange={e => toggle(d.id, e.target.checked)} className="" />
                <span className="truncate flex-1">{d.name}</span>
                <span className="text-[10px] text-app-muted shrink-0">{d.type}{d.source === 'library' ? ' · lib' : ''}</span>
              </label>
            );
          })}
        </div>
      )}
      {values.length > 0 && <div className="text-[10px] text-app-success">✓ {values.length} selected</div>}
    </div>
  );
}

/* ─── Tabular helpers: copy-paste into Excel (TSV) & editable column lists ─── */
export function rowsToTSV(columns, rows) {
  const clean = v => String(v ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim();
  const head = columns.join('\t');
  const body = (rows || []).map(r => columns.map(c => clean(r[c])).join('\t')).join('\n');
  return body ? `${head}\n${body}` : head;
}

// Copies the table as tab-separated text so it pastes straight into Excel/Sheets
// and autofills across cells (the Gemini/ChatGPT "copy table" behaviour).
export function CopyExcelButton({ columns, rows, label = 'Copy for Excel' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rowsToTSV(columns, rows));
      setDone(true); setTimeout(() => setDone(false), 1500);
    } catch (_) { /* clipboard blocked */ }
  };
  return (
    <button onClick={copy} type="button" className="app-control-btn btn-sm">
      {done ? <><Check size={13} /> Copied</> : <><Copy size={13} /> {label}</>}
    </button>
  );
}

// Editable list of output columns — lets the user adjust the table format BEFORE
// running extraction. Backed by a plain string[] so the result table reuses it.
export function EditableColumns({ columns = [], onChange, label = 'Output columns (edit before extracting)' }) {
  const setAt = (i, v) => { const c = [...columns]; c[i] = v; onChange(c); };
  const add   = () => onChange([...columns, '']);
  const del   = (i) => onChange(columns.filter((_, j) => j !== i));
  return (
    <div className="space-y-1">
      {label && <label className="text-[11px] font-semibold text-app-text">{label}</label>}
      <div className="flex flex-wrap gap-1.5">
        {columns.map((c, i) => (
          <span key={i} className="flex items-center rounded-lg bg-app-surface-soft border border-app-border pl-2">
            <input value={c} onChange={e => setAt(i, e.target.value)} placeholder="column"
              className="bg-transparent text-[11px] text-app-text py-1 w-32 outline-none" />
            <button type="button" onClick={() => del(i)} className="px-1.5 text-app-muted hover:text-app-danger">×</button>
          </span>
        ))}
        <button type="button" onClick={add}
          className="px-2.5 py-1 rounded-lg border border-dashed border-app-border text-[11px] text-app-muted hover:text-app-accent hover:border-app-accent-border">+ Add column</button>
      </div>
    </div>
  );
}

/* ─── Markdown-table parsing + rich text (renders | a | b | tables) ────────── */
function splitCells(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(s => s.trim());
}
function parseMarkdownTable(lines) {
  if (lines.length < 2) return null;
  if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[1]) || !lines[1].includes('-')) return null;
  const cols = splitCells(lines[0]);
  const rows = lines.slice(2).map(l => { const cs = splitCells(l); const o = {}; cols.forEach((c, i) => { o[c] = cs[i] ?? ''; }); return o; });
  return { columns: cols, rows };
}
// Render assistant text, turning contiguous "| … |" blocks into HTML tables with
// a Copy-for-Excel button. Falls back to the lightweight inline markdown styling.
export function RichText({ text }) {
  const lines = (text || '').split('\n');
  const blocks = [];
  let buf = [];
  const flush = () => { if (buf.length) { blocks.push({ type: 'text', lines: buf }); buf = []; } };
  for (let i = 0; i < lines.length; i++) {
    const isTableLine = /\|.*\|/.test(lines[i]);
    if (isTableLine) {
      const tbl = [];
      while (i < lines.length && /\|/.test(lines[i]) && lines[i].trim()) { tbl.push(lines[i]); i++; }
      i--;
      const parsed = parseMarkdownTable(tbl);
      if (parsed && parsed.columns.length) { flush(); blocks.push({ type: 'table', ...parsed }); }
      else buf.push(...tbl);
    } else buf.push(lines[i]);
  }
  flush();
  return (
    <div className="text-[12px] leading-relaxed text-app-text space-y-2">
      {blocks.map((b, bi) => b.type === 'table'
        ? (
          <div key={bi} className="space-y-1">
            <div className="table-wrap tall">
              <table className="app-table compact">
                <thead>
                  <tr>{b.columns.map((c, j) => <th key={j}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {b.rows.map((r, ri) => <tr key={ri}>{b.columns.map((c, ci) => <td key={ci} className="whitespace-pre-wrap break-words">{r[c]}</td>)}</tr>)}
                </tbody>
              </table>
            </div>
            <CopyExcelButton columns={b.columns} rows={b.rows} />
          </div>
        )
        : (
          <div key={bi} className="space-y-1">
            {b.lines.map((line, i) => {
              if (!line.trim()) return null;
              if (/^#{1,3}\s/.test(line)) return <p key={i} className="font-bold text-app-text">{line.replace(/^#{1,3}\s/, '')}</p>;
              if (/^\s*[-*•]\s/.test(line)) return <p key={i} className="pl-3">· {line.replace(/^\s*[-*•]\s/, '')}</p>;
              const parts = line.split(/(\*\*[^*]+\*\*)/g);
              return <p key={i}>{parts.map((p, j) => p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} className="text-app-text font-semibold">{p.slice(2, -2)}</strong> : p)}</p>;
            })}
          </div>
        ))}
    </div>
  );
}

/* ─── Result table: Download opens the Document Studio (spec 9) ────────────── */
export function ResultTable({ columns, rows, title, sheetName = 'Sheet1', extraSheets = [], note, editable = false, onRowsChange, onColumnsChange }) {
  const editCell = (ri, col, v) => { if (!onRowsChange) return; const next = rows.map((r, i) => i === ri ? { ...r, [col]: v } : r); onRowsChange(next); };
  const addRow   = () => { if (!onRowsChange) return; const blank = {}; columns.forEach(c => { blank[c] = ''; }); onRowsChange([...rows, blank]); };
  const delRow   = (ri) => { if (!onRowsChange) return; onRowsChange(rows.filter((_, i) => i !== ri)); };
  const renameCol = (idx, name) => { if (!onColumnsChange) return; const next = [...columns]; next[idx] = name; onColumnsChange(next); };

  const download = () => openStudio({
    title: title || sheetName,
    subtitle: `${rows.length} row${rows.length === 1 ? '' : 's'}`,
    sections: [
      { type: 'table', title: title || sheetName, columns, rows },
      ...extraSheets.filter(s => s?.columns?.length).map(s => ({ type: 'table', title: s.title || s.name, columns: s.columns, rows: s.rows || [] })),
    ],
  });

  if (!columns?.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] text-app-muted">{title} <span className="text-app-faint">· {rows.length} row{rows.length === 1 ? '' : 's'}</span></div>
        <div className="panel-actions">
          <CopyExcelButton columns={columns} rows={rows} />
          <button type="button" onClick={download} disabled={!rows.length} className="app-control-btn btn-sm" aria-label={`Download ${title || 'table'}`}>
            <Download size={13} /> Download
          </button>
        </div>
      </div>
      <div className="table-wrap rounded-lg border border-app-border" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        <table className="app-table compact">
          <thead>
            <tr>
              {columns.map((c, ci) => (
                <th key={ci}>
                  {editable && onColumnsChange
                    ? <input value={c} onChange={e => renameCol(ci, e.target.value)} aria-label="Column name" className="bg-transparent text-app-muted uppercase outline-none w-28" />
                    : c}
                </th>
              ))}
              {editable && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + (editable ? 1 : 0)}><div className="app-empty"><div className="app-empty-title">No rows</div><div className="app-empty-text">Nothing matched this request. Adjust the prompt or the selected documents and run it again.</div></div></td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                {columns.map(c => (
                  <td key={c}>
                    {editable
                      ? <textarea value={r[c] ?? ''} onChange={e => editCell(i, c, e.target.value)} rows={1} aria-label={c} className="app-textarea" style={{ minHeight: 30, minWidth: '7rem' }} />
                      : (PILL_COLS.test(c) && String(r[c] ?? '').trim() && String(r[c]).length < 24
                        ? <Pill value={String(r[c])}>{String(r[c])}</Pill>
                        : <span className="whitespace-pre-wrap break-words">{r[c] ?? ''}</span>)}
                  </td>
                ))}
                {editable && (
                  <td className="text-center">
                    <button type="button" onClick={() => delRow(i)} className="text-app-muted hover:text-app-danger" aria-label="Delete row">×</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <button type="button" onClick={addRow} className="app-ghost-btn btn-sm">+ Add row</button>
      )}
      {note && <div className="text-[10px] text-app-muted">{note}</div>}
    </div>
  );
}

/* Text input + textarea helpers */
export function Field({ label, value, onChange, placeholder, textarea, rows = 3 }) {
  return (
    <div className="space-y-1">
      {label && <label className="text-[11px] font-semibold text-app-text">{label}</label>}
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
          className="w-full px-3 py-2 rounded-lg bg-app-surface-soft border border-app-border text-[11px] text-app-text placeholder-app-faint resize-y" />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg bg-app-surface-soft border border-app-border text-[11px] text-app-text placeholder-app-faint" />
      )}
    </div>
  );
}

/* ─── Continuous-learning feedback bar (shown under every AI output) ───────── */
export function FeedbackBar({ module, subject = '' }) {
  // MVP item 16: Satisfied / Partially Satisfied / Not Satisfied + comments.
  const [state, setState]     = useState('idle');   // idle | remarks | sent
  const [rating, setRating]   = useState(null);     // satisfied | partially_satisfied | not_satisfied
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy]       = useState(false);

  const submit = async (r, note = '') => {
    setBusy(true);
    try { await sendFeedback({ module, rating: r, remarks: note, subject }); } catch (_) {}
    setBusy(false); setState('sent');
  };

  const pick = (r) => {
    setRating(r);
    if (r === 'satisfied') submit('satisfied');     // no comment needed for full satisfaction
    else setState('remarks');                       // ask for comments on partial / not satisfied
  };

  const RATING_LABEL = { partially_satisfied: 'Partially Satisfied', not_satisfied: 'Not Satisfied' };

  if (state === 'sent') {
    return <div className="text-[10px] text-app-success flex items-center gap-1.5 pt-1">✓ Thank you — feedback recorded; it will guide future results in this module.</div>;
  }

  return (
    <div className="pt-2 mt-1 border-t border-app-border space-y-2">
      {state === 'idle' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-app-muted uppercase tracking-widest font-bold">Rate this output</span>
          <button onClick={() => pick('satisfied')} disabled={busy}
            className="app-control-btn btn-sm">
            <Smile size={13} /> Satisfied
          </button>
          <button onClick={() => pick('partially_satisfied')} disabled={busy}
            className="app-control-btn btn-sm">
            <Meh size={13} /> Partially Satisfied
          </button>
          <button onClick={() => pick('not_satisfied')} disabled={busy}
            className="app-control-btn btn-sm">
            <Frown size={13} /> Not Satisfied
          </button>
        </div>
      )}
      {state === 'remarks' && (
        <div className="space-y-2">
          <div className="text-[10px] text-app-muted">Selected: <span className="font-semibold text-app-text">{RATING_LABEL[rating]}</span> — add a comment, suggestion or correction (used to improve future results).</div>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
            placeholder="What was wrong or what should change? (optional)"
            className="w-full px-3 py-2 rounded-lg bg-app-surface-soft border border-app-border text-[11px] text-app-text placeholder-app-faint resize-y" />
          <div className="flex items-center gap-2">
            <button onClick={() => submit(rating, remarks)} disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-app-accent-bg text-app-accent border border-app-accent-border text-[10px] font-semibold hover:bg-app-accent-bg disabled:opacity-40 flex items-center gap-1.5">
              {busy ? <Spinner /> : null} Submit feedback
            </button>
            <button onClick={() => { setState('idle'); setRemarks(''); }} className="px-3 py-1.5 rounded-lg text-[10px] text-app-muted hover:text-app-text">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Per-module chat assistant (prompt-driven, document-aware) ────────────── */
export function ModuleChat({ module, title = 'Ask the Assistant', docText, docName, suggestions = [], placeholder }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [busy, setBusy]         = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    const history = [...messages, { role: 'user', content: q }];
    setMessages(history);
    setBusy(true);
    try {
      const resp = await chat(history.map(m => ({ role: m.role, content: m.content })), undefined, docText, docName, title || module);
      setMessages(h => [...h, { role: 'assistant', content: resp.content, citations: resp.citations || [] }]);
    } catch (e) {
      setMessages(h => [...h, { role: 'assistant', content: e.message, error: true }]);
    }
    setBusy(false);
  };

  return (
    <Card title={title} desc={docName ? `Context: ${docName}` : 'Ask anything in the context of this module — grounded in the knowledge base.'}>
      {suggestions.length > 0 && messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => send(s)} disabled={busy}
              className="text-left text-[10px] px-2.5 py-1.5 rounded-lg bg-app-surface-soft border border-app-border hover:bg-app-accent-bg hover:border-app-accent-border text-app-text disabled:opacity-40">
              {s}
            </button>
          ))}
        </div>
      )}
      {messages.length > 0 && (
        <div className="max-h-72 overflow-y-auto space-y-3 rounded-lg bg-app-surface-soft border border-app-border p-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${m.role === 'user' ? 'bg-app-surface-raised text-app-text' : 'bg-app-btn text-app-btn-text'}`}>{m.role === 'user' ? 'U' : 'AI'}</div>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 ${m.role === 'user' ? 'bg-app-surface-raised' : m.error ? 'bg-app-danger-bg border border-app-danger-border' : 'bg-app-panel border border-app-border'}`}>
                <RichText text={m.content} />
                {m.citations?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.citations.map((c, j) => <span key={j} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-app-violet-bg text-app-advisory-soft border border-app-advisory-border">{c}</span>)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-[10px] text-app-muted flex items-center gap-1.5"><Spinner /> Thinking…</div>}
          <div ref={endRef} />
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder={placeholder || 'Ask a question about this module…'}
          className="flex-1 px-3 py-2 rounded-lg bg-app-surface-soft border border-app-border text-[12px] text-app-text placeholder-app-faint resize-none max-h-28"
        />
        <button onClick={() => send()} disabled={busy || !input.trim()}
          className="px-3 py-2 rounded-lg bg-app-btn text-app-btn-text text-[11px] font-semibold disabled:opacity-40 hover:opacity-90">Send</button>
      </div>
    </Card>
  );
}

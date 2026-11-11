import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Check, Download, FileText, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { downloadCsv, downloadOds, downloadWord, downloadXlsx, logExport } from '../../services/featureApi';
import { toast } from '../ui/Overlays';

/* Document Studio (spec §9): every table and chart download is viewed, edited, then saved.

   openStudio({
     title, subtitle,
     sections: [
       { type: 'kpis',  title, items: [{ label, value }] },
       { type: 'chart', title, data:  [{ label, value }] },
       { type: 'table', title, columns, rows },
       { type: 'text',  title, body },
     ],
   })
*/

const PRODUCT = 'Design Validator';
const PAGE_W = 794;
const PAGE_H = 1123;
const MAIN_H = PAGE_H - 118 - 60;   // .doc-main top and bottom insets
const SEC_GAP = 18;

const FORMATS = {
  PDF:   { desc: 'Branded A4, exactly as previewed.', sheets: false },
  Excel: { desc: 'One sheet per table, chart and summary.', sheets: true },
  CSV:   { desc: 'The sheet on screen, UTF-8 with BOM.', sheets: true },
  PNG:   { desc: 'Each page as an image at 2× resolution.', sheets: false },
  Word:  { desc: 'The first table as an editable Word document.', sheets: true },
  ODS:   { desc: 'OpenDocument workbook, one sheet per table.', sheets: true },
};

let openFn = null;
let returnFocus = null;
let seq = 1;

export function openStudio(spec) {
  returnFocus = document.activeElement;
  openFn?.(spec);
}

const slug = (s) => String(s || 'export').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'export';
const today = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const isoDate = () => new Date().toISOString().slice(0, 10);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 30)));

function currentUserName() {
  try { return JSON.parse(localStorage.getItem('auth_user'))?.fullName || ''; } catch { return ''; }
}

function normalize(spec) {
  return {
    title: spec.title || 'Export',
    subtitle: spec.subtitle || '',
    preparedFor: '',
    preparedBy: currentUserName(),
    classification: 'Internal',
    date: today(),
    notes: '',
    sections: (spec.sections || []).filter(Boolean).map((s) => ({
      ...s,
      id: seq++,
      on: true,
      rows: s.rows ? s.rows.map((r) => ({ ...r })) : undefined,
      columns: s.columns ? [...s.columns] : undefined,
      items: s.items ? s.items.map((i) => ({ ...i })) : undefined,
      data: s.data ? s.data.map((d) => ({ ...d })) : undefined,
    })),
  };
}

/* Column widths follow content length, and stay identical from page to page. */
function columnWidths(section) {
  const weights = section.columns.map((c) => {
    const lengths = section.rows.slice(0, 200).map((r) => String(r[c] ?? '').length);
    const avg = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
    return Math.min(46, Math.max(String(c).length * 0.8, avg, 5)) + 5;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => `${(w / total) * 100}%`);
}

function sheetsOf(doc) {
  const used = new Set();
  const name = (raw) => {
    let base = String(raw || 'Sheet').replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 28) || 'Sheet';
    let n = base; let i = 2;
    while (used.has(n)) n = `${base} ${i++}`;
    used.add(n);
    return n;
  };
  const sheets = [];
  doc.sections.filter((s) => s.on).forEach((s) => {
    if (s.type === 'table') sheets.push({ name: name(s.title), title: s.title, columns: s.columns, rows: s.rows, section: s });
    if (s.type === 'kpis') sheets.push({ name: name(s.title), title: s.title, columns: ['Measure', 'Value'], rows: s.items.map((i) => ({ Measure: i.label, Value: i.value })), section: s });
    if (s.type === 'chart') sheets.push({ name: name(s.title), title: s.title, columns: ['Category', 'Value'], rows: s.data.map((d) => ({ Category: d.label, Value: d.value })), section: s });
  });
  return sheets;
}

function Editable({ value, onChange, as: Tag = 'span', className }) {
  return (
    <Tag
      className={className}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={(e) => { const v = e.currentTarget.textContent; if (v !== String(value ?? '')) onChange(v); }}
    >{value}</Tag>
  );
}

function TitleBlock({ doc, set }) {
  return (
    <div className="doc-titleblock" data-m="title">
      <div className="doc-eyebrow">{PRODUCT}</div>
      <Editable as="div" className="doc-title" value={doc.title} onChange={(v) => set({ title: v })} />
      <Editable as="div" className="doc-subtitle" value={doc.subtitle} onChange={(v) => set({ subtitle: v })} />
      <div className="doc-meta">
        <div><span>Date</span>{doc.date}</div>
        <div><span>Prepared for</span>{doc.preparedFor || '—'}</div>
        <div><span>Prepared by</span>{doc.preparedBy || '—'}</div>
        <div><span>Classification</span>{doc.classification}</div>
      </div>
    </div>
  );
}

function SectionBody({ s, slice, patch }) {
  const continued = slice?.cont ? ' (continued)' : '';
  const heading = (
    <h2 className="doc-h2">
      <Editable value={s.title} onChange={(v) => patch(s.id, { title: v })} />{continued}
    </h2>
  );

  if (s.type === 'kpis') {
    return (
      <div className="doc-sec" data-sec={s.id}>
        {heading}
        <div className="doc-kpis">
          {s.items.map((it, i) => (
            <div className="doc-kpi" key={i}>
              <Editable as="div" className="v" value={it.value} onChange={(v) => patch(s.id, { items: s.items.map((x, j) => (j === i ? { ...x, value: v } : x)) })} />
              <Editable as="div" className="l" value={it.label} onChange={(v) => patch(s.id, { items: s.items.map((x, j) => (j === i ? { ...x, label: v } : x)) })} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (s.type === 'chart') {
    const max = Math.max(...s.data.map((d) => Number(d.value) || 0), 1);
    return (
      <div className="doc-sec" data-sec={s.id}>
        {heading}
        {s.data.map((d, i) => (
          <div className="doc-bar" key={i}>
            <span className="l">{d.label}</span>
            <span className="t"><span className="f" style={{ width: `${((Number(d.value) || 0) / max) * 100}%` }} /></span>
            <span className="v">{d.value}</span>
          </div>
        ))}
      </div>
    );
  }

  if (s.type === 'text') {
    return (
      <div className="doc-sec" data-sec={s.id}>
        {heading}
        <Editable as="p" className="doc-p" value={s.body} onChange={(v) => patch(s.id, { body: v })} />
      </div>
    );
  }

  const from = slice?.from ?? 0;
  const to = slice?.to ?? s.rows.length;
  const widths = columnWidths(s);
  const editCell = (rowIndex, col, v) => patch(s.id, { rows: s.rows.map((r, i) => (i === rowIndex ? { ...r, [col]: v } : r)) });
  const editHead = (ci, v) => {
    const old = s.columns[ci];
    patch(s.id, {
      columns: s.columns.map((c, i) => (i === ci ? v : c)),
      rows: s.rows.map((r) => { const { [old]: value, ...rest } = r; return { ...rest, [v]: value }; }),
    });
  };
  return (
    <div className="doc-sec" data-sec={s.id}>
      {heading}
      <table className={`doc-table ${s.columns.length > 6 ? 'is-dense' : ''}`}>
        <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
        <thead><tr>{s.columns.map((c, ci) => <th key={ci}><Editable value={c} onChange={(v) => editHead(ci, v)} /></th>)}</tr></thead>
        <tbody>
          {s.rows.slice(from, to).map((r, i) => (
            <tr key={from + i}>
              {s.columns.map((c) => <td key={c}><Editable value={r[c] ?? ''} onChange={(v) => editCell(from + i, c, v)} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocPage({ doc, set, patch, entries, index, total }) {
  const byId = (id) => doc.renderSections.find((s) => s.id === id);
  return (
    <div className="doc-page">
      <div className="doc-head">
        <img src="/astrikos-mark.png" alt="Astrikos" className="doc-mark" />
        <div>
          <div className="doc-brand">ASTRIKOS</div>
          <div className="doc-brand-sub">AI Private Limited</div>
        </div>
      </div>
      <div className="doc-rule" />
      <div className="doc-main">
        {index === 0 && <TitleBlock doc={doc} set={set} />}
        {entries.map((e, i) => { const s = byId(e.id); return s ? <SectionBody key={`${e.id}-${i}`} s={s} slice={e} patch={patch} /> : null; })}
      </div>
      <div className="doc-foot">
        <span>{PRODUCT} · {doc.title}</span>
        <span>www.astrikos.ai · contact@astrikos.ai</span>
        <span>Page {index + 1} of {total}</span>
      </div>
    </div>
  );
}

function Studio({ initial, onClose }) {
  const [doc, setDoc] = useState(() => normalize(initial));
  const [format, setFormat] = useState('PDF');
  const [view, setView] = useState('pages');
  const [sheetIdx, setSheetIdx] = useState(0);
  const [pages, setPages] = useState([[]]);
  const [scale, setScale] = useState(0.7);
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [fontsTick, setFontsTick] = useState(0);
  const measureRef = useRef(null);
  const previewRef = useRef(null);
  const captureRef = useRef(null);
  const rootRef = useRef(null);

  const set = useCallback((p) => setDoc((d) => ({ ...d, ...p })), []);
  const patch = useCallback((id, p) => setDoc((d) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...p } : s)) })), []);

  /* Analyst notes print as a text section at the end. */
  const renderDoc = useMemo(() => {
    const active = doc.sections.filter((s) => s.on);
    const notes = doc.notes.trim() ? [{ id: -1, type: 'text', title: 'Analyst notes', body: doc.notes.trim(), on: true }] : [];
    return { ...doc, renderSections: [...active, ...notes] };
  }, [doc]);

  useEffect(() => { document.fonts?.ready.then(() => setFontsTick((n) => n + 1)); }, []);

  /* Flow sections onto A4 pages using real measured heights. */
  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const out = [];
    let page = [];
    let used = (root.querySelector('[data-m="title"]')?.offsetHeight || 0) + SEC_GAP;
    const newPage = () => { out.push(page); page = []; used = 0; };

    renderDoc.renderSections.forEach((s) => {
      const el = root.querySelector(`[data-sec="${s.id}"]`);
      if (!el) return;
      if (s.type !== 'table') {
        const h = el.offsetHeight + SEC_GAP;
        if (used > 0 && used + h > MAIN_H) newPage();
        page.push({ id: s.id });
        used += h;
        return;
      }
      const headH = (el.querySelector('.doc-h2')?.offsetHeight || 0) + 8 + (el.querySelector('thead')?.offsetHeight || 26);
      const rowH = [...el.querySelectorAll('tbody tr')].map((r) => r.offsetHeight);
      let i = 0;
      let cont = false;
      do {
        if (used > 0 && used + headH + (rowH[i] || 0) + SEC_GAP > MAIN_H) newPage();
        let room = MAIN_H - used - headH - SEC_GAP;
        const from = i;
        while (i < rowH.length && rowH[i] <= room) { room -= rowH[i]; i += 1; }
        if (i === from && i < rowH.length) i += 1;       // one row taller than a whole page
        page.push({ id: s.id, from, to: i, cont });
        used = MAIN_H - room;
        if (i < rowH.length) { newPage(); cont = true; }
      } while (i < rowH.length);
    });
    out.push(page);
    setPages(out);
  }, [renderDoc, fontsTick]);

  /* Scale pages to the preview width. */
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 48) / PAGE_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Esc closes, Tab stays inside. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !rootRef.current) return;
      const items = [...rootRef.current.querySelectorAll('button:not(:disabled),input,textarea,select,[contenteditable]')].filter((x) => x.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector('.icon-btn')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sheets = useMemo(() => sheetsOf(doc), [doc]);
  const sheet = sheets[Math.min(sheetIdx, sheets.length - 1)];

  const pickFormat = (f) => { setFormat(f); setView(FORMATS[f].sheets ? 'sheets' : 'pages'); };
  const move = (idx, dir) => setDoc((d) => {
    const list = [...d.sections];
    [list[idx], list[idx + dir]] = [list[idx + dir], list[idx]];
    return { ...d, sections: list };
  });

  const baseName = `${slug(PRODUCT).replace('design-validator', 'Design-Validator')}_${slug(doc.title)}`;

  const capturePages = async () => {
    const { default: html2canvas } = await import('html2canvas');
    setCapturing(true);
    await nextFrame(); await nextFrame();
    try {
      const canvases = [];
      for (const el of captureRef.current.querySelectorAll('.doc-page')) {
        // eslint-disable-next-line no-await-in-loop
        canvases.push(await html2canvas(el, { scale: 2, backgroundColor: '#F7F7FA', useCORS: true, logging: false, width: PAGE_W, height: PAGE_H }));
      }
      return canvases;
    } finally { setCapturing(false); }
  };

  const saveBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const runDownload = async () => {
    setBusy(true);
    const date = isoDate();
    try {
      let filename = `${baseName}_${date}`;
      const payloadSheets = sheets.map(({ name, title, columns, rows }) => ({ name, title, columns, rows }));
      if (format === 'PDF') {
        const { jsPDF } = await import('jspdf');
        const canvases = await capturePages();
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        pdf.setProperties({ title: doc.title, subject: doc.subtitle || PRODUCT, author: 'Astrikos' });
        canvases.forEach((c, i) => { if (i) pdf.addPage(); pdf.addImage(c.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, 210, 297); });
        filename += '.pdf';
        pdf.save(filename);
        logExport({ format, filename }).catch(() => {});
      } else if (format === 'PNG') {
        const canvases = await capturePages();
        for (let i = 0; i < canvases.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          const blob = await new Promise((r) => canvases[i].toBlob(r, 'image/png'));
          saveBlob(blob, `${baseName}${canvases.length > 1 ? `_p${i + 1}` : ''}_${date}.png`);
          // eslint-disable-next-line no-await-in-loop
          if (canvases.length > 1) await new Promise((r) => setTimeout(r, 350));
        }
        filename += '.png';
        logExport({ format, filename }).catch(() => {});
      } else if (format === 'Excel') {
        await downloadXlsx(payloadSheets, filename); filename += '.xlsx';
      } else if (format === 'ODS') {
        await downloadOds(payloadSheets, filename); filename += '.ods';
      } else if (format === 'CSV') {
        filename = `${baseName}_${slug(sheet.name)}_${date}`;
        await downloadCsv({ columns: sheet.columns, rows: sheet.rows, filename }); filename += '.csv';
      } else {
        const first = sheets.find((s) => s.section.type === 'table') || sheets[0];
        await downloadWord({ title: doc.title, subtitle: doc.subtitle, columns: first.columns, rows: first.rows, filename }); filename += '.doc';
      }
      toast({ title: 'Downloaded', body: filename });
    } catch (e) {
      toast({ tone: 'danger', title: 'Download failed', body: e.message || 'The file could not be prepared. Please try again.' });
    }
    setBusy(false);
  };

  const needsSheet = format !== 'PDF' && format !== 'PNG';
  const canDownload = !busy && (!needsSheet || sheets.length > 0) && renderDoc.renderSections.length > 0;

  return createPortal(
    <>
      <div className="app-studio-catcher" />
      <div className="app-studio" role="dialog" aria-modal="true" aria-labelledby="studio-title" ref={rootRef}>
        <div className="studio-bar">
          <div className="studio-file-tile"><FileText size={16} strokeWidth={1.75} /></div>
          <div>
            <div className="studio-title" id="studio-title">Document studio</div>
            <div className="studio-sub">Branded to the Astrikos letter guide · {pages.length} page{pages.length === 1 ? '' : 's'} · {sheets.length} data sheet{sheets.length === 1 ? '' : 's'}</div>
          </div>
          <div className="studio-steps">
            <span className="on"><Check size={12} /> 1 · View</span><i className="sep" />
            <span className="on"><Pencil size={12} /> 2 · Edit</span><i className="sep" />
            <span className={busy ? 'on' : ''}><Download size={12} /> 3 · Download</span>
          </div>
          <div className="studio-spacer" />
          <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Close document studio"><X size={14} /></button>
        </div>

        <div className="studio-body">
          <div className="studio-preview" ref={previewRef}>
            <div className="studio-toolbar">
              <div className="app-timeframe-control" role="tablist" aria-label="Preview">
                {[['pages', 'Pages'], ['sheets', 'Sheets']].map(([k, label]) => (
                  <button key={k} type="button" role="tab" aria-selected={view === k} className={`app-timeframe-btn ${view === k ? 'is-active' : ''}`} onClick={() => setView(k)}>{label}</button>
                ))}
              </div>
              <div className="studio-hint"><Pencil size={12} /> Click any heading, figure or table cell to edit it.</div>
            </div>

            {view === 'pages' && pages.map((entries, i) => (
              <div className="doc-page-wrap" key={i} style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PAGE_W, height: PAGE_H }}>
                  <DocPage doc={renderDoc} set={set} patch={patch} entries={entries} index={i} total={pages.length} />
                </div>
              </div>
            ))}

            {view === 'sheets' && (sheet ? (
              <div className="sheet-view">
                <div className="sheet-grid">
                  <table className="sheet-table">
                    <thead><tr>{sheet.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {sheet.rows.map((r, ri) => (
                        <tr key={ri}>
                          {sheet.columns.map((c) => (
                            <td key={c}>
                              {sheet.section.type === 'table'
                                ? <Editable value={r[c] ?? ''} onChange={(v) => patch(sheet.section.id, { rows: sheet.section.rows.map((x, i) => (i === ri ? { ...x, [c]: v } : x)) })} />
                                : r[c]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="sheet-tabs">
                  {sheets.map((s, i) => <button key={s.name} type="button" className={`sheet-tab ${s === sheet ? 'on' : ''}`} onClick={() => setSheetIdx(i)}>{s.name}</button>)}
                </div>
              </div>
            ) : (
              <div className="app-empty"><div className="app-empty-title">No data sheets</div><div className="app-empty-text">Switch on a table or summary section to see its sheet.</div></div>
            ))}
          </div>

          <div className="studio-side">
            <div className="flex items-center justify-between">
              <div className="studio-section-label" style={{ marginTop: 0 }}>Document</div>
              <button type="button" className="app-ghost-btn btn-sm" onClick={() => setDoc(normalize(initial))}><RotateCcw size={12} /> Reset edits</button>
            </div>
            {[['title', 'Title'], ['subtitle', 'Subtitle'], ['preparedFor', 'Prepared for'], ['preparedBy', 'Prepared by'], ['classification', 'Classification'], ['date', 'Date']].map(([k, label]) => (
              <label className="studio-field" key={k}>
                <span className="app-label">{label}</span>
                <input className="app-input" value={doc[k]} onChange={(e) => set({ [k]: e.target.value })} />
              </label>
            ))}

            <div className="studio-section-label">Sections</div>
            {doc.sections.map((s, i) => (
              <div className="studio-sec-row" key={s.id}>
                <input type="checkbox" checked={s.on} onChange={(e) => patch(s.id, { on: e.target.checked })} aria-label={`Include ${s.title}`} />
                <input className="studio-sec-name as-input" value={s.title} onChange={(e) => patch(s.id, { title: e.target.value })} aria-label="Section name" />
                <button type="button" className="studio-sec-mini" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${s.title} up`}><ArrowUp size={12} /></button>
                <button type="button" className="studio-sec-mini" disabled={i === doc.sections.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${s.title} down`}><ArrowDown size={12} /></button>
              </div>
            ))}
            <button type="button" className="app-control-btn btn-sm" onClick={() => setDoc((d) => ({ ...d, sections: [...d.sections, { id: seq++, type: 'text', title: 'New section', body: 'Click here to write.', on: true }] }))}>
              <Plus size={12} /> Add text section
            </button>

            <label className="studio-field">
              <span className="app-label">Analyst notes</span>
              <textarea className="app-textarea" value={doc.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Printed as a section at the end of the document." />
            </label>

            <div className="studio-section-label">Format</div>
            <div className="app-timeframe-control" role="tablist" aria-label="Download format" style={{ flexWrap: 'wrap' }}>
              {Object.keys(FORMATS).map((f) => (
                <button key={f} type="button" role="tab" aria-selected={format === f} className={`app-timeframe-btn ${format === f ? 'is-active' : ''}`} onClick={() => pickFormat(f)}>{f}</button>
              ))}
            </div>
            <div className="studio-note">{FORMATS[format].desc}</div>
            <button type="button" className="app-primary-btn btn-lg btn-block" disabled={!canDownload} onClick={runDownload}>
              {busy ? <><span className="app-spinner" /> Preparing {format}…</> : <><Download size={15} /> Download {format}</>}
            </button>
            <div className="studio-note">Every download is recorded in the audit trail.</div>
          </div>
        </div>
      </div>

      {/* Natural-size copy used to measure heights */}
      <div className="doc-measure" aria-hidden="true" ref={measureRef}>
        <div className="doc-page" style={{ height: 'auto', overflow: 'visible' }}>
          <div style={{ width: PAGE_W - 112 }}>
            <TitleBlock doc={renderDoc} set={set} />
            {renderDoc.renderSections.map((s) => <SectionBody key={s.id} s={s} patch={patch} />)}
          </div>
        </div>
      </div>

      {capturing && (
        <div className="doc-capture" aria-hidden="true" ref={captureRef}>
          {pages.map((entries, i) => <DocPage key={i} doc={renderDoc} set={set} patch={patch} entries={entries} index={i} total={pages.length} />)}
        </div>
      )}
    </>,
    document.body,
  );
}

export function StudioHost() {
  const [spec, setSpec] = useState(null);
  useEffect(() => { openFn = setSpec; return () => { openFn = null; }; }, []);
  const close = useCallback(() => { setSpec(null); returnFocus?.focus?.(); }, []);
  return spec ? <Studio initial={spec} onClose={close} /> : null;
}

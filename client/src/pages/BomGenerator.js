import React, { useState, useRef } from 'react';
import { Page, Card, StatTile, RunButton, ErrorNote, ResultTable, MultiDocSource, EditableColumns, Field, Spinner, FeedbackBar, ModuleChat } from '../components/feature/FeatureKit';
import { bomGenerate, bomSotr, bomElaSize, downloadWord, downloadPdf, logInteraction } from '../services/featureApi';
import { saveArtifact } from '../services/docStore';

function SaveButton({ onClick, saved }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-success-bg text-app-success border border-app-success-border text-[11px] font-semibold hover:bg-app-success-bg">
      {saved ? '✓ Saved' : 'Save'}
    </button>
  );
}

const DEFAULT_COLS = ['Discipline', 'System', 'Equipment Name', 'OEM', 'Capacity', 'Unit', 'Quantity', 'Page Number', 'Reference'];

// ── Module switcher ──────────────────────────────────────────────────────────
function ModeToggle({ mode, setMode }) {
  const tabs = [
    { id: 'bom',  label: 'Bill of Materials',  desc: 'List every equipment / material item' },
    { id: 'sotr', label: 'Statement of Technical Requirements', desc: 'Draft formal technical requirements' },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {tabs.map(t => {
        const active = mode === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`text-left rounded-xl border px-4 py-3 transition-colors ${
              active
                ? 'bg-app-accent-bg border-app-accent-border'
                : 'bg-app-panel border-app-border hover:border-app-border'
            }`}
          >
            <div className={`text-sm font-bold ${active ? 'text-app-text' : 'text-app-text'}`}>{t.label}</div>
            <div className="text-[10px] text-app-muted mt-0.5">{t.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

// ── BOM module ───────────────────────────────────────────────────────────────
function BomModule() {
  const [sources, setSources] = useState([]);
  const [prompt, setPrompt]   = useState('Generate a system-wise and discipline-wise Bill of Materials for the vessel in the prescribed format. Group and order rows by Discipline (Electrical, Machinery, Hull, Outfit, Piping, HVAC…) and then by System. Where a quantity is not stated, estimate it by calculation and note the basis in the Reference (e.g. number of PA speakers from a compartment’s area, light fittings from deck area).');
  const [columns, setColumns] = useState(DEFAULT_COLS);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [bom, setBom]         = useState(null);
  const [saved, setSaved]     = useState(false);

  const elaFileRef = useRef(null);
  const [elaFile, setElaFile]         = useState(null);
  const [marginPct, setMarginPct]     = useState('');
  const [powerFactor, setPowerFactor] = useState('');

  const saveBom = () => {
    if (!bom?.rows?.length) return;
    saveArtifact('bom', { columns: bom.columns, rows: bom.rows }, { sources: bom.sources || [] });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const run = async () => {
    if (!sources.length && !elaFile) { setError('Select at least one source (RFP / Build Specification), or attach an ELA workbook for Generator/Transformer sizing.'); return; }
    setBusy(true); setError(null); setBom(null); setSaved(false);
    try {
      const cols = columns.map(s => s.trim()).filter(Boolean);
      const tasks = [];
      if (sources.length) {
        tasks.push(bomGenerate({ sources: sources.map(s => ({ name: s.name, text: s.text })), prompt, columns: cols })
          .then(r => ({ kind: 'main', r })).catch(e => ({ kind: 'main', err: e.message })));
      }
      if (elaFile) {
        tasks.push(bomElaSize({ file: elaFile, columns: cols, marginPct, powerFactor })
          .then(r => ({ kind: 'ela', r })).catch(e => ({ kind: 'ela', err: e.message })));
      }
      const settled = await Promise.all(tasks);
      const mainOut = settled.find(x => x.kind === 'main');
      const elaOut  = settled.find(x => x.kind === 'ela');

      const errs = [];
      if (mainOut?.err) errs.push(mainOut.err);
      if (elaOut?.err) errs.push(`ELA sizing: ${elaOut.err}`);

      const outColumns = mainOut?.r?.columns || ['S.No', ...cols];
      let rows = [...(mainOut?.r?.rows || []), ...(elaOut?.r?.rows || [])]
        .map((r, i) => ({ ...r, 'S.No': String(i + 1) }));

      if (mainOut?.r || elaOut?.r) {
        setBom({
          columns: outColumns, rows, rowCount: rows.length,
          sources: mainOut?.r?.sources || [],
          elaSummary: elaOut?.r?.summary, elaNotes: elaOut?.r?.notes, elaSource: elaOut?.r?.sourceName,
        });
        logInteraction({ module: 'BOM Generation', prompt, subject: [...sources.map(s => s.name), elaFile?.name].filter(Boolean).join(', '),
          response: `Generated Bill of Materials — ${rows.length} items, columns: ${outColumns.join(' | ')}.` }).catch(() => {});
      }
      if (errs.length) setError(errs.join(' — '));
      else if (!rows.length) setError('No BOM items were generated. Try different source documents or prompt.');
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <>
      <Card title="Sources & BOM Request" desc="Select the RFP, Build Specification and any GA/spec documents to build the BOM from.">
        <div className="grid md:grid-cols-2 gap-4">
          <MultiDocSource label="Source documents (RFP / Build Spec / GA / specs)" values={sources} onChange={(v) => { setSources(v); setBom(null); }} />
          <div className="space-y-3">
            <Field label="Prompt (customizable — include any estimation request)" value={prompt} onChange={setPrompt} textarea rows={4} />
            <EditableColumns columns={columns} onChange={setColumns} label="BOM columns (edit before generating)" />
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-app-border p-3 space-y-2">
          <div className="text-[11px] font-semibold text-app-text">Electrical Load Analysis workbook (optional) — AI estimates Generator &amp; Transformer capacity/quantity from it and adds them as BOM rows</div>
          <input ref={elaFileRef} type="file" accept=".xls,.xlsx,.xlsm" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) setElaFile(f); e.target.value = ''; }} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => elaFileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-app-border hover:border-app-accent-border text-[11px] text-app-muted hover:text-app-accent transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              {elaFile ? 'Change ELA workbook' : 'Upload ELA workbook (.xls / .xlsx)'}
            </button>
            {elaFile && (
              <span className="text-[10px] px-2 py-1 rounded bg-app-accent-bg text-app-accent border border-app-accent-border flex items-center gap-1">
                {elaFile.name}
                <button type="button" onClick={() => setElaFile(null)} className="text-app-accent hover:text-app-danger">×</button>
              </span>
            )}
          </div>
          {elaFile && (
            <div className="grid grid-cols-2 gap-2 max-w-xs">
              <Field label="Growth margin % (blank = auto from sheet / 10%)" value={marginPct} onChange={setMarginPct} placeholder="10" />
              <Field label="Power factor (blank = auto / 0.8)" value={powerFactor} onChange={setPowerFactor} placeholder="0.8" />
            </div>
          )}
        </div>

        <RunButton onClick={run} busy={busy} busyLabel="Generating BOM…">Generate BOM</RunButton>
        <ErrorNote>{error}</ErrorNote>
        {busy && <div className="text-[10px] text-app-muted flex items-center gap-1.5"><Spinner /> Reading the sources section-by-section{elaFile ? ' and sizing Generator/Transformer capacity from the ELA workbook' : ''}…</div>}
      </Card>

      {bom?.elaSummary && (
        <Card title="Electrical Load Analysis — computed load summary" desc={`From ${bom.elaSource || 'the uploaded workbook'}. All arithmetic below is computed deterministically from the sheet, not by the AI.`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <StatTile label="Main-bus worst case" value={`${bom.elaSummary.mainWorstCase.loadKva} kVA`} tone="emerald" />
            <StatTile label="Worst-case mode" value={bom.elaSummary.mainWorstCase.modeName} tone="sky" />
            <StatTile label="Emergency-bus worst case" value={`${bom.elaSummary.emergencyWorstCase.loadKva} kVA`} tone="amber" />
            <StatTile label="Margin / Power factor" value={`${bom.elaSummary.marginPct}% / ${bom.elaSummary.powerFactor}`} tone="violet" />
          </div>
          {bom.elaNotes?.length > 0 && (
            <div className="space-y-1">
              {bom.elaNotes.map((n, i) => (
                <div key={i} className="text-[10px] text-app-muted px-2 py-1 rounded bg-app-surface-soft border border-app-border">{n}</div>
              ))}
            </div>
          )}
        </Card>
      )}

      {bom && (
        <Card title="Bill of Materials" desc="Review and edit rows inline, then Save (the saved BOM is used by Ship Cost Estimation) or export." right={<SaveButton onClick={saveBom} saved={saved} />}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <StatTile label="BOM Items" value={bom.rowCount} tone="emerald" />
            <StatTile label="Columns" value={bom.columns?.length || 0} tone="sky" />
            <StatTile label="Sources" value={bom.sources?.length || 0} tone="violet" />
          </div>
          <ResultTable columns={bom.columns} rows={bom.rows} editable
            onRowsChange={(rows) => setBom(b => ({ ...b, rows, rowCount: rows.length }))}
            title="Bill of Materials" sheetName="BOM" downloadName="BOM" />
          <FeedbackBar module="bom" subject={`BOM (${bom.sources?.join(', ')})`} />
        </Card>
      )}
    </>
  );
}

// ── Tender-format renderer (parses the SOTR markdown → styled document) ─────────
// Same grammar the server/exports use: # / ## / ### headings, "- " bullets,
// | pipe | tables, and paragraphs. Keeps the on-screen preview identical to the
// Word/PDF/TXT output so what you see is what you download.
const _isRow = l => /^\s*\|.*\|\s*$/.test(l);
const _isSep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
const _strip = s => s.replace(/\*\*(.+?)\*\*/g, '$1');
const _splitRow = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => _strip(c).trim());

function parseSotrBlocks(md) {
  const lines = String(md || '').split(/\r?\n/);
  const blocks = [];
  let bullets = [];
  const flush = () => { if (bullets.length) { blocks.push({ t: 'ul', items: bullets }); bullets = []; } };
  for (let i = 0; i < lines.length; i++) {
    const line = _strip(lines[i]);
    if (_isRow(line) && i + 1 < lines.length && _isSep(lines[i + 1])) {
      flush();
      const cols = _splitRow(line); i += 2; const rows = [];
      while (i < lines.length && _isRow(lines[i]) && !_isSep(lines[i])) { rows.push(_splitRow(lines[i])); i++; }
      i--; blocks.push({ t: 'table', cols, rows }); continue;
    }
    if (/^###\s+/.test(line))            { flush(); blocks.push({ t: 'h3', text: line.replace(/^###\s+/, '') }); }
    else if (/^##\s+/.test(line))        { flush(); blocks.push({ t: 'h2', text: line.replace(/^##\s+/, '') }); }
    else if (/^#\s+/.test(line))         { flush(); blocks.push({ t: 'h1', text: line.replace(/^#\s+/, '') }); }
    else if (/^\s*[-*•]\s+/.test(line))  { bullets.push(line.replace(/^\s*[-*•]\s+/, '')); }
    else if (line.trim() === '')         { flush(); }
    else                                 { flush(); blocks.push({ t: 'p', text: line }); }
  }
  flush();
  return blocks;
}

function SotrDocView({ content }) {
  const blocks = parseSotrBlocks(content);
  return (
    <div className="rounded-lg bg-astrikos-paper text-astrikos-carbon border border-app-border p-5 md:p-8 max-h-[62vh] overflow-y-auto space-y-2 shadow-inner">
      {blocks.map((b, i) => {
        if (b.t === 'h1') return <h1 key={i} className="text-center text-lg md:text-xl font-bold text-astrikos-ink border-b-2 border-astrikos-ink pb-2 mb-3 uppercase tracking-tight">{b.text}</h1>;
        if (b.t === 'h2') return <h2 key={i} className="text-sm md:text-base font-bold text-astrikos-ink mt-5 mb-1.5 border-b border-astrikos-mist pb-1">{b.text}</h2>;
        if (b.t === 'h3') return <h3 key={i} className="text-[13px] font-semibold text-astrikos-ink mt-3 mb-1">{b.text}</h3>;
        if (b.t === 'ul') return <ul key={i} className="list-disc pl-6 text-[12px] leading-relaxed space-y-0.5">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
        if (b.t === 'p')  return <p key={i} className="text-[12px] leading-relaxed">{b.text}</p>;
        if (b.t === 'table') {
          // The clause table's first column is short (clause no.) and the last is
          // the vendor-reply column; give the description column the room.
          const isClauseTable = /clause/i.test(b.cols[0] || '');
          return (
            <div key={i} className="overflow-x-auto my-2">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr>{b.cols.map((c, j) => (
                    <th key={j} className="bg-astrikos-ink text-white border border-astrikos-iris px-2 py-1.5 text-left font-semibold align-top">{c}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {b.rows.map((r, ri) => (
                    <tr key={ri}>
                      {b.cols.map((_, ci) => (
                        <td key={ci} className={`border border-astrikos-mist px-2 py-1.5 align-top ${isClauseTable && ci === 0 ? 'whitespace-nowrap font-medium text-astrikos-steel w-14' : ''} ${isClauseTable && ci === b.cols.length - 1 ? 'w-40 text-slate-400' : ''}`}>
                          {r[ci] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

// ── SOTR module ──────────────────────────────────────────────────────────────
function SotrModule() {
  const [sources, setSources] = useState([]);
  const [prompt, setPrompt]   = useState('Generate a Statement of Technical Requirements in the standard tender format directly from the build specification, covering every equipment/system: scope, technical particulars, applicable classification rules, interfaces, environmental & type-test requirements, reliability/maintainability, documentation, testing, trials and warranty.');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [sotr, setSotr]       = useState(null);
  const [dlBusy, setDlBusy]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [view, setView]       = useState('formatted');   // 'formatted' | 'edit'

  const saveSotr = () => {
    if (!sotr?.content) return;
    saveArtifact('sotr', { title: sotr.title, content: sotr.content });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const run = async () => {
    if (!sources.length) { setError('Select at least one source (Build Specification / RFP).'); return; }
    setBusy(true); setError(null); setSotr(null);
    try {
      const res = await bomSotr({ sources: sources.map(d => ({ name: d.name, text: d.text })), prompt, title: 'Statement of Technical Requirements' });
      setSotr(res); setView('formatted');
      logInteraction({ module: 'SOTR Generation', prompt, subject: sources.map(d => d.name).join(', '),
        response: res.content || '' }).catch(() => {});
      if (!res.content?.trim()) setError('No SOTR could be generated. Try different source documents or prompt.');
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const download = async (fmt) => {
    if (!sotr?.content) return;
    if (fmt === 'txt') {
      const blob = new Blob([sotr.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'SOTR.txt'; a.click(); URL.revokeObjectURL(url);
      return;
    }
    setDlBusy(true);
    try {
      // The document title is the first "# …" line of the content, so leave the
      // export title blank to avoid a duplicate heading; keep a clean filename.
      const payload = { title: '', text: sotr.content, filename: 'SOTR' };
      if (fmt === 'pdf') await downloadPdf(payload); else await downloadWord(payload);
    } catch (e) { setError(e.message); }
    setDlBusy(false);
  };

  return (
    <>
      <Card title="Sources & SOTR Request" desc="Select the Build Specification / RFP to draft the Statement of Technical Requirements from. The SOTR is generated in a standard tender format — cover page, list of contents, and numbered chapters of clauses with a Complied / Not Complied vendor-reply column.">
        <div className="grid md:grid-cols-2 gap-4">
          <MultiDocSource label="Source documents (Build Spec / RFP / specs)" values={sources} onChange={(v) => { setSources(v); setSotr(null); }} />
          <div className="space-y-3">
            <Field label="Prompt (customizable)" value={prompt} onChange={setPrompt} textarea rows={5} />
          </div>
        </div>
        <RunButton onClick={run} busy={busy} busyLabel="Drafting SOTR…">Generate SOTR</RunButton>
        <ErrorNote>{error}</ErrorNote>
        {busy && <div className="text-[10px] text-app-muted flex items-center gap-1.5"><Spinner /> Harvesting technical requirements section-by-section and drafting the SOTR in tender format…</div>}
      </Card>

      {sotr && (
        <Card title="Statement of Technical Requirements" desc="Generated in a standard tender format. Review the formatted document (or edit the raw text), Save it, then download. Edits are reflected in the preview and every export.">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-app-border overflow-hidden text-[11px] font-semibold">
              <button onClick={() => setView('formatted')} className={`px-3 py-1.5 ${view === 'formatted' ? 'bg-app-accent-bg text-app-accent' : 'bg-app-panel text-app-muted hover:text-app-text'}`}>Formatted</button>
              <button onClick={() => setView('edit')} className={`px-3 py-1.5 border-l border-app-border ${view === 'edit' ? 'bg-app-accent-bg text-app-accent' : 'bg-app-panel text-app-muted hover:text-app-text'}`}>Edit text</button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <SaveButton onClick={saveSotr} saved={saved} />
              <button onClick={() => download('word')} disabled={dlBusy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-accent-bg text-app-accent border border-app-accent-border text-[11px] font-semibold hover:bg-app-accent-bg disabled:opacity-40">
                {dlBusy ? <Spinner /> : null} Download Word
              </button>
              <button onClick={() => download('pdf')} disabled={dlBusy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-danger-bg text-app-danger border border-app-danger-border text-[11px] font-semibold hover:bg-app-danger-bg disabled:opacity-40">
                {dlBusy ? <Spinner /> : null} Download PDF
              </button>
              <button onClick={() => download('txt')} className="px-3 py-1.5 rounded-lg bg-app-surface-raised text-app-text border border-app-border text-[11px] font-semibold hover:bg-app-surface-raised">Download TXT</button>
            </div>
          </div>

          {view === 'formatted' ? (
            <SotrDocView content={sotr.content} />
          ) : (
            <textarea
              value={sotr.content}
              onChange={(e) => setSotr(s => ({ ...s, content: e.target.value }))}
              className="w-full max-h-[55vh] min-h-[40vh] overflow-y-auto rounded-lg bg-app-surface-soft border border-app-border p-4 text-[12px] text-app-text leading-relaxed resize-y font-mono"
            />
          )}

          {sotr.citations?.length > 0 && <div className="text-[10px] text-app-muted">Grounded in: {sotr.citations.join(' · ')}</div>}
          <FeedbackBar module="sotr" subject={`SOTR (${sources.map(s => s.name).join(', ')})`} />
        </Card>
      )}
    </>
  );
}

export default function BomGenerator() {
  const [mode, setMode] = useState('bom');

  return (
    <Page
      title="BOM & SOTR Generator"
      subtitle="Two independent modules built from your build specifications. Generate a Bill of Materials (with Equipment Name, OEM, Capacity, Page Number, Reference and AI estimation), or draft a Statement of Technical Requirements directly from the specs — whichever you need."
    >
      <ModeToggle mode={mode} setMode={setMode} />

      {mode === 'bom' ? <BomModule /> : <SotrModule />}

      <ModuleChat
        module="bom"
        title="Ask about BOM / SOTR generation"
        placeholder="e.g. How would you estimate the number of speakers for a 200 m² compartment?"
        suggestions={[
          'What columns should a good shipbuilding BOM include?',
          'How do you estimate equipment quantities from a GA plan?',
          'What goes into an SOTR clause for a navigation system?',
        ]}
      />
    </Page>
  );
}

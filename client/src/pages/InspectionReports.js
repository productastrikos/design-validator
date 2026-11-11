import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Page, Card, StatTile, RunButton, ErrorNote, ResultTable, DocSource, Field, Spinner, Pill, FeedbackBar, ModuleChat } from '../components/feature/FeatureKit';
import { analyzeInspection, inspectionAnalytics, listInspectionObservations, updateInspectionObservation, inspectionQuery } from '../services/featureApi';
import { DOC_ACCEPT } from '../services/fileTypes';
import { Download } from 'lucide-react';
import { openStudio } from '../components/studio/DocumentStudio';

// Prescribed inspection-remarks register format.
const REG_HEADERS = [
  'S.No', 'Name of the project', 'Name of the equipment /system/material', 'Name of the inspection agency',
  'Date of the inspection', 'Document no if any', 'Trial sl.no', 'Description of the remark',
  'SAT/UNSAT', 'classification of the remark', 'Signed by',
];

function Bar({ label, value, max, tone = 'sky' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const color = { sky: 'bg-app-accent', amber: 'bg-app-warning', red: 'bg-app-danger', emerald: 'bg-app-success', violet: 'bg-app-advisory' }[tone];
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="w-40 truncate text-app-text" title={label}>{label}</div>
      <div className="flex-1 h-3 bg-app-surface-raised rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${pct}%` }} /></div>
      <div className="w-8 text-right text-app-muted font-mono">{value}</div>
    </div>
  );
}

const STATUSES = ['Open', 'Under Action', 'Closed', 'Deferred'];
const STATUS_TONE = {
  'Open':         'bg-app-danger-bg text-app-danger border-app-danger-border',
  'Under Action': 'bg-app-warning-bg text-app-warning border-app-warning-border',
  'Closed':       'bg-app-success-bg text-app-success border-app-success-border',
  'Deferred':     'bg-app-surface-raised text-app-text border-app-border',
};

// One status-trackable observation row with a 4-state status workflow + remark.
function ObsRow({ o, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatusVal] = useState(o.status || 'Open');
  const [remark, setRemark] = useState(o.closureRemark || '');
  const [busy, setBusy]   = useState(false);
  const save = async () => {
    setBusy(true);
    try { await updateInspectionObservation(o.id, { status, closureRemark: remark }); onChanged && onChanged(); }
    catch (_) {}
    setBusy(false); setEditing(false);
  };
  return (
    <div className="p-3 hover:bg-app-accent-bg">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Pill value={o.severity}>{o.severity}</Pill>
            <Pill value={o.category}>{o.category}</Pill>
            {o.satUnsat && <Pill value={o.satUnsat === 'UNSAT' ? 'no' : 'complied'}>{o.satUnsat}</Pill>}
            <span className="text-[10px] font-mono text-app-muted">{o.system || 'Unspecified'}</span>
            {o.agency && <span className="text-[10px] text-app-muted">· {o.agency}</span>}
          </div>
          <p className="text-[11px] text-app-text leading-snug">{o.observation}</p>
          {o.closureRemark && <p className="text-[10px] text-app-success mt-1">Remark: {o.closureRemark}</p>}
          {o.history?.length > 0 && (
            <p className="text-[10px] text-app-muted mt-0.5">Last update: {o.history.at(-1).from} → {o.history.at(-1).to} by {o.history.at(-1).by} · {o.history.length} change{o.history.length === 1 ? '' : 's'}</p>
          )}
        </div>
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${STATUS_TONE[o.status] || STATUS_TONE.Open}`}>{o.status || 'Open'}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {editing ? (
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            <select value={status} onChange={e => setStatusVal(e.target.value)} className="text-[10px] px-2 py-1 rounded bg-app-surface-soft border border-app-border text-app-text">
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={remark} onChange={e => setRemark(e.target.value)} placeholder="Remark (optional)…"
              className="flex-1 min-w-[120px] px-2 py-1 rounded bg-app-surface-soft border border-app-border text-[10px] text-app-text" />
            <button onClick={save} disabled={busy} className="text-[10px] px-2 py-1 rounded bg-app-success-bg text-app-success border border-app-success-border disabled:opacity-40">{busy ? '…' : 'Save'}</button>
            <button onClick={() => { setEditing(false); setStatusVal(o.status || 'Open'); }} className="text-[10px] px-2 py-1 rounded text-app-muted">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-[10px] px-2 py-1 rounded bg-app-accent-bg text-app-accent border border-app-accent-border">Update status</button>
        )}
      </div>
    </div>
  );
}

export default function InspectionReports() {
  const [tab, setTab]         = useState('analyze');
  const [doc, setDoc]         = useState(null);
  const [file, setFile]       = useState(null);
  const [project, setProject] = useState('');
  const [save, setSave]       = useState(true);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState(null);
  const [result, setResult]   = useState(null);
  const fileRef = useRef(null);

  // analytics + open remarks
  const [analytics, setAnalytics] = useState(null);
  const [dash, setDash]           = useState({ project: '', system: '', discipline: '', agency: '', category: '', status: '' });
  const [obs, setObs]             = useState([]);
  const [obsFilter, setObsFilter] = useState('Open');

  // natural-language query over inspection data
  const [question, setQuestion]   = useState('');
  const [qBusy, setQBusy]         = useState(false);
  const [qErr, setQErr]           = useState(null);
  const [qResult, setQResult]     = useState(null);

  const refreshAnalytics = useCallback(() => {
    inspectionAnalytics(Object.fromEntries(Object.entries(dash).filter(([, v]) => v))).then(setAnalytics).catch(() => {});
  }, [dash]);
  const refreshObs = useCallback(() => {
    const params = obsFilter === 'All' ? {} : { status: obsFilter };
    listInspectionObservations(params).then(r => setObs(r.observations || [])).catch(() => setObs([]));
  }, [obsFilter]);

  useEffect(() => { if (tab === 'analytics') refreshAnalytics(); if (tab === 'remarks') refreshObs(); }, [tab, refreshAnalytics, refreshObs]);

  const askQuestion = async (q) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setQBusy(true); setQErr(null); setQResult(null);
    try { setQResult(await inspectionQuery({ question: text })); }
    catch (e) { setQErr(e.message); }
    setQBusy(false);
  };

  const onUpload = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setFile(f); setDoc(null); setResult(null); setError(null); } };

  const run = async () => {
    if (!file && !doc) { setError('Select a report, or upload one (including a handwritten image).'); return; }
    setBusy(true); setError(null); setResult(null);
    try {
      const res = file
        ? await analyzeInspection({ file, project, saveToLessons: save })
        : await analyzeInspection({ text: doc.text, name: doc.name, project, saveToLessons: save });
      setResult(res);
      if (!res.observations?.length) setError('No observations were extracted from this report.');
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const rows = (result?.observations || []).map((o, i) => ({
    'S.No': o.slNo ?? i + 1,
    'Name of the project': o.project || result?.project || '',
    'Name of the equipment /system/material': o.system || '',
    'Name of the inspection agency': o.agency || '',
    'Date of the inspection': o.date || '',
    'Document no if any': o.documentNo || o.reportRef || '',
    'Trial sl.no': o.trialNo || '',
    'Description of the remark': o.observation || '',
    'SAT/UNSAT': o.satUnsat || '',
    'classification of the remark': o.category || '',
    'Signed by': o.signedBy || '',
  }));
  const maxEq = analytics?.equipment?.reduce((m, e) => Math.max(m, e.total), 0) || 0;
  const tabCls = (t) => `app-tab ${tab === t ? 'is-active' : ''}`;

  return (
    <Page
      title="Inspection Reports Analytics"
      subtitle="Process inspection reports / NCRs / trial reports — including handwritten report images (vision OCR) — auto-classify every observation, track status (close open remarks), and view an equipment-wise analytics dashboard. Findings feed the Lessons-Learned repository."
    >
      <div className="app-tabs" role="tablist">
        <button className={tabCls('analyze')} onClick={() => setTab('analyze')}>Analyse Report</button>
        <button className={tabCls('analytics')} onClick={() => setTab('analytics')}>Analytics Dashboard</button>
        <button className={tabCls('remarks')} onClick={() => setTab('remarks')}>Status Tracking</button>
        <button className={tabCls('query')} onClick={() => setTab('query')}>Query Data</button>
      </div>

      {tab === 'analyze' && (
        <>
          <Card title="Select / Upload Inspection Report" desc="Choose a document, or upload a report — including a handwritten inspection image (PNG/JPG) which is read by the vision model.">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <DocSource label="Inspection Report" value={doc} onChange={(v) => { setDoc(v); setFile(null); setResult(null); setError(null); }} />
                <div>
                  <input ref={fileRef} type="file" accept={DOC_ACCEPT} className="hidden" onChange={onUpload} />
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-app-border hover:border-app-accent-border text-[11px] text-app-muted hover:text-app-accent transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    {file ? file.name : 'Upload report / handwritten image'}
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                <Field label="Project" value={project} onChange={setProject} placeholder="e.g. Hull 101" />
                <label className="flex items-center gap-2 text-[11px] text-app-text cursor-pointer">
                  <input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)} className="" />
                  Add findings to the Lessons-Learned repository
                </label>
              </div>
            </div>
            <RunButton onClick={run} busy={busy} busyLabel="Extracting & classifying observations…">Analyse Report</RunButton>
            <ErrorNote>{error}</ErrorNote>
            {busy && <div className="text-[10px] text-app-muted flex items-center gap-1.5"><Spinner /> Long / handwritten reports are processed in sections.</div>}
          </Card>

          {result && (
            <>
              <Card title="Classification Summary" right={result.savedToLessons ? <span className="text-[10px] text-app-success">✓ {result.savedToLessons} added to Lessons-Learned</span> : null}>
                <div className="grid grid-cols-3 md:grid-cols-7 gap-2.5">
                  <StatTile label="Total" value={result.total} tone="emerald" />
                  {result.categories.map(c => (
                    <StatTile key={c} label={c.replace('Testing and Commissioning', 'Testing & Comm.')} value={result.byCategory[c] || 0}
                      tone={{ 'Material': 'amber', 'Design/Drawing': 'violet', 'Workmanship': 'orange', 'Installation': 'sky', 'Documentation': 'slate', 'Testing and Commissioning': 'red' }[c] || 'sky'} />
                  ))}
                </div>
              </Card>
              <Card title="Observations Register" desc="In the prescribed inspection-remarks format — classified, status-tracked and downloadable (Excel / Word / PDF). Close open remarks in the Status Tracking tab.">
                <ResultTable columns={REG_HEADERS} rows={rows} title={`${result.report}${result.project ? ' · ' + result.project : ''}`} sheetName="Observations"
                  downloadName={`Inspection_${(result.project || result.report || 'report').replace(/[^a-z0-9]+/gi, '_').slice(0, 24)}`} />
                <FeedbackBar module="inspection" subject={result.report} />
              </Card>
            </>
          )}
        </>
      )}

      {tab === 'analytics' && (
        <>
          <Card title="Configurable Analytics Dashboard" right={<>
            <button type="button" onClick={refreshAnalytics} className="app-control-btn btn-sm">Apply / Refresh</button>
            {analytics?.total > 0 && (
              <button type="button" className="icon-btn sm" aria-label="Download inspection analytics" onClick={() => openStudio({
                title: 'Inspection analytics',
                subtitle: Object.entries(dash).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'All analysed inspection reports',
                sections: [
                  { type: 'kpis', title: 'Key figures', items: [
                    { label: 'Total observations', value: String(analytics.total) }, { label: 'Open', value: String(analytics.open) },
                    { label: 'Closed', value: String(analytics.closed) }, { label: 'UNSAT', value: String(analytics.unsat) },
                  ] },
                  { type: 'chart', title: 'By equipment', data: analytics.equipment.slice(0, 12).map(e => ({ label: e.equipment, value: e.total })) },
                  { type: 'chart', title: 'By category', data: analytics.categories.map(c => ({ label: c, value: analytics.byCategory[c] || 0 })) },
                  { type: 'chart', title: 'By status', data: (analytics.statuses || []).map(st => ({ label: st, value: analytics.byStatus?.[st] || 0 })) },
                  Object.keys(analytics.byAgency || {}).length > 0 && { type: 'chart', title: 'By inspection agency', data: Object.entries(analytics.byAgency).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value })) },
                ],
              })}><Download size={13} /></button>
            )}
          </>}
            desc="Aggregated from all analysed inspection reports — filter by project, system, discipline, agency, category or status. Nothing is pre-populated.">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
              {[
                ['project', 'Project'], ['system', 'Equipment/System'], ['discipline', 'Discipline'],
                ['agency', 'Agency'], ['category', 'Category'], ['status', 'Status'],
              ].map(([k, label]) => (
                <input key={k} value={dash[k]} onChange={e => setDash(d => ({ ...d, [k]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') refreshAnalytics(); }} placeholder={label}
                  className="app-input select-sm" />
              ))}
            </div>
            {!analytics || analytics.total === 0 ? (
              <div className="text-[11px] text-app-muted py-6 text-center">No inspection data yet. Analyse a report to populate equipment-wise analytics.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  <StatTile label="Total Observations" value={analytics.total} tone="sky" />
                  <StatTile label="Open" value={analytics.open} tone="red" />
                  <StatTile label="Closed" value={analytics.closed} tone="emerald" />
                  <StatTile label="UNSAT" value={analytics.unsat} tone="amber" />
                </div>
                <div className="grid md:grid-cols-2 gap-4 mt-2">
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-app-muted mb-1">By Equipment (total observations)</div>
                    {analytics.equipment.slice(0, 12).map(e => <Bar key={e.equipment} label={e.equipment} value={e.total} max={maxEq} tone="sky" />)}
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-app-muted mb-1">By Category</div>
                    {analytics.categories.map(c => <Bar key={c} label={c} value={analytics.byCategory[c] || 0} max={Math.max(...analytics.categories.map(x => analytics.byCategory[x] || 0), 1)} tone="violet" />)}
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-app-muted mb-1">By Status</div>
                    {(analytics.statuses || []).map(s => <Bar key={s} label={s} value={analytics.byStatus?.[s] || 0} max={Math.max(...(analytics.statuses || []).map(x => analytics.byStatus?.[x] || 0), 1)} tone="amber" />)}
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-app-muted mb-1">By Inspection Agency</div>
                    {Object.keys(analytics.byAgency || {}).length === 0
                      ? <div className="text-[10px] text-app-faint">No agency captured in the analysed reports.</div>
                      : Object.entries(analytics.byAgency).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([a, v]) =>
                          <Bar key={a} label={a} value={v} max={Math.max(...Object.values(analytics.byAgency), 1)} tone="emerald" />)}
                  </div>
                </div>
              </>
            )}
          </Card>
          {analytics && analytics.equipment?.length > 0 && (
            <Card title="Equipment Register">
              <ResultTable
                columns={['Equipment / System', 'Total', 'Open', 'Closed', 'Critical', 'High', 'UNSAT']}
                rows={analytics.equipment.map(e => ({ 'Equipment / System': e.equipment, Total: e.total, Open: e.open, Closed: e.closed, Critical: e.critical, High: e.high, UNSAT: e.unsat }))}
                title="Equipment-wise Analytics" sheetName="Equipment Analytics" downloadName="Inspection_Equipment_Analytics" />
            </Card>
          )}
        </>
      )}

      {tab === 'remarks' && (
        <Card title="Status Tracking — Open / Closed Remarks" right={
          <div className="flex items-center gap-1 flex-wrap">
            {['Open', 'Under Action', 'Closed', 'Deferred', 'All'].map(f => (
              <button key={f} onClick={() => setObsFilter(f)} className={`text-[10px] px-2 py-1 rounded border font-semibold ${obsFilter === f ? 'bg-app-accent-bg text-app-accent border-app-accent-border' : 'bg-app-surface-raised text-app-muted border-app-border'}`}>{f}</button>
            ))}
          </div>
        } desc="Track remarks raised across inspection reports — set status Open / Under Action / Closed / Deferred with a remark. Every change is captured in the audit trail.">
          <div className="rounded-lg border border-app-border divide-y divide-app-border-soft max-h-[60vh] overflow-y-auto">
            {obs.length === 0 ? (
              <div className="text-[11px] text-app-muted py-8 text-center">No {obsFilter !== 'All' ? obsFilter.toLowerCase() : ''} remarks. Analyse an inspection report first.</div>
            ) : obs.map(o => <ObsRow key={o.id} o={o} onChanged={() => { refreshObs(); }} />)}
          </div>
        </Card>
      )}

      {tab === 'query' && (
        <Card title="Query Inspection Data" desc="Ask questions in plain language across all analysed inspection observations — counts, lists and filters. Answers are grounded strictly in your recorded data.">
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <Field label="Question" value={question} onChange={setQuestion}
                placeholder="e.g. How many UNSAT remarks were raised by the class surveyor in Project XXX?" />
            </div>
            <div className="shrink-0 w-32">
              <RunButton onClick={() => askQuestion()} busy={qBusy} busyLabel="Searching…">Ask</RunButton>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              'How many Workmanship Related remarks exist?',
              'List all Material Related remarks for the Steering Gear.',
              'How many UNSAT observations are still open?',
              'Which equipment has the most non-conformities?',
            ].map((s, i) => (
              <button key={i} onClick={() => { setQuestion(s); askQuestion(s); }} disabled={qBusy}
                className="text-[10px] px-2.5 py-1.5 rounded-lg bg-app-surface-soft border border-app-border hover:bg-app-accent-bg text-app-text disabled:opacity-40">{s}</button>
            ))}
          </div>
          <ErrorNote>{qErr}</ErrorNote>
          {qResult && (
            <div className="space-y-3">
              <div className="rounded-lg bg-app-surface-soft border border-app-border p-3">
                <div className="text-[10px] uppercase tracking-widest text-app-muted font-bold mb-1">Answer · {qResult.count} match{qResult.count === 1 ? '' : 'es'}</div>
                <p className="text-[12px] text-app-text whitespace-pre-wrap leading-relaxed">{qResult.answer}</p>
              </div>
              {qResult.rows?.length > 0 && (
                <ResultTable
                  columns={['Sl.No', 'Observation', 'Category', 'System/Equipment', 'Discipline', 'Agency', 'SAT/UNSAT', 'Severity', 'Status', 'Project', 'Report']}
                  rows={qResult.rows} title="Matching Observations" sheetName="Query Result" downloadName="Inspection_Query" />
              )}
              <FeedbackBar module="inspection" subject={`Query: ${question}`} />
            </div>
          )}
        </Card>
      )}

      <ModuleChat
        module="inspection"
        title="Ask about inspections"
        docText={doc?.text}
        docName={doc?.name}
        placeholder="e.g. Which equipment has the most open non-conformities?"
        suggestions={[
          'Summarise the recurring defects across inspection reports.',
          'Which equipment has the most critical observations?',
          'Draft a corrective action plan for the open remarks.',
        ]}
      />
    </Page>
  );
}

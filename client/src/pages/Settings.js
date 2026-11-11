import React, { useState, useEffect, useCallback } from 'react';
import { testConnection, getKbStatus } from '../services/aiService';
import { PageHeader } from '../components/feature/FeatureKit';

function StatusDot({ ok }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-app-success' : 'bg-app-danger'}`} />;
}

export default function Settings() {
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [kbStatus,   setKbStatus]   = useState(null);
  const [kbLoading,  setKbLoading]  = useState(true);

  const refreshKb = useCallback(async () => {
    setKbLoading(true);
    try { setKbStatus(await getKbStatus()); }
    catch (_) { setKbStatus(null); }
    setKbLoading(false);
  }, []);

  useEffect(() => { refreshKb(); }, [refreshKb]);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnection();
      setTestResult({ ok: true, msg: `Inference engine online · ${res.chunks} knowledge chunks indexed` });
      setKbStatus(res);
    } catch (e) {
      setTestResult({ ok: false, msg: e.message });
    }
    setTesting(false);
  };

  return (
    <div className="page max-w-3xl">
      <PageHeader title="Settings" subtitle="Verify the inference engine and review the built-in knowledge base." />

      {/* ── Inference engine ──────────────────────────────────────────────── */}
      <div className="astk-panel space-y-4">
        <h2 className="text-sm font-bold text-app-text">Inference Engine</h2>
        <p className="text-[11px] text-app-muted leading-relaxed">
          Language and vision processing runs through the inference endpoint configured on the server.
          Document text and queries are sent to that endpoint, so point it at a private or on-premise
          deployment when documents must stay inside your network.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={runTest}
            disabled={testing}
            className="app-control-btn btn-md"
          >
            {testing ? (
              <><svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> Testing…</>
            ) : (
              <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Test Connection</>
            )}
          </button>

          {testResult && (
            <div className={`flex items-center gap-1.5 text-[11px] ${testResult.ok ? 'text-app-success' : 'text-app-danger'}`}>
              <StatusDot ok={testResult.ok} />
              {testResult.msg}
            </div>
          )}
        </div>
      </div>

      {/* ── Knowledge Base ────────────────────────────────────────────────── */}
      <div className="astk-panel space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-app-text">Knowledge Base</h2>
          <button onClick={refreshKb} className="text-[10px] text-app-muted hover:text-app-text flex items-center gap-1">
            <svg className={`w-3 h-3 ${kbLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        <p className="text-[11px] text-app-muted leading-relaxed">
          The engine is grounded in a built-in maritime rule base (SOLAS, the LSA Code and classification
          rules) used for retrieval. Upload your
          own documents from the <span className="text-app-accent">Document Intelligence</span> page — they
          stay in your workspace for the session and power every tool.
        </p>

        {kbStatus ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="stat"><div className="stat-label">Knowledge Chunks</div><div className="stat-value astk-numeric">{(kbStatus.chunks || 0).toLocaleString()}</div></div>
            <div className="stat"><div className="stat-label">Vectors Indexed</div><div className="stat-value astk-numeric">{(kbStatus.vectorsIndexed || 0).toLocaleString()}</div></div>
            <div className="stat"><div className="stat-label">Engine State</div><div className="stat-value astk-numeric">{kbStatus.ready ? 'Ready' : 'Loading'}</div></div>
          </div>
        ) : kbLoading ? (
          <div className="text-[11px] text-app-muted">Loading status…</div>
        ) : (
          <div className="text-[11px] text-app-danger">
            Backend server not reachable. Start the system with <code className="font-mono bg-app-surface-raised px-1 rounded">npm run dev</code> from the project root.
          </div>
        )}
      </div>


      {/* ── Engine info ───────────────────────────────────────────────────── */}
      <div className="astk-panel text-[11px] text-app-muted flex-row items-center justify-between">
        <div>
          <span className="text-app-text font-semibold">Engine:</span>{' '}
          LLM inference · Hybrid BM25 + semantic retrieval · Vision OCR
        </div>
        <span className="text-[10px] uppercase tracking-widest text-app-faint font-bold">Design Validator</span>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';

/* Toasts (§7.19) and confirmation dialogs (§7.17), callable from anywhere. */

let pushToast = null;
let pushConfirm = null;
let nextId = 1;

const LIFE = { success: 5000, info: 5000, warning: 8000, danger: null };
const TOAST_ICON = { success: CheckCircle2, info: Info, warning: AlertTriangle, danger: XCircle };

export function toast({ tone = 'success', title, body }) {
  pushToast?.({ id: nextId++, tone, title, body });
}

/** Resolves true when the person confirms, false when they cancel. */
export function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    if (!pushConfirm) { resolve(false); return; }
    pushConfirm({ title, body, confirmLabel, danger, resolve });
  });
}

function ConfirmModal({ request, onDone }) {
  const cancelRef = useRef(null);
  const returnTo = useRef(document.activeElement);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') finish(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (value) => {
    request.resolve(value);
    onDone();
    returnTo.current?.focus?.();
  };

  return (
    <div className="app-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) finish(false); }}>
      <div className="app-modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="app-modal-header">
          <div className="app-modal-title" id="confirm-title">{request.title}</div>
          <button type="button" className="icon-btn sm" onClick={() => finish(false)} aria-label="Close"><X size={14} /></button>
        </div>
        <div className="app-modal-body"><p className="confirm-body">{request.body}</p></div>
        <div className="app-modal-footer">
          <button type="button" ref={cancelRef} className="app-control-btn btn-md" onClick={() => finish(false)}>Cancel</button>
          <button type="button" className={`${request.danger ? 'app-danger-btn' : 'app-primary-btn'} btn-md`} onClick={() => finish(true)}>{request.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function OverlayHost() {
  const [toasts, setToasts] = useState([]);
  const [confirmReq, setConfirmReq] = useState(null);

  useEffect(() => {
    pushToast = (t) => {
      setToasts((list) => [...list, t]);
      const life = LIFE[t.tone];
      if (life) setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), life);
    };
    pushConfirm = setConfirmReq;
    return () => { pushToast = null; pushConfirm = null; };
  }, []);

  return createPortal(
    <>
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.tone] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.tone}`}>
              <Icon size={16} className={`tone-${t.tone}`} />
              <div className="min-w-0 flex-1">
                <div className="toast-title">{t.title}</div>
                {t.body && <div className="toast-body break-words">{t.body}</div>}
              </div>
              <button type="button" className="icon-btn sm" onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))} aria-label="Dismiss"><X size={12} /></button>
            </div>
          );
        })}
      </div>
      {confirmReq && <ConfirmModal request={confirmReq} onDone={() => setConfirmReq(null)} />}
    </>,
    document.body,
  );
}

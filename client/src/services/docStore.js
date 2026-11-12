// ─────────────────────────────────────────────────────────────────────────────
// Browser document store (IndexedDB)
//
//   • "base"  — the pre-parsed knowledge-base documents, cached once and kept
//               across every session on this machine. Internal to the AI/RAG
//               engine; never surfaced in the UI.
//   • "user"  — documents the user uploads. Visible across the app (via the
//               document picker) and cleared the moment the user logs out.
//
// A small event ('docstore:changed') lets open pages refresh their pickers when
// a document is added or removed.
// ─────────────────────────────────────────────────────────────────────────────

import { getRepository, getRepositoryDoc, getRepositoryFile, updateRepositoryDoc, deleteRepositoryDoc } from './aiService';

const isRepoId = (id) => typeof id === 'string' && id.startsWith('REPO-');

const DB_NAME = 'dv_docstore';
const DB_VERSION = 2;
const BASE_STORE = 'base';
const USER_STORE = 'user';
const LIBRARY_STORE = 'library';   // pre-loaded documents (persist across sessions)

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BASE_STORE))    db.createObjectStore(BASE_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(USER_STORE))    db.createObjectStore(USER_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(LIBRARY_STORE)) db.createObjectStore(LIBRARY_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    let result;
    Promise.resolve(fn(os)).then(r => { result = r; }).catch(reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function emitChange() {
  try { window.dispatchEvent(new Event('docstore:changed')); } catch (_) {}
}

// ── Base knowledge-base cache ────────────────────────────────────────────────
export async function hasBaseDocs() {
  try {
    const count = await tx(BASE_STORE, 'readonly', os => reqToPromise(os.count()));
    return count > 0;
  } catch (_) { return false; }
}

export async function cacheBaseDocs(docs = []) {
  if (!docs.length) return;
  await tx(BASE_STORE, 'readwrite', os => {
    for (const d of docs) os.put({ id: d.id, name: d.name, text: d.text || '' });
  });
}

export async function getBaseDocs() {
  try { return await tx(BASE_STORE, 'readonly', os => reqToPromise(os.getAll())); }
  catch (_) { return []; }
}

// ── User-uploaded documents ──────────────────────────────────────────────────
// A record: { id, name, type, mime, pages, textLength, addedAt, text, file,
//             project, discipline }
// project + discipline drive the hierarchical Workspace (project-wise repositories).
export async function addUserDoc(doc) {
  const record = {
    id:         doc.id,
    name:       doc.name,
    type:       doc.type || 'General Document',
    mime:       doc.mime || '',
    pages:      doc.pages || 0,
    textLength: doc.textLength || (doc.text ? doc.text.length : 0),
    addedAt:    doc.addedAt || new Date().toISOString(),
    text:       doc.text || '',
    file:       doc.file || null,   // original Blob/File — used by vision features
    project:    doc.project || 'Unassigned',
    discipline: doc.discipline || '',
  };
  try {
    await tx(USER_STORE, 'readwrite', os => os.put(record));
  } catch (e) {
    const name = (e && e.name) || '';
    if (name === 'QuotaExceededError' || /quota|storage/i.test(e && e.message ? e.message : '')) {
      throw new Error('Not enough browser storage to save this document. Remove some documents and try again.');
    }
    throw new Error('Could not save the document in your browser. Please try again.');
  }
  emitChange();
  return record;
}

// Lightweight list (no text / blob payloads) for pickers and tables.
export async function listUserDocs() {
  try {
    const local = await tx(USER_STORE, 'readonly', os => reqToPromise(os.getAll())).catch(() => []);
    // Server-stored uploads follow the user to any device; the local copy is only a cache.
    const seen = new Set(local.map(d => d.id));
    const repo = (await listRepositoryDocs()).filter(d => !seen.has(d.id));
    const all = [...local, ...repo];
    return all
      .map(({ id, name, type, mime, pages, textLength, addedAt, project, discipline }) =>
        ({ id, name, type, mime, pages, textLength, addedAt, project: project || 'Unassigned', discipline: discipline || '' }))
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  } catch (_) { return []; }
}

// List the distinct projects (workspaces) currently in use.
export async function listProjects() {
  const docs = await listUserDocs();
  return [...new Set(docs.map(d => d.project || 'Unassigned'))].sort();
}

// Reassign a document to a project / discipline (move within the workspace tree).
export async function setDocMeta(id, { project, discipline } = {}) {
  if (isRepoId(id)) {
    await updateRepositoryDoc(id, { project, discipline });
    const local = await tx(USER_STORE, 'readonly', os => reqToPromise(os.get(id))).catch(() => null);
    if (local) {
      if (project !== undefined)    local.project = project || 'Unassigned';
      if (discipline !== undefined) local.discipline = discipline || '';
      await tx(USER_STORE, 'readwrite', os => os.put(local)).catch(() => {});
    }
    emitChange();
    return local || { id };
  }
  const rec = await getUserDoc(id);
  if (!rec) return null;
  if (project !== undefined)    rec.project = project || 'Unassigned';
  if (discipline !== undefined) rec.discipline = discipline || '';
  await tx(USER_STORE, 'readwrite', os => os.put(rec));
  emitChange();
  return rec;
}

export async function getUserDoc(id) {
  if (!id) return null;
  let local = null;
  try { local = await tx(USER_STORE, 'readonly', os => reqToPromise(os.get(id))); } catch (_) {}
  if (local || !isRepoId(id)) return local;
  // Not cached on this device (e.g. signed in elsewhere): rebuild from the server.
  const full = await getRepositoryDocFull(id);
  if (!full) return null;
  const file = await getRepositoryFile(id);
  const rec = { ...full, file, project: full.project || 'Unassigned', discipline: full.discipline || '' };
  try { await tx(USER_STORE, 'readwrite', os => os.put(rec)); } catch (_) {}
  return rec;
}

export async function removeUserDoc(id) {
  if (isRepoId(id)) await deleteRepositoryDoc(id);
  await tx(USER_STORE, 'readwrite', os => os.delete(id));
  emitChange();
}

export async function clearUserDocs() {
  try {
    await tx(USER_STORE, 'readwrite', os => os.clear());
    emitChange();
  } catch (_) {}
}

// ── Pre-loaded document library (persists across sessions) ───────────────────
// Records: { id, name, type, mime, text, isDrawing, libraryFile, source:'library' }
export async function hasLibraryDocs() {
  try { return (await tx(LIBRARY_STORE, 'readonly', os => reqToPromise(os.count()))) > 0; }
  catch (_) { return false; }
}

export async function clearLibraryDocs() {
  try {
    await tx(LIBRARY_STORE, 'readwrite', os => os.clear());
    emitChange();
  } catch (_) {}
}

export async function cacheLibraryDocs(docs = []) {
  if (!docs.length) return;
  await tx(LIBRARY_STORE, 'readwrite', os => {
    for (const d of docs) os.put({
      id: d.id, name: d.name, type: d.type || 'General Document', mime: d.mime || 'application/pdf',
      text: d.text || '', isDrawing: !!d.isDrawing, libraryFile: d.libraryFile || d.id,
      textLength: d.textLength || (d.text ? d.text.length : 0), note: d.note || '', source: 'library',
    });
  });
  emitChange();
}

export async function listLibraryDocs() {
  try {
    const all = await tx(LIBRARY_STORE, 'readonly', os => reqToPromise(os.getAll()));
    return all.map(({ id, name, type, mime, isDrawing, libraryFile, textLength }) =>
      ({ id, name, type, mime, isDrawing, libraryFile, textLength, source: 'library' }));
  } catch (_) { return []; }
}

export async function getLibraryDoc(id) {
  if (!id) return null;
  try { return await tx(LIBRARY_STORE, 'readonly', os => reqToPromise(os.get(id))); }
  catch (_) { return null; }
}

// ── Persistent shared repository (server-side) ───────────────────────────────
// Documents saved to the server repository persist across sessions and are
// shared by all users. Fetched live so pickers always reflect the server.
export async function listRepositoryDocs() {
  try {
    const { docs = [] } = await getRepository();
    return docs.map(d => ({
      id: d.id, name: d.name, type: d.type || 'General Document', mime: d.mime || '',
      pages: d.pages || 0, textLength: d.textLength || 0, addedAt: d.addedAt,
      project: d.project || 'Unassigned', discipline: d.discipline || '',
      uploadedBy: d.uploadedBy || '', source: 'repository',
    }));
  } catch (_) { return []; }
}

// Full repository document (with text) — used by getSelectableDoc's fallback.
async function getRepositoryDocFull(id) {
  try {
    const d = await getRepositoryDoc(id);
    return d && d.id ? { ...d, source: 'repository' } : null;
  } catch (_) { return null; }
}

// ── Merged view used by every document picker ────────────────────────────────
// user uploads (this session) + pre-loaded library + persistent shared repository.
// De-duplicated by id (a repository doc added to the session store appears once).
export async function listSelectableDocs() {
  const [user, lib, repo] = await Promise.all([listUserDocs(), listLibraryDocs(), listRepositoryDocs()]);
  const userTagged = user.map(d => ({ ...d, source: 'user' }));
  const seen = new Set(userTagged.map(d => d.id).concat(lib.map(d => d.id)));
  const repoOnly = repo.filter(d => !seen.has(d.id));
  return [...userTagged, ...lib, ...repoOnly];
}

export async function getSelectableDoc(id) {
  return (await getUserDoc(id)) || (await getLibraryDoc(id)) || (await getRepositoryDocFull(id));
}

// ── Saved artifacts (edited BOM / SOTR etc.) ────────────────────────────────
// Small JSON outputs the user has reviewed/edited and saved, so other modules
// can consume them (e.g. Ship Cost reads the saved BOM). localStorage-backed;
// session-scoped like user docs. Emits 'docstore:changed' so pickers refresh.
const ARTIFACT_KEY = 'dv_artifacts';

function _readArtifacts() {
  try { return JSON.parse(localStorage.getItem(ARTIFACT_KEY) || '{}'); }
  catch (_) { return {}; }
}
function _writeArtifacts(obj) {
  try { localStorage.setItem(ARTIFACT_KEY, JSON.stringify(obj)); } catch (_) {}
  emitChange();
}

// Save (replace) the latest artifact of a given kind, e.g. 'bom' or 'sotr'.
export function saveArtifact(kind, data, meta = {}) {
  const all = _readArtifacts();
  all[kind] = { kind, data, meta, savedAt: new Date().toISOString() };
  _writeArtifacts(all);
  return all[kind];
}

export function getArtifact(kind) {
  return _readArtifacts()[kind] || null;
}

export function listArtifacts() {
  return Object.values(_readArtifacts());
}

export function clearArtifacts() {
  _writeArtifacts({});
}

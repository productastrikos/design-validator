// ─────────────────────────────────────────────────────────────────────────────
// Backend origin — single source of truth for every call the browser makes.
//
// Driven entirely by VITE_API_URL so no host/IP/port literal ever ships in the
// source (see deployment_context.md §5 "Env discipline").
//
//   • Development  → VITE_API_URL is empty, so API_BASE is the relative "/api"
//                    and Vite's dev proxy forwards it to the local API.
//   • Production   → VITE_API_URL points at the backend subdomain, so the SPA
//                    (served on its own port) calls the API cross-origin.
//
// Trailing slashes are stripped so `${API_BASE}${path}` never doubles up.
// ─────────────────────────────────────────────────────────────────────────────

const ORIGIN = String(import.meta.env?.VITE_API_URL || '').trim().replace(/\/+$/, '');

// Backend origin without a path ('' in development). Use for websockets or any
// non-/api endpoint.
export const API_ORIGIN = ORIGIN;

// Prefix for every REST call: "/api" in development, an absolute URL in production.
export const API_BASE = `${ORIGIN}/api`;

// Websocket origin. Falls back to the API origin — one backend, one port.
export const SOCKET_URL =
  String(import.meta.env?.VITE_SOCKET_URL || '').trim().replace(/\/+$/, '') || ORIGIN;

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Deploying organisation's display name, printed on generated tenders and enquiry
// letters. Set ORG_NAME in the deployment environment; when it is empty, generated
// documents use the ship builder named in the source or a visible placeholder.
// ─────────────────────────────────────────────────────────────────────────────

const ORG_NAME = (process.env.ORG_NAME || '').trim();

module.exports = { ORG_NAME };

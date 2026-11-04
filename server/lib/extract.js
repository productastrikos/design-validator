'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Shared document text extractor
//   PDF (per-page text layer; pages with no text → page image → vision model)
//   · Word (.doc/.docx) · Excel (.xls/.xlsx/.ods) · PowerPoint (.pptx)
//   · OpenDocument (.odt/.odp) · RTF · images (vision) · plain text
// Used by upload, convert, chat-extract, and the feature modules.
// ─────────────────────────────────────────────────────────────────────────────

const { getModel } = require('./llm');
const { extractPdfPageTexts, rasterizePdfToPngs, isRendererAvailable } = require('./rasterize');
const { parseCad, isCadName } = require('./cad');

// Build a specific, actionable error when a PDF yields no text — so a deployed
// app reports the real cause instead of a blanket "could not read this file".
function readError(message, status = 422) {
  const err = new Error(message);
  err.status = status;
  return err;
}
function diagnoseEmpty(scanned) {
  if (!scanned) {
    return readError('Could not read this file. It may be empty, password-protected, or a corrupted/incomplete PDF.');
  }
  if (!isRendererAvailable()) {
    return readError('This looks like a scanned / image-only PDF, but the server\'s PDF renderer (mupdf) is unavailable, so OCR could not run. Reinstall the server dependencies on the host (cd server && npm install).');
  }
  if (!process.env.LLM_API_KEY) {
    return readError('This is a scanned / image-only PDF that needs OCR, but the AI vision engine is not configured. Set LLM_API_KEY in the deployment environment.', 503);
  }
  return readError('This is a scanned / image-only PDF and the OCR/vision step returned no text. The vision model likely errored — check the server logs for "[inference]" entries.', 502);
}

const IMAGE_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
]);
const IMAGE_MIME_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
};

// Page markers are injected into extracted PDF text so downstream features (pre-bid
// queries, BOM generation, clause referencing) can cite an actual page number.
// The format is stable and human-readable; prompts tell the model to read it.
const PAGE_MARK = (n) => `----- Page ${n} -----`;

// A page with fewer than this many characters of embedded text is treated as
// scanned / image-only and routed to the vision model.
const MIN_PAGE_TEXT_CHARS = 80;
// Safety cap on how many image-only pages we OCR per document. OCR is sequential
// and each page is a vision call (several seconds), so a high cap can blow past
// the host's gateway timeout. Default 10 keeps a scanned-doc upload responsive;
// raise EXTRACT_MAX_VISION_PAGES on a host with a longer timeout.
const MAX_VISION_PAGES = parseInt(process.env.EXTRACT_MAX_VISION_PAGES || '10', 10);
// OCR pages in parallel (bounded) so a multi-page scan finishes well within the
// host's gateway timeout instead of running one slow vision call at a time.
const OCR_CONCURRENCY = parseInt(process.env.EXTRACT_OCR_CONCURRENCY || '3', 10);

/** Run an async mapper over items with bounded concurrency, preserving order. */
async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await mapper(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const OCR_PROMPT =
  'Extract ALL text and tabular data from this page exactly as it appears, including text inside ' +
  'images, figures, stamps, tables and diagrams. Preserve structure using line breaks. ' +
  'Output only the extracted text — no commentary.';

/** OCR a single page image (base64 PNG) via the vision model. */
async function ocrImage(base64, mimeType = 'image/png') {
  const model = getModel();
  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    OCR_PROMPT,
  ]);
  return (result.response.text() || '').trim();
}

/** Extract text from a PDF, falling back to vision for pages with no text layer. */
async function extractPdfText(buffer) {
  let pageTexts = [];
  try {
    pageTexts = await extractPdfPageTexts(buffer);
  } catch (_) {
    pageTexts = [];
  }

  // If we couldn't even enumerate pages, fall back to pdf-parse, then whole-doc vision.
  if (!pageTexts.length) {
    let text = '';
    try {
      const data = await require('pdf-parse')(buffer);
      text = (data.text || '').trim();
    } catch (_) { /* ignore */ }
    if (text.length >= MIN_PAGE_TEXT_CHARS) return text;

    const pngs = await rasterizePdfToPngs(buffer, { maxPages: MAX_VISION_PAGES }).catch(() => []);
    const parts = await mapLimit(pngs, OCR_CONCURRENCY,
      pg => ocrImage(pg.data).then(t => ({ page: pg.page, t })).catch(() => ({ page: pg.page, t: '' })));
    const ocrText = parts.filter(x => x.t).map(x => `${PAGE_MARK(x.page)}\n${x.t}`).join('\n\n').trim();
    if (ocrText) return ocrText;
    if (buffer.includes('/Encrypt')) throw readError('This PDF is password-protected. Remove the password and upload it again.');
    throw diagnoseEmpty(true);   // no text layer at all → treat as scanned
  }

  // Identify pages that need vision (no usable text layer).
  const needVision = pageTexts.filter(p => p.text.length < MIN_PAGE_TEXT_CHARS).map(p => p.page);
  const visionPages = needVision.slice(0, MAX_VISION_PAGES);

  const ocrByPage = new Map();
  if (visionPages.length) {
    const pngs = await rasterizePdfToPngs(buffer, { pages: visionPages, maxPages: MAX_VISION_PAGES }).catch(() => []);
    const ocrResults = await mapLimit(pngs, OCR_CONCURRENCY,
      pg => ocrImage(pg.data).then(txt => ({ page: pg.page, txt })).catch(() => ({ page: pg.page, txt: '' })));
    for (const r of ocrResults) if (r.txt) ocrByPage.set(r.page, r.txt);
  }

  // Reassemble in page order, preferring the text layer, then OCR. Each page is
  // prefixed with a page marker so features can cite real page numbers.
  const out = [];
  for (const p of pageTexts) {
    let body = '';
    if (p.text.length >= MIN_PAGE_TEXT_CHARS) body = p.text;
    else if (ocrByPage.has(p.page))           body = ocrByPage.get(p.page);
    if (body) out.push(`${PAGE_MARK(p.page)}\n${body}`);
  }
  const unread = needVision.length - visionPages.length;
  if (out.length && unread > 0) {
    out.push(`[Note: ${unread} further page(s) have no text layer and were not read — the per-document OCR limit is ${MAX_VISION_PAGES}. Raise EXTRACT_MAX_VISION_PAGES on the server to include them.]`);
  }
  const result = out.join('\n\n').trim();
  if (result) return result;
  // Nothing readable — most pages had no text layer → scanned document.
  throw diagnoseEmpty(needVision.length > 0);
}

// ── Other office formats ─────────────────────────────────────────────────────
const SUPPORTED_FORMATS = 'PDF, Word (.doc/.docx), Excel (.xls/.xlsx/.ods), PowerPoint (.pptx), OpenDocument (.odt/.odp), RTF, plain text / CSV, images, and AutoCAD (.dwg/.dxf)';

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

// PowerPoint → one block per slide, in slide order.
async function extractPptxText(buffer) {
  const zip = await require('jszip').loadAsync(buffer);
  const slideNo = n => parseInt(n.match(/slide(\d+)\.xml$/)[1], 10);
  const names = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNo(a) - slideNo(b));
  const blocks = [];
  for (const name of names) {
    const xml = await zip.file(name).async('string');
    const paragraphs = xml.split('</a:p>')
      .map(p => [...p.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g)].map(m => decodeXml(m[1])).join('').trim())
      .filter(Boolean);
    if (paragraphs.length) blocks.push(`----- Slide ${slideNo(name)} -----\n${paragraphs.join('\n')}`);
  }
  return blocks.join('\n\n').trim();
}

// OpenDocument text / presentation → paragraphs from content.xml.
async function extractOdfText(buffer) {
  const zip = await require('jszip').loadAsync(buffer);
  const entry = zip.file('content.xml');
  if (!entry) return '';
  const xml = await entry.async('string');
  return decodeXml(xml
    .replace(/<text:tab[^>]*\/>/g, '\t')
    .replace(/<text:s(\s[^>]*)?\/>/g, ' ')
    .replace(/<text:line-break[^>]*\/>/g, '\n')
    .replace(/<\/text:(p|h)>/g, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Remove a brace-delimited RTF group such as {\fonttbl ...}, honouring nesting.
function stripRtfGroup(rtf, keyword) {
  let out = rtf, at;
  while ((at = out.indexOf(`{\\${keyword}`)) !== -1) {
    let depth = 0, i = at;
    for (; i < out.length; i++) {
      if (out[i] === '\\') { i++; continue; }
      if (out[i] === '{') depth++;
      else if (out[i] === '}' && --depth === 0) break;
    }
    out = out.slice(0, at) + out.slice(i + 1);
  }
  return out;
}

function rtfToText(rtf) {
  let s = rtf;
  for (const group of ['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', '*']) s = stripRtfGroup(s, group);
  return s
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(+n < 0 ? +n + 65536 : +n))
    .replace(/\\(par|line|sect|page)\b ?/g, '\n')
    .replace(/\\tab\b ?/g, '\t')
    .replace(/\\([{}\\])/g, '$1')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToText(html) {
  return decodeXml(html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|div|tr|li|h[1-6])>|<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Plain text, honouring the UTF-8/UTF-16 byte-order marks Windows editors write.
function decodeText(buffer) {
  if (buffer[0] === 0xFF && buffer[1] === 0xFE) return buffer.slice(2).toString('utf16le');
  if (buffer[0] === 0xFE && buffer[1] === 0xFF) return Buffer.from(buffer.slice(2)).swap16().toString('utf16le');
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) return buffer.slice(3).toString('utf8');
  return null;
}

function looksBinary(buffer) {
  const sample = buffer.slice(0, 8192);
  let control = 0;
  for (const b of sample) {
    if (b === 0) return true;
    if (b < 9 || (b > 13 && b < 32)) control++;
  }
  return sample.length > 0 && control / sample.length > 0.1;
}

// Legacy .doc. Files saved with that extension are not always the binary format —
// Word-compatible HTML and RTF (and renamed .docx) are common too.
async function extractDocText(buffer) {
  if (buffer.slice(0, 4).toString('hex') === 'd0cf11e0') {
    const WordExtractor = require('word-extractor');
    const doc = await new WordExtractor().extract(buffer);
    return (doc.getBody() || '').trim();
  }
  if (buffer.slice(0, 2).toString('latin1') === 'PK') {
    const result = await require('mammoth').extractRawText({ buffer });
    return result.value || '';
  }
  const text = decodeText(buffer) ?? buffer.toString('utf8');
  if (text.startsWith('{\\rtf')) return rtfToText(text);
  return /<html|<body|<p[\s>]/i.test(text.slice(0, 4096)) ? htmlToText(text) : text;
}

// Parser failures on office files almost always mean a protected or damaged file.
function unreadable(what) {
  return readError(`Could not read this ${what} file. It may be password-protected or corrupted.`);
}

// Excel workbook → readable text: one block per sheet, rows as pipe-separated
// cells (values formatted as displayed, e.g. "1,988.79" not raw floats), with a
// header line per sheet so a downstream reader (LLM or human) can tell which
// switchboard/table a row came from. Blank rows are dropped to keep this dense.
function extractExcelText(buffer) {
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellStyles: false });
  const blocks = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' });
    const lines = rows
      .map(r => r.map(c => String(c == null ? '' : c).trim()).filter(Boolean).join(' | '))
      .filter(Boolean);
    if (lines.length) blocks.push(`----- Sheet: ${sheetName} -----\n${lines.join('\n')}`);
  }
  return blocks.join('\n\n').trim();
}

async function extractFileText(buffer, mime, origName = '') {
  const isPDF   = mime === 'application/pdf' || /\.pdf$/i.test(origName);
  const isDOCX  = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(origName);
  const isExcel = /\.(xlsx|xlsm|xlsb|xls|ods)$/i.test(origName)
    || mime === 'application/vnd.ms-excel'
    || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const isImg  = IMAGE_MIMES.has(mime) || /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(origName);
  const isCad  = isCadName(origName, mime);

  // AutoCAD drawings (.dwg / .dxf) — decode to a structured text summary (text
  // labels + computed compartment areas) so EVERY feature that reads documents
  // (upload, convert, chat, BOM, design review, inspection, …) can consume a CAD
  // drawing exactly like a PDF. Drawing Intelligence still uses the richer
  // geometry-aware path; here we just need readable text.
  if (isCad) {
    const parsed = await parseCad(buffer, origName || 'drawing');
    const summary = (parsed && parsed.summary || '').trim();
    if (summary) return summary;
    throw readError('Could not read this CAD drawing. If it is a binary .dwg that failed to decode, export it to DXF or PDF from AutoCAD and re-upload.');
  }

  if (isPDF) return extractPdfText(buffer);

  if (isDOCX) {
    const mammoth = require('mammoth');
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '';
    } catch (_) { throw unreadable('Word'); }
  }

  if (/\.doc$/i.test(origName) || mime === 'application/msword') {
    try { return await extractDocText(buffer); }
    catch (_) { throw unreadable('Word'); }
  }

  if (/\.pptx$/i.test(origName)) {
    try { return await extractPptxText(buffer); }
    catch (_) { throw unreadable('PowerPoint'); }
  }

  if (/\.(odt|odp)$/i.test(origName)) {
    try { return await extractOdfText(buffer); }
    catch (_) { throw unreadable('OpenDocument'); }
  }

  if (isExcel) {
    let text = '';
    try { text = extractExcelText(buffer); } catch (_) { throw unreadable('Excel'); }
    if (text) return text;
    throw readError('This Excel file has no readable content.');
  }

  if (isImg) {
    const ext = (origName.match(/\.([a-z]+)$/i) || [])[1] || '';
    const imgMime = IMAGE_MIMES.has(mime) ? mime : (IMAGE_MIME_BY_EXT[ext.toLowerCase()] || 'image/jpeg');
    return ocrImage(buffer.toString('base64'), imgMime);
  }

  // Everything else must actually be text. Decoding an unknown binary as UTF-8 would
  // feed garbage into every analysis, so refuse it with a clear message instead.
  const bom = decodeText(buffer);
  const text = bom ?? (looksBinary(buffer) ? null : buffer.toString('utf8'));
  if (text == null) {
    const ext = (origName.match(/\.[a-z0-9]+$/i) || ['this file type'])[0];
    throw readError(`${ext} files cannot be read. Supported formats: ${SUPPORTED_FORMATS}.`, 415);
  }
  if (/\.rtf$/i.test(origName) || text.startsWith('{\\rtf')) return rtfToText(text);
  if (/\.html?$/i.test(origName)) return htmlToText(text);
  return text;
}

module.exports = { extractFileText, IMAGE_MIMES, PAGE_MARK };

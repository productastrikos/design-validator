#!/usr/bin/env node
'use strict';

// Generates the Excel workbooks in sample-docs/. exceljs is used rather than a
// Python library because it can store each formula together with its calculated
// result: the ELA parser and most previewers read that cached value, exactly as
// they do for a workbook saved by Excel. Everything here is fictitious.
//
//   node scripts/sample-docs/workbooks.js

const path = require('path');
const ExcelJS = require('../../server/node_modules/exceljs');

const OUT = path.join(__dirname, '..', '..', 'sample-docs');
const NOTICE = 'SAMPLE DOCUMENT - fictitious data for demonstration only';
const FONT = { name: 'Arial', size: 10 };
const BOLD = { name: 'Arial', size: 10, bold: true };
const TITLE = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF17324D' } };
const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF2' } };
const BORDER = ['top', 'left', 'bottom', 'right'].reduce((b, k) => ({ ...b, [k]: { style: 'thin', color: { argb: 'FF9AA7B4' } } }), {});
const round3 = n => Math.round(n * 1000) / 1000;

function colLetter(n) {
  let s = '';
  for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
  return s;
}

function styleRange(ws, row, fromCol, toCol, { font = FONT, fill, border = true, numFmt } = {}) {
  for (let c = fromCol; c <= toCol; c++) {
    const cell = ws.getCell(row, c);
    cell.font = font;
    if (fill) cell.fill = fill;
    if (border) cell.border = BORDER;
    if (numFmt) cell.numFmt = numFmt;
  }
}

// ── 17  Electrical Load Analysis ─────────────────────────────────────────────
const MODES = ['SAILING', 'MANOEUVRING', 'HARBOUR', 'EMERGENCY'];

// [consumer, no. off, rated kW, [D.F. per mode], [no. in use per mode]]
const BOARDS = {
  '415V MSB': { title: 'Main switchboard consumers', rows: [
    ['Bow thruster',            1, 250, [0, 0.85, 0, 0],       [0, 1, 0, 0]],
    ['Main engine LO priming pump', 2, 7.5, [0.2, 0.2, 0.2, 0], [1, 1, 1, 0]],
    ['Main engine cooling SW pump', 2, 18.5, [0.8, 0.8, 0, 0], [2, 2, 0, 0]],
    ['Fuel oil transfer pump',  2, 5.5, [0.5, 0.2, 0.3, 0],    [1, 1, 1, 0]],
    ['Bilge pump',              2, 15, [0.2, 0.2, 0.2, 0],     [1, 1, 1, 0]],
    ['Ballast pump',            2, 22, [0.3, 0.8, 0.5, 0],     [1, 2, 1, 0]],
    ['Main fire pump',          2, 22, [0.1, 0.1, 0.1, 0],     [1, 1, 1, 0]],
    ['Steering gear pump 1',    1, 11, [0.6, 0.9, 0, 0],       [1, 1, 0, 0]],
    ['ER supply fan',           2, 11, [0.9, 0.9, 0.6, 0],     [2, 2, 1, 0]],
    ['ER exhaust fan',          1, 7.5, [0.9, 0.9, 0.6, 0],    [1, 1, 1, 0]],
    ['Accommodation A/C plant', 1, 45, [0.8, 0.8, 0.8, 0],     [1, 1, 1, 0]],
    ['Deck crane',              1, 55, [0, 0.3, 0.4, 0],       [0, 1, 1, 0]],
    ['Windlass and mooring winches', 3, 18.5, [0, 0.6, 0.1, 0], [0, 2, 1, 0]],
    ['Galley equipment',        1, 28, [0.6, 0.6, 0.6, 0],     [1, 1, 1, 0]],
    ['Air compressor',          2, 11, [0.3, 0.5, 0.2, 0],     [1, 1, 1, 0]],
  ] },
  '230V MSB': { title: 'Lighting and small power from the 415/230 V transformers', rows: [
    ['Accommodation lighting',  1, 14, [0.7, 0.7, 0.9, 0],     [1, 1, 1, 0]],
    ['Machinery space lighting', 1, 9, [0.9, 0.9, 0.9, 0],     [1, 1, 1, 0]],
    ['Deck floodlights',        1, 8, [0.2, 0.6, 0.6, 0],      [1, 1, 1, 0]],
    ['Socket outlets and small power', 1, 12, [0.4, 0.4, 0.5, 0], [1, 1, 1, 0]],
    ['Navigation and bridge equipment supply', 1, 6, [0.9, 0.9, 0.3, 0], [1, 1, 1, 0]],
  ] },
  '415V ESB': { title: 'Emergency switchboard consumers', rows: [
    ['Emergency fire pump',     1, 15, [0, 0, 0, 1],           [0, 0, 0, 1]],
    ['Steering gear pump 2',    1, 11, [0.6, 0.9, 0, 0.9],     [1, 1, 0, 1]],
    ['Emergency air compressor', 1, 4, [0, 0, 0.2, 0.3],       [0, 0, 1, 1]],
    ['Fire damper and ventilation closing', 1, 2.5, [0, 0, 0, 0.6], [0, 0, 0, 1]],
    ['Rescue boat davit',       1, 7.5, [0, 0, 0, 0.5],        [0, 0, 0, 1]],
  ] },
  '230V ESB': { title: 'Emergency lighting and services', rows: [
    ['Emergency lighting',      1, 8, [0.1, 0.1, 0.1, 1],      [1, 1, 1, 1]],
    ['Navigation lights',       1, 1.5, [0.8, 0.8, 0, 1],      [1, 1, 0, 1]],
    ['Radio and GMDSS charger', 1, 3, [0.6, 0.6, 0.3, 1],      [1, 1, 1, 1]],
    ['Fire detection and alarm panel', 1, 1.2, [1, 1, 1, 1],   [1, 1, 1, 1]],
    ['Public address and general alarm', 1, 2.4, [0.3, 0.3, 0.3, 1], [1, 1, 1, 1]],
  ], transformerKva: 25 },
};

function addLoadSheet(wb, name, board) {
  const ws = wb.addWorksheet(name);
  const firstMode = 5;                    // A Sl.No | B Consumer | C No. Off | D Rated kW | E… mode triples
  const lastCol = firstMode + MODES.length * 3 - 1;
  ws.getCell(1, 1).value = 'ELECTRICAL LOAD ANALYSIS - OSV-45 MULTIPURPOSE OFFSHORE SUPPORT VESSEL (Hull No.: 101)';
  ws.getCell(1, 1).font = TITLE;
  ws.getCell(2, 1).value = `${name} - ${board.title}`;
  ws.getCell(2, 1).font = BOLD;
  ws.getCell(3, 1).value = NOTICE;
  ws.getCell(3, 1).font = { ...FONT, italic: true };

  // Mode names sit above each [D.F. | No. in use | Load (kW)] group.
  MODES.forEach((m, i) => {
    const col = firstMode + i * 3;
    ws.mergeCells(4, col, 4, col + 2);
    const c = ws.getCell(4, col);
    c.value = m; c.font = BOLD; c.fill = HEAD_FILL; c.alignment = { horizontal: 'center' }; c.border = BORDER;
  });

  const header = ['Sl.No', 'Consumer', 'No. Off', 'Rated (kW)'];
  MODES.forEach(() => header.push('D.F.', 'No. in use', 'Load (kW)'));
  header.forEach((h, i) => { ws.getCell(5, i + 1).value = h; });
  styleRange(ws, 5, 1, lastCol, { font: BOLD, fill: HEAD_FILL });

  const totals = MODES.map(() => 0);
  board.rows.forEach(([consumer, noOff, kw, dfs, used], i) => {
    const r = 6 + i;
    ws.getCell(r, 1).value = i + 1;
    ws.getCell(r, 2).value = consumer;
    ws.getCell(r, 3).value = noOff;
    ws.getCell(r, 4).value = kw;
    MODES.forEach((_, m) => {
      const col = firstMode + m * 3;
      const load = round3(kw * dfs[m] * used[m]);
      totals[m] += load;
      ws.getCell(r, col).value = dfs[m];
      ws.getCell(r, col + 1).value = used[m];
      ws.getCell(r, col + 2).value = { formula: `$D${r}*${colLetter(col)}${r}*${colLetter(col + 1)}${r}`, result: load };
      ws.getCell(r, col + 2).numFmt = '0.00';
    });
    styleRange(ws, r, 1, lastCol);
  });

  const first = 6, last = 5 + board.rows.length, totalRow = last + 1;
  ws.getCell(totalRow, 1).value = 'LOAD (kW)';
  MODES.forEach((_, m) => {
    const col = firstMode + m * 3 + 2, L = colLetter(col);
    ws.getCell(totalRow, col).value = { formula: `SUM(${L}${first}:${L}${last})`, result: round3(totals[m]) };
    ws.getCell(totalRow, col).numFmt = '0.00';
  });
  styleRange(ws, totalRow, 1, lastCol, { font: BOLD, fill: HEAD_FILL });

  if (board.transformerKva) {
    ws.getCell(totalRow + 2, 1).value = 'Calculated Minimum Transformer Capacity (kVA)';
    ws.getCell(totalRow + 2, 1).font = BOLD;
    ws.getCell(totalRow + 2, 5).value = board.transformerKva;
    ws.getCell(totalRow + 2, 5).font = BOLD;
  }

  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 38;
  for (let c = 3; c <= lastCol; c++) ws.getColumn(c).width = 10.5;
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 5 }];
  return totals;
}

async function ela() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sample data'; wb.title = 'Electrical Load Analysis - OSV-45';
  const cover = wb.addWorksheet('Cover');
  [
    ['ELECTRICAL LOAD ANALYSIS', TITLE],
    ['OSV-45 Multipurpose Offshore Support Vessel - Hull 101', BOLD],
    ['Document No.: EX-101-EL-ELA-005   Rev. A', FONT],
    [NOTICE, { ...FONT, italic: true }],
    ['', FONT],
    ['Design basis', BOLD],
    ['Average power factor: 0.8', FONT],
    ['Design margin: 10 %', FONT],
    ['Main plant: 03 x Diesel Generator of 312.5 kVA shall be considered, with one unit in standby.', FONT],
    ['Emergency plant: 01 x Emergency Generator of 75 kVA is currently under review.', FONT],
    ['', FONT],
    ['How to read this workbook', BOLD],
    ['Load (kW) = Rated (kW) x D.F. x No. in use, computed per operating mode on each switchboard sheet.', FONT],
    ['Blue figures are inputs: edit the rated power, D.F. or number in use, and the loads recalculate in Excel.', FONT],
  ].forEach(([t, f], i) => { const c = cover.getCell(i + 1, 1); c.value = t; c.font = f; });
  cover.getColumn(1).width = 100;

  const summary = {};
  for (const [name, board] of Object.entries(BOARDS)) summary[name] = addLoadSheet(wb, name, board);

  // Inputs in blue, formulas stay black.
  for (const name of Object.keys(BOARDS)) {
    const ws = wb.getWorksheet(name);
    const n = BOARDS[name].rows.length;
    for (let r = 6; r < 6 + n; r++) {
      ws.getCell(r, 4).font = { ...FONT, color: { argb: 'FF0000FF' } };
      MODES.forEach((_, m) => {
        const col = 5 + m * 3;
        ws.getCell(r, col).font = { ...FONT, color: { argb: 'FF0000FF' } };
        ws.getCell(r, col + 1).font = { ...FONT, color: { argb: 'FF0000FF' } };
      });
    }
  }
  await wb.xlsx.writeFile(path.join(OUT, '17_Electrical_Load_Analysis.xlsx'));
  console.log('  wrote 17_Electrical_Load_Analysis.xlsx');
  return summary;
}

// ── 05  Vendor compliance statement ──────────────────────────────────────────
async function compliance() {
  const rows = [
    ['2.1', 'One X-band radar, one S-band radar and two ECDIS workstations on a redundant bridge LAN', 'Complied', 'Non-redundant LAN offered as our standard.'],
    ['2.3', 'Automatic tracking of not less than 100 targets and AIS display', 'Complied', ''],
    ['3.1', 'X-band transmitter not less than 25 kW; S-band not less than 30 kW', 'Complied', 'Refer to our technical offer.'],
    ['3.2', 'Display not less than 23.1 inches, 1920 x 1200 pixels', 'Complied', ''],
    ['3.3', 'Radar to MSC.192(79) and IEC 62388; ECDIS to MSC.232(82) and IEC 61174', 'Complied', ''],
    ['3.4', 'All interfaces to IEC 61162 included in the base price', 'Partly complied', 'VDR and echo sounder interfaces are optional.'],
    ['3.5', '230 V AC with a UPS of not less than 30 minutes', 'Complied', ''],
    ['4.1', 'Type tested to IEC 60945', 'Complied', ''],
    ['4.2', 'Antenna units IP56, -25 C to +55 C', 'Complied', ''],
    ['4.3', 'Below-deck units -15 C to +55 C at up to 95% RH', 'Complied', ''],
    ['5.1', 'MTBF not less than 10,000 h; MTTR not more than 2 h', 'Will comply', 'Figures at the post-order stage.'],
    ['5.2', 'Built-in test to line-replaceable-unit level', 'Complied', ''],
    ['5.3', 'Product support for not less than 10 years', 'Complied', ''],
    ['6.1', 'Valid marine type-approval certificate with the offer', 'Complied', 'Certificate under process.'],
    ['6.2', 'On-board spares for two years; priced base spares list', 'Not complied', 'One year spares offered.'],
    ['6.3', 'FAT, plus HAT and SAT attendance at no extra cost', 'Not complied', 'HAT and SAT at standard rates.'],
    ['6.4', 'On-board training for 6 operators and 2 maintainers', 'Not complied', 'Training at works for up to 4 persons.'],
    ['6.5', 'Warranty not less than 24 months from vessel delivery', 'Not complied', '12 months from commissioning.'],
    ['6.6', 'Documents in English, printed and searchable electronic form', 'Not complied', 'Printed copy only.'],
    ['6.7', 'Delivery within 8 months of purchase order', 'Not complied', '10 to 12 months.'],
  ];
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sample data'; wb.title = 'Technical Compliance Statement - Acme Marine Electronics';
  const ws = wb.addWorksheet('Compliance Statement');
  ws.getCell('A1').value = 'TECHNICAL COMPLIANCE STATEMENT - ACME MARINE ELECTRONICS';
  ws.getCell('A1').font = TITLE;
  ws.getCell('A2').value = 'Against SOTR EX-101-SOTR-021 Rev. A - Navigation Radar and ECDIS System - Hull 101';
  ws.getCell('A2').font = BOLD;
  ws.getCell('A3').value = NOTICE;
  ws.getCell('A3').font = { ...FONT, italic: true };
  ['Clause', 'Requirement (summary)', 'Vendor reply', 'Remarks'].forEach((h, i) => { ws.getCell(5, i + 1).value = h; });
  styleRange(ws, 5, 1, 4, { font: BOLD, fill: HEAD_FILL });
  rows.forEach((row, i) => {
    row.forEach((v, c) => { ws.getCell(6 + i, c + 1).value = v; ws.getCell(6 + i, c + 1).alignment = { wrapText: true, vertical: 'top' }; });
    styleRange(ws, 6 + i, 1, 4);
  });
  const last = 5 + rows.length;
  ws.getCell(last + 2, 2).value = 'Clauses replied "Complied"';
  ws.getCell(last + 2, 3).value = { formula: `COUNTIF(C6:C${last},"Complied")`, result: rows.filter(r => r[2] === 'Complied').length };
  ws.getCell(last + 3, 2).value = 'Clauses replied "Not complied"';
  ws.getCell(last + 3, 3).value = { formula: `COUNTIF(C6:C${last},"Not complied")`, result: rows.filter(r => r[2] === 'Not complied').length };
  for (const r of [last + 2, last + 3]) { ws.getCell(r, 2).font = BOLD; ws.getCell(r, 3).font = BOLD; }
  ws.columns = [{ width: 9 }, { width: 66 }, { width: 16 }, { width: 42 }];
  ws.views = [{ state: 'frozen', ySplit: 5 }];
  await wb.xlsx.writeFile(path.join(OUT, '05_Compliance_Statement_Acme.xlsx'));
  console.log('  wrote 05_Compliance_Statement_Acme.xlsx');
}

// ── 18  Budgetary quotations ─────────────────────────────────────────────────
async function quotations() {
  const rows = [
    ['Acme Power Systems', 'Diesel generator set, 250 kW, 415 V', 3, 4150000, 'Valid 90 days; delivery 7 months'],
    ['Globex Power Systems', 'Diesel generator set, 250 kW, 415 V', 3, 4375000, 'Valid 60 days; delivery 6 months'],
    ['Acme Power Systems', 'Emergency generator set, 75 kVA', 1, 1450000, 'Valid 90 days'],
    ['Globex Power Systems', 'Emergency generator set, 75 kVA', 1, 1380000, 'Valid 60 days'],
    ['Acme Switchgear', 'Main switchboard with PMS', 1, 6800000, 'Includes FAT'],
    ['Globex Switchgear', 'Main switchboard with PMS', 1, 7250000, 'Excludes class witness fees'],
    ['Acme Marine Electronics', 'Navigation radar and ECDIS system', 1, 5950000, 'Excludes VDR interface'],
    ['Globex Marine Systems', 'Navigation radar and ECDIS system', 1, 6420000, 'All interfaces included'],
    ['Acme Sound Systems', 'Public address and general alarm system', 1, 1275000, 'Valid 90 days'],
    ['Acme Marine Pumps', 'Bilge pump, 40 m3/h', 2, 325000, 'Valid 90 days'],
    ['Globex Pumps', 'Bilge pump, 40 m3/h', 2, 348000, 'Valid 45 days'],
    ['Acme Steering Systems', 'Electro-hydraulic steering gear', 2, 5100000, 'Delivery 9 months'],
  ];
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sample data'; wb.title = 'Budgetary Quotations - Hull 101';
  const ws = wb.addWorksheet('Budgetary Quotations');
  ws.getCell('A1').value = 'BUDGETARY QUOTATIONS RECEIVED - HULL 101';
  ws.getCell('A1').font = TITLE;
  ws.getCell('A2').value = NOTICE;
  ws.getCell('A2').font = { ...FONT, italic: true };
  ws.getCell('A3').value = 'All rates are indicative figures in INR per unit, entered as received. Total = Qty x Unit rate.';
  ws.getCell('A3').font = FONT;
  ['Vendor', 'Item', 'Qty', 'Unit rate (INR)', 'Total (INR)', 'Remark'].forEach((h, i) => { ws.getCell(5, i + 1).value = h; });
  styleRange(ws, 5, 1, 6, { font: BOLD, fill: HEAD_FILL });
  rows.forEach(([vendor, item, qty, rate, remark], i) => {
    const r = 6 + i;
    ws.getCell(r, 1).value = vendor;
    ws.getCell(r, 2).value = item;
    ws.getCell(r, 3).value = qty;
    ws.getCell(r, 4).value = rate;
    ws.getCell(r, 5).value = { formula: `C${r}*D${r}`, result: qty * rate };
    ws.getCell(r, 6).value = remark;
    styleRange(ws, r, 1, 6);
    ws.getCell(r, 3).font = { ...FONT, color: { argb: 'FF0000FF' } };
    ws.getCell(r, 4).font = { ...FONT, color: { argb: 'FF0000FF' } };
    ws.getCell(r, 4).numFmt = '#,##0';
    ws.getCell(r, 5).numFmt = '#,##0';
  });
  ws.columns = [{ width: 26 }, { width: 44 }, { width: 7 }, { width: 16 }, { width: 16 }, { width: 34 }];
  ws.views = [{ state: 'frozen', ySplit: 5 }];
  await wb.xlsx.writeFile(path.join(OUT, '18_Budgetary_Quotations.xlsx'));
  console.log('  wrote 18_Budgetary_Quotations.xlsx');
}

(async () => {
  const summary = await ela();
  await compliance();
  await quotations();
  console.log('\nELA per-mode totals (kW):');
  for (const [name, totals] of Object.entries(summary)) {
    console.log(`  ${name.padEnd(9)} ${MODES.map((m, i) => `${m}=${round3(totals[i])}`).join('  ')}`);
  }
})().catch(err => { console.error(err); process.exit(1); });

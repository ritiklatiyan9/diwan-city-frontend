import ExcelJS from 'exceljs';
import { isIncludedExpense } from './loadExpenseStatement.js';

const C = { navy: '172D46', teal: '087F8C', ink: '26384A', muted: '65758A', light: 'F1F6FA', line: 'DDE6EE', white: 'FFFFFF', red: 'B13E48', amber: 'FFF3DD' };
const MONEY = '"₹" #,##0.00;[Red]("₹" #,##0.00);"₹" "–"';
const DATE = 'dd mmm yyyy';
const STAMP = 'dd mmm yyyy hh:mm';
const CASH = new Set(['CASH', 'CASH PLOT PAYMENT', 'CASH REFUND PLOT PAYMENT', 'PAY ADVANCE']);
const SCOPE = 'All expense records available in this module for the selected site; screen filters are not applied. Bounced/returned cheques are omitted by the source.';
const RULES = 'Totals include approved and pending entries. Rejected entries are retained with zero counted amounts. Any supplied bounced/returned entries also count as zero. Net movement = counted credits − counted debits, starting at zero; this is not an account balance.';
const str = value => value == null ? '' : String(value);
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const cents = value => Math.sign(num(value)) * Math.round((Math.abs(num(value)) + Number.EPSILON) * 100);
const net = (credit, debit) => (cents(credit) - cents(debit)) / 100;
const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function timestamp(value) {
  if (value == null || value === '') return null;
  const parsed = new Date(typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// PostgreSQL dates may arrive through GraphQLString as epoch milliseconds.
// Write logical calendar days as UTC-midnight Excel dates, without letting the
// machine timezone shift the day. Explicit source calendar dates stay intact.
function calendarDate(value) {
  if (value == null || value === '') return null;
  const explicit = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (explicit) {
    const date = new Date(Date.UTC(+explicit[1], +explicit[2] - 1, +explicit[3]));
    return date.getUTCFullYear() === +explicit[1] && date.getUTCMonth() === +explicit[2] - 1 && date.getUTCDate() === +explicit[3] ? date : null;
  }
  const parsed = timestamp(value);
  if (!parsed) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(parsed);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return new Date(Date.UTC(+values.year, +values.month - 1, +values.day));
}

function merge(sheet, row, start, end, value, options = {}) {
  sheet.mergeCells(row, start, row, end);
  const cell = sheet.getCell(row, start);
  cell.value = value;
  cell.font = { name: 'Aptos', size: 10, color: { argb: C.ink }, ...options.font };
  cell.alignment = { vertical: 'middle', wrapText: true };
  if (options.fill) cell.fill = fill(options.fill);
  return cell;
}

function sheetBase(workbook, name, widths, title, data) {
  const sheet = workbook.addWorksheet(name, {
    properties: { defaultRowHeight: 25, tabColor: { argb: name === 'Summary' ? C.teal : C.navy } },
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 } },
  });
  sheet.columns = widths.map(width => ({ width }));
  merge(sheet, 1, 1, widths.length, title.toUpperCase(), { fill: C.navy, font: { size: 19, bold: true, color: { argb: C.white } } });
  sheet.getRow(1).height = 40;
  merge(sheet, 2, 1, widths.length, data.site?.name || 'Site', { font: { size: 12, bold: true, color: { argb: C.teal } } });
  sheet.getRow(2).height = 27;
  const generated = timestamp(data.generatedAt) || new Date();
  merge(sheet, 3, 1, widths.length, `All module expense records • Generated ${generated.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST • Currency: INR`, { font: { size: 9, color: { argb: C.muted } } });
  sheet.getRow(3).height = 24;
  sheet.headerFooter.oddFooter = `&L${str(data.site?.name).replace(/&/g, '&&')}&CExpense Statement&RPage &P of &N`;
  return sheet;
}

function header(sheet, index, labels) {
  const row = sheet.getRow(index);
  row.values = labels;
  row.height = 40;
  row.eachCell({ includeEmpty: true }, cell => {
    cell.fill = fill(C.navy);
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: C.white } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
}

function dataRow(sheet, values, index, formats = {}) {
  const row = sheet.addRow(values);
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.fill = fill(index % 2 ? C.white : C.light);
    cell.font = { name: 'Aptos', size: 10, color: { argb: C.ink } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'hair', color: { argb: C.line } } };
    if (formats[col]) { cell.numFmt = formats[col]; cell.alignment.horizontal = 'right'; }
  });
  row.height = Math.min(409, Math.max(28, ...values.map((value, col) => {
    const width = Math.max(7, (sheet.getColumn(col + 1).width || 15) - 3);
    const source = value && typeof value === 'object' && value.text ? value.text : value instanceof Date ? '' : str(value);
    return source.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / width)), 0) * 14 + 8;
  })));
  return row;
}

function totalRow(sheet, values, formats = {}) {
  const row = dataRow(sheet, values, 0, formats);
  row.height = 31;
  // Include empty cells so the entire total band has a continuous fill.
  for (let col = 1; col <= values.length; col++) {
    const cell = row.getCell(col);
    cell.fill = fill(C.teal);
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: C.white } };
  }
  return row;
}

function finishRegister(sheet, row, labels, count) {
  sheet.views = [{ state: 'frozen', ySplit: row, xSplit: 2, showGridLines: false, activeCell: `A${row + 1}`, zoomScale: 85 }];
  if (count) sheet.autoFilter = { from: { row, column: 1 }, to: { row: row + count, column: labels.length } };
  sheet.pageSetup.printTitlesRow = `${row}:${row}`;
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(labels.length).letter}${sheet.rowCount}`;
}

function normalize(expenses) {
  return expenses.map((row, index) => {
    const mode = row.payment_mode == null ? 'CASH' : str(row.payment_mode).toUpperCase();
    const reason = isIncludedExpense(row) ? '' : row.status == null ? 'Missing status' : str(row.status).trim().toLowerCase() === 'rejected' ? 'Rejected' : `Cheque ${str(row.cheque_status).trim().toLowerCase()}`;
    return { raw: row, index, date: calendarDate(row.date), id: str(row.id), category: str(row.category).trim() ? str(row.category) : 'Uncategorised', mode, displayMode: mode || '(blank)', channel: CASH.has(mode) ? 'Cash' : 'Bank / other', debit: cents(row.debit) / 100, credit: cents(row.credit) / 100, countedDebit: reason ? 0 : cents(row.debit) / 100, countedCredit: reason ? 0 : cents(row.credit) / 100, reason };
  }).sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0) || (timestamp(a.raw.created_at)?.getTime() || 0) - (timestamp(b.raw.created_at)?.getTime() || 0) || a.id.localeCompare(b.id, 'en', { numeric: true }) || a.index - b.index);
}

function sums(rows) {
  const totals = rows.reduce((totals, row) => ({ records: totals.records + 1, included: totals.included + (row.reason ? 0 : 1), debit: totals.debit + cents(row.countedDebit), credit: totals.credit + cents(row.countedCredit) }), { records: 0, included: 0, debit: 0, credit: 0 });
  return { ...totals, debit: totals.debit / 100, credit: totals.credit / 100 };
}

function groups(rows, field) {
  const grouped = new Map();
  rows.forEach(row => { const key = row[field]; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(row); });
  return [...grouped].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([key, values]) => [key, sums(values)]);
}

function addSummary(workbook, data, rows) {
  const sheet = sheetBase(workbook, 'Summary', [29, 29, 16, 16, 23, 23, 24, 27], 'Expense Statement', data);
  const totals = sums(rows);
  const cards = [['EXPENSE RECORDS', rows.length, '#,##0'], ['COUNTED DEBITS', totals.debit, MONEY], ['COUNTED CREDITS', totals.credit, MONEY], ['NET MOVEMENT', net(totals.credit, totals.debit), MONEY]];
  cards.forEach(([label, value, format], index) => {
    const col = index * 2 + 1;
    merge(sheet, 5, col, col + 1, label, { fill: C.light, font: { size: 9, bold: true, color: { argb: C.muted } } });
    const valueCell = merge(sheet, 6, col, col + 1, value, { fill: C.light, font: { size: 20, bold: true, color: { argb: C.teal } } });
    valueCell.numFmt = format;
  });
  sheet.getRow(5).height = 25;
  sheet.getRow(6).height = 39;
  sheet.getRow(4).height = 12;
  sheet.getRow(7).height = 12;
  merge(sheet, 8, 1, 8, SCOPE, { font: { size: 10, color: { argb: C.muted } } });
  sheet.getRow(8).height = 30;
  const missingStatus = rows.filter(row => row.reason === 'Missing status').length;
  merge(sheet, 9, 1, 8, `${RULES}${missingStatus ? ` ${missingStatus} missing-status record(s) are also excluded from totals.` : ''}`, { font: { size: 10, color: { argb: C.muted } } });
  sheet.getRow(9).height = missingStatus ? 50 : 43;
  sheet.getRow(10).height = 12;
  const labels = ['Category / Mode', 'Payment Channel', 'Records', 'Counted Records', 'Counted Debit (₹)', 'Counted Credit (₹)', 'Net Movement (₹)', 'Excluded Records'];
  const formats = { 3: '#,##0', 4: '#,##0', 5: MONEY, 6: MONEY, 7: MONEY, 8: '#,##0' };
  const section = (title, items, classifier) => {
    const first = sheet.rowCount + 1;
    merge(sheet, first, 1, 8, title, { fill: C.teal, font: { bold: true, size: 12, color: { argb: C.white } } });
    sheet.getRow(first).height = 30;
    header(sheet, first + 1, labels);
    items.forEach(([key, value], index) => dataRow(sheet, [key, classifier(key), value.records, value.included, value.debit, value.credit, net(value.credit, value.debit), value.records - value.included], index, formats));
    if (!items.length) { merge(sheet, sheet.rowCount + 1, 1, 8, 'No expense records available.'); sheet.getRow(sheet.rowCount).height = 30; }
    totalRow(sheet, ['TOTAL', '', totals.records, totals.included, totals.debit, totals.credit, net(totals.credit, totals.debit), totals.records - totals.included], formats);
    sheet.getRow(sheet.rowCount + 1).height = 15;
  };
  section('CATEGORY SUMMARY', groups(rows, 'category'), key => {
    const channels = new Set(rows.filter(row => row.category === key).map(row => row.channel));
    return channels.size > 1 ? 'Cash & Bank / other' : [...channels][0] || '';
  });
  section('PAYMENT MODE SUMMARY', groups(rows, 'displayMode'), key => CASH.has(key) ? 'Cash' : 'Bank / other');
  merge(sheet, sheet.rowCount + 1, 1, 8, 'Each record contributes to one category and one payment mode. Category labels are preserved as a whole. Missing modes use CASH; an explicitly blank mode belongs to Bank / other, following the module rules.', { font: { size: 9, color: { argb: C.muted } } });
  sheet.getRow(sheet.rowCount).height = 35;
  sheet.pageSetup.printArea = `A1:H${sheet.rowCount}`;
  sheet.views = [{ state: 'frozen', ySplit: 3, showGridLines: false, zoomScale: 90 }];
}

function addStatement(workbook, data, rows) {
  const sheet = sheetBase(workbook, 'Expense Statement', [14, 14, 23, 23, 24, 17, 20, 20, 20, 22, 22, 42], 'Complete Expense Statement', data);
  merge(sheet, 4, 1, 12, 'Debit and credit are recorded source amounts. Counted net and running net exclude rejected / bounced / returned entries. Running net starts at zero and is movement across this statement, not the stored account balance.', { font: { size: 9, color: { argb: C.muted } } });
  sheet.getRow(4).height = 32;
  const labels = ['Date', 'Entry ID', 'From', 'To', 'Category', 'Payment Mode', 'Recorded Debit (₹)', 'Recorded Credit (₹)', 'Counted Net (₹)', 'Running Net Movement (₹)', 'Approval / Exclusion', 'Remark'];
  header(sheet, 6, labels);
  const formats = { 1: DATE, 7: MONEY, 8: MONEY, 9: MONEY, 10: MONEY };
  let runningCents = 0;
  rows.forEach((row, index) => {
    const movementCents = cents(row.countedCredit) - cents(row.countedDebit);
    runningCents += movementCents;
    const rendered = dataRow(sheet, [row.date, row.id, row.raw.from_entity || '', row.raw.to_entity || '', row.category, row.displayMode, row.debit, row.credit, movementCents / 100, runningCents / 100, [row.raw.status || 'Not specified', row.reason ? `Excluded: ${row.reason}` : ''].filter(Boolean).join('\n'), row.raw.remark || ''], index, formats);
    if (row.reason) { rendered.getCell(11).fill = fill(C.amber); rendered.getCell(11).font.color = { argb: C.red }; }
  });
  if (!rows.length) { merge(sheet, 7, 1, 12, 'No expense records available in this site.'); sheet.getRow(7).height = 30; }
  totalRow(sheet, ['', 'STATEMENT TOTAL', '', '', '', 'Recorded totals', rows.reduce((sum, row) => sum + cents(row.debit), 0) / 100, rows.reduce((sum, row) => sum + cents(row.credit), 0) / 100, runningCents / 100, runningCents / 100, 'Counted net shown', ''], formats);
  finishRegister(sheet, 6, labels, rows.length);
}

function hyperlink(value, label) {
  const url = str(value);
  return /^https?:\/\//i.test(url) ? { text: label, hyperlink: url } : url;
}

const fields = [
  ['id', 'Entry ID', 'id'], ['original_id', 'Original Source ID', 'id'], ['source', 'Source'], ['site_id', 'Site ID', 'id'], ['date', 'Date', 'date'], ['from_entity', 'From'], ['to_entity', 'To'], ['category', 'Category'], ['payment_mode', 'Payment Mode'], ['debit', 'Recorded Debit (₹)', 'money'], ['credit', 'Recorded Credit (₹)', 'money'],
  ['countedDebit', 'Counted Debit (₹)', 'derived'], ['countedCredit', 'Counted Credit (₹)', 'derived'], ['channel', 'Cash / Bank Classification', 'derived'], ['included', 'Included in Totals', 'derived'], ['reason', 'Exclusion Reason', 'derived'], ['remark', 'Remark'], ['account_no', 'Account No.', 'id'], ['branch', 'Branch'], ['status', 'Approval Status'], ['cheque_no', 'Cheque No.', 'id'], ['cheque_status', 'Cheque Status'], ['approved_by', 'Approved By ID', 'id'], ['approved_by_name', 'Approved By'], ['approved_at', 'Approved At (UTC)', 'stamp'], ['created_by', 'Created By ID', 'id'], ['created_by_name', 'Created By'], ['created_at', 'Created At (UTC)', 'stamp'], ['updated_at', 'Updated At (UTC)', 'stamp'], ['assigned_user_id', 'Assigned User ID', 'id'], ['assigned_user_name', 'Assigned User'], ['assigned_admin_id', 'Assigned Admin ID', 'id'], ['assigned_admin_name', 'Assigned Admin'], ['voucher_url', 'Voucher URL', 'link'], ['bill_url', 'Bill URL', 'link'], ['verifyUrl', 'Receipt Verification URL', 'link'], ['balance', 'Stored Source Balance (₹)', 'money'],
];

function addDetails(workbook, data, rows) {
  const known = new Set(fields.filter(([, , type]) => type !== 'derived').map(([key]) => key));
  const extra = [...new Set(rows.flatMap(row => Object.keys(row.raw)))].filter(key => !known.has(key) && !key.startsWith('__')).sort().map(key => [key, key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())]);
  const columns = [...fields, ...extra];
  const widths = columns.map(([key, , type]) => type === 'link' ? 24 : key === 'remark' ? 50 : ['from_entity', 'to_entity', 'category'].includes(key) ? 30 : type === 'stamp' ? 24 : type === 'money' || type === 'derived' ? 23 : type === 'id' ? 18 : 25);
  const sheet = sheetBase(workbook, 'Expense Details', widths, 'Expense Record Details', data);
  merge(sheet, 4, 1, widths.length, 'Stored source balance is preserved for reference only; summary and running movement are calculated independently. Timestamp columns are UTC. Account and cheque identifiers retain leading zeros.', { font: { size: 9, color: { argb: C.muted } } });
  sheet.getRow(4).height = 30;
  const labels = columns.map(([, label]) => label);
  header(sheet, 6, labels);
  const formats = Object.fromEntries(columns.flatMap(([, , type], index) => type === 'date' ? [[index + 1, DATE]] : type === 'stamp' ? [[index + 1, STAMP]] : type === 'money' ? [[index + 1, MONEY]] : []));
  formats[12] = MONEY;
  formats[13] = MONEY;
  rows.forEach((row, index) => {
    const values = columns.map(([key, , type]) => {
      if (type === 'derived') return key === 'included' ? row.reason ? 'No' : 'Yes' : row[key];
      if (type === 'id') return str(row.raw[key]);
      if (type === 'date') return row.date;
      if (type === 'stamp') return timestamp(row.raw[key]);
      if (type === 'money') return row.raw[key] == null || row.raw[key] === '' ? null : num(row.raw[key]);
      if (type === 'link') return hyperlink(row.raw[key], key === 'verifyUrl' ? 'Verify receipt' : key === 'bill_url' ? 'Open bill' : 'Open voucher');
      const value = row.raw[key];
      return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : value;
    });
    const rendered = dataRow(sheet, values, index, formats);
    columns.forEach(([, , type], col) => { if (type === 'link' && values[col]?.hyperlink) rendered.getCell(col + 1).font = { name: 'Aptos', size: 10, underline: true, color: { argb: C.teal } }; });
  });
  if (!rows.length) { merge(sheet, 7, 1, widths.length, 'No expense records available.'); sheet.getRow(7).height = 30; }
  finishRegister(sheet, 6, labels, rows.length);
  sheet.pageSetup.fitToPage = false;
  sheet.pageSetup.scale = 85;
  sheet.pageSetup.printTitlesColumn = 'A:B';
}

/** Build a fresh all-record statement; values remain native Excel dates/numbers. */
export async function buildExpenseStatementWorkbook(data) {
  if (!data || !Array.isArray(data.expenses) || data.expenses.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('The expense statement response is incomplete. Please try again.');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Diwan City';
  workbook.title = `${data.site?.name || 'Site'} — Expense Statement`;
  workbook.subject = 'All module expense records and movement';
  workbook.created = timestamp(data.generatedAt) || new Date();
  const rows = normalize(data.expenses);
  addSummary(workbook, data, rows);
  addStatement(workbook, data, rows);
  addDetails(workbook, data, rows);
  return workbook;
}

/** Download a workbook through the browser without exposing temporary files. */
export async function downloadExpenseStatement(data) {
  const workbook = await buildExpenseStatementWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const name = str(data.site?.name || 'Site').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Site';
  const today = new Date();
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const filename = `Expense_Statement_${name}_${day}.xlsx`;
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return filename;
}

import ExcelJS from 'exceljs';

const COLOR = { navy: '172D46', teal: '087F8C', ink: '26384A', muted: '65758A', light: 'F1F6FA', line: 'DDE6EE', white: 'FFFFFF', red: 'B13E48', amber: 'FFF3DD' };
const MONEY = '"₹" #,##0.00;[Red]("₹" #,##0.00);"₹" –';
const NUMBER = '#,##0.00;[Red](#,##0.00);–';
const DATE = 'dd mmm yyyy';
const DATE_TIME = 'dd mmm yyyy hh:mm';
const BANK_MODES = new Set(['BANK', 'CHEQUE', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'TRANSFER']);
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const active = row => !['BOUNCED', 'RETURNED'].includes(String(row.cheque_status || '').toUpperCase());
const text = value => value == null ? '' : String(value);
const pretty = value => text(value).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

// Dates in the source are calendar dates, not moments in the browser's timezone.
const excelDate = value => {
  if (!value) return null;
  const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const excelTimestamp = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const localDay = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fill = color => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } });

function mergedText(sheet, row, start, end, value, options = {}) {
  sheet.mergeCells(row, start, row, end);
  const cell = sheet.getCell(row, start);
  cell.value = value;
  cell.font = { name: 'Aptos', size: 10, color: { argb: COLOR.ink }, ...options.font };
  cell.alignment = { vertical: 'middle', wrapText: true, ...options.alignment };
  if (options.fill) cell.fill = fill(options.fill);
  return cell;
}

function makeSheet(workbook, name, widths, title, data) {
  const sheet = workbook.addWorksheet(name, {
    properties: { defaultRowHeight: 24, tabColor: { argb: name === 'Summary' ? COLOR.teal : COLOR.navy } },
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 } },
  });
  sheet.columns = widths.map(width => ({ width }));
  mergedText(sheet, 1, 1, widths.length, title.toUpperCase(), { font: { size: 19, bold: true, color: { argb: COLOR.white } }, fill: COLOR.navy });
  sheet.getRow(1).height = 40;
  mergedText(sheet, 2, 1, widths.length, data.site?.name || 'Site statement', { font: { size: 12, bold: true, color: { argb: COLOR.teal } } });
  sheet.getRow(2).height = 26;
  const generated = new Date(data.generatedAt || Date.now());
  const time = Number.isNaN(generated.getTime()) ? '' : generated.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  mergedText(sheet, 3, 1, widths.length, `All site plots • Complete transaction history • Generated ${time} IST`, { font: { size: 9, color: { argb: COLOR.muted } } });
  sheet.getRow(3).height = 22;
  sheet.headerFooter.oddFooter = `&L${text(data.site?.name).replace(/&/g, '&&')}&CPlot Payments Statement&RPage &P of &N`;
  return sheet;
}

function header(sheet, row, labels) {
  const target = sheet.getRow(row);
  target.values = labels;
  target.height = 34;
  target.eachCell(cell => {
    cell.fill = fill(COLOR.navy);
    cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLOR.white } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
}

function body(sheet, values, index, formats = {}) {
  const row = sheet.addRow(values);
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    cell.font = { name: 'Aptos', size: 10, color: { argb: COLOR.ink } };
    cell.fill = fill(index % 2 ? COLOR.white : COLOR.light);
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'hair', color: { argb: COLOR.line } } };
    if (formats[col]) { cell.numFmt = formats[col]; cell.alignment.horizontal = 'right'; }
  });
  // Fit source text at readable font sizes; Excel does not auto-fit wrapped rows.
  row.height = Math.min(409, Math.max(27, ...values.map((value, i) => {
    const width = sheet.getColumn(i + 1).width || 15;
    const lines = text(value instanceof Date ? '' : value).split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / Math.max(7, width - 3))), 0);
    return lines * 14 + 8;
  })));
  return row;
}

function register(sheet, headerRow, labels, rows, formats = {}, xSplit = 0) {
  header(sheet, headerRow, labels);
  rows.forEach((values, i) => body(sheet, values, i, formats));
  sheet.views = [{ state: 'frozen', ySplit: headerRow, xSplit, showGridLines: false, activeCell: `A${headerRow + 1}` }];
  if (rows.length) sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + rows.length, column: labels.length } };
  else {
    mergedText(sheet, headerRow + 1, 1, labels.length, 'No records available.', { font: { color: { argb: COLOR.muted }, italic: true } });
    sheet.getRow(headerRow + 1).height = 30;
  }
  sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(labels.length).letter}${sheet.rowCount}`;
}

function normalize(data) {
  const plots = [...(data.plots || [])].sort((a, b) => text(a.plot_no).localeCompare(text(b.plot_no), 'en', { numeric: true, sensitivity: 'base' }) || n(a.id) - n(b.id));
  const byId = new Map(plots.map(plot => [text(plot.id), plot]));
  const transactions = [
    ...(data.payments || []).map(row => ({ ...row, source: 'payment' })),
    ...(data.installmentPayments || []).map(row => ({ ...row, source: 'installment' })),
  ].filter(row => byId.has(text(row.plot_id))).map(row => {
    const installment = row.source === 'installment';
    const mode = text(installment ? row.payment_mode || 'CASH' : row.payment_type || 'CASH').toUpperCase();
    return { ...row, mode, dateValue: excelDate(installment ? row.payment_date : row.date), amountValue: n(row.amount), counted: active(row) ? n(row.amount) : 0, entry: `${installment ? 'IP' : 'PP'}-${row.id}`, sourceLabel: installment ? 'Installment payment' : 'Plot payment' };
  });
  const rank = new Map(plots.map((plot, i) => [text(plot.id), i]));
  transactions.sort((a, b) => rank.get(text(a.plot_id)) - rank.get(text(b.plot_id)) || (a.dateValue?.getTime() || 0) - (b.dateValue?.getTime() || 0) || text(a.created_at).localeCompare(text(b.created_at)) || a.entry.localeCompare(b.entry, 'en', { numeric: true }));
  const byPlot = new Map(plots.map(plot => [text(plot.id), []]));
  transactions.forEach(row => byPlot.get(text(row.plot_id)).push(row));
  return { plots, byId, transactions, byPlot };
}

function addSummary(workbook, data, model) {
  const { plots, transactions, byPlot } = model;
  const sheet = makeSheet(workbook, 'Summary', [6, 13, 10, 20, 30, 13, 20, 20, 20, 20, 20, 13], 'Plot Payments Statement', data);
  const sale = plots.reduce((sum, p) => sum + n(p.sale_price), 0);
  const received = transactions.reduce((sum, p) => sum + p.counted, 0);
  const cards = [
    ['TOTAL PLOTS', plots.length, '#,##0'], ['TOTAL SALE VALUE', sale, MONEY],
    ['TOTAL RECEIVED', received, MONEY], ['OUTSTANDING BALANCE', sale - received, MONEY],
  ];
  cards.forEach(([label, value, format], i) => {
    const start = i * 3 + 1;
    mergedText(sheet, 5, start, start + 2, label, { font: { size: 9, bold: true, color: { argb: COLOR.muted } }, fill: COLOR.light });
    const cell = mergedText(sheet, 6, start, start + 2, value, { font: { size: 19, bold: true, color: { argb: COLOR.teal } }, fill: COLOR.light });
    cell.numFmt = format;
  });
  sheet.getRow(5).height = 24;
  sheet.getRow(6).height = 38;
  mergedText(sheet, 8, 1, 12, `${transactions.length} transactions, including ${transactions.filter(row => !active(row)).length} bounced / returned entries. These entries remain in the history and contribute zero to receipts.`, { font: { size: 10, color: { argb: COLOR.muted } } });
  sheet.getRow(8).height = 30;
  mergedText(sheet, 9, 1, 12, 'Totals include every plot, including historical / OLD and cancelled records. Search and selection filters are not applied. Approval status does not filter receipts. All amounts in INR.', { font: { size: 9, color: { argb: COLOR.muted } } });
  sheet.getRow(9).height = 27;
  const rows = plots.map((p, i) => {
    const txns = byPlot.get(text(p.id));
    const total = txns.reduce((sum, t) => sum + t.counted, 0);
    const bank = txns.reduce((sum, t) => sum + ((t.source === 'installment' ? BANK_MODES.has(t.mode) : ['BANK', 'CHEQUE'].includes(t.mode)) ? t.counted : 0), 0);
    const cash = txns.reduce((sum, t) => sum + (t.mode === 'CASH' ? t.counted : 0), 0);
    return [i + 1, text(p.plot_no), p.block || '', p.status || '', p.buyer_name || '', n(p.plot_size), n(p.sale_price), bank, cash, total, n(p.sale_price) - total, txns.length];
  });
  register(sheet, 11, ['No.', 'Plot / Unit', 'Block', 'Status', 'Buyer', 'Area (Gaz)', 'Sale Value (₹)', 'Bank Received (₹)', 'Cash Received (₹)', 'Total Received (₹)', 'Balance (₹)', 'Transactions'], rows, { 6: NUMBER, 7: MONEY, 8: MONEY, 9: MONEY, 10: MONEY, 11: MONEY, 12: '#,##0' }, 2);
  if (rows.length) {
    const totals = [null, 'GRAND TOTAL', null, null, null, ...[5, 6, 7, 8, 9, 10, 11].map(index => rows.reduce((sum, row) => sum + n(row[index]), 0))];
    const row = body(sheet, totals, 0, { 6: NUMBER, 7: MONEY, 8: MONEY, 9: MONEY, 10: MONEY, 11: MONEY, 12: '#,##0' });
    row.eachCell({ includeEmpty: true }, cell => { cell.fill = fill(COLOR.teal); cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: COLOR.white } }; });
  }
  sheet.pageSetup.printArea = `A1:L${sheet.rowCount}`;
}

function addLedgers(workbook, data, model) {
  const sheet = makeSheet(workbook, 'Plot Ledgers', [15, 13, 20, 25, 14, 28, 28, 40, 22, 20, 20, 20], 'Plot-by-Plot Transaction Statements', data);
  mergedText(sheet, 5, 1, 12, 'Balance = sale value less counted receipts. Bounced / returned amounts are shown in full, with counted receipts of zero. Approval status is displayed without changing the module’s receipt calculation.', { font: { size: 9, color: { argb: COLOR.muted } } });
  sheet.getRow(5).height = 30;
  sheet.views = [{ state: 'frozen', ySplit: 5, showGridLines: false, zoomScale: 85 }];
  model.plots.forEach((p, i) => {
    const start = sheet.rowCount + 2;
    if (i > 0) sheet.getRow(start - 1).addPageBreak();
    mergedText(sheet, start, 1, 12, `${text(p.plot_no)}${p.block ? ` • Block ${p.block}` : ''}   |   ${p.buyer_name || 'Buyer not specified'}   |   ${p.status || 'Status not specified'}${p.plot_tag ? ` • ${p.plot_tag}` : ''}   |   Plot ID: ${p.id}`, { fill: COLOR.teal, font: { size: 12, bold: true, color: { argb: COLOR.white } } });
    sheet.getRow(start).height = 30;
    const txns = model.byPlot.get(text(p.id));
    const total = txns.reduce((sum, row) => sum + row.counted, 0);
    const meta = [
      `Size: ${n(p.plot_size)} Gaz${p.plot_size_mtr ? ` / ${n(p.plot_size_mtr)} Mtr` : ''}   •   Rate: ₹${n(p.plot_rate).toLocaleString('en-IN')}   •   Booking by: ${p.booking_by || '—'}   •   Team: ${p.team || '—'}`,
      `Sale value: ₹${n(p.sale_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}   •   Received: ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}   •   Balance: ₹${(n(p.sale_price) - total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}   •   Transactions: ${txns.length}`,
    ];
    meta.forEach((value, offset) => { mergedText(sheet, start + 1 + offset, 1, 12, value, { fill: COLOR.light }); sheet.getRow(start + 1 + offset).height = 27; });
    header(sheet, start + 3, ['Date', 'Entry ID', 'Source', 'From / Installment', 'Mode', 'Buyer / Booked By', 'Bank / Reference', 'Narration / Notes', 'Cheque / Approval', 'Amount (₹)', 'Counted Receipt (₹)', 'Balance (₹)']);
    let balance = n(p.sale_price);
    if (!txns.length) {
      mergedText(sheet, start + 4, 1, 12, 'No transactions recorded for this plot.', { font: { italic: true, color: { argb: COLOR.muted } } });
      sheet.getRow(start + 4).height = 30;
    }
    txns.forEach((t, j) => {
      balance -= t.counted;
      const row = body(sheet, [t.dateValue, t.entry, t.sourceLabel, t.payment_from || t.installment_name || '', t.mode, [t.buyer_name, t.booked_by].filter(Boolean).join('\n'), [t.bank_name, t.branch, t.bank_details, t.reference, t.cheque_no ? `Cheque: ${t.cheque_no}` : ''].filter(Boolean).join('\n'), t.narration || t.notes || '', [t.cheque_status, t.status ? `Approval: ${t.status}` : ''].filter(Boolean).join('\n'), t.amountValue, t.counted, balance], j, { 1: DATE, 10: MONEY, 11: MONEY, 12: MONEY });
      if (!active(t)) [9, 10, 11].forEach(col => { row.getCell(col).font.color = { argb: COLOR.red }; row.getCell(col).fill = fill(COLOR.amber); });
    });
    const close = body(sheet, ['', '', '', '', '', '', '', 'CLOSING TOTAL', '', txns.reduce((sum, t) => sum + t.amountValue, 0), total, balance], 0, { 10: MONEY, 11: MONEY, 12: MONEY });
    close.eachCell(cell => { cell.font.bold = true; cell.fill = fill('DFEFF0'); });
  });
  if (!model.plots.length) mergedText(sheet, 7, 1, 12, 'No plots available in this site.');
  sheet.pageSetup.printArea = `A1:L${sheet.rowCount}`;
}

function addTransactions(workbook, data, model) {
  const labels = ['Plot / Unit', 'Plot ID', 'Block', 'Plot Buyer', 'Entry ID', 'Source', 'Date', 'From', 'Installment', 'Mode', 'Amount (₹)', 'Counted Receipt (₹)', 'Included in Receipts', 'Buyer', 'Booked By', 'Received By', 'Bank Name', 'Branch', 'Bank / Cash Details', 'Reference', 'Cheque No.', 'Cheque Status', 'Approval Status', 'Narration / Notes', 'Created By', 'Assigned Admin', 'Approved By ID', 'Approved At (UTC)', 'Voucher URL', 'Created At (UTC)', 'Updated At (UTC)', 'Installment ID'];
  const widths = [14, 12, 10, 26, 14, 21, 16, 21, 23, 14, 20, 22, 20, 25, 25, 25, 25, 23, 34, 28, 21, 18, 18, 48, 25, 25, 17, 23, 45, 23, 23, 17];
  const sheet = makeSheet(workbook, 'Transactions', widths, 'Complete Transaction Register', data);
  const rows = model.transactions.map(t => {
    const p = model.byId.get(text(t.plot_id));
    return [text(p.plot_no), text(p.id), p.block || '', p.buyer_name || '', t.entry, t.sourceLabel, t.dateValue, t.payment_from || '', t.installment_name || '', t.mode, t.amountValue, t.counted, active(t) ? 'Yes' : 'No — bounced / returned', t.buyer_name || '', t.booked_by || '', t.received_by || '', t.bank_name || '', t.branch || '', t.bank_details || t.cash_details || '', t.reference || t.transaction_id || '', text(t.cheque_no), t.cheque_status || '', t.status || '', t.narration || t.notes || '', t.created_by_name || text(t.created_by), t.assigned_admin_name || text(t.assigned_admin_id), text(t.approved_by), excelTimestamp(t.approved_at), t.voucher_url || '', excelTimestamp(t.created_at), excelTimestamp(t.updated_at), text(t.installment_id)];
  });
  register(sheet, 5, labels, rows, { 7: DATE, 11: MONEY, 12: MONEY, 28: DATE_TIME, 30: DATE_TIME, 31: DATE_TIME }, 1);
  // The full register is deliberately wide. Let it span pages at a readable
  // scale; the grouped ledgers provide the compact printable statement.
  sheet.pageSetup.fitToPage = false;
  sheet.pageSetup.scale = 85;
  sheet.pageSetup.printTitlesColumn = 'A:A';
}

const numericFields = new Set(['plot_size', 'plot_size_mtr', 'plot_rate', 'sale_price', 'registry_area', 'circle_rate', 'to_receive_bank', 'first_installment', 'plc_charges', 'interest_rate', 'commission_value', 'commission_rate', 'plot_commission', 'original_plot_rate', 'discount_rate', 'penalty_rate', 'free_to_sale_days', 'grace_period_days', 'company_price', 'party_price', 'total_received', 'received_bank', 'received_cash', 'payment_count']);
const dateFields = new Set(['booking_date', 'created_at', 'updated_at']);
const categories = {
  plot_size: 'Area & pricing', plot_size_mtr: 'Area & pricing', plot_rate: 'Area & pricing', sale_price: 'Area & pricing', registry_area: 'Area & pricing', circle_rate: 'Area & pricing', plc_charges: 'Area & pricing', original_plot_rate: 'Area & pricing', discount_rate: 'Area & pricing', company_price: 'Area & pricing', party_price: 'Area & pricing',
  to_receive_bank: 'Collections', first_installment: 'Collections', total_received: 'Collections', received_bank: 'Collections', received_cash: 'Collections', payment_count: 'Collections',
};
const fieldLabel = key => ({ id: 'Plot ID', site_id: 'Site ID', plot_no: 'Plot / Unit Number', plot_size: 'Area (Gaz)', plot_size_mtr: 'Area (Mtr)', plot_rate: 'Rate (₹ / Gaz)', registry_area: 'Registry Area (Mtr)', interest_rate: 'Interest Rate (%)', penalty_rate: 'Penalty Rate', commission_rate: 'Commission Rate (₹)', plot_tag: 'Tag', payment_count: 'Transaction Count', created_at: 'Created At (UTC)', updated_at: 'Updated At (UTC)' }[key] || pretty(key));

function addDetails(workbook, data, model) {
  const sheet = makeSheet(workbook, 'Plot Details', [15, 12, 30, 25, 34, 70], 'Complete Plot Details', data);
  const rows = [];
  const formats = [];
  model.plots.forEach(p => {
    Object.entries(p).filter(([key]) => !key.startsWith('__')).forEach(([key, value]) => {
      let parsed = value;
      let format = null;
      if (dateFields.has(key)) { parsed = key === 'booking_date' ? excelDate(value) : excelTimestamp(value); format = key === 'booking_date' ? DATE : DATE_TIME; }
      else if (numericFields.has(key) && value != null && value !== '') { parsed = n(value); format = key.includes('size') || key.includes('area') || key.endsWith('days') || key === 'payment_count' || key === 'interest_rate' || key === 'penalty_rate' ? NUMBER : MONEY; }
      else if (typeof value === 'boolean') parsed = value ? 'Yes' : 'No';
      else if (value != null && typeof value === 'object') parsed = JSON.stringify(value);
      else parsed = text(value);
      const category = categories[key] || (/commission/.test(key) ? 'Commission' : /interest|penalty|grace|free_to_sale|installments_enabled/.test(key) ? 'Installment terms' : 'Plot record');
      rows.push([text(p.plot_no), p.block || '', p.buyer_name || '', category, fieldLabel(key), parsed]);
      formats.push(format);
    });
  });
  register(sheet, 5, ['Plot / Unit', 'Block', 'Buyer', 'Section', 'Field', 'Value'], rows, {}, 1);
  formats.forEach((format, i) => { if (format) sheet.getCell(i + 6, 6).numFmt = format; });
}

function addInstallments(workbook, data, model) {
  if (!(data.installments || []).length) return;
  const sheet = makeSheet(workbook, 'Installments', [15, 12, 29, 15, 29, 17, 20, 20, 20, 20, 20, 17, 16], 'Installment Schedule', data);
  mergedText(sheet, 4, 1, 13, 'Counted direct payments exclude bounced / returned cheques. Recorded paid amount and schedule status are preserved from the source; plot-level payments may be allocated separately by the application.', { font: { size: 9, color: { argb: COLOR.muted } } });
  sheet.getRow(4).height = 30;
  const rows = [...data.installments].filter(inst => model.byId.has(text(inst.plot_id))).sort((a, b) => text(model.byId.get(text(a.plot_id)).plot_no).localeCompare(text(model.byId.get(text(b.plot_id)).plot_no), 'en', { numeric: true }) || n(a.sort_order) - n(b.sort_order) || text(a.due_date).localeCompare(text(b.due_date))).map(inst => {
    const p = model.byId.get(text(inst.plot_id));
    const txns = model.byPlot.get(text(p.id)).filter(t => t.source === 'installment' && text(t.installment_id) === text(inst.id));
    return [text(p.plot_no), p.block || '', p.buyer_name || '', text(inst.id), inst.installment_name || '', excelDate(inst.due_date), n(inst.amount), txns.reduce((sum, t) => sum + t.counted, 0), n(inst.paid_amount), n(inst.interest_amount), n(inst.amount) - n(inst.paid_amount), pretty(inst.status), txns.length];
  });
  register(sheet, 6, ['Plot / Unit', 'Block', 'Buyer', 'Installment ID', 'Installment', 'Due Date', 'Scheduled (₹)', 'Direct Receipts (₹)', 'Recorded Paid (₹)', 'Interest (₹)', 'Recorded Balance (₹)', 'Schedule Status', 'Transactions'], rows, { 6: DATE, 7: MONEY, 8: MONEY, 9: MONEY, 10: MONEY, 11: MONEY, 13: '#,##0' }, 1);
}

/** Create a complete, styled workbook from the fresh site-wide statement API. */
export async function buildPlotStatementWorkbook(data) {
  if (!data || !Array.isArray(data.plots) || !Array.isArray(data.payments) || !Array.isArray(data.installmentPayments)) throw new Error('The statement response is incomplete. Please try again.');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Diwan City';
  workbook.subject = 'All plot details and transaction statements';
  workbook.title = `${data.site?.name || 'Site'} — Plot Payments Statement`;
  workbook.created = new Date(data.generatedAt || Date.now());
  const model = normalize(data);
  addSummary(workbook, data, model);
  addLedgers(workbook, data, model);
  addTransactions(workbook, data, model);
  addDetails(workbook, data, model);
  addInstallments(workbook, data, model);
  return workbook;
}

/** Browser-only download. Kept separate from the workbook builder for validation. */
export async function downloadPlotStatement(data) {
  const workbook = await buildPlotStatementWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const name = text(data.site?.name || 'Site').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Site';
  const filename = `Plot_Statement_${name}_${localDay(new Date())}.xlsx`;
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return filename;
}

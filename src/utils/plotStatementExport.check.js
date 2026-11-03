// node src/utils/plotStatementExport.check.js
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildPlotStatementWorkbook } from './plotStatementExport.js';

const data = {
  site: { id: 7, name: 'Statement Checks & Co' },
  generatedAt: '2026-11-03T12:30:00.000Z',
  plots: [
    { id: 10, plot_no: 'A10', block: 'A', status: 'CANCELLED', plot_tag: 'OLD', sale_price: '2000.00', plot_size: '20.5', notes: '=literal text, not a formula' },
    { id: 2, plot_no: 'A2', block: 'A', buyer_name: 'Buyer Two', status: 'BOOKED', sale_price: '1000.50', to_receive_bank: '600', booking_date: '2026-11-02', interest_enabled: false, created_at: '2026-11-01T11:45:00.000Z' },
    { id: 1, plot_no: 'A1', block: 'A', status: 'COMPANY', sale_price: '500.00' },
  ],
  payments: [
    { id: 1, plot_id: 2, date: '2026-11-02', amount: '100.25', payment_type: 'CASH', status: 'pending', narration: 'Booking receipt' },
    { id: 2, plot_id: 2, date: '2026-11-03', amount: '500.00', payment_type: 'CHEQUE', cheque_status: 'BOUNCED', cheque_no: '000045', status: 'approved' },
    { id: 3, plot_id: 10, date: '2026-11-01', amount: '-20.00', payment_type: 'CASH', status: 'rejected', narration: 'Refund adjustment' },
  ],
  installmentPayments: [
    { id: 1, plot_id: 2, installment_id: 9, payment_date: '2026-11-03', amount: '200.00', payment_mode: 'UPI', reference: 'REF-001', installment_name: 'First installment' },
    { id: 2, plot_id: 2, installment_id: 9, payment_date: '2026-11-03', amount: '50.00', payment_mode: 'CHEQUE', cheque_status: 'RETURNED', installment_name: 'First installment' },
  ],
  installments: [{ id: 9, plot_id: 2, installment_name: 'First installment', amount: '600', paid_amount: '250', interest_amount: '10', status: 'partial', due_date: '2026-11-10', sort_order: 0 }],
};

const workbook = await buildPlotStatementWorkbook(data);
assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Summary', 'Plot Ledgers', 'Transactions', 'Plot Details', 'Installments']);
const summary = workbook.getWorksheet('Summary');
assert.equal(summary.getCell('A6').value, 3);
assert.equal(summary.getCell('D6').value, 3500.5);
assert.equal(summary.getCell('G6').value, 280.25, 'pending and rejected still count under module rules; bounced and returned do not');
assert.equal(summary.getCell('J6').value, 3220.25);
assert.equal(summary.getCell('B12').value, 'A1');
assert.equal(summary.getCell('B13').value, 'A2', 'natural unit ordering');
assert.equal(summary.getCell('B14').value, 'A10');
assert.equal(summary.getCell('H13').value, 200, 'installment UPI counted as bank');
assert.equal(summary.getCell('I13').value, 100.25);
assert.equal(summary.getCell('L15').value, 5, 'source IDs may overlap; all rows retained exactly once');
assert.equal(summary.pageSetup.printArea, 'A1:L15');
assert.equal(summary.views[0].state, 'frozen');
assert.equal(summary.autoFilter.to.row, 14, 'grand total is outside sort/filter range');
assert.equal(summary.getCell('A1').fill.fgColor.argb, '172D46');
assert.ok(summary.getCell('G6').numFmt.includes('₹'));
assert.ok(summary.getCell('A9').value.includes('historical / OLD'));

const txns = workbook.getWorksheet('Transactions');
assert.equal(txns.rowCount, 10);
const entries = [];
txns.eachRow((row, index) => { if (index > 5) entries.push(row.getCell(5).value); });
assert.equal(new Set(entries).size, 5);
assert.ok(entries.includes('IP-1') && entries.includes('PP-1'));
let bounced;
txns.eachRow(row => { if (row.getCell(5).value === 'PP-2') bounced = row; });
assert.equal(bounced.getCell(11).value, 500);
assert.equal(bounced.getCell(12).value, 0);
assert.equal(bounced.getCell(21).value, '000045', 'leading zeros in cheque identifiers retained');
assert.equal(txns.getCell('G6').value.toISOString(), '2026-11-02T00:00:00.000Z');
assert.equal(txns.pageSetup.fitToPage, false, 'wide register prints across pages without tiny text');

const ledgers = workbook.getWorksheet('Plot Ledgers');
let hasEmptyPlot = false;
let ledgerClosingBalance = null;
let ledgerCount = 0;
ledgers.eachRow(row => {
  if (row.getCell(1).value === 'No transactions recorded for this plot.') hasEmptyPlot = true;
  if (row.getCell(2).value === 'IP-1') { ledgerClosingBalance = row.getCell(12).value; ledgerCount++; }
});
assert.ok(hasEmptyPlot, 'zero-payment plots still have a full statement section');
assert.equal(ledgerClosingBalance, 700.25);
assert.equal(ledgerCount, 1);
const details = workbook.getWorksheet('Plot Details');
let dateFound = false;
let timestampFound = false;
let literalFound = false;
details.eachRow(row => {
  if (row.getCell(5).value === 'Booking Date') { assert.ok(row.getCell(6).value instanceof Date); dateFound = true; }
  if (row.getCell(5).value === 'Created At (UTC)') { assert.equal(row.getCell(6).value.toISOString(), '2026-11-01T11:45:00.000Z'); timestampFound = true; }
  if (row.getCell(5).value === 'Notes') { assert.equal(row.getCell(6).value, '=literal text, not a formula'); literalFound = true; }
});
assert.ok(dateFound && timestampFound && literalFound);
const schedule = workbook.getWorksheet('Installments');
assert.equal(schedule.getCell('H7').value, 200, 'linked receipts exclude returned cheque');
assert.equal(schedule.getCell('I7').value, 250, 'stored paid source data is separately labeled');
assert.equal(schedule.getCell('K7').value, 350);

// Verify native XLSX serialization preserves content and formatting.
const buffer = await workbook.xlsx.writeBuffer();
assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), 'PK');
const reloaded = new ExcelJS.Workbook();
await reloaded.xlsx.load(buffer);
assert.equal(reloaded.getWorksheet('Summary').getCell('G6').value, 280.25);
assert.equal(reloaded.getWorksheet('Transactions').getCell('G6').value.toISOString(), '2026-11-02T00:00:00.000Z');
assert.equal(reloaded.getWorksheet('Summary').getCell('A1').fill.fgColor.argb, '172D46');
assert.equal(reloaded.getWorksheet('Summary').views[0].ySplit, 11);
const empty = await buildPlotStatementWorkbook({ site: { name: 'Empty' }, plots: [], payments: [], installmentPayments: [], installments: [] });
assert.equal(empty.getWorksheet('Summary').getCell('G6').value, 0);
assert.equal(empty.worksheets.length, 4);
await empty.xlsx.writeBuffer();
await assert.rejects(() => buildPlotStatementWorkbook({ plots: [] }), /incomplete/);
console.log('plotStatementExport: all checks passed');

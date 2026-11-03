// node src/utils/expenseStatementExport.check.js [--preview]
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildExpenseStatementWorkbook } from './expenseStatementExport.js';
import { summarizeExpenseStatement } from './loadExpenseStatement.js';

const data = {
  site: { id: 7, name: 'Diwan City — Sample Expense Statement', address: 'Main Road, Sector 12' },
  generatedAt: '2026-11-03T12:30:00.000Z',
  expenses: [
    { id: '001', original_id: '0001', site_id: 7, source: 'expenses', date: String(Date.parse('2026-11-01T18:30:00Z')), from_entity: 'Cash Account', to_entity: 'Office Services', payment_mode: 'CASH', debit: '100.10', credit: '0', category: 'Office; Fees', status: 'approved', account_no: '00001234', cheque_no: '000045', remark: '=Literal reference; this must remain text.', created_at: String(Date.parse('2026-11-02T09:00:00Z')), approved_at: '2026-11-02T12:10:00Z', voucher_url: 'https://example.com/voucher/001', bill_url: 'https://example.com/bill/001', verifyUrl: 'https://example.com/verify/001', balance: null, __typename: 'ExpenseEntry' },
    { id: 2, original_id: 2, source: 'expenses', date: '2026-11-02', from_entity: 'Refund Receipt', to_entity: 'Bank Account', payment_mode: 'UPI', debit: '0', credit: '500.20', category: null, status: 'pending', created_at: '2026-11-02T10:00:00Z', remark: 'Supplier credit received against previous invoice.' },
    { id: 3, original_id: 3, source: 'expenses', date: '2026-11-03', payment_mode: 'BANK', debit: '900', credit: '0', category: 'Office; Fees', status: ' rejected ', remark: 'Rejected entry retained in the full statement.' },
    { id: 4, original_id: 4, source: 'expenses', date: '2026-11-03', payment_mode: 'CHEQUE', debit: '100', credit: '0', category: 'Maintenance', status: 'approved', cheque_status: ' bounced ', remark: 'Supplied bounced cheque retained as an excluded record.' },
    { id: 5, original_id: 5, source: 'expenses', date: '2026-11-03', payment_mode: null, debit: '-20.05', credit: '0', category: ' ', status: 'approved', remark: 'Expense reversal; negative debit is preserved.' },
    { id: 6, original_id: 6, source: 'expenses', date: '2026-11-03', payment_mode: '', debit: '0.10', credit: '0', category: 'Bank Charges', status: 'approved', remark: 'Explicit blank mode follows bank / other source classification.' },
    { id: 7, original_id: 7, source: 'expenses', date: '2026-11-03', payment_mode: 'ADJUST', debit: '700', credit: '0', category: 'Adjustments', status: null, remark: 'Missing approval status is excluded from module totals.' },
    { id: 8, original_id: 8, source: 'expenses', date: '2026-11-03', payment_mode: 'PAY ADVANCE', debit: '0', credit: '0.20', category: 'Advance', status: '', remark: Array.from({ length: 20 }, (_, index) => `Line ${index + 1}: detailed advance remark.`).join('\n') },
  ],
};

const workbook = await buildExpenseStatementWorkbook(data);
assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Summary', 'Expense Statement', 'Expense Details']);
const summary = workbook.getWorksheet('Summary');
assert.equal(summary.getCell('A6').value, 8);
assert.equal(summary.getCell('C6').value, 80.15);
assert.equal(summary.getCell('E6').value, 500.4);
assert.equal(summary.getCell('G6').value, 420.25);
assert.equal(summary.getCell('A1').fill.fgColor.argb, '172D46');
assert.ok(summary.getCell('A8').value.includes('screen filters are not applied'));
assert.ok(summary.getCell('A9').value.includes('missing-status'));
assert.equal(summary.pageSetup.orientation, 'landscape');
const controls = summarizeExpenseStatement(data.expenses);
assert.equal(summary.getCell('C6').value, controls.total_debit);
assert.equal(summary.getCell('E6').value, controls.total_credit);
const categories = [];
let inCategory = false;
summary.eachRow(row => {
  if (row.getCell(1).value === 'CATEGORY SUMMARY') inCategory = true;
  else if (row.getCell(1).value === 'TOTAL') inCategory = false;
  else if (inCategory && typeof row.getCell(3).value === 'number') categories.push(row.getCell(1).value);
});
assert.ok(categories.includes('Office; Fees'), 'compound category remains one label');
assert.ok(!categories.includes('Office') && !categories.includes('Fees'));
assert.equal(categories.filter(value => value === 'Uncategorised').length, 1);

const statement = workbook.getWorksheet('Expense Statement');
assert.equal(statement.getCell('B7').value, '001', 'identifiers retain leading zeros');
assert.equal(statement.getCell('B8').value, '2', 'same-day ordering uses creation time then ID');
assert.equal(statement.getCell('A7').value.toISOString(), '2026-11-02T00:00:00.000Z', 'numeric epoch date uses Indian source calendar day');
assert.equal(statement.getCell('G7').value, 100.1);
assert.equal(statement.getCell('L7').value, '=Literal reference; this must remain text.');
assert.equal(statement.getCell('J7').value, -100.1);
assert.equal(statement.getCell('J8').value, 400.1);
const byId = new Map();
statement.eachRow((row, index) => { if (index > 6 && row.getCell(2).value !== 'STATEMENT TOTAL') byId.set(row.getCell(2).value, row); });
assert.equal(byId.get('3').getCell(7).value, 900, 'rejected source debit remains visible');
assert.equal(byId.get('3').getCell(9).value, 0, 'rejected debit is excluded from counted movement');
assert.equal(byId.get('4').getCell(9).value, 0, 'bounced amount does not affect movement');
assert.equal(byId.get('5').getCell(7).value, -20.05, 'refund / reversal sign preserved');
assert.equal(byId.get('7').getCell(9).value, 0, 'null approval status matches SQL summary exclusion');
assert.equal(byId.get('8').getCell(10).value, 420.25, 'running arithmetic uses cents');
assert.ok(byId.get('8').height >= 280, 'long multiline remarks wrap without a small hard cap');
assert.equal(statement.views[0].ySplit, 6);
assert.equal(statement.autoFilter.to.row, 14, 'total row remains outside filter');
const total = statement.getRow(15);
assert.equal(total.getCell(10).value, 420.25);
assert.equal(total.getCell(12).fill.fgColor.argb, '087F8C', 'total band includes empty cells');
assert.equal(statement.pageSetup.printArea, 'A1:L15', 'print area includes totals');

const details = workbook.getWorksheet('Expense Details');
const column = label => details.getRow(6).values.indexOf(label);
assert.ok(column('Entry ID') > 0);
assert.equal(details.getCell(7, column('Original Source ID')).value, '0001');
assert.equal(details.getCell(7, column('Account No.')).value, '00001234');
assert.equal(details.getCell(7, column('Cheque No.')).value, '000045');
assert.equal(details.getCell(7, column('Stored Source Balance (₹)')).value, null, 'missing stored balance is not invented as zero');
assert.equal(details.getCell(7, column('Created At (UTC)')).value.toISOString(), '2026-11-02T09:00:00.000Z');
assert.equal(details.getCell(7, column('Voucher URL')).value.hyperlink, 'https://example.com/voucher/001');
assert.equal(details.getCell(7, column('Voucher URL')).value.text, 'Open voucher');
assert.equal(details.getCell(7, column('Receipt Verification URL')).value.text, 'Verify receipt');
assert.equal(details.getCell(7, column('Included in Totals')).value, 'Yes');
assert.equal(details.pageSetup.fitToPage, false, 'wide details paginate horizontally at readable size');
assert.ok(!details.getRow(6).values.includes('  Typename'), 'Apollo internal fields are omitted');
assert.equal(details.columnCount, 37);

const serialized = await workbook.xlsx.writeBuffer();
assert.equal(Buffer.from(serialized).subarray(0, 2).toString(), 'PK');
const reloaded = new ExcelJS.Workbook();
await reloaded.xlsx.load(serialized);
assert.equal(reloaded.getWorksheet('Summary').getCell('G6').value, 420.25);
assert.equal(reloaded.getWorksheet('Expense Statement').getCell('A7').value.toISOString(), '2026-11-02T00:00:00.000Z');
assert.equal(reloaded.getWorksheet('Expense Statement').getCell('L7').type, ExcelJS.ValueType.String, 'leading formula text remains literal after XLSX reload');
assert.equal(reloaded.getWorksheet('Expense Details').getCell(7, column('Account No.')).value, '00001234');
assert.equal(reloaded.getWorksheet('Expense Statement').getCell('L15').fill.fgColor.argb, '087F8C');

const empty = await buildExpenseStatementWorkbook({ site: { name: 'Empty' }, expenses: [] });
assert.equal(empty.getWorksheet('Summary').getCell('A6').value, 0);
assert.equal(empty.getWorksheet('Summary').getCell('G6').value, 0);
await empty.xlsx.writeBuffer();
await assert.rejects(() => buildExpenseStatementWorkbook({}), /incomplete/);
await assert.rejects(() => buildExpenseStatementWorkbook({ expenses: [null] }), /incomplete/);
const zeroDate = await buildExpenseStatementWorkbook({ expenses: [{ id: '0', date: '0', debit: '0.1', credit: '0.2', status: 'pending' }] });
assert.equal(zeroDate.getWorksheet('Expense Statement').getCell('A7').value.toISOString(), '1970-01-01T00:00:00.000Z');
assert.equal(zeroDate.getWorksheet('Expense Statement').getCell('J7').value, 0.1);

const longReceipt = `https://example.com/verify?token=${'a'.repeat(1200)}`;
const linked = await buildExpenseStatementWorkbook({ expenses: [{ id: '1', date: '2026-11-03', debit: 1, credit: 0, status: 'pending', verifyUrl: longReceipt }] });
assert.equal(linked.getWorksheet('Expense Details').getRow(7).height, 28, 'long link targets do not stretch rows');
assert.equal(linked.getWorksheet('Expense Details').getCell(7, column('Receipt Verification URL')).value.hyperlink, longReceipt);

if (process.argv.includes('--preview')) {
  await workbook.xlsx.writeFile('/tmp/expense-statement-preview.xlsx');
  console.log('/tmp/expense-statement-preview.xlsx');
}
console.log('expenseStatementExport: all checks passed');

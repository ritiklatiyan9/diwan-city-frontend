// Run: node src/utils/loadExpenseStatement.check.js
import assert from 'node:assert/strict';
import { isIncludedExpense, loadExpenseStatement, summarizeExpenseStatement } from './loadExpenseStatement.js';

const site = { id: 7, name: 'Selected Site', city: 'Delhi' };
const rows = [
  { id: '1', site_id: 7, source: 'expenses', debit: '100.10', credit: 0, status: 'approved' },
  { id: '2', site_id: 7, source: 'expenses', debit: 0.2, credit: '50.25', status: 'pending' },
  { id: '3', site_id: 7, source: 'expenses', debit: 900, credit: 0, status: 'rejected' },
  { id: '4', site_id: 7, source: 'expenses', debit: 0, credit: 500, status: null },
  { id: '5', site_id: 7, source: 'expenses', debit: '-10.05', credit: 0, status: 'approved' },
];
const summary = { total_debit: 90.25, total_credit: 50.25, total_count: 3 };
const full = { expenses: rows, summary, pagination: { totalItems: rows.length, totalPages: 1, currentPage: 1, itemsPerPage: rows.length } };

// The interface accepts only the selected site and an all-records callback;
// screen filters, selected rows and pagination cannot enter its query signature.
{
  const calls = [];
  const data = await loadExpenseStatement({
    site,
    search: 'must not be passed', selectedIds: [2], page: 9,
    fetchAllExpenses: async (...args) => { calls.push(args); return full; },
  });
  assert.deepEqual(calls, [[7]]);
  assert.deepEqual(data.site, site);
  assert.notEqual(data.site, site, 'Site metadata is captured independently');
  assert.equal(data.expenses.length, 5, 'Rejected and null-status records remain in history');
  assert.notEqual(data.expenses[0], rows[0]);
  assert.equal(data.expenses[4].debit, '-10.05', 'Negative corrections are preserved');
  assert.ok(!Number.isNaN(new Date(data.generatedAt).getTime()));
  assert.match(data.sourceNote, /excludes bounced and returned/i);
  assert.deepEqual(summarizeExpenseStatement(data.expenses), summary);
}

// Shared policy includes pending entries and excludes null/rejected/failed cheques.
assert.equal(isIncludedExpense({ status: 'pending' }), true);
assert.equal(isIncludedExpense({ status: 'REJECTED' }), false);
assert.equal(isIncludedExpense({ status: null }), false);
assert.equal(isIncludedExpense({}), false);
for (const cheque_status of ['bounced', 'RETURNED']) assert.equal(isIncludedExpense({ status: 'approved', cheque_status }), false);
assert.deepEqual(summarizeExpenseStatement([
  ...rows,
  { id: 6, status: 'REJECTED', debit: 700, credit: 0 },
  { id: 7, status: 'approved', cheque_status: 'BOUNCED', debit: 1000, credit: 0 },
]), summary);

// Correct cent arithmetic avoids floating point false positives at 0.1 + 0.2.
assert.deepEqual(summarizeExpenseStatement([
  { status: 'pending', debit: 0.1, credit: -0.2 },
  { status: 'approved', debit: 0.2, credit: 0.1 },
]), { total_debit: 0.3, total_credit: -0.1, total_count: 2 });

const malformed = [
  undefined,
  { ...full, expenses: null },
  { ...full, summary: null },
  { ...full, pagination: null },
  { ...full, expenses: rows.slice(0, 1) },
  { ...full, expenses: [rows[0], rows[0], ...rows.slice(2)] },
  { ...full, expenses: [{ ...rows[0], site_id: 8 }, ...rows.slice(1)] },
  { ...full, expenses: [{ ...rows[0], source: 'vendor_payment' }, ...rows.slice(1)] },
  { ...full, expenses: [{ ...rows[0], id: '' }, ...rows.slice(1)] },
  { ...full, expenses: [{ ...rows[0], id: Infinity }, ...rows.slice(1)] },
  { ...full, expenses: [{ ...rows[0], debit: NaN }, ...rows.slice(1)] },
  { ...full, expenses: [{ ...rows[0], credit: null }, ...rows.slice(1)] },
  { ...full, expenses: [{ ...rows[0], debit: '' }, ...rows.slice(1)] },
  { ...full, expenses: [{ ...rows[0], debit: true }, ...rows.slice(1)] },
  { ...full, summary: { ...summary, total_debit: 90.26 } },
  { ...full, summary: { ...summary, total_credit: null } },
  { ...full, summary: { ...summary, total_count: 5 } },
  { ...full, pagination: { ...full.pagination, totalPages: 2 } },
  { ...full, pagination: { ...full.pagination, currentPage: 2 } },
  { ...full, pagination: { ...full.pagination, itemsPerPage: 20 } },
  { ...full, pagination: { ...full.pagination, totalItems: -1 } },
];
for (const data of malformed) {
  await assert.rejects(loadExpenseStatement({ site, fetchAllExpenses: async () => data }), /incomplete or inconsistent/);
}

// Authentication and network failures propagate without fallback or an empty file.
for (const error of [Object.assign(new Error('Unauthorized'), { response: { status: 401 } }), new Error('Network Error')]) {
  let calls = 0;
  await assert.rejects(loadExpenseStatement({ site, fetchAllExpenses: async () => { calls++; throw error; } }), cause => cause === error);
  assert.equal(calls, 1);
}

// Invalid site selection fails before the query; a verified empty result is valid.
let calls = 0;
await assert.rejects(loadExpenseStatement({ site: { id: undefined }, fetchAllExpenses: async () => { calls++; } }), /no site is selected/);
assert.equal(calls, 0);
const empty = await loadExpenseStatement({ site, fetchAllExpenses: async () => ({ expenses: [], summary: { total_debit: 0, total_credit: 0, total_count: 0 }, pagination: { totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 0 } }) });
assert.deepEqual(empty.expenses, []);

console.log('loadExpenseStatement: all checks passed');

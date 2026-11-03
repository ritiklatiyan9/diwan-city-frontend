const SOURCE_NOTE = 'All direct expense records available in the Expenses module for the selected site. The source excludes bounced and returned cheques. Rejected entries and entries without an approval status remain in the statement but do not contribute to financial totals; pending entries are included.';
const record = value => value != null && typeof value === 'object' && !Array.isArray(value);
const siteKey = value => /^\d+$/.test(String(value ?? '')) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? String(Number(value)) : null;
const invalid = detail => new Error(`The expense statement is incomplete or inconsistent: ${detail}. Please refresh and try again.`);

function numeric(value, label) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value))) throw invalid(`${label} is invalid`);
  return Number(value);
}

function count(value, label) {
  const number = numeric(value, label);
  if (!Number.isSafeInteger(number) || number < 0) throw invalid(`${label} is invalid`);
  return number;
}

function cents(value, label) {
  const number = numeric(value, label);
  const result = Math.sign(number) * Math.round((Math.abs(number) + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(result)) throw invalid(`${label} exceeds the supported amount precision`);
  return result;
}

/** Match the source's financial totals while retaining excluded rows as history. */
export function isIncludedExpense(row) {
  return row.status != null
    && String(row.status).trim().toLowerCase() !== 'rejected'
    && !['BOUNCED', 'RETURNED'].includes(String(row.cheque_status || '').trim().toUpperCase());
}

/** Shared by the loader and workbook so totals use the same inclusion policy. */
export function summarizeExpenseStatement(rows) {
  let debit = 0, credit = 0, included = 0;
  for (const row of rows) {
    if (!isIncludedExpense(row)) continue;
    debit += cents(row.debit, 'Expense debit');
    credit += cents(row.credit, 'Expense credit');
    included++;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) throw invalid('expense totals exceed the supported amount precision');
  }
  return { total_debit: debit / 100, total_credit: credit / 100, total_count: included };
}

/**
 * Read a fresh, unfiltered selected-site statement through an injected all-rows
 * query. The caller supplies page 1, limit 0, onlySite true, order ASC and a fresh
 * fetch policy; no screen filter or selection is accepted by this loader.
 */
export async function loadExpenseStatement({ site, fetchAllExpenses }) {
  const capturedSite = { ...site };
  const selectedId = siteKey(capturedSite.id);
  if (!selectedId) throw invalid('no site is selected');
  if (typeof fetchAllExpenses !== 'function') throw invalid('the expense source is unavailable');

  // Errors propagate to the UI. A failed query must never become an empty file.
  const data = await fetchAllExpenses(capturedSite.id);
  if (!record(data) || !Array.isArray(data.expenses) || !record(data.pagination) || !record(data.summary)) throw invalid('the complete expense source could not be read');

  const totalItems = count(data.pagination.totalItems, 'Source record count');
  if (data.expenses.length !== totalItems) throw invalid('the source returned only part of the expense records');
  const currentPage = count(data.pagination.currentPage, 'Source page');
  const totalPages = count(data.pagination.totalPages, 'Source page count');
  const itemsPerPage = count(data.pagination.itemsPerPage, 'Source page size');
  if (currentPage !== 1 || totalPages > 1 || (totalItems > 0 && totalPages !== 1) || itemsPerPage !== totalItems) throw invalid('the source is still paginated');

  const seen = new Set();
  for (const row of data.expenses) {
    if (!record(row) || !siteKey(row.id)) throw invalid('a record has no valid ID');
    if (siteKey(row.site_id) !== selectedId) throw invalid('a record belongs to another site');
    if (row.source !== 'expenses') throw invalid('the source includes records from another module');
    const key = `${row.source}:${siteKey(row.id)}`;
    if (seen.has(key)) throw invalid('the source includes duplicate records');
    seen.add(key);
    cents(row.debit, 'Expense debit');
    cents(row.credit, 'Expense credit');
    if (row.amount != null) cents(row.amount, 'Expense amount');
  }

  const computed = summarizeExpenseStatement(data.expenses);
  if (cents(data.summary.total_debit, 'Source debit total') !== cents(computed.total_debit, 'Calculated debit total')
    || cents(data.summary.total_credit, 'Source credit total') !== cents(computed.total_credit, 'Calculated credit total')
    || count(data.summary.total_count, 'Source financial record count') !== computed.total_count) {
    throw invalid('the financial totals do not match the returned records');
  }

  return {
    site: capturedSite,
    expenses: data.expenses.map(row => ({ ...row })),
    generatedAt: new Date().toISOString(),
    sourceNote: SOURCE_NOTE,
  };
}

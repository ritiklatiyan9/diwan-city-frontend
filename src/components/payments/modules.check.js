// Self-check for the per-module payload adapters. No test runner is installed:
//   node src/components/payments/modules.check.js
//
// Every value below is money in a real ledger. Two things are guarded, because
// both fail silently rather than loudly:
//   1. Hydration — `fromRecord` is where edit mode destroys data today (three
//      modules drop cheque_no), and a dropped key is only visible as a column
//      that quietly went null after someone opened the edit dialog.
//   2. Direction — six encodings of one bit (signed amount, inverted signed
//      amount, debit/credit twins, transaction_type). A flipped direction posts
//      a valid-looking row with the money on the wrong side of the balance.
// Fixtures are one real row per module: an all-empty row round-trips vacuously.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { derivePaymentType } from '../../constants/paymentOptions.js';
import { MODE_FIELD_SETS } from './modeFieldSets.js';

/* ── loading browser code under bare node ───────────────────────────────── */

// modules.js imports the axios instance (which reads Vite's import.meta.env at
// module load) and uses extensionless specifiers. Both are resolver problems,
// not logic problems, so fix them in the resolver rather than forking the file.
// ponytail: string matching, ceiling = a non-.js relative import in modules.js.
// Teach this hook if that happens; never keep a second copy of the adapters.
// Writes still throw. GET serves one canned response, because plot_payment.scope
// .load is what remembers the plot list that toPayload reads buyer_name back from
// (the pre-bound case, where the picker that would seed it never renders).
const API_STUB = `data:text/javascript,${encodeURIComponent(`
const CANNED = { '/plots?site_id=7': { plots: [{ id: 202, plot_no: 'A-12', buyer_name: 'SUNITA VERMA' }] } };
const boom = (m) => () => { throw new Error('modules.check: api.' + m + ' must not be called'); };
export default {
  get: (url) => (url in CANNED
    ? Promise.resolve({ data: CANNED[url] })
    : Promise.reject(new Error('modules.check: unstubbed GET ' + url))),
  post: boom('post'), put: boom('put'), delete: boom('delete'), patch: boom('patch'),
};`)}`;
const HOOKS = `
export function resolve(spec, ctx, next) {
  if (spec.endsWith('/api/api')) return { url: ${JSON.stringify(API_STUB)}, shortCircuit: true, format: 'module' };
  return next(spec.startsWith('.') && !/\\.[cm]?js$/.test(spec) ? spec + '.js' : spec, ctx);
}`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const { PAYMENT_MODULES, modulesFor } = await import('./modules.js');

/* ── the mode → fields contract ─────────────────────────────────────────── */

// The real map, not a copy — ModeFields renders MODE_FIELD_SETS[kind] ∩
// adapter.modeFields, so a field in no kind never renders and its column is
// permanently unwritable (this is what keeps `ifsc` in the BANK set honest).
const UNION = new Set(Object.values(MODE_FIELD_SETS).flat());
// plot_payments.payment_type CHECK constraint only allows these three.
const KINDS = ['CASH', 'BANK', 'CHEQUE'];

/* ── fixtures: one real row per module ──────────────────────────────────── */

// `posted` is the key list each module put on the wire before the rewrite,
// transcribed from the modal audit — not from memory. `drops` are the keys the
// spec deliberately stopped sending, each with the reason it went.
const CASES = {
  expenses: {
    direction: 'out',
    row: {
      id: 101, date: '2026-02-03', debit: '4500.50', credit: '0',
      payment_mode: 'CHEQUE', cheque_no: 'CHQ-88213',
      account_no: '50100234567', branch: 'CIVIL LINES',
      to_entity: 'RAMESH TRADERS', assigned_user_id: 12, from_entity: 'SITE OFFICE',
      category: 'MATERIAL', remark: 'CEMENT 200 BAGS',
      voucher_url: 'https://s3/vouchers/exp-101.pdf', assigned_admin_id: 3,
    },
    posted: ['site_id', 'date', 'from_entity', 'to_entity', 'payment_mode', 'cheque_no',
      'debit', 'credit', 'remark', 'account_no', 'branch', 'category', 'assigned_user_id',
      'voucher_url', 'assigned_admin_id'],
    payload: {
      site_id: 7, date: '2026-02-03', from_entity: 'SITE OFFICE', to_entity: 'RAMESH TRADERS',
      payment_mode: 'CHEQUE', cheque_no: 'CHQ-88213', debit: 4500.5, credit: 0,
      remark: 'CEMENT 200 BAGS', account_no: '50100234567', branch: 'CIVIL LINES',
      category: 'MATERIAL', assigned_user_id: 12,
      voucher_url: 'https://s3/vouchers/exp-101.pdf', assigned_admin_id: 3,
    },
  },

  plot_payment: {
    direction: 'in',
    row: {
      id: 202, date: '2026-01-18', amount: '250000', payment_from: 'CASH', payment_type: 'CASH',
      // The dual-meaning column: on a CASH row this is a person, not an account.
      bank_details: 'SUNITA VERMA - 9876543210', bank_name: null, branch: null, cheque_no: null,
      buyer_name: 'SUNITA VERMA', booked_by: 'DEEPAK', narration: 'FIRST INSTALMENT',
      voucher_url: null, assigned_admin_id: null,
    },
    posted: ['date', 'payment_from', 'payment_type', 'bank_name', 'branch', 'bank_details',
      'narration', 'buyer_name', 'booked_by', 'amount', 'voucher_url', 'assigned_admin_id',
      'cheque_no', 'cheque_status', 'received_by', 'plot_id'],
    drops: [
      'received_by',    // had no UI and was always null
      'cheque_status',  // create-only now; resending it reset cleared cheques
      'plot_id',        // create-only; the server derives it on update
    ],
    payload: {
      date: '2026-01-18', payment_from: 'CASH', payment_type: 'CASH',
      bank_name: null, branch: null, bank_details: 'SUNITA VERMA - 9876543210',
      narration: 'FIRST INSTALMENT', buyer_name: 'SUNITA VERMA', booked_by: 'DEEPAK',
      amount: 250000, cheque_no: null, voucher_url: null, assigned_admin_id: null,
    },
  },

  cashflow: {
    direction: 'in',
    row: {
      id: 303, date: '2026-03-11', debit: '0', credit: '18000', particular: 'DIESEL',
      cash_type: 'cheque', cheque_no: 'CHQ-4471',
      to_firm_id: 5, to_firm_name: 'ACME BUILDERS', to_name: null, from_firm_id: null,
      remarks: 'PUMP HIRE', voucher_url: null, assigned_admin_id: 9,
    },
    posted: ['cash_flow_month_id', 'date', 'particular', 'debit', 'credit', 'remarks',
      'cash_type', 'cheque_no', 'voucher_url', 'is_firm_transaction', 'from_firm_id',
      'to_firm_id', 'to_name', 'assigned_admin_id'],
    payload: {
      cash_flow_month_id: 42, date: '2026-03-11', particular: 'DIESEL', debit: 0, credit: 18000,
      remarks: 'PUMP HIRE', cash_type: 'cheque', cheque_no: 'CHQ-4471', voucher_url: null,
      is_firm_transaction: true, from_firm_id: null, to_firm_id: 5, to_name: null,
      assigned_admin_id: 9,
    },
  },

  farmer_payment: {
    direction: 'out',
    row: {
      id: 404, date: '2026-04-02', amount: '-75000', transaction_type: 'debit',
      // particular is the only column holding the raw token; mode/payment_mode hold the kind.
      particular: 'BANK TRANSFER', mode: 'BANK', payment_mode: 'BANK',
      bank_name: 'HDFC', bank_account_no: '50200098765', bank_reference: 'UTR889912',
      bank_ifsc: 'hdfc0000123', cheque_no: null, by_note: 'MUNSHI RAM', remarks: 'ADVANCE',
      voucher_url: '', assigned_admin_id: null,
    },
    posted: ['date', 'transaction_type', 'particular', 'mode', 'amount', 'by_note', 'remarks',
      'payment_mode', 'cash_amount', 'bank_amount', 'bank_name', 'bank_account_no',
      'bank_reference', 'bank_ifsc', 'voucher_url', 'assigned_admin_id', 'cheque_no'],
    payload: {
      date: '2026-04-02', transaction_type: 'debit', particular: 'BANK TRANSFER',
      mode: 'BANK', payment_mode: 'BANK', amount: -75000, cash_amount: 0, bank_amount: -75000,
      by_note: 'MUNSHI RAM', remarks: 'ADVANCE', bank_name: 'HDFC',
      bank_account_no: '50200098765', bank_reference: 'UTR889912',
      bank_ifsc: 'HDFC0000123', // normalised on the way out, as it always was
      cheque_no: null, voucher_url: '', assigned_admin_id: null,
    },
  },

  commission: {
    // INVERTED: a stored negative is money taken back FROM the agent.
    direction: 'in',
    row: {
      id: 505, date: '2026-05-20', amount: '-12500', payment_mode: 'BANK', bank_name: 'ICICI',
      transaction_id: 'TXN-556677', cheque_no: null, remarks: 'RECOVERY',
      voucher_url: null, assigned_admin_id: null, is_receive_entry: true,
    },
    posted: ['master_id', 'date', 'amount', 'payment_mode', 'bank_name', 'transaction_id',
      'cheque_no', 'remarks', 'voucher_url', 'assigned_admin_id'],
    payload: {
      master_id: 42, date: '2026-05-20', amount: -12500, payment_mode: 'BANK',
      bank_name: 'ICICI', transaction_id: 'TXN-556677', cheque_no: null, remarks: 'RECOVERY',
      // '' not null: the page spreads formData, so unset keys have always gone out
      // as empty strings. The controller NULLs both — this keeps the wire identical.
      voucher_url: '', assigned_admin_id: null,
      // is_receive_entry is absent: the exact match below is what enforces that.
    },
  },

  firm_transaction: {
    direction: 'out',
    row: {
      id: 606, date: '2026-06-09', debit: '1500.50', credit: '', payment_mode: 'cheque',
      cheque_no: 'CHQ-1201', transaction_no: 'UTR60912', description: 'STEEL PAYMENT',
      name: 'BALAJI STEELS', purpose: 'MATERIAL', remark: 'FIRM', remark2: 'PARTIAL',
      voucher_url: '', assigned_admin_id: 4,
    },
    posted: ['date', 'payment_mode', 'cheque_no', 'transaction_no', 'description', 'debit',
      'credit', 'name', 'purpose', 'remark', 'remark2', 'voucher_url', 'assigned_admin_id',
      'firm_id'],
    payload: {
      firm_id: 42, date: '2026-06-09', payment_mode: 'cheque', cheque_no: 'CHQ-1201',
      transaction_no: 'UTR60912', description: 'STEEL PAYMENT',
      debit: 1500.5, credit: 0, // numbers, not the "1500.50" / '' the twin inputs posted
      name: 'BALAJI STEELS', purpose: 'MATERIAL', remark: 'FIRM', remark2: 'PARTIAL',
      voucher_url: '', assigned_admin_id: 4,
    },
  },

  vendor_payment: {
    direction: 'out',
    row: {
      id: 707, payment_date: '2026-07-14', amount: '32000', payment_mode: 'cheque',
      reference_no: 'CHQ-7788', note: 'PART PAYMENT', voucher_url: '', assigned_admin_id: null,
    },
    posted: ['site_id', 'payment_date', 'amount', 'payment_mode', 'reference_no', 'note',
      'voucher_url', 'assigned_admin_id', 'allocations'],
    drops: ['allocations'], // belongs to /distribute-payment, which stays in the page
    payload: {
      site_id: 7, payment_date: '2026-07-14', amount: 32000, payment_mode: 'cheque',
      reference_no: 'CHQ-7788', note: 'PART PAYMENT', voucher_url: '', assigned_admin_id: null,
    },
  },

  daybook: {
    direction: 'in',
    row: {
      id: 808, date: '2026-08-01', debit: '0', credit: '6400', particular: 'SHOP RENT',
      entry_type: 'INCOME', payment_mode: 'CHEQUE', cheque_no: 'CHQ-3390',
      account_no: '911010045', branch: 'MAIN', category: 'RENT',
      to_entity: 'OFFICE', from_entity: 'TENANT', remarks: 'AUG RENT',
      voucher_url: '', assigned_admin_id: 2,
    },
    // Native rows only — the audit's remaining keys (farmer_id, pp_*, cf_*, firm_*)
    // belong to the imported-row branches, which now route to the sibling adapter.
    posted: ['site_id', 'date', 'particular', 'entry_type', 'debit', 'credit', 'remarks',
      'payment_mode', 'category', 'from_entity', 'to_entity', 'assigned_admin_id',
      'account_no', 'branch', 'cheque_no'],
    payload: {
      site_id: 7, date: '2026-08-01', particular: 'SHOP RENT', entry_type: 'INCOME',
      debit: 0, credit: 6400, remarks: 'AUG RENT', payment_mode: 'CHEQUE', category: 'RENT',
      from_entity: 'TENANT', to_entity: 'OFFICE', assigned_admin_id: 2,
      account_no: '911010045', branch: 'MAIN', cheque_no: 'CHQ-3390',
      // Present-and-null on an EDIT only (this fixture runs with ctx.record set),
      // so removing an upload clears the column. A create still omits the key —
      // asserted below, because POST /daybook has never received it.
      voucher_url: null,
    },
  },
};

const ctx = (over) => ({ siteId: 7, scopeId: 42, record: null, user: { role: 'admin' }, ...over });

// MIRRORS PaymentModal.setMode — the only way to change `mode` in the real app.
// The adapters no longer force-null a mode field by kind (a `bank` firm row
// legitimately stores a cheque_no that MODE_FIELD_SETS.BANK never renders), so
// this clearing is what keeps a switched-away field out of the payload. Setting
// `mode` directly in a fixture would assert a state the UI cannot produce.
const switchMode = (a, values, mode) => {
  const keep = MODE_FIELD_SETS[a.kindOverrides?.[mode] || derivePaymentType(mode)] || [];
  const next = { ...values, mode };
  [...new Set([...Object.values(MODE_FIELD_SETS).flat(), ...a.modeFields])]
    .forEach((k) => { if (!keep.includes(k)) next[k] = ''; });
  return next;
};

/* ── 1 + 2: round-trip and sign fidelity, per module ────────────────────── */

assert.deepEqual(
  Object.keys(CASES).sort(), Object.keys(PAYMENT_MODULES).sort(),
  'every adapter needs a fixture row — a new module ships with one or it ships untested',
);

for (const [key, c] of Object.entries(CASES)) {
  const a = PAYMENT_MODULES[key];
  const editCtx = ctx({ record: c.row });
  const v = a.fromRecord(c.row, editCtx);

  // The sign / debit-credit side the row stored must survive hydration...
  assert.equal(v.direction, c.direction, `${key}: direction hydrated from the stored side`);
  assert.match(String(v.amount), /^\d+(\.\d+)?$/, `${key}: amount hydrates unsigned (got ${v.amount})`);

  // ...and the payload must re-encode it identically. Exact match, so a dropped
  // key, a renamed key, a string where a number is due, or a resurrected
  // UI-only key all fail here.
  const p = a.toPayload(v, editCtx);
  assert.deepEqual(p, c.payload, `${key}: payload round-trip`);

  // Cross-check against what the module actually posted before the rewrite.
  for (const k of c.posted) {
    assert.ok(k in p || c.drops?.includes(k), `${key}: no longer posts '${k}'`);
  }

  assert.equal(a.validate(v, editCtx), null, `${key}: a real stored row must still validate`);
}

/* ── 3 + 4: adapter declarations, independent of any fixture ────────────── */

for (const [key, a] of Object.entries(PAYMENT_MODULES)) {
  for (const m of a.modes) {
    const kind = a.kindOverrides?.[m] || derivePaymentType(m);
    assert.ok(KINDS.includes(kind), `${key}: mode '${m}' resolves to ${kind}, not CASH/BANK/CHEQUE`);
  }
  for (const f of a.modeFields) {
    assert.ok(UNION.has(f), `${key}: modeField '${f}' is in no MODE_FIELD_SETS kind, so it can never render`);
  }
}

/* ── the derivations that changed behaviour, one assertion each ─────────── */

// expenses + daybook: account_no is dual-purpose. On CASH it must carry the cash
// account and nothing else — the bank details typed before the mode switch used
// to post verbatim, leaving orphan account numbers on cash rows.
for (const key of ['expenses', 'daybook']) {
  const a = PAYMENT_MODULES[key];
  const hydrated = a.fromRecord(CASES[key].row);
  const v = { ...switchMode(a, hydrated, 'CASH'), cash_account: 'PETTY CASH BOX' };
  const p = a.toPayload(v, ctx());
  assert.equal(hydrated.bank_account, CASES[key].row.account_no, `${key}: bank details hydrated from the CHEQUE row`);
  assert.deepEqual([p.account_no, p.branch, p.cheque_no ?? null], ['PETTY CASH BOX', null, null],
    `${key}: a CASH row carries the cash account, never the bank details`);

  // The other half of the same rule: an UNTOUCHED edit must not null a field the
  // current kind happens not to render. Force-nulling by kind is what wiped
  // firm_transaction's cheque_no on every bank edit.
  const same = a.toPayload(hydrated, ctx({ record: CASES[key].row }));
  assert.equal(same.branch, CASES[key].row.branch, `${key}: an untouched edit keeps branch`);
}

// plot_payment: one column, two meanings. A wrong split writes a client name
// into the bank-details box, or an account number into the cash-details box.
const pp = PAYMENT_MODULES.plot_payment;
assert.equal(pp.fromRecord({ payment_type: 'CASH', bank_details: 'SUNITA VERMA - 9876543210' }).bank_account, '',
  'plot_payment: a CASH row must not hydrate bank_account');
assert.equal(pp.fromRecord({ payment_type: 'BANK', payment_from: 'NEFT', bank_details: 'SBI 50100234567' }).cash_account, '',
  'plot_payment: a BANK row must not hydrate cash_account');
// The other half of the shared bank_details column: a CASH row must round-trip its
// typed Cash Details, which is what "farmer payment showing nothing" was about.
assert.equal(pp.fromRecord({ payment_type: 'CASH', payment_from: 'CASH', bank_details: 'RAVI - 9876543210' }).cash_account,
  'RAVI - 9876543210', 'plot_payment: a CASH row must hydrate cash_account');

const chqV = { ...switchMode(pp, pp.fromRecord(CASES.plot_payment.row), 'CHEQUE'), cheque_no: 'CHQ-5501' };
assert.equal(pp.toPayload(chqV, ctx()).cheque_status, 'PENDING', 'plot_payment: a new cheque starts PENDING');
assert.equal(pp.toPayload(chqV, ctx()).plot_id, 42, 'plot_payment: create still binds the plot');
assert.ok(!('cheque_status' in pp.toPayload(chqV, ctx({ record: CASES.plot_payment.row }))),
  'plot_payment: editing must not reset a cleared or bounced cheque to PENDING');

// The row the audit says production has: payment_from and payment_type disagree,
// because the old Bank/Cash toggle wrote payment_type without touching
// payment_from. Splitting by one and joining by the other emitted '' and wiped
// the reference on an edit that changed nothing.
const contradictory = {
  date: '2026-01-18', amount: '90000', payment_from: 'CASH', payment_type: 'BANK',
  bank_details: 'SBI-613266', buyer_name: 'A', booked_by: 'B', narration: 'C',
};
const ppRound = pp.toPayload(pp.fromRecord(contradictory), ctx({ record: contradictory }));
assert.equal(ppRound.bank_details, 'SBI-613266',
  'plot_payment: a payment_from/payment_type mismatch must round-trip, not blank the column');
assert.deepEqual([ppRound.payment_from, ppRound.payment_type], ['CASH', 'CASH'],
  'plot_payment: payment_type is re-derived from the mode both sides read');

// CHEQUE renders bank_name as the drawee bank (MODE_FIELD_SETS.CHEQUE), so gating
// the payload on BANK threw away what the user typed into a visible field.
assert.equal(pp.toPayload({ ...chqV, bank_name: 'SBI' }, ctx()).bank_name, 'SBI',
  'plot_payment: a CHEQUE keeps its drawee bank');
const fpCheque = PAYMENT_MODULES.farmer_payment.toPayload(
  { direction: 'in', amount: '9000', mode: 'CHEQUE', cheque_no: 'CHQ-2201', bank_name: 'HDFC', bank_account: '50200098765' }, ctx(),
);
assert.deepEqual([fpCheque.bank_name, fpCheque.bank_account_no], ['HDFC', '50200098765'],
  'farmer_payment: a CHEQUE keeps its drawee bank and account');
assert.equal(PAYMENT_MODULES.commission.toPayload(
  { direction: 'out', amount: '500', mode: 'CHEQUE', cheque_no: 'CHQ-1', bank_name: 'ICICI' }, ctx(),
).bank_name, 'ICICI', 'commission: a CHEQUE keeps its drawee bank');

// buyer_name is payload-only and its seed never fires when the page pre-binds the
// plot, so every create from PlotDetail/PlotPayments posted an empty buyer.
await pp.scope.load({ siteId: 7 });   // the one canned GET, as PaymentModal runs it on open
assert.equal(
  pp.toPayload({ direction: 'in', amount: '1000', mode: 'CASH', counterparty: { id: null, label: '' } },
    ctx({ scopeId: 202 })).buyer_name,
  'SUNITA VERMA', 'plot_payment: a pre-bound plot still posts its buyer');

// commission stores the inverted sign; every sibling stores the plain one.
const moneyIn = { direction: 'in', amount: '5000', mode: 'CASH' };
assert.equal(PAYMENT_MODULES.commission.toPayload(moneyIn, ctx()).amount, -5000,
  'commission: money IN stores NEGATIVE — the page reads direction back as amount < 0');
assert.equal(pp.toPayload(moneyIn, ctx()).amount, 5000,
  'plot_payment: money IN stores positive — commission is the only inversion');

// cashflow + firm_transaction: the debit/credit twins. Both pages compute running
// balances from these, so a flip is a silently valid, silently wrong ledger.
for (const key of ['cashflow', 'firm_transaction']) {
  const a = PAYMENT_MODULES[key];
  const v = a.fromRecord(CASES[key].row);
  const same = a.toPayload(v, ctx());
  const flipped = a.toPayload({ ...v, direction: v.direction === 'in' ? 'out' : 'in' }, ctx());
  assert.deepEqual([flipped.debit, flipped.credit], [same.credit, same.debit],
    `${key}: flipping direction must swap the columns, never fill both`);
  assert.equal(typeof same.debit, 'number', `${key}: debit posts as a number`);
}

// firm_transaction: FirmDetail shows Cheque No AND Transaction No on a `bank` row,
// but MODE_FIELD_SETS.BANK has no cheque_no — so the field never renders while
// fromRecord still hydrates it. Force-nulling by kind PUT cheque_no: null over a
// stored number on every bank edit that touched nothing.
const ft = PAYMENT_MODULES.firm_transaction;
const bankRow = {
  date: '2026-06-10', debit: '1500.50', credit: '', payment_mode: 'bank',
  cheque_no: '123456', transaction_no: 'UTR999', description: 'X', name: 'Y', purpose: 'Z',
};
const ftEdit = ft.toPayload(ft.fromRecord(bankRow), ctx({ record: bankRow }));
assert.deepEqual([ftEdit.cheque_no, ftEdit.transaction_no], ['123456', 'UTR999'],
  'firm_transaction: a BANK edit must keep the cheque no the form never showed');
// …and the switch still clears, so this is preservation, not leakage.
const ftCash = ft.toPayload(switchMode(ft, ft.fromRecord(bankRow), 'CASH'), ctx({ record: bankRow }));
assert.deepEqual([ftCash.cheque_no, ftCash.transaction_no], [null, null],
  'firm_transaction: switching to CASH still clears both references');

// farmer_payment: CHEQUE still posts 0/0. Preserved verbatim — fixing it changes
// reported cash/bank totals and belongs in its own PR.
const fpChq = PAYMENT_MODULES.farmer_payment.toPayload(
  { direction: 'in', amount: '9000', mode: 'CHEQUE', cheque_no: 'CHQ-2201' }, ctx(),
);
assert.deepEqual([fpChq.cash_amount, fpChq.bank_amount, fpChq.amount], [0, 0, 9000],
  'farmer_payment: CHEQUE posts cash_amount 0 / bank_amount 0');

// vendor_payment: three canonical fields collapse into reference_no, so the
// value must survive whichever field the kind renders — including legacy
// 'other' rows, whose kind renders neither.
const vp = PAYMENT_MODULES.vendor_payment;
// On a create only one of the two is ever filled, so the fallback chain must
// read both — an edit fixture hydrates both and would pass either way.
assert.equal(vp.toPayload({ direction: 'out', amount: '9000', mode: 'CHEQUE', cheque_no: 'CHQ-3040' }, ctx()).reference_no,
  'CHQ-3040', 'vendor_payment: a new cheque payment must post its cheque no');
assert.equal(vp.toPayload({ direction: 'out', amount: '9000', mode: 'UPI', txn_ref: 'utr-99120' }, ctx()).reference_no,
  'UTR-99120', 'vendor_payment: a new bank payment must post its reference');
const legacy = vp.fromRecord({ payment_date: '2026-07-14', amount: '32000', payment_mode: 'other', reference_no: 'MISC-9' });
assert.equal(vp.toPayload(legacy, ctx()).reference_no, 'MISC-9',
  'vendor_payment: reference_no must survive an edit of a legacy row');
// Both fields are hydrated from that one column, so the chain must start with the
// one this kind RENDERS — otherwise the stale cheque_no beats what the user typed.
const neftRow = { payment_date: '2026-07-14', amount: '5000', payment_mode: 'neft', reference_no: 'UTR111' };
const edited = { ...vp.fromRecord(neftRow), txn_ref: 'UTR222' };
assert.equal(vp.toPayload(edited, ctx({ record: neftRow })).reference_no, 'UTR222',
  'vendor_payment: editing the visible reference must not lose to the hydrated cheque_no');
const chqRow = { payment_date: '2026-07-14', amount: '5000', payment_mode: 'cheque', reference_no: 'CHQ-1' };
assert.equal(vp.toPayload({ ...vp.fromRecord(chqRow), cheque_no: 'CHQ-2' }, ctx({ record: chqRow })).reference_no,
  'CHQ-2', 'vendor_payment: a CHEQUE row reads the cheque field, not the reference');

// daybook: the date rule is a permission boundary — a wrong read of ctx.user.role
// either lets a sub-admin backdate, or rewrites an admin's back-dated entry.
const db = PAYMENT_MODULES.daybook;
const dbV = db.fromRecord(CASES.daybook.row);
const subAdmin = ctx({ user: { role: 'sub_admin' } });
const subDate = db.toPayload(dbV, subAdmin).date;
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(subDate) && subDate !== '2026-08-01',
  'daybook: a sub-admin must not back-date a NEW entry');
assert.equal(db.toPayload(dbV, { ...subAdmin, record: CASES.daybook.row }).date, '2026-08-01',
  'daybook: editing keeps the stored date');
assert.equal(db.toPayload(dbV, ctx()).date, '2026-08-01', 'daybook: an admin may back-date');
assert.equal(db.toPayload({ ...dbV, voucher_url: 'https://s3/vouchers/db-808.pdf' }, ctx()).voucher_url,
  'https://s3/vouchers/db-808.pdf', 'daybook: an attached voucher is still sent');
// Clearable on edit, invented on create never: a conditional spread omitted the
// key, so removing an upload left the stored URL behind while the modal showed none.
assert.equal(db.toPayload({ ...dbV, voucher_url: '' }, ctx({ record: CASES.daybook.row })).voucher_url, null,
  'daybook: clearing a voucher on edit must send the key as null');
assert.ok(!('voucher_url' in db.toPayload({ ...dbV, voucher_url: '' }, ctx())),
  'daybook: a create with no upload must not invent a key POST /daybook never had');

// expenses: picking a member stored full_name VERBATIM; only typed free text was
// uppercased. Uppercasing both changes the value every list renders.
const ex = PAYMENT_MODULES.expenses;
const exV = ex.fromRecord(CASES.expenses.row);
assert.equal(ex.toPayload({ ...exV, counterparty: { id: 12, label: 'Ravi Kumar' } }, ctx()).to_entity,
  'Ravi Kumar', 'expenses: a member-linked TO keeps the stored name');
assert.equal(ex.toPayload({ ...exV, counterparty: { id: null, label: 'ravi traders' } }, ctx()).to_entity,
  'RAVI TRADERS', 'expenses: typed free text is still uppercased');

// commission sends '' where the page sends '' — the drift the audit flagged.
assert.deepEqual(
  [PAYMENT_MODULES.commission.toPayload({ direction: 'out', amount: '5', mode: 'CASH' }, ctx()).remarks,
    PAYMENT_MODULES.commission.toPayload({ direction: 'out', amount: '5', mode: 'CASH' }, ctx()).voucher_url],
  ['', ''], 'commission: unset remarks/voucher_url stay empty strings, as the page has always sent them');

/* ── no adapter may post money against a null scope ─────────────────────── */

// 6 of 8 could, and two of them had no picker to set one from: the dashboard
// posted master_id: null and POST /vendors/commitments/null/payments, both with a
// success toast. Every scoped adapter is now either pickable or picker-excluded.
for (const key of ['plot_payment', 'cashflow', 'farmer_payment', 'commission', 'firm_transaction', 'vendor_payment']) {
  const a = PAYMENT_MODULES[key];
  const v = { ...a.fromRecord(CASES[key].row), amount: '100' };
  assert.equal(typeof a.validate(v, ctx({ scopeId: null })), 'string', `${key}: must refuse a null scope`);
  assert.equal(a.validate(v, ctx()), null, `${key}: a bound scope still validates`);
  assert.ok(
    a.scope
      ? ['load', 'getKey', 'getLabel', 'getSearch'].every((f) => typeof a.scope[f] === 'function')
      : a.requiresScope === true,
    `${key}: needs a usable scope picker, or requiresScope so the picker omits it`,
  );
}
assert.deepEqual(modulesFor(() => true).filter((m) => m.requiresScope).map((m) => m.key), [],
  'the dashboard picker must not offer a module whose scope it cannot set');
assert.ok(modulesFor(() => true, 'write', 42).some((m) => m.key === 'commission'),
  'a bound scope brings the scope-only modules back');

console.log('modules: all checks passed');

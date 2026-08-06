// Per-module payload adapters for PaymentModal. The modal knows canonical field
// names only; every backend key mapping lives here, so a wire-format change is a
// data edit rather than a branch inside the component.
//
// EVERY VALUE IN THIS FILE IS MONEY IN A REAL LEDGER. Each toPayload below
// reproduces the key set its page posted today — dropping or renaming a key
// silently corrupts records, and each fromRecord must be EXHAUSTIVE because
// edit-mode hydration is where three modules currently destroy `cheque_no`.
//
// MODE FIELDS ARE NEVER FORCE-NULLED BY KIND. A field the current kind does not
// RENDER can still hold a value the row stored — FirmDetail shows Cheque No AND
// Transaction No on a `bank` row, but MODE_FIELD_SETS.BANK has no cheque_no — so
// `kind === 'CHEQUE' ? v : null` wipes a number the form never even showed.
// PaymentModal.setMode already clears every field the new kind does not keep, so
// `v.x || null` is empty exactly when the user really switched mode, and
// preserved when they never touched it. Kind still decides which field feeds a
// SHARED column (bank_details, account_no, reference_no) — that is a join, not a
// wipe, and both sides of that join must derive the kind from the same source.
import { BookOpen, Building2, LandPlot, Percent, Receipt, Sprout, Truck, Wallet } from 'lucide-react';
import api from '../../api/api';
import {
  PAYMENT_MODE_OPTIONS,
  PLOT_PAYMENT_MODES,
  derivePaymentType,
} from '../../constants/paymentOptions';
import { PREDEFINED_EXPENSE_CATEGORIES } from '../../constants/expenseCategories';

/* ── shared helpers ─────────────────────────────────────────────────────── */

// Local date, not toISOString() — the UTC form rolls back a day before 05:30 IST.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Server dates arrive as 'YYYY-MM-DD' or a full ISO string; an invalid one must
// yield '' rather than 'NaN-NaN-NaN', which <input type="date"> silently drops.
const dateOf = (d) => {
  if (!d) return '';
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt?.getTime?.()) ? '' : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const amt = (v) => Math.abs(parseFloat(v) || 0);
const up = (v) => (v || '').toUpperCase();
const int = (v) => (v === null || v === undefined || v === '' ? null : parseInt(v, 10));

/** Kind of a mode token, honouring an adapter's non-standard overrides. */
const kindOf = (mode, overrides) => overrides?.[mode] || derivePaymentType(mode);

/** debit/credit twins are how four modules encode direction. */
const twin = (values) => {
  const a = amt(values.amount);
  return { debit: values.direction === 'out' ? a : 0, credit: values.direction === 'in' ? a : 0 };
};
const twinDirection = (row) => {
  const debit = parseFloat(row.debit) || 0;
  const credit = parseFloat(row.credit) || 0;
  return { direction: credit > 0 && debit <= 0 ? 'in' : 'out', debit, credit };
};

/** The only validation that must never be simplified away. */
const requireAmount = (v) => (amt(v.amount) > 0 ? null : 'Enter an amount greater than 0');

/** No adapter may post money against a null scope. A page usually pre-binds one,
 *  but the dashboard picker does not, and `master_id: null` / `POST
 *  /vendors/commitments/null/payments` both fire with a success toast. */
const requireScope = (ctx, what) => ((ctx?.scopeId ?? '') === '' ? `Select a ${what}` : null);

/** Sub-admins cannot write directly — the backend queues a multipart edit request. */
const postEditRequest = (module, recordId, payload, proofPhoto, extra) => {
  const fd = new FormData();
  fd.append('module', module);
  fd.append('record_id', String(recordId));
  fd.append('proposed_data', JSON.stringify(payload));
  Object.entries(extra || {}).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, v); });
  if (proofPhoto) fd.append('proof_photo', proofPhoto);
  return api.post('/edit-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};

const isAdminUser = (ctx) => ['admin', 'super_admin'].includes(ctx?.user?.role);

// SearchSelect's default accessors read {id,label}; server rows use name/full_name.
const nameOf = (m) => m.full_name || m.name || '';
const partyOpt = (m) => ({ id: m.id ?? null, label: nameOf(m), search: `${nameOf(m)} ${m.phone || ''}`.trim() });
// cash_party is stored as the literal "NAME - PHONE" string the tables print.
const cashOpt = (m) => {
  const label = m.phone ? `${nameOf(m)} - ${m.phone}` : nameOf(m);
  return { id: m.id ?? null, label, search: label };
};
const list = (v) => (Array.isArray(v) ? v : []);

/* ── module-local option lists ──────────────────────────────────────────── */

const CASH_BANK_CHEQUE = ['CASH', 'BANK', 'CHEQUE'];

// 'BANK TRANSFER' is not in BANK_TYPE_FROMS so it would derive CASH. Renaming it
// to TRANSFER would change every stored `particular` value — override instead.
const FARMER_MODES = ['CASH', 'BANK TRANSFER', 'RTGS', 'NEFT', 'UPI', 'IMPS', 'CHEQUE'];
const FARMER_KINDS = { 'BANK TRANSFER': 'BANK' };

const VENDOR_MODES = ['CASH', 'BANK', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'IMPS', 'ADJUST'];

const FIRM_REMARK_OPTIONS = [
  'PLOT ADVANCE', 'SALARY', 'EXPENCE', 'PERSONAL', 'FIRM',
  'REGISTRY', 'COMMISSION', 'LOAN', 'REFUND', 'MISCELLANEOUS',
];

// Plots by id, filled by plot_payment.scope.load (which PaymentModal runs on every
// open, pre-bound scope or not). buyer_name is payload-only in every existing
// modal and scope.seed only fires when the user picks a plot in the SearchSelect —
// which never renders for PlotDetail/PlotPayments, so toPayload reads it back here.
// ponytail: a plain Map refilled on the first open per site, no TTL. Ceiling: a
// buyer renamed mid-session posts the old name until the tab reloads.
const plotsById = new Map();

const DAYBOOK_ENTRY_TYPES = [
  'GENERAL', 'EXPENSE', 'INCOME', 'PAYMENT', 'RECEIPT', 'TRANSFER', 'ADJUSTMENT',
  'FARMER PAYMENT', 'PLOT COMMISSION', 'VENDOR PAYMENT', 'PLOT PAYMENT',
  'CASH FLOW', 'FIRM TRANSACTION', 'OTHER',
];

/* ── adapters ───────────────────────────────────────────────────────────── */

export const PAYMENT_MODULES = {
  /* ══ expenses — Expenses.jsx + dashboard debit tab ══════════════════════ */
  expenses: {
    key: 'expenses',
    label: 'Expense',
    hint: 'Site expense',
    icon: Receipt,
    permission: 'expenses',
    group: 'out',

    directions: ['out', 'in'],
    directionLabels: { out: 'Debit', in: 'Credit' },

    modes: PAYMENT_MODE_OPTIONS,
    // cash_account shares the account_no column with bank_account: the two are
    // mutually exclusive by kind, and account_no is force-nulled on CASH rows
    // today, so it is free to hold "which cash box" without a migration.
    modeFields: ['cash_account', 'bank_account', 'branch', 'cheque_no'],
    fieldLabels: { bank_account: 'Account No' },
    scope: null,

    fields: ['counterparty', 'source', 'category', 'note', 'voucher', 'approver'],
    fieldMeta: {
      // No `uppercase` here: picking a member stores full_name VERBATIM today, and
      // the shell's uppercase flag cannot tell a pick from typed text. toPayload
      // uppercases the free-text case only, which is exactly today's split.
      counterparty: { label: 'TO (Member / Vendor)', span: 6, source: 'toEntities', allowCustom: true },
      source: { label: 'FROM', span: 6, source: 'fromEntities', allowCustom: true, uppercase: true },
      category: { label: 'Category', span: 6, source: 'categories', allowCustom: true },
      note: { label: 'Remark', uppercase: true },
    },

    loadSources: async (ctx) => {
      const [ac, cats, members] = await Promise.all([
        api.get(`/expenses/autocomplete?site_id=${ctx.siteId}`).catch(() => ({ data: {} })),
        api.get('/expense-categories').catch(() => ({ data: {} })),
        api.get('/members', { params: { site_id: ctx.siteId, limit: 1000 } }).catch(() => ({ data: {} })),
      ]);
      // ponytail: no per-browser HIDDEN_EXPENSE_CATEGORIES filter — a searchable
      // list makes a long one cheap. Re-add it if users ask for the hiding back.
      const categories = [...new Set([
        ...PREDEFINED_EXPENSE_CATEGORIES.map((c) => c.name),
        ...list(cats.data?.categories).map((c) => c.name),
        ...list(ac.data?.categories),
      ])].sort();
      const people = list(members.data?.members).map(partyOpt);
      return {
        members: people,
        // Linked members first: picking one carries assigned_user_id, free text does not.
        toEntities: [...people, ...list(ac.data?.toEntities)],
        fromEntities: list(ac.data?.fromEntities),
        categories,
        accountNos: list(ac.data?.accountNos),
        branches: list(ac.data?.branches),
        bankNames: [],
      };
    },

    fromRecord: (row) => {
      const { direction, debit, credit } = twinDirection(row);
      return {
        date: dateOf(row.date) || dateOf(row.created_at),
        direction,
        amount: String(direction === 'in' ? credit : debit),
        mode: row.payment_mode || '',
        counterparty: { id: row.assigned_user_id ?? null, label: row.to_entity || '' },
        source: { id: null, label: row.from_entity || '' },
        // account_no is dual-purpose: cash account on CASH rows, bank details
        // otherwise. Hydrate the one the row's mode actually meant.
        bank_account: derivePaymentType(row.payment_mode) === 'CASH' ? '' : (row.account_no || ''),
        cash_account: derivePaymentType(row.payment_mode) === 'CASH' ? (row.account_no || '') : '',
        branch: row.branch || '',
        cheque_no: row.cheque_no || '',
        category: row.category || '',
        note: row.remark || '',
        voucher_url: row.voucher_url || '',
        assigned_admin_id: row.assigned_admin_id ?? null,
      };
    },

    toPayload: (v, ctx) => {
      const kind = derivePaymentType(v.mode);
      return {
        site_id: ctx.siteId,
        date: v.date || today(),
        from_entity: up(v.source?.label),
        // A member-linked TO keeps the name as stored (`RAVI KUMAR` vs `Ravi
        // Kumar` is a visible change in every list); only free text is uppercased.
        to_entity: v.counterparty?.id ? (v.counterparty.label || '') : up(v.counterparty?.label),
        payment_mode: v.mode,
        // Never `kind === 'CHEQUE' ? … : null` — see the file header.
        cheque_no: v.cheque_no || null,
        ...twin(v),
        remark: up(v.note),
        // Dual-purpose column, so kind picks WHICH field feeds it: on CASH the
        // cash account, otherwise the bank details (sent verbatim before, which
        // left orphan bank details on cash rows).
        account_no: kind === 'CASH' ? (v.cash_account || null) : (v.bank_account || null),
        branch: v.branch || null,
        category: v.category,
        assigned_user_id: v.counterparty?.id ?? null,
        voucher_url: v.voucher_url || '',
        assigned_admin_id: v.assigned_admin_id ?? null,
      };
    },

    validate: requireAmount,

    submit: (payload, { record }) =>
      record ? api.put(`/expenses/${record.id}`, payload) : api.post('/expenses', payload),
  },

  /* ══ plot_payment — PlotDetail.jsx + PlotPayments.jsx + dashboard credit ══ */
  plot_payment: {
    key: 'plot_payment',
    label: 'Plot Payment',
    hint: 'Against a plot',
    icon: LandPlot,
    permission: 'plot_payments',
    group: 'in',

    directions: ['in', 'out'],
    directionLabels: { in: 'Credit', out: 'Debit' },

    modes: PLOT_PAYMENT_MODES,
    // cash_account and bank_account share the `bank_details` column; the kind
    // makes them mutually exclusive, which is why both can be declared here.
    modeFields: ['cash_account', 'bank_name', 'bank_account', 'branch', 'cheque_no'],
    fieldLabels: { bank_account: 'Bank Details' },

    editRequest: true,

    scope: {
      label: 'Plot',
      load: (ctx) => api.get(`/plots?site_id=${ctx.siteId}`).then((r) => {
        const plots = list(r.data?.plots);
        plotsById.clear();  // a site switch must never resolve a stale plot
        plots.forEach((p) => plotsById.set(String(p.id), p));
        return plots;
      }),
      getKey: (p) => p.id,
      getLabel: (p) => `${p.plot_no || '—'} · ${p.buyer_name || '—'}`,
      getSearch: (p) => `${p.plot_no || ''} ${p.block || ''} ${p.buyer_name || ''}`,
      // buyer_name is payload-only in every existing modal — seed it from the plot
      // or a create posts an empty buyer on a row whose table renders that column.
      seed: (p) => ({ counterparty: { id: null, label: p?.buyer_name || '' } }),
    },

    fields: ['counterparty', 'source', 'note', 'voucher', 'approver'],
    fieldMeta: {
      counterparty: { label: 'Buyer', span: 6, readOnly: true },
      source: { label: 'Booked By', span: 6, source: 'fromEntities', allowCustom: true, uppercase: true },
      note: { label: 'Narration', uppercase: true },
    },

    loadSources: async (ctx) => {
      const ac = await api.get(`/plots/autocomplete?site_id=${ctx.siteId}`).catch(() => ({ data: {} }));
      return {
        members: list(ac.data?.members).map(cashOpt),
        fromEntities: list(ac.data?.bookedBys),
        toEntities: [],
        categories: [],
        accountNos: list(ac.data?.bankDetails),
        bankNames: [],
        branches: [],
      };
    },

    fromRecord: (row) => {
      const a = parseFloat(row.amount) || 0;
      // ONE notion of kind on both sides: derivePaymentType of the mode token.
      // Production rows exist where payment_from and payment_type disagree
      // ({payment_from:'CASH', payment_type:'BANK'} — clicking the old Bank toggle
      // set only payment_type). Splitting bank_details by the stored payment_type
      // and joining it back by the mode's kind emitted '' and wiped the column.
      // payment_from wins because it is the token the mode chips show and
      // payment_type is documented as derived, never user-picked.
      const mode = row.payment_from || row.payment_type || '';
      const kind = derivePaymentType(mode);
      return {
        date: dateOf(row.date),
        direction: a < 0 ? 'out' : 'in',
        amount: String(Math.abs(a)),
        mode,
        counterparty: { id: null, label: row.buyer_name || '' },
        source: { id: null, label: row.booked_by || '' },
        // One column, two meanings — split it back by kind or a cash row's client
        // name lands in the bank-details box.
        cash_account: kind === 'CASH' ? (row.bank_details || '') : '',
        bank_account: kind === 'CASH' ? '' : (row.bank_details || ''),
        bank_name: row.bank_name || '',
        branch: row.branch || '',
        cheque_no: row.cheque_no || '',
        note: row.narration || '',
        voucher_url: row.voucher_url || '',
        assigned_admin_id: row.assigned_admin_id ?? null,
      };
    },

    toPayload: (v, ctx) => {
      const kind = derivePaymentType(v.mode);
      const a = amt(v.amount);
      const p = {
        date: v.date || today(),
        payment_from: v.mode,
        // DB CHECK constraint accepts CASH|BANK|CHEQUE only — never user-picked.
        // Same derivation fromRecord used, so an untouched edit round-trips.
        payment_type: kind,
        // Not gated on BANK: MODE_FIELD_SETS.CHEQUE renders bank_name as the
        // drawee bank, and gating threw that typed value away on save.
        bank_name: v.bank_name || null,
        branch: v.branch || null,
        bank_details: kind === 'CASH' ? (v.cash_account || '') : up(v.bank_account),
        narration: up(v.note),
        // scope.seed only runs in the scope picker, which does not render when the
        // page pre-binds the plot — so fall back to the fetched plot or every
        // create from PlotDetail/PlotPayments posts an empty buyer.
        buyer_name: v.counterparty?.label || plotsById.get(String(ctx.scopeId))?.buyer_name || '',
        booked_by: up(v.source?.label),
        amount: v.direction === 'out' ? -a : a,
        cheque_no: v.cheque_no || null,
        voucher_url: v.voucher_url || null,
        assigned_admin_id: v.assigned_admin_id ?? null,
      };
      // Omitted on edit: resending it reset cleared/bounced cheques to PENDING,
      // fighting ChequeStatusControl. site_id is derived server-side from plot_id.
      if (!ctx.record) {
        p.plot_id = ctx.scopeId;
        if (kind === 'CHEQUE') p.cheque_status = 'PENDING';
      }
      return p;
    },

    // plot_id is create-only (the server keeps it on update), so an edit needs no scope.
    validate: (v, ctx) => requireAmount(v) || (ctx.record ? null : requireScope(ctx, 'plot')),

    submit: (payload, { record, requestEdit, values }) => {
      if (record && requestEdit) return postEditRequest('plot_payment', record.id, payload, values.proof_photo);
      return record
        ? api.put(`/plots/payments/${record.id}`, payload)
        : api.post('/plots/payments', payload);
    },
  },

  /* ══ cashflow — CashFlow.jsx ════════════════════════════════════════════ */
  cashflow: {
    key: 'cashflow',
    label: 'Cash Flow Entry',
    hint: 'Into a ledger',
    icon: Wallet,
    permission: 'cashflow',
    group: 'both',

    directions: ['out', 'in'],
    directionLabels: { out: 'Debit', in: 'Credit' },

    modes: CASH_BANK_CHEQUE,
    modeFields: ['cheque_no'],

    scope: {
      label: 'Ledger',
      load: (ctx) => api.get(`/cashflow/months?site_id=${ctx.siteId}`).then((r) => list(r.data?.months)),
      getKey: (l) => l.id,
      getLabel: (l) => `${l.ledger_name || '—'} · ${l.month || ''}/${l.year || ''}`,
      getSearch: (l) => `${l.ledger_name || ''} ${l.month || ''} ${l.year || ''}`,
    },

    fields: ['counterparty', 'source', 'category', 'note', 'voucher', 'approver'],
    fieldMeta: {
      // is_firm_transaction and to_mode are derived from these two — no checkbox.
      counterparty: { label: 'To (Firm / Name)', span: 6, source: 'toEntities', allowCustom: true, uppercase: true },
      source: { label: 'From Firm', span: 6, source: 'fromEntities' },
      category: { label: 'Particular', span: 6, source: 'categories', allowCustom: true, required: true },
      note: { label: 'Remarks' },
    },

    loadSources: async (ctx) => {
      const [ac, firms] = await Promise.all([
        api.get(`/cashflow/autocomplete?site_id=${ctx.siteId}`).catch(() => ({ data: {} })),
        api.get(`/cashflow/firms?site_id=${ctx.siteId}`).catch(() => ({ data: {} })),
      ]);
      const firmOpts = list(firms.data?.firms).map(partyOpt);
      return {
        members: [],
        toEntities: firmOpts,
        fromEntities: firmOpts,
        categories: list(ac.data?.particulars),
        bankNames: [],
        accountNos: [],
        branches: [],
      };
    },

    fromRecord: (row) => {
      const { direction, debit, credit } = twinDirection(row);
      return {
        date: dateOf(row.date),
        direction,
        amount: String(direction === 'in' ? credit : debit),
        mode: up(row.cash_type || 'cash'),
        category: row.particular || '',
        counterparty: { id: row.to_firm_id ?? null, label: row.to_firm_name || row.to_name || '' },
        source: { id: row.from_firm_id ?? null, label: row.from_firm_name || '' },
        // Phantom key today: never hydrated, so every cheque edit PUT nulled it.
        cheque_no: row.cheque_no || '',
        note: row.remarks || '',
        voucher_url: row.voucher_url || '',
        assigned_admin_id: row.assigned_admin_id ?? null,
      };
    },

    toPayload: (v, ctx) => {
      const kind = derivePaymentType(v.mode);
      const toId = int(v.counterparty?.id);
      const fromId = int(v.source?.id);
      const toLabel = (v.counterparty?.label || '').trim();
      return {
        cash_flow_month_id: int(ctx.scopeId),
        date: v.date || today(),
        particular: v.category,
        ...twin(v),
        remarks: v.note,
        cash_type: kind.toLowerCase(),
        cheque_no: v.cheque_no || null,
        voucher_url: v.voucher_url || null,
        is_firm_transaction: !!(fromId || toId || toLabel),
        from_firm_id: fromId,
        to_firm_id: toId,
        to_name: toId ? null : (up(toLabel) || null),
        assigned_admin_id: v.assigned_admin_id ?? null,
      };
    },

    // The ledger is in the body on create AND update — a null one moves the entry
    // out of every month's balance.
    validate: (v, ctx) => requireAmount(v) || requireScope(ctx, 'ledger')
      || ((v.category || '').trim() ? null : 'Particular is required'),

    submit: (payload, { record }) =>
      record ? api.put(`/cashflow/entries/${record.id}`, payload) : api.post('/cashflow/entries', payload),
  },

  /* ══ farmer_payment — FarmerPayments.jsx ════════════════════════════════ */
  farmer_payment: {
    key: 'farmer_payment',
    label: 'Farmer Payment',
    hint: 'Against a farmer',
    icon: Sprout,
    permission: 'farmers',
    group: 'in',

    directions: ['in', 'out'],
    directionLabels: { in: 'Credit', out: 'Debit' },

    modes: FARMER_MODES,
    kindOverrides: FARMER_KINDS,
    // cash_account and txn_ref share `bank_reference`; the kind makes them
    // mutually exclusive, so a CASH row still has somewhere to put its details.
    modeFields: ['cash_account', 'bank_name', 'bank_account', 'txn_ref', 'ifsc', 'cheque_no'],
    fieldLabels: { bank_account: 'Account No', txn_ref: 'Reference / UTR No' },
    editRequest: true,

    scope: {
      label: 'Farmer',
      load: (ctx) => api.get(`/daybook/farmers?site_id=${ctx.siteId}`)
        .then((r) => list(r.data?.farmers).filter((f) => f.status === 'active')),
      getKey: (f) => f.id,
      getLabel: (f) => nameOf(f) || `Farmer #${f.id}`,
      getSearch: (f) => `${nameOf(f)} ${f.phone || ''} ${f.village || ''}`,
    },

    fields: ['counterparty', 'note', 'voucher', 'approver'],
    fieldMeta: {
      counterparty: { label: 'By (who / reference)', span: 6, allowCustom: true },
      note: { label: 'Remarks' },
    },

    loadSources: async () => ({
      members: [], toEntities: [], fromEntities: [], categories: [],
      bankNames: [], accountNos: [], branches: [],
    }),

    fromRecord: (row) => {
      const a = parseFloat(row.amount) || 0;
      // `particular` is the only column holding the raw token; payment_mode/mode
      // store the kind, so fall back to a token of that kind when it is missing.
      const kind = row.payment_mode === 'CHEQUE' || row.particular === 'CHEQUE' ? 'CHEQUE'
        : row.payment_mode === 'BANK' ? 'BANK' : 'CASH';
      const mode = FARMER_MODES.includes(row.particular)
        ? row.particular
        : (kind === 'CHEQUE' ? 'CHEQUE' : kind === 'BANK' ? 'BANK TRANSFER' : 'CASH');
      return {
        date: dateOf(row.date),
        direction: row.transaction_type ? (row.transaction_type === 'debit' ? 'out' : 'in') : (a < 0 ? 'out' : 'in'),
        amount: String(Math.abs(a)),
        mode,
        counterparty: { id: null, label: row.by_note || '' },
        bank_name: row.bank_name || '',
        bank_account: row.bank_account_no || '',
        // bank_reference is dual-purpose: cash details on CASH rows, UTR otherwise.
        txn_ref: kind === 'CASH' ? '' : (row.bank_reference || ''),
        cash_account: kind === 'CASH' ? (row.bank_reference || '') : '',
        ifsc: row.bank_ifsc || '',
        cheque_no: row.cheque_no || '',
        note: row.remarks || '',
        voucher_url: row.voucher_url || '',
        assigned_admin_id: row.assigned_admin_id ?? null,
      };
    },

    // Contract preserved VERBATIM, deliberately, including the two quirks below.
    // Fixing either changes reported totals and belongs in its own PR:
    //   1. `payment_mode` and `mode` both carry the KIND, never the raw token.
    //   2. CHEQUE posts cash_amount 0 / bank_amount 0, so cheque money shows up
    //      only in the Total column.
    toPayload: (v) => {
      const kind = kindOf(v.mode, FARMER_KINDS);
      const total = v.direction === 'out' ? -amt(v.amount) : amt(v.amount);
      return {
        date: v.date || today(),
        transaction_type: v.direction === 'in' ? 'credit' : 'debit',
        particular: v.mode,
        mode: kind,
        payment_mode: kind,
        amount: total,
        cash_amount: kind === 'CASH' ? total : 0,
        bank_amount: kind === 'BANK' ? total : 0,
        by_note: v.counterparty?.label || '',
        remarks: v.note || '',
        // Not gated on BANK: CHEQUE renders bank_name (drawee) and bank_account
        // too, and gating threw both away. The mode switch is what clears the
        // fields the new kind does not ask for — see the file header.
        bank_name: v.bank_name || '',
        bank_account_no: v.bank_account || '',
        bank_reference: kind === 'CASH' ? (v.cash_account || '') : (v.txn_ref || ''),
        bank_ifsc: up(v.ifsc),
        cheque_no: v.cheque_no || null,
        voucher_url: v.voucher_url || '',
        assigned_admin_id: v.assigned_admin_id ?? null,
      };
    },

    // The farmer is the URL, not the body: a null one POSTs to /farmers/null/payments.
    validate: (v, ctx) => requireAmount(v) || requireScope(ctx, 'farmer')
      || (kindOf(v.mode, FARMER_KINDS) === 'CHEQUE' && !v.cheque_no ? 'Cheque number is required' : null),

    submit: (payload, { ctx, record, requestEdit, values }) => {
      if (record && requestEdit) {
        // currentSite is the consistent source; the page read farmer.site_id here.
        return postEditRequest('farmer_payment', record.id, payload, values.proof_photo, { site_id: ctx.siteId });
      }
      return record
        ? api.put(`/farmers/${ctx.scopeId}/payments/${record.id}`, payload)
        : api.post(`/farmers/${ctx.scopeId}/payments`, payload);
    },
  },

  /* ══ commission — PlotCommissionDetail.jsx (create + edit) ══════════════ */
  commission: {
    key: 'commission',
    label: 'Commission Payout',
    hint: 'To an agent',
    icon: Percent,
    permission: 'commissions',
    group: 'out',

    directions: ['out', 'in'],
    directionLabels: { out: 'Debit', in: 'Credit' },

    modes: CASH_BANK_CHEQUE,
    // cash_account shares `transaction_id` with txn_ref, mutually exclusive by kind.
    modeFields: ['cash_account', 'bank_name', 'txn_ref', 'cheque_no'],
    fieldLabels: { txn_ref: 'Transaction ID' },
    // No picker: the payee AND the overpay cap both come from the agent-commission
    // row that was clicked (ctx.scope.balance / total_paid_all), so a dashboard
    // picker would have to drop the only guard this module has. Excluded from
    // modulesFor() instead — see requiresScope there.
    scope: null,
    requiresScope: true,

    fields: ['note', 'voucher', 'approver'],
    fieldMeta: { note: { label: 'Remarks' } },

    loadSources: async () => ({
      members: [], toEntities: [], fromEntities: [], categories: [],
      bankNames: [], accountNos: [], branches: [],
    }),

    fromRecord: (row) => {
      const a = parseFloat(row.amount) || 0;
      return {
        date: dateOf(row.date),
        // INVERTED: a stored negative is money received FROM the agent.
        direction: a < 0 ? 'in' : 'out',
        amount: String(Math.abs(a)),
        mode: row.payment_mode || 'CASH',
        bank_name: row.bank_name || '',
        txn_ref: derivePaymentType(up(row.payment_mode)) === 'CASH' ? '' : (row.transaction_id || ''),
        cash_account: derivePaymentType(up(row.payment_mode)) === 'CASH' ? (row.transaction_id || '') : '',
        cheque_no: row.cheque_no || '',
        note: row.remarks || '',
        voucher_url: row.voucher_url || '',
        assigned_admin_id: row.assigned_admin_id ?? null,
      };
    },

    toPayload: (v, ctx) => {
      const a = amt(v.amount);
      return {
        master_id: int(ctx.scopeId),
        date: v.date || today(),
        // INVERTED vs every other module — the whole page reads direction back as
        // `(parseFloat(amount) || 0) < 0`. Do not "fix" this to match its siblings.
        amount: v.direction === 'in' ? -a : a,
        payment_mode: v.mode,
        // Not gated on BANK: CHEQUE renders bank_name as the drawee bank and the
        // column exists, so gating silently dropped what the user typed.
        bank_name: v.bank_name || null,
        transaction_id: (derivePaymentType(up(v.mode)) === 'CASH' ? v.cash_account : v.txn_ref) || null,
        cheque_no: v.cheque_no || null,
        // '' not null: the page spreads formData, so these have always gone out as
        // empty strings. The controller coerces both to NULL either way — matching
        // today keeps the wire format identical to what the API has been fed.
        remarks: v.note || '',
        voucher_url: v.voucher_url || '',
        assigned_admin_id: v.assigned_admin_id ?? null,
        // is_receive_entry dropped — a UI-only flag the edit PUT was shipping.
      };
    },

    validate: (v, ctx) => {
      const err = requireAmount(v) || requireScope(ctx, 'commission entry');
      if (err) return err;
      if (derivePaymentType(v.mode) === 'BANK' && !v.bank_name) return 'Bank name is required for BANK payments';
      const scope = ctx.scope || {};
      const cap = parseFloat(v.direction === 'in' ? scope.total_paid_all : scope.balance);
      if (Number.isFinite(cap) && amt(v.amount) > cap) {
        const what = v.direction === 'in' ? 'recoverable' : 'due';
        return { confirm: `Amount exceeds the ₹${cap.toLocaleString('en-IN')} ${what}. Record anyway?` };
      }
      return null;
    },

    submit: (payload, { record }) =>
      record
        ? api.put(`/plot-commission/payment/${record.id}`, payload)
        : api.post('/plot-commission/payment', payload),
  },

  /* ══ firm_transaction — FirmDetail.jsx ══════════════════════════════════ */
  firm_transaction: {
    key: 'firm_transaction',
    label: 'Firm Transaction',
    hint: 'Against a firm',
    icon: Building2,
    permission: 'firm_transactions',
    group: 'both',

    directions: ['out', 'in'],
    directionLabels: { out: 'Debit', in: 'Credit' },

    modes: CASH_BANK_CHEQUE,
    // cash_account shares `transaction_no` with txn_ref, mutually exclusive by kind.
    modeFields: ['cash_account', 'cheque_no', 'txn_ref'],
    fieldLabels: { txn_ref: 'Transaction No / UTR' },

    scope: {
      label: 'Firm',
      load: (ctx) => api.get(`/firms?site_id=${ctx.siteId}`).then((r) => list(r.data?.firms)),
      getKey: (f) => f.id,
      getLabel: (f) => nameOf(f) || `Firm #${f.id}`,
      getSearch: (f) => nameOf(f),
    },

    fields: ['counterparty', 'category', 'note', 'voucher', 'approver'],
    fieldMeta: {
      counterparty: { label: 'Name', span: 6, source: 'toEntities', allowCustom: true, uppercase: true },
      category: { label: 'Purpose', span: 6, source: 'categories', allowCustom: true, uppercase: true },
      note: { label: 'Description', required: true },
    },
    extras: [
      { key: 'remark', label: 'Remark', type: 'select', options: FIRM_REMARK_OPTIONS, span: 6 },
      { key: 'remark2', label: 'Remark 2', type: 'text', span: 6 },
    ],

    loadSources: async (ctx) => {
      const res = await api.get(`/firms/transactions/list?firm_id=${ctx.scopeId}`).catch(() => ({ data: {} }));
      const ac = res.data?.autocomplete || {};
      return {
        members: [],
        toEntities: list(ac.names),
        fromEntities: [],
        categories: list(ac.purposes),
        bankNames: [], accountNos: [], branches: [],
      };
    },

    fromRecord: (row) => {
      const { direction, debit, credit } = twinDirection(row);
      const mode = up(row.payment_mode || 'cash');
      return {
        date: dateOf(row.date),
        direction,
        amount: String(direction === 'in' ? credit : debit),
        mode: CASH_BANK_CHEQUE.includes(mode) ? mode : 'CASH',
        counterparty: { id: null, label: row.name || '' },
        category: row.purpose || '',
        cheque_no: row.cheque_no || '',
        txn_ref: derivePaymentType(up(row.payment_mode)) === 'CASH' ? '' : (row.transaction_no || ''),
        cash_account: derivePaymentType(up(row.payment_mode)) === 'CASH' ? (row.transaction_no || '') : '',
        note: row.description || '',
        remark: row.remark || '',
        remark2: row.remark2 || '',
        voucher_url: row.voucher_url || '',
        assigned_admin_id: row.assigned_admin_id ?? null,
      };
    },

    // Explicit key list — the page spread the whole form, PUTting id/status/
    // balance/created_at straight back at the server on every edit.
    toPayload: (v, ctx) => {
      const kind = derivePaymentType(v.mode);
      return {
        firm_id: int(ctx.scopeId),
        date: v.date || today(),
        payment_mode: kind.toLowerCase(),
        // NOT gated by kind: FirmDetail renders Cheque No AND Transaction No on a
        // `bank` row, so a BANK edit that never touched either used to PUT
        // cheque_no: null over a stored cheque number. See the file header.
        cheque_no: v.cheque_no || null,
        transaction_no: up(derivePaymentType(up(v.mode)) === 'CASH' ? v.cash_account : v.txn_ref) || null,
        description: v.note || '',
        // Numbers, not the "1500.50" / '' strings the twin inputs used to post.
        ...twin(v),
        name: up(v.counterparty?.label),
        purpose: up(v.category),
        remark: v.remark || '',
        remark2: v.remark2 || '',
        voucher_url: v.voucher_url || '',
        assigned_admin_id: v.assigned_admin_id ?? null,
      };
    },

    // firm_id is in the body on create AND update — a null one orphans the row.
    validate: (v, ctx) => requireAmount(v) || requireScope(ctx, 'firm')
      || ((v.note || '').trim() ? null : 'Description is required'),

    submit: (payload, { record }) =>
      record
        ? api.put(`/firms/transactions/${record.id}`, payload)
        : api.post('/firms/transactions', payload),
  },

  /* ══ vendor_payment — VendorCommitmentDetail.jsx (add + edit) ═══════════ */
  vendor_payment: {
    key: 'vendor_payment',
    label: 'Vendor Payment',
    hint: 'Against a commitment',
    icon: Truck,
    permission: 'vendors',
    group: 'out',

    // Single direction ⇒ PaymentModal renders no toggle.
    directions: ['out'],
    directionLabels: { out: 'Debit' },

    modes: VENDOR_MODES,
    // Collapses to one `reference_no` column, so exactly one field per kind:
    // CHEQUE ⇒ cheque_no, BANK-family ⇒ txn_ref, CASH/ADJUST ⇒ nothing.
    // cash_account joins the same single `reference_no` column as the others.
    modeFields: ['cash_account', 'cheque_no', 'txn_ref'],
    fieldLabels: { txn_ref: 'Reference / UTR', cheque_no: 'Cheque No' },
    // No picker: a create must be followed by the page's /distribute-payment call
    // against THIS commitment's item rows, which only the commitment page can do.
    // Excluded from modulesFor() instead — see requiresScope there.
    scope: null,
    requiresScope: true,

    fields: ['note', 'voucher', 'approver'],
    fieldMeta: { note: { label: 'Note' } },

    loadSources: async () => ({
      members: [], toEntities: [], fromEntities: [], categories: [],
      bankNames: [], accountNos: [], branches: [],
    }),

    fromRecord: (row) => {
      // Legacy rows may carry 'other', which was dropped from the option list; keep
      // the token so an unrelated edit does not silently reclassify the payment.
      const mode = up(row.payment_mode || 'cash');
      // One column feeds two possible fields — hydrate both so whichever the kind
      // renders shows the value and toPayload's fallback chain writes it back.
      const ref = row.reference_no || '';
      return {
        date: dateOf(row.payment_date),
        direction: 'out',
        amount: String(Math.abs(parseFloat(row.amount) || 0)),
        mode,
        cheque_no: ref,
        txn_ref: ref,
        note: row.note || '',
        voucher_url: row.voucher_url || '',
        assigned_admin_id: row.assigned_admin_id ?? null,
      };
    },

    toPayload: (v, ctx) => ({
      site_id: ctx.siteId,
      payment_date: v.date || today(),
      amount: amt(v.amount),
      payment_mode: (v.mode || '').toLowerCase(),
      // fromRecord hydrates cheque_no AND txn_ref from this one column, so the
      // chain must START with the field this kind actually renders — otherwise
      // editing a NEFT row's reference posts the stale cheque_no over it. The
      // cross-kind fallbacks only fire when the rendered field is empty (a create
      // fills exactly one of them; a legacy 'other' row renders neither).
      reference_no: up(derivePaymentType(v.mode) === 'CHEQUE'
        ? (v.cheque_no || v.txn_ref)
        : (v.txn_ref || v.cheque_no || v.bank_account)),
      note: v.note || '',
      voucher_url: v.voucher_url || '',
      assigned_admin_id: v.assigned_admin_id ?? null,
    }),

    // The commitment is the create URL; the edit PUT addresses the payment itself.
    validate: (v, ctx) => requireAmount(v) || (ctx.record ? null : requireScope(ctx, 'commitment')),

    // The /distribute-payment second write stays in the page, fired from onSaved.
    submit: (payload, { ctx, record }) =>
      record
        ? api.put(`/vendors/payments/${record.id}`, payload)
        : api.post(`/vendors/commitments/${ctx.scopeId}/payments`, payload),
  },

  /* ══ daybook — DayBook.jsx, native rows only ════════════════════════════ */
  // Rows whose id carries a cf_/ft_/pp_/comm_/fp_/expense_ prefix open the
  // SIBLING module's adapter with scopeId + record from the row; that is what
  // deletes the 9-branch submit dispatch, so this adapter stays single-purpose.
  daybook: {
    key: 'daybook',
    label: 'Day Book Entry',
    hint: 'Daily cash book',
    icon: BookOpen,
    permission: 'daybook',
    group: 'both',

    directions: ['out', 'in'],
    directionLabels: { out: 'Debit', in: 'Credit' },

    // Free-text custom mode deleted — root cause of unclassifiable 'other' rows.
    modes: PAYMENT_MODE_OPTIONS,
    // cash_account shares the account_no column with bank_account: the two are
    // mutually exclusive by kind, and account_no is force-nulled on CASH rows
    // today, so it is free to hold "which cash box" without a migration.
    modeFields: ['cash_account', 'bank_account', 'branch', 'cheque_no'],
    fieldLabels: { bank_account: 'Account No' },
    scope: null,
    editRequest: true,

    fields: ['counterparty', 'source', 'category', 'note', 'voucher', 'approver'],
    fieldMeta: {
      counterparty: { label: 'To Entity', span: 6, source: 'toEntities', allowCustom: true, uppercase: true },
      source: { label: 'From Entity', span: 6, source: 'fromEntities', allowCustom: true, uppercase: true },
      category: { label: 'Category', span: 6, source: 'categories', allowCustom: true },
      note: { label: 'Remarks' },
    },
    // `particular` is the row's headline text and is required — it is an extra
    // rather than a core field because `category` already owns daybook.category.
    extras: [
      { key: 'particular', label: 'Particular', type: 'select', source: 'particulars', allowCustom: true, uppercase: true, required: true, span: 6 },
      { key: 'entry_type', label: 'Entry Type', type: 'select', options: DAYBOOK_ENTRY_TYPES, span: 6 },
    ],

    loadSources: async (ctx) => {
      const [ac, members] = await Promise.all([
        api.get(`/daybook/autocomplete?site_id=${ctx.siteId}`).catch(() => ({ data: {} })),
        api.get(`/daybook/members?site_id=${ctx.siteId}`).catch(() => ({ data: {} })),
      ]);
      return {
        members: list(members.data?.members).map(partyOpt),
        toEntities: list(ac.data?.toEntities),
        fromEntities: list(ac.data?.fromEntities),
        categories: list(ac.data?.categories),
        particulars: list(ac.data?.particulars),
        accountNos: list(ac.data?.accountNos),
        branches: list(ac.data?.branches),
        bankNames: [],
      };
    },

    fromRecord: (row) => {
      const { direction, debit, credit } = twinDirection(row);
      return {
        date: dateOf(row.date),
        direction,
        amount: String(direction === 'in' ? credit : debit),
        mode: row.payment_mode || '',
        particular: row.particular || '',
        entry_type: row.entry_type || 'GENERAL',
        category: row.category || '',
        counterparty: { id: null, label: row.to_entity || '' },
        source: { id: null, label: row.from_entity || '' },
        // account_no is dual-purpose: cash account on CASH rows, bank details
        // otherwise. Hydrate the one the row's mode actually meant.
        bank_account: derivePaymentType(row.payment_mode) === 'CASH' ? '' : (row.account_no || ''),
        cash_account: derivePaymentType(row.payment_mode) === 'CASH' ? (row.account_no || '') : '',
        branch: row.branch || '',
        cheque_no: row.cheque_no || '',
        note: row.remarks || '',
        voucher_url: row.voucher_url || '',
        assigned_admin_id: row.assigned_admin_id ?? null,
      };
    },

    toPayload: (v, ctx) => {
      const kind = derivePaymentType(v.mode);
      return {
        site_id: ctx.siteId,
        // Non-admins may not backdate a NEW entry; edits keep the stored date.
        date: isAdminUser(ctx) ? (v.date || today()) : (ctx.record ? v.date : today()),
        particular: up(v.particular),
        entry_type: v.entry_type || 'GENERAL',
        ...twin(v),
        remarks: v.note,
        payment_mode: v.mode,
        category: v.category || '',
        from_entity: up(v.source?.label),
        to_entity: up(v.counterparty?.label),
        assigned_admin_id: v.assigned_admin_id ?? null,
        // Dual-purpose column: on CASH it carries the cash account instead.
        account_no: kind === 'CASH' ? (v.cash_account || null) : (v.bank_account || null),
        branch: v.branch || null,
        // Preserved verbatim from today, including the conditional spread — an
        // omitted key leaves the stored cheque no alone rather than nulling it.
        ...(kind === 'CHEQUE' && { cheque_no: v.cheque_no }),
        // Create: only when attached, because POST /daybook has never received
        // this key. Edit: always, so removing an upload can clear the column —
        // the conditional spread left the old URL stored while the modal showed
        // it gone. ponytail: the daybook controller reads neither voucher_url nor
        // cheque_no yet; the ceiling is the backend, not this line.
        ...(ctx.record || v.voucher_url ? { voucher_url: v.voucher_url || null } : null),
      };
    },

    validate: (v) => requireAmount(v) || ((v.particular || '').trim() ? null : 'Particular is required'),

    submit: (payload, { record, requestEdit, values }) => {
      if (record && requestEdit) return postEditRequest('daybook', record.id, payload, values.proof_photo);
      return record ? api.put(`/daybook/${record.id}`, payload) : api.post('/daybook', payload);
    },
  },
};

/**
 * Modules the user may write (or update) — omitted, never disabled, in the picker.
 *
 * `requiresScope` adapters are omitted when nothing has bound a scope: their scope
 * is the row the trigger page was on (an agent commission, a vendor commitment),
 * there is no site-wide list to pick it from, and offering them from the dashboard
 * meant posting master_id: null / POST /vendors/commitments/null/payments.
 */
export const modulesFor = (hasPermission, action = 'write', scopeId = null) =>
  Object.values(PAYMENT_MODULES).filter(
    (m) => hasPermission(m.permission, action) && ((scopeId ?? '') !== '' || !m.requiresScope),
  );

// The unified money-entry modal: one shell, eight modules. It knows CANONICAL
// field names only — every backend key lives in modules.js — plus a two-step
// picker so the dashboard can open it with no module chosen.
//
// Radix <Select> is BANNED inside this dialog: it swallows Enter to open its
// listbox, so the form's Enter-to-next-field handler never sees the key. Every
// dropdown in here is a <SearchSelect>, which re-emits Enter to the form.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, Loader2, Lock, Paperclip, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '../ui/command';
import { SearchSelect } from '../ui/search-select';
import VoucherUpload from '../VoucherUpload';
import { Field } from './Field';
import { ModeFields } from './ModeFields';
import { MODE_FIELD_SETS } from './modeFieldSets';
import { PAYMENT_MODULES, modulesFor } from './modules';
import { derivePaymentType } from '../../constants/paymentOptions';

const FOCUSABLE =
  'input:not([type="hidden"]):not([type="file"]), textarea, [role="combobox"], [data-field]';

const PICKER_GROUPS = [['in', 'Credit'], ['out', 'Debit'], ['both', 'Credit / Debit']];

// Local date, not toISOString() — the UTC form rolls back a day before 05:30 IST.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const kindOf = (mode, overrides) => overrides?.[mode] || derivePaymentType(mode);

/** Every canonical mode field the shell knows about, plus anything the adapter
 *  declares that MODE_FIELD_SETS has not caught up with (e.g. `ifsc`). */
const modeFieldKeys = (adapter) => [...new Set([
  ...Object.values(MODE_FIELD_SETS).flat(),
  ...(adapter.modeFields || []),
])];

const initialValues = (adapter, record, defaults) => {
  const base = {
    scope_id: null,
    date: today(),
    direction: adapter.directions?.[0] || 'out',
    amount: '',
    mode: adapter.modes?.[0] || '',
    counterparty: { id: null, label: '' },
    source: { id: null, label: '' },
    category: '',
    note: '',
    voucher_url: '',
    assigned_admin_id: null,
    proof_photo: null,
  };
  modeFieldKeys(adapter).forEach((k) => { base[k] = ''; });
  (adapter.extras || []).forEach((x) => { base[x.key] = ''; });
  return { ...base, ...(record ? adapter.fromRecord(record) : null), ...defaults };
};

// Party options are a mix of {id,label} rows and bare autocomplete strings; an
// allowCustom commit arrives as the raw query with no option object.
const toParty = (key, option, uppercase) => {
  const label = option
    ? String(option.label ?? option.name ?? option)
    : (key === null || key === undefined ? '' : String(key));
  return {
    id: option && typeof option === 'object' ? (option.id ?? null) : null,
    label: uppercase ? label.toUpperCase() : label,
  };
};

const optSearch = (o) => String(o?.search ?? o?.label ?? o?.name ?? o ?? '');

const asText = (key, uppercase) => {
  const s = key === null || key === undefined ? '' : String(key);
  return uppercase ? s.toUpperCase() : s;
};

function handleFormKeyDown(e) {
  if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.nativeEvent.isComposing) return;

  const el = e.target;

  // Textarea keeps Enter for newlines; Cmd/Ctrl+Enter submits from anywhere.
  if (el.tagName === 'TEXTAREA') {
    if (e.metaKey || e.ctrlKey) { e.preventDefault(); e.currentTarget.requestSubmit(); }
    return;
  }
  if (e.metaKey || e.ctrlKey) { e.preventDefault(); e.currentTarget.requestSubmit(); return; }

  // Query at keydown time — the field set changes with mode/direction.
  const fields = Array.from(e.currentTarget.querySelectorAll(FOCUSABLE))
    .filter((n) => !n.disabled && n.tabIndex !== -1 && n.offsetParent !== null);

  const i = fields.indexOf(el);
  if (i === -1) return;                 // unknown target: leave native behaviour alone
  if (i === fields.length - 1) return;  // last field: fall through to implicit submit

  e.preventDefault();
  const next = fields[i + 1];
  next.focus();
  next.select?.();
}

export default function PaymentModal({
  open,
  onOpenChange,
  module = null,
  scopeId = null,
  record = null,
  intent = 'auto',
  defaults = {},
  scope = null,
  onSaved,
}) {
  const { currentSite, user, hasPermission } = useAuth();
  const siteId = currentSite?.id;

  // The <form> sits between a sticky header and a sticky footer, so Save lives
  // OUTSIDE it and is associated back by id — the native way to keep exactly one
  // submit button. useId, not a constant, so two mounted modals can't collide.
  const formId = useId();

  const [pickedKey, setPickedKey] = useState(null);
  const moduleKey = module || pickedKey;
  const adapter = moduleKey ? PAYMENT_MODULES[moduleKey] : null;

  const [values, setValues] = useState({});
  const [valuesFor, setValuesFor] = useState(null);
  const [pickedScope, setPickedScope] = useState(null);
  const [sources, setSources] = useState({});
  const [scopeRows, setScopeRows] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState(null);

  const formRef = useRef(null);
  const proofInputRef = useRef(null);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  // Same identity shield as `defaults`: callers pass freshly-mapped rows
  // (record={rows.find(r => r.id === editingId)}), and a new object on every
  // parent render would re-run initialValues and discard everything typed.
  // Keyed on the id, so a genuinely different row still re-initialises.
  const recordRef = useRef(record);
  recordRef.current = record;
  const recordKey = record ? (record.id ?? '?') : null;

  const effectiveScopeId = scopeId ?? values.scope_id ?? null;

  const ctx = useMemo(
    () => ({ siteId, scopeId: effectiveScopeId, record, user, scope: scope || pickedScope }),
    [siteId, effectiveScopeId, record, user, scope, pickedScope],
  );
  // ctx changes identity whenever the parent re-renders (`record`, `scope`), so
  // the load effect reads it through this ref and lists its real triggers itself.
  // effectiveScopeId IS one of them — firm_transaction.loadSources needs the id.
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  // intent==='request' is the page saying "this user may only queue an edit", and
  // it bypasses the permission gate below. Honour it only when the adapter really
  // has a POST /edit-requests branch: for the rest, submit() would issue a direct
  // PUT — an ungated write, announced by a toast that says it was queued.
  const requestEdit = intent === 'request' && !!adapter?.editRequest;
  const permitted = !adapter || requestEdit || hasPermission(adapter.permission, record ? 'update' : 'write');
  const pickable = useMemo(() => modulesFor(hasPermission, 'write'), [hasPermission]);

  // Back to step 1 on every open, so a stale module never inherits a new trigger.
  useEffect(() => { if (open) setPickedKey(null); }, [open]);

  // Fresh draft per open: re-resolves today's date (a tab left open overnight
  // would otherwise book to yesterday) and drops an abandoned draft.
  useEffect(() => {
    if (!open || !adapter) return;
    setValues(initialValues(adapter, recordRef.current, defaultsRef.current));
    setValuesFor(adapter.key);
    setPickedScope(null);
    setConfirmMsg(null);
  }, [open, adapter, recordKey]);

  const cacheRef = useRef({});

  // A plot_id from another site would be posted against the wrong project.
  useEffect(() => { cacheRef.current = {}; }, [siteId]);

  useEffect(() => {
    if (!open || !adapter || !siteId) return;

    // Caching the PROMISE (not a "loaded" flag) both de-dupes in-flight loads and
    // makes a rejected one retry on the next open, which the flag version got
    // wrong: a load abandoned mid-flight left the list permanently empty.
    const once = (key, fn) => {
      const c = cacheRef.current;
      if (!c[key]) c[key] = Promise.resolve().then(fn).catch((err) => { delete c[key]; throw err; });
      return c[key];
    };
    const base = `${siteId}:${adapter.key}`;

    // `cancelled` is the single guard: React runs this cleanup before the next
    // effect, so a superseded load can neither fill the lists nor clear the
    // spinner the new one just raised.
    let cancelled = false;
    setLoading(true);

    Promise.all([
      adapter.loadSources ? once(`src:${base}:${effectiveScopeId ?? ''}`, () => adapter.loadSources(ctxRef.current)) : {},
      adapter.scope ? once(`scope:${base}`, () => adapter.scope.load(ctxRef.current)) : [],
      once(`approvers:${siteId}`, () => api.get(`/admin/approvers?site_id=${siteId}`).then((r) => r.data?.approvers || [])),
    ])
      .then(([src, rows, apps]) => {
        if (cancelled) return;
        setSources(src || {});
        setScopeRows(Array.isArray(rows) ? rows : []);
        setApprovers(apps || []);
      })
      .catch(() => { if (!cancelled) toast.error('Failed to load form options'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, adapter, siteId, effectiveScopeId]);

  // Data entry starts in field #1 (scope when the module has one, else Amount).
  // Radix would leave focus on the header, and SearchSelect has no autoFocus prop.
  useEffect(() => {
    if (!open || !adapter) return;
    const raf = requestAnimationFrame(() => formRef.current?.querySelector(FOCUSABLE)?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, adapter]);

  const setValue = useCallback((key, v) => setValues((p) => ({ ...p, [key]: v })), []);

  // Centralised mode-switch cleanup: whatever the new kind does not ask for is
  // wiped here, so a CASH row can never carry the bank details typed before it.
  const setMode = (mode) => setValues((p) => {
    const keep = MODE_FIELD_SETS[kindOf(mode, adapter.kindOverrides)] || [];
    const next = { ...p, mode };
    modeFieldKeys(adapter).forEach((k) => { if (!keep.includes(k)) next[k] = ''; });
    return next;
  });

  const submit = async (confirmed) => {
    if (submitting || !adapter) return;
    if (!siteId) { toast.error('Select a site first'); return; }

    // Save is never disabled — the reason a click did nothing must be sayable.
    const err = adapter.validate ? adapter.validate(values, ctx) : null;
    if (typeof err === 'string') { toast.error(err); return; }
    if (err?.confirm && !confirmed) { setConfirmMsg(err.confirm); return; }
    setConfirmMsg(null);

    setSubmitting(true);
    try {
      const payload = adapter.toPayload(values, ctx);
      const res = await adapter.submit(payload, { values, ctx, record, requestEdit });
      toast.success(requestEdit
        ? 'Edit request submitted for approval'
        : `${adapter.label} ${record ? 'updated' : 'recorded'}`);
      // Escape hatch: optimistic patches, /distribute-payment, print receipts.
      onSaved?.(res, payload, values);
      onOpenChange(false);
    } catch (e) {
      toast.error(e.response?.data?.message || `Failed to save ${adapter.label.toLowerCase()}`);
    } finally {
      setSubmitting(false);
    }
  };

  const approverOpts = useMemo(
    () => approvers.map((a) => ({ id: a.id, label: a.full_name || a.name || a.email || `#${a.id}` })),
    [approvers],
  );

  const ready = adapter && valuesFor === adapter.key;
  const Icon = adapter?.icon;
  const has = (f) => !!adapter?.fields?.includes(f);
  const meta = (k) => adapter?.fieldMeta?.[k] || {};
  const showDirection = (adapter?.directions?.length || 0) > 1;
  const kind = adapter ? kindOf(values.mode, adapter.kindOverrides) : 'CASH';
  const showModeFields = !!adapter
    && (MODE_FIELD_SETS[kind] || []).some((k) => adapter.modeFields?.includes(k));

  // Counterparty · Source · Category share row 2. At the adapter's span-6 a third
  // one cannot fit, so it takes a row of its own — 56px + gap of the no-scroll
  // budget, on the three densest modules (daybook, expenses, cashflow). Pack the
  // full house 4/4/4 instead; two or fewer keep the adapter's span.
  const partyCount = ['counterparty', 'source', 'category'].filter(has).length;
  const spanOf = (k) => (partyCount === 3 ? 4 : meta(k).span || 6);

  /* Counterparty / Source share a shape ({id,label}); Category is a plain string. */
  const partyField = (key) => {
    const m = meta(key);
    if (!has(key)) return null;
    return (
      <Field key={key} label={m.label || key} htmlFor={`pm-${key}`} required={m.required} span={spanOf(key)}>
        {m.readOnly ? (
          // Display-only chip (plot_payment's buyer): carried in the payload, never typed.
          <Input id={`pm-${key}`} readOnly tabIndex={-1} className="h-9 bg-muted text-muted-foreground"
            value={values[key]?.label || '—'} />
        ) : (
          <SearchSelect
            id={`pm-${key}`}
            value={values[key]?.id ?? values[key]?.label ?? null}
            options={sources[m.source] || []}
            getSearch={optSearch}
            allowCustom={!!m.allowCustom}
            loading={loading}
            disabled={submitting}
            placeholder={`Select ${(m.label || key).toLowerCase()}…`}
            onChange={(k, opt) => setValue(key, toParty(k, opt, m.uppercase))}
          />
        )}
      </Field>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      {/* sm:p-0 is NOT redundant: tailwind-merge cannot let a modifier-less p-0
          override the base class's sm:p-6, so without it every viewport ≥640px
          gets a 24px gutter around the sticky header/footer and the no-scroll
          budget loses 48px of height. Verified against tailwind-merge 3.5.0. */}
      <DialogContent className="sm:max-w-3xl w-[calc(100%-2rem)] max-h-[min(90vh,44rem)]
                                p-0 sm:p-0 gap-0 overflow-hidden flex flex-col">
        <header className="shrink-0 px-5 py-3 pr-12 border-b flex items-center gap-3">
          {adapter && !module && (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 -ml-2 shrink-0"
              aria-label="Back to entry types" onClick={() => setPickedKey(null)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {Icon && <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <DialogTitle className="text-base truncate">
              {adapter ? `${record ? (requestEdit ? 'Request edit' : 'Edit') : 'New'} ${adapter.label}` : 'New Entry'}
            </DialogTitle>
            <DialogDescription className="text-[11px] truncate">
              {adapter ? (adapter.hint || 'Record money') : 'What are you recording?'}
              {currentSite?.name ? ` · ${currentSite.name}` : ''}
            </DialogDescription>
          </div>
        </header>

        {/* ── Step 1: pick a module ── */}
        {!adapter && (
          <Command className="flex-1 min-h-0">
            <CommandInput placeholder="Search entry type…" autoFocus />
            {/* max-h-none: the DialogContent's max-h is the real cap, and the list
                must own the scroll or long groups get clipped by overflow-hidden. */}
            <CommandList className="flex-1 min-h-0 max-h-none">
              <CommandEmpty>
                {pickable.length ? 'No entry type matches.' : 'You do not have permission to add entries.'}
              </CommandEmpty>
              {PICKER_GROUPS.map(([group, heading]) => {
                const rows = pickable.filter((m) => m.group === group);
                if (!rows.length) return null;
                return (
                  <CommandGroup key={group} heading={heading}>
                    {rows.map((m) => {
                      const RowIcon = m.icon;
                      return (
                        <CommandItem key={m.key} value={`${m.label} ${m.hint || ''}`}
                          onSelect={() => setPickedKey(m.key)}>
                          <RowIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate">
                            <span className="font-medium">{m.label}</span>
                            {m.hint && <span className="text-muted-foreground"> — {m.hint}</span>}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        )}

        {/* ── Permission self-guard: three pages ship an ungated trigger today ── */}
        {adapter && !permitted && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              You cannot {record ? 'edit' : 'add'} {adapter.label.toLowerCase()} entries.
            </p>
            <p className="text-xs text-muted-foreground">
              Ask an admin for {record ? 'update' : 'write'} access to “{adapter.permission}”.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-2"
              onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}

        {/* ── Step 2: the form ── */}
        {adapter && permitted && ready && (
          <form
            ref={formRef}
            id={formId}
            noValidate /* every failure is a toast from validate(), never a browser bubble */
            onKeyDown={handleFormKeyDown}
            onSubmit={(e) => { e.preventDefault(); submit(false); }}
            /* py-4, not p-5: 8px of the no-scroll budget, and px stays 5 so the
               grid still lines up with the sticky header and footer. */
            className="flex-1 min-h-0 overflow-y-auto px-5 py-4"
          >
            <div className="grid grid-cols-12 gap-x-3 gap-y-2">
              {/* Row 0 — scope, only when the trigger page has not pre-bound one */}
              {adapter.scope && !scopeId && (
                <Field label={adapter.scope.label} htmlFor="pm-scope" required span={12}>
                  <SearchSelect
                    id="pm-scope"
                    value={values.scope_id ?? null}
                    options={scopeRows}
                    getKey={adapter.scope.getKey}
                    getLabel={adapter.scope.getLabel}
                    getSearch={adapter.scope.getSearch}
                    loading={loading}
                    disabled={submitting}
                    placeholder={`Select ${adapter.scope.label.toLowerCase()}…`}
                    onChange={(k, opt) => {
                      setPickedScope(opt || null);
                      setValues((p) => ({
                        ...p,
                        scope_id: k,
                        ...(opt && adapter.scope.seed ? adapter.scope.seed(opt) : null),
                      }));
                    }}
                  />
                </Field>
              )}

              {/* Row 1 — direction · amount · date */}
              {showDirection && (
                <Field label="Direction" span={4}>
                  <div role="group" aria-label="Direction"
                    className="flex h-9 items-center gap-0.5 rounded-md border border-input p-0.5">
                    {adapter.directions.map((d) => (
                      <button key={d} type="button" aria-pressed={values.direction === d}
                        onClick={() => setValue('direction', d)}
                        className={`h-full flex-1 truncate rounded-[5px] px-2 text-xs font-semibold transition-colors ${
                          values.direction === d
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent'
                        }`}>
                        {adapter.directionLabels?.[d] || d}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              <Field label="Amount" htmlFor="pm-amount" required span={showDirection ? 4 : 8}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                  <Input id="pm-amount" type="number" step="0.01" min="0" inputMode="decimal"
                    placeholder="0" className="h-9 pl-6 text-lg font-bold tabular-nums"
                    value={values.amount ?? ''} disabled={submitting}
                    onChange={(e) => setValue('amount', e.target.value)} />
                </div>
              </Field>

              <Field label="Date" htmlFor="pm-date" required span={4}>
                <Input id="pm-date" type="date" className="h-9" value={values.date || ''}
                  disabled={submitting} onChange={(e) => setValue('date', e.target.value)} />
              </Field>

              {/* Row 2 — parties / category */}
              {partyField('counterparty')}
              {partyField('source')}
              {has('category') && (
                <Field label={meta('category').label || 'Category'} htmlFor="pm-category"
                  required={meta('category').required} span={spanOf('category')}>
                  <SearchSelect
                    id="pm-category"
                    value={values.category || null}
                    options={sources[meta('category').source] || []}
                    allowCustom={!!meta('category').allowCustom}
                    loading={loading}
                    disabled={submitting}
                    placeholder="Select…"
                    onChange={(k) => setValue('category', asText(k, meta('category').uppercase))}
                  />
                </Field>
              )}

              {/* Row 3 — mode chips. Not a <Field>: 16px label + 4 + 32px chip = 52px.
                  Every adapter's chips fit one line at sm:max-w-3xl (widest is
                  plot_payment's 10 chips, ~624px against ~728px of grid). */}
              <div className="col-span-12">
                <p className="mb-1 text-[11px] font-medium leading-4 text-muted-foreground">Mode</p>
                <div role="group" aria-label="Payment mode" className="flex flex-wrap gap-1.5">
                  {(adapter.modes || []).map((m) => (
                    <button key={m} type="button" aria-pressed={values.mode === m}
                      disabled={submitting} onClick={() => setMode(m)}
                      className={`h-8 rounded-full border px-2.5 text-xs font-semibold transition-colors ${
                        values.mode === m
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background text-muted-foreground hover:bg-accent'
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 4 — the mode-conditional block */}
              {showModeFields && (
                <div className="col-span-12">
                  <ModeFields
                    mode={values.mode}
                    kindOverrides={adapter.kindOverrides}
                    allow={adapter.modeFields || []}
                    values={values}
                    onChange={setValue}
                    sources={sources}
                    labels={adapter.fieldLabels}
                    disabled={submitting}
                  />
                </div>
              )}

              {/* Row 5 — adapter extras */}
              {(adapter.extras || []).map((x) => (
                <Field key={x.key} label={x.label} htmlFor={`pm-${x.key}`} required={x.required} span={x.span || 3}>
                  {x.type === 'select' ? (
                    <SearchSelect
                      id={`pm-${x.key}`}
                      value={values[x.key] || null}
                      options={x.options || sources[x.source] || []}
                      allowCustom={!!x.allowCustom}
                      loading={loading}
                      disabled={submitting}
                      placeholder="Select…"
                      onChange={(k) => setValue(x.key, asText(k, x.uppercase))}
                    />
                  ) : (
                    <Input id={`pm-${x.key}`} className="h-9" value={values[x.key] || ''} disabled={submitting}
                      onChange={(e) => setValue(x.key, x.uppercase ? e.target.value.toUpperCase() : e.target.value)} />
                  )}
                </Field>
              ))}

              {/* Row 6 — note. Last focusable, so Enter here makes a newline. */}
              {has('note') && (
                <Field label={meta('note').label || 'Note'} htmlFor="pm-note"
                  required={meta('note').required} span={12}>
                  {/* min-h-0 so rows={2} actually governs — the base min-h-[60px]
                      otherwise wins and the row is taller than it asked for. */}
                  <Textarea id="pm-note" rows={2} className="min-h-0 resize-none" value={values.note || ''}
                    disabled={submitting}
                    onChange={(e) => setValue('note', meta('note').uppercase
                      ? e.target.value.toUpperCase() : e.target.value)} />
                </Field>
              )}
            </div>
          </form>
        )}

        {/* Inline confirm, not a stacked dialog: costs 0px when absent. */}
        {confirmMsg && (
          <div className="shrink-0 flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-5 py-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="flex-1 text-xs text-amber-900">{confirmMsg}</p>
            <Button type="button" size="sm" variant="outline"
              className="h-7 border-amber-300 text-amber-900 hover:bg-amber-100"
              onClick={() => submit(true)}>
              Confirm anyway
            </Button>
          </div>
        )}

        {adapter && permitted && (
          <footer className="shrink-0 px-5 py-3 border-t flex items-center gap-2">
            {/* Sidecar strip: voucher + approver never cost a body row. */}
            {requestEdit ? (
              // A <label> wrapping a hidden input is not focusable and has no
              // keyboard path — same shape as VoucherUpload's compact button.
              <div className="flex min-w-0 items-center gap-1">
                <Button
                  type="button" variant="ghost" size="icon"
                  className="h-9 w-9 shrink-0 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                  disabled={submitting}
                  onClick={() => proofInputRef.current?.click()}
                  title="Proof photo"
                  aria-label={values.proof_photo ? `Replace proof photo (${values.proof_photo.name})` : 'Attach proof photo'}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <input ref={proofInputRef} type="file" className="hidden" disabled={submitting}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setValue('proof_photo', e.target.files?.[0] || null)} />
                <span className="max-w-32 truncate text-[11px] font-medium text-amber-700">
                  {values.proof_photo?.name || 'Proof'}
                </span>
              </div>
            ) : has('voucher') && (
              <VoucherUpload compact value={values.voucher_url} disabled={submitting}
                onChange={(url) => setValue('voucher_url', url || '')} />
            )}

            {has('approver') && approverOpts.length > 0 && (
              // The sidecar strip is outside the <form>, so handleFormKeyDown never
              // sees this and SearchSelect's own preventDefault made Enter a dead
              // key. Approver is optional and terminal: Enter submits, like the
              // form's last field would. ArrowDown/Space/click still open the list.
              <div
                onKeyDown={(e) => {
                  // contains() is load-bearing: PopoverContent is PORTALLED to
                  // body, but React bubbles its events through the REACT tree, so
                  // the Enter that picks an approver in cmdk (which preventDefaults
                  // but never stopPropagations) lands here too — and requestSubmit
                  // would then save with the values from BEFORE the pick. Only the
                  // trigger button is a real DOM child of this div.
                  if (!e.currentTarget.contains(e.target)) return;
                  if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
              >
                <SearchSelect
                  value={values.assigned_admin_id ?? null}
                  options={approverOpts}
                  disabled={submitting}
                  placeholder="Auto-assign"
                  className="w-44"
                  triggerClassName="h-8"
                  onChange={(k) => setValue('assigned_admin_id', k ?? null)}
                />
              </div>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={submitting}
                onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {/* The only type="submit" in the dialog. Never disabled: a blocked
                  save must say why, and submit() already guards double-fires. */}
              <Button type="submit" form={formId} size="sm" className="gap-1.5">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {requestEdit ? 'Request Edit' : record ? 'Update' : 'Save'}
              </Button>
            </div>
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}

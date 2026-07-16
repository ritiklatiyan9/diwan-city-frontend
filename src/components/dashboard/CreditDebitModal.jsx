import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/api';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '../ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '../ui/command';
import {
  PAYMENT_FROM_OPTIONS, PAYMENT_MODE_OPTIONS, BANK_MODES, derivePaymentType,
} from '../../constants/paymentOptions';
import {
  PREDEFINED_EXPENSE_CATEGORIES, HIDDEN_EXPENSE_CATEGORIES_KEY,
} from '../../constants/expenseCategories';
import {
  Loader2, TrendingUp, TrendingDown, ChevronDown, ShieldCheck,
  IndianRupee, Check,
} from 'lucide-react';

/* Local-timezone today. `new Date().toISOString()` would shift the date back a
   day for anyone east of UTC after ~05:30 IST, which is most of this app's users. */
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Factories, not consts: `date` must be resolved when the form is opened, not at
// module-load time, or a tab left open past midnight defaults to yesterday.
const emptyCredit = () => ({
  plot_id: null, plot_label: '', buyer_name: '',
  amount: '', date: todayLocal(),
  payment_from: 'CASH', bank_details: '', cheque_no: '',
  booked_by: '', narration: '',
});

const emptyDebit = () => ({
  amount: '', date: todayLocal(),
  to_entity: '', from_entity: '', payment_mode: 'CASH',
  cheque_no: '', account_no: '', branch: '', category: '', remark: '',
});

const TONE = {
  credit: {
    accent: 'text-emerald-700',
    ring: 'focus-visible:ring-emerald-500/40 border-emerald-200',
    submit: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    chipOn: 'border-emerald-600 bg-emerald-600 text-white',
    glow: 'from-emerald-500/10 to-teal-500/5',
  },
  debit: {
    accent: 'text-rose-700',
    ring: 'focus-visible:ring-rose-500/40 border-rose-200',
    submit: 'bg-rose-600 hover:bg-rose-700 text-white',
    chipOn: 'border-rose-600 bg-rose-600 text-white',
    glow: 'from-rose-500/10 to-orange-500/5',
  },
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const TABS = [
  { key: 'credit', label: 'Credit', sub: 'Plot Payment', icon: TrendingUp, on: 'text-emerald-600' },
  { key: 'debit', label: 'Debit', sub: 'Expense', icon: TrendingDown, on: 'text-rose-600' },
];

// Money-in only. plot_payments encodes money-out as a NEGATIVE amount, and this
// quick entry has no refund toggle (the full Plot Payments page does), so a
// RETURN/REFUND label here would post a positive receipt and overstate the
// plot's collections. Record those on /plot-payments instead.
const CREDIT_FROM_OPTIONS = PAYMENT_FROM_OPTIONS.filter((o) => o !== 'RETURN' && o !== 'REFUND');

/* Chip row — used for both `payment_from` (credit) and `payment_mode` (debit). */
const ChipRow = ({ options, value, onChange, tone }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((opt) => (
      <button
        key={opt} type="button"
        onClick={() => onChange(opt)}
        aria-pressed={value === opt}
        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
          value === opt
            ? TONE[tone].chipOn
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        {opt}
      </button>
    ))}
  </div>
);

const Field = ({ label, required, children, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-xs font-medium text-slate-600">
      {label}{required && <span className="text-rose-500"> *</span>}
    </Label>
    {children}
  </div>
);

export const CreditDebitModal = ({ open, onOpenChange }) => {
  const { currentSite, hasPermission } = useAuth();

  // Backend gates these with requirePermission(module, 'write') — mirror it
  // exactly. hasPermission already short-circuits true for admin/super_admin.
  const canCredit = hasPermission('plot_payments', 'write');
  const canDebit = hasPermission('expenses', 'write');

  const [tab, setTab] = useState(canCredit ? 'credit' : 'debit');
  const [submitting, setSubmitting] = useState(false);
  const [credit, setCredit] = useState(emptyCredit);
  const [debit, setDebit] = useState(emptyDebit);

  const [plots, setPlots] = useState([]);
  const [plotOpen, setPlotOpen] = useState(false);
  const [plotSearch, setPlotSearch] = useState('');
  const [creditMeta, setCreditMeta] = useState({ bankDetails: [], bookedBys: [], members: [] });

  const [debitMeta, setDebitMeta] = useState({
    fromEntities: [], toEntities: [], accountNos: [], branches: [],
  });
  const [customCategories, setCustomCategories] = useState([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Per-site+tab fetch guard so re-opening the modal doesn't refetch.
  const loadedRef = useRef({});
  // Identifies the newest in-flight load, so a superseded one can't clear the
  // spinner out from under its replacement.
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setTab((t) => (t === 'credit' && !canCredit ? 'debit' : t === 'debit' && !canDebit ? 'credit' : t));
  }, [open, canCredit, canDebit]);

  // Fresh draft on every open: re-resolves today's date (a dashboard left open
  // overnight would otherwise book to yesterday) and drops an abandoned draft
  // so a stale plot/amount can't be submitted against the wrong plot.
  useEffect(() => {
    if (!open) return;
    setCredit(emptyCredit());
    setDebit(emptyDebit());
  }, [open]);

  // Drop cached per-site data when the site changes — a plot_id from another
  // site would be posted against the wrong project.
  useEffect(() => {
    setCredit(emptyCredit());
    setDebit(emptyDebit());
    setPlots([]);
    loadedRef.current = {};
  }, [currentSite?.id]);

  // Lazily load only the tab the user is actually on.
  useEffect(() => {
    const siteId = currentSite?.id;
    if (!open || !siteId) return;
    const key = `${siteId}:${tab}`;
    if (loadedRef.current[key]) return;
    loadedRef.current[key] = true;

    let cancelled = false;
    let committed = false;
    const myReq = ++reqIdRef.current;
    setLoadingMeta(true);

    const work = tab === 'credit'
      ? Promise.all([
          api.get(`/plots?site_id=${siteId}`),
          api.get(`/plots/autocomplete?site_id=${siteId}`).catch(() => ({ data: {} })),
        ]).then(([plotRes, metaRes]) => {
          if (cancelled) return;
          setPlots(plotRes.data?.plots || []);
          setCreditMeta({
            bankDetails: metaRes.data?.bankDetails || [],
            bookedBys: metaRes.data?.bookedBys || [],
            members: metaRes.data?.members || [],
          });
          committed = true;
        })
      : Promise.all([
          api.get(`/expenses/autocomplete?site_id=${siteId}`).catch(() => ({ data: {} })),
          api.get('/expense-categories').catch(() => ({ data: {} })),
        ]).then(([metaRes, catRes]) => {
          if (cancelled) return;
          setDebitMeta({
            fromEntities: metaRes.data?.fromEntities || [],
            toEntities: metaRes.data?.toEntities || [],
            accountNos: metaRes.data?.accountNos || [],
            branches: metaRes.data?.branches || [],
          });
          setCustomCategories((catRes.data?.categories || []).map((c) => c.name));
          committed = true;
        });

    work
      .catch(() => {
        loadedRef.current[key] = false; // failed attempt — allow a retry
        if (!cancelled) toast.error('Failed to load form options');
      })
      .finally(() => { if (reqIdRef.current === myReq) setLoadingMeta(false); });

    return () => {
      cancelled = true;
      // The key is marked on ATTEMPT, but an attempt that never committed data
      // (modal closed / tab switched mid-flight, or StrictMode's double-invoke)
      // must un-mark, or the guard above skips the refetch for the rest of the
      // page session and the plot list stays permanently empty.
      if (!committed) loadedRef.current[key] = false;
    };
  }, [open, tab, currentSite?.id]);

  // Same merge the Expenses page does, so both dropdowns offer the same list.
  const categoryOptions = useMemo(() => {
    let hidden = [];
    try { hidden = JSON.parse(localStorage.getItem(HIDDEN_EXPENSE_CATEGORIES_KEY) || '[]'); } catch { /* ignore */ }
    const predefined = PREDEFINED_EXPENSE_CATEGORIES
      .map((c) => c.name)
      .filter((name) => !hidden.includes(name));
    return [...new Set([...predefined, ...customCategories])].sort();
  }, [customCategories]);

  const filteredPlots = useMemo(() => {
    const q = plotSearch.trim().toLowerCase();
    if (!q) return plots.slice(0, 100);
    return plots
      .filter((p) => `${p.plot_no || ''} ${p.block || ''} ${p.buyer_name || ''}`.toLowerCase().includes(q))
      .slice(0, 100);
  }, [plots, plotSearch]);

  const isCredit = tab === 'credit';
  const form = isCredit ? credit : debit;
  const tone = TONE[tab];
  const amountNum = parseFloat(form.amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const creditPaymentType = derivePaymentType(credit.payment_from);
  const showCreditBank = creditPaymentType !== 'CASH';
  const showDebitBank = BANK_MODES.includes(debit.payment_mode);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!currentSite?.id) return toast.error('Select a site first');
    // The backend does NOT validate amount — `parseFloat(amount) || 0` silently
    // stores 0, and the cashflow trigger then deletes the entry. Guard here.
    if (!amountValid) return toast.error('Enter an amount greater than 0');

    setSubmitting(true);
    try {
      if (isCredit) {
        if (!credit.plot_id) { toast.error('Select a plot'); return; }
        // site_id is derived server-side from the plot — do not send it.
        await api.post('/plots/payments', {
          plot_id: credit.plot_id,
          date: credit.date || todayLocal(),
          amount: amountNum,
          payment_from: credit.payment_from || null,
          payment_type: creditPaymentType,
          bank_details: showCreditBank ? (credit.bank_details || null) : null,
          cheque_no: credit.payment_from === 'CHEQUE' ? (credit.cheque_no || null) : null,
          buyer_name: credit.buyer_name || null,
          booked_by: credit.booked_by || null,
          narration: credit.narration || null,
        });
        toast.success(`Credit of ${inr(amountNum)} recorded for ${credit.plot_label}`);
        setCredit(emptyCredit());
      } else {
        await api.post('/expenses', {
          site_id: currentSite.id,
          date: debit.date || todayLocal(),
          debit: amountNum,
          credit: 0,
          to_entity: debit.to_entity || null,
          from_entity: debit.from_entity || null,
          payment_mode: debit.payment_mode || null,
          cheque_no: debit.payment_mode === 'CHEQUE' ? (debit.cheque_no || null) : null,
          account_no: showDebitBank ? (debit.account_no || null) : null,
          branch: showDebitBank ? (debit.branch || null) : null,
          category: debit.category || null,
          remark: debit.remark || null,
        });
        toast.success(`Debit of ${inr(amountNum)} recorded`);
        setDebit(emptyDebit());
      }
      // The axios interceptor emits 'data-mutated' on every successful non-GET,
      // which the Dashboard already listens to — no manual refetch needed here.
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to record ${tab}`);
    } finally {
      setSubmitting(false);
    }
  };

  const setC = (patch) => setCredit((p) => ({ ...p, ...patch }));
  const setD = (patch) => setDebit((p) => ({ ...p, ...patch }));

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">Quick Entry</DialogTitle>
          <DialogDescription className="text-[13px] text-slate-500">
            Record money in against a plot, or money out as an expense
            {currentSite?.name ? ` · ${currentSite.name}` : ''}
          </DialogDescription>
        </DialogHeader>

        {/* ── Credit / Debit switch ── */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100/80 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            const allowed = t.key === 'credit' ? canCredit : canDebit;
            return (
              <button
                key={t.key} type="button" disabled={!allowed || submitting}
                onClick={() => setTab(t.key)}
                aria-pressed={active}
                title={allowed ? undefined : `You do not have permission to add ${t.sub.toLowerCase()}s`}
                className={`relative flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? 'bg-white shadow-sm' : 'hover:bg-white/60'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? t.on : 'text-slate-400'}`} />
                <span className="text-left leading-tight">
                  <span className={`block text-sm font-semibold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{t.label}</span>
                  <span className="block text-[10px] text-slate-400">{t.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Amount (hero) ── */}
          <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 ${tone.ring} ${tone.glow}`}>
            <Label htmlFor="qe-amount" className="text-xs font-medium text-slate-600">
              {isCredit ? 'Amount Received' : 'Amount Paid'}<span className="text-rose-500"> *</span>
            </Label>
            <div className="relative mt-1">
              <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="qe-amount" type="number" step="0.01" min="0" inputMode="decimal"
                autoFocus placeholder="0"
                value={form.amount}
                onChange={(e) => (isCredit ? setC : setD)({ amount: e.target.value })}
                className="h-14 border-0 bg-white/70 pl-10 text-2xl font-bold tabular-nums shadow-none focus-visible:ring-1"
              />
            </div>
            {amountValid && (
              // tailwindcss-animate is already loaded as a v4 @plugin in index.css
              <p className={`mt-1.5 text-xs font-semibold animate-in fade-in slide-in-from-top-1 ${tone.accent}`}>
                {inr(amountNum)} will be {isCredit ? 'credited' : 'debited'}
              </p>
            )}
          </div>

          {loadingMeta && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading options…
            </p>
          )}

          {isCredit ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Plot" required>
                  <Popover open={plotOpen} onOpenChange={setPlotOpen} modal={false}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" role="combobox" aria-expanded={plotOpen}
                        className="h-9 w-full justify-between font-normal">
                        <span className={credit.plot_id ? 'truncate text-foreground' : 'text-muted-foreground'}>
                          {credit.plot_label || 'Select plot...'}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start"
                      style={{ width: 'var(--radix-popover-trigger-width)' }}
                      onWheel={(e) => e.stopPropagation()}>
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search plot or buyer..." value={plotSearch} onValueChange={setPlotSearch} />
                        <CommandList>
                          <CommandEmpty>{plots.length ? 'No plot found.' : 'No plots on this site yet.'}</CommandEmpty>
                          <CommandGroup>
                            {filteredPlots.map((p) => {
                              const label = `${p.plot_no}${p.block ? ` · ${p.block}` : ''}`;
                              return (
                                <CommandItem key={p.id} value={String(p.id)}
                                  onSelect={() => {
                                    setC({ plot_id: p.id, plot_label: label, buyer_name: p.buyer_name || '' });
                                    setPlotOpen(false); setPlotSearch('');
                                  }}>
                                  <Check className={`mr-2 h-4 w-4 ${credit.plot_id === p.id ? 'opacity-100' : 'opacity-0'}`} />
                                  <span className="flex-1 truncate">
                                    <span className="font-medium">{label}</span>
                                    {p.buyer_name && <span className="text-muted-foreground"> — {p.buyer_name}</span>}
                                  </span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </Field>

                <Field label="Date" required>
                  <Input type="date" required value={credit.date}
                    onChange={(e) => setC({ date: e.target.value })} className="h-9" />
                </Field>
              </div>

              {credit.buyer_name && (
                <p className="-mt-1 text-[11px] text-slate-500">
                  Buyer: <span className="font-semibold text-slate-700">{credit.buyer_name}</span>
                </p>
              )}

              <Field label="Received From">
                <ChipRow options={CREDIT_FROM_OPTIONS} value={credit.payment_from} tone="credit"
                  onChange={(v) => setC({ payment_from: credit.payment_from === v ? '' : v })} />
                <p className="pt-0.5 text-[10px] text-slate-400">
                  Books as <span className="font-semibold text-slate-500">{creditPaymentType}</span>
                </p>
              </Field>

              {showCreditBank && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bank Details">
                    <Input placeholder="SBI-613266" list="qe-bank-details" className="h-9"
                      value={credit.bank_details}
                      onChange={(e) => setC({ bank_details: e.target.value.toUpperCase() })} />
                    <datalist id="qe-bank-details">
                      {creditMeta.bankDetails.map((b) => <option key={b} value={b} />)}
                    </datalist>
                  </Field>
                  {credit.payment_from === 'CHEQUE' && (
                    <Field label="Cheque No">
                      <Input placeholder="000123" className="h-9" value={credit.cheque_no}
                        onChange={(e) => setC({ cheque_no: e.target.value })} />
                    </Field>
                  )}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Booked By">
                  <Input placeholder="Agent / staff name" list="qe-booked-by" className="h-9"
                    value={credit.booked_by}
                    onChange={(e) => setC({ booked_by: e.target.value.toUpperCase() })} />
                  <datalist id="qe-booked-by">
                    {creditMeta.members.map((m) => <option key={m.name} value={m.name} />)}
                    {creditMeta.bookedBys.map((b) => <option key={b} value={b} />)}
                  </datalist>
                </Field>
                <Field label="Narration">
                  <Input placeholder="BOOKING, INSTALLMENT..." className="h-9" value={credit.narration}
                    onChange={(e) => setC({ narration: e.target.value.toUpperCase() })} />
                </Field>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Paid To">
                  <Input placeholder="Vendor / member" list="qe-to-entity" className="h-9"
                    value={debit.to_entity}
                    onChange={(e) => setD({ to_entity: e.target.value.toUpperCase() })} />
                  <datalist id="qe-to-entity">
                    {debitMeta.toEntities.map((t) => <option key={t} value={t} />)}
                  </datalist>
                </Field>
                <Field label="Date" required>
                  <Input type="date" required value={debit.date}
                    onChange={(e) => setD({ date: e.target.value })} className="h-9" />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Paid From">
                  <Input placeholder="Firm / account" list="qe-from-entity" className="h-9"
                    value={debit.from_entity}
                    onChange={(e) => setD({ from_entity: e.target.value.toUpperCase() })} />
                  <datalist id="qe-from-entity">
                    {debitMeta.fromEntities.map((f) => <option key={f} value={f} />)}
                  </datalist>
                </Field>
                <Field label="Category">
                  <Popover open={categoryOpen} onOpenChange={setCategoryOpen} modal={false}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" role="combobox" aria-expanded={categoryOpen}
                        className="h-9 w-full justify-between font-normal">
                        <span className={debit.category ? 'truncate text-foreground' : 'text-muted-foreground'}>
                          {debit.category || 'Select category...'}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start"
                      style={{ width: 'var(--radix-popover-trigger-width)' }}
                      onWheel={(e) => e.stopPropagation()}>
                      <Command shouldFilter>
                        <CommandInput placeholder="Search category..." />
                        <CommandList>
                          <CommandEmpty>No category found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem value="— None —" className="text-muted-foreground"
                              onSelect={() => { setD({ category: '' }); setCategoryOpen(false); }}>
                              — None —
                            </CommandItem>
                            {categoryOptions.map((c) => (
                              <CommandItem key={c} value={c}
                                onSelect={(val) => {
                                  setD({ category: categoryOptions.find((o) => o.toLowerCase() === val.toLowerCase()) || val });
                                  setCategoryOpen(false);
                                }}>
                                <Check className={`mr-2 h-4 w-4 ${debit.category === c ? 'opacity-100' : 'opacity-0'}`} />
                                {c}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </Field>
              </div>

              <Field label="Payment Mode">
                <ChipRow options={PAYMENT_MODE_OPTIONS} value={debit.payment_mode} tone="debit"
                  onChange={(v) => setD({ payment_mode: debit.payment_mode === v ? '' : v })} />
              </Field>

              {showDebitBank && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Account No">
                    <Input placeholder="CNRB-077582" list="qe-acc-no" className="h-9" value={debit.account_no}
                      onChange={(e) => setD({ account_no: e.target.value.toUpperCase() })} />
                    <datalist id="qe-acc-no">
                      {debitMeta.accountNos.map((a) => <option key={a} value={a} />)}
                    </datalist>
                  </Field>
                  <Field label="Branch">
                    <Input placeholder="MAIN" list="qe-branch" className="h-9" value={debit.branch}
                      onChange={(e) => setD({ branch: e.target.value.toUpperCase() })} />
                    <datalist id="qe-branch">
                      {debitMeta.branches.map((b) => <option key={b} value={b} />)}
                    </datalist>
                  </Field>
                  {debit.payment_mode === 'CHEQUE' && (
                    <Field label="Cheque No">
                      <Input placeholder="000123" className="h-9" value={debit.cheque_no}
                        onChange={(e) => setD({ cheque_no: e.target.value })} />
                    </Field>
                  )}
                </div>
              )}

              <Field label="Remark">
                <Textarea rows={2} placeholder="ADJUST A19 DG, TRF TO A7..." className="resize-none"
                  value={debit.remark}
                  onChange={(e) => setD({ remark: e.target.value.toUpperCase() })} />
              </Field>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              Saved as <span className="font-semibold text-slate-500">Pending</span> for approval
            </p>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" disabled={submitting}
                onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting || !amountValid || (isCredit && !credit.plot_id)}
                className={`gap-1.5 ${tone.submit}`}>
                {submitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                  : <>{isCredit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} Record {isCredit ? 'Credit' : 'Debit'}</>}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreditDebitModal;

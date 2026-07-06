import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Search, Filter, X, IndianRupee, Calendar, AlertTriangle,
  CheckCircle2, CalendarClock, TrendingDown, Users,
  ChevronDown, ChevronRight, BarChart3, Banknote, Percent,
  Download, RefreshCw, Printer, FileSpreadsheet, Sparkles, Wallet,
} from 'lucide-react';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtCompact = (n) => {
  const abs = Math.abs(Number(n) || 0);
  if (abs >= 10000000) return `${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${(abs / 1000).toFixed(1)} K`;
  return fmt(n);
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const MODES = [
  { value: 'overall_pending', label: 'Overall Pending', icon: Banknote, desc: 'All plots with balance remaining' },
  { value: 'installment_pending', label: 'By Installment', icon: CalendarClock, desc: 'Pending by specific installment number' },
  { value: 'overdue_till_date', label: 'Overdue Till Date', icon: AlertTriangle, desc: 'All overdue installments as of today' },
  { value: 'month_pending', label: 'Month-wise Pending', icon: Calendar, desc: 'Installments due in a specific month' },
  { value: 'no_payment_since', label: 'No Payment in Month', icon: TrendingDown, desc: 'Plots with no payment in a specific month' },
  { value: 'custom_range', label: 'Custom Date Range', icon: Filter, desc: 'Installments due within custom range' },
];

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const STATUS_COLORS = {
  overdue: 'bg-red-50 text-red-700 border-red-200',
  partially_paid: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-slate-50 text-slate-600 border-slate-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Smooth ease-out count-up for numeric KPIs. */
function useCountUp(target, duration = 700) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(0);
  useEffect(() => {
    const to = Number.isFinite(target) ? target : 0;
    const from = fromRef.current;
    if (prefersReducedMotion() || from === to) { fromRef.current = to; setDisplay(to); return undefined; }
    let start;
    const step = (ts) => {
      if (start === undefined) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return display;
}

const ACCENTS = {
  indigo: { chip: 'bg-indigo-50 text-indigo-600 ring-indigo-100', bar: 'from-indigo-400 to-violet-500', glow: 'bg-indigo-300/40', value: 'text-slate-900' },
  rose:   { chip: 'bg-rose-50 text-rose-600 ring-rose-100',       bar: 'from-rose-400 to-red-500',       glow: 'bg-rose-300/40',   value: 'text-rose-600' },
  amber:  { chip: 'bg-amber-50 text-amber-600 ring-amber-100',    bar: 'from-amber-400 to-orange-500',   glow: 'bg-amber-300/40',  value: 'text-amber-600' },
  orange: { chip: 'bg-orange-50 text-orange-600 ring-orange-100', bar: 'from-orange-400 to-red-500',     glow: 'bg-orange-300/40', value: 'text-orange-600' },
};

function StatCard({ icon: Icon, label, value, prefix = '', compact = false, tone = 'indigo', loading, index = 0, hint }) {
  const accent = ACCENTS[tone] || ACCENTS.indigo;
  const animated = useCountUp(loading ? 0 : (Number(value) || 0));
  const shown = loading ? 0 : animated;
  const text = compact ? fmtCompact(shown) : Math.round(shown).toLocaleString('en-IN');
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-300 hover:shadow-[0_14px_34px_-14px_rgba(16,24,40,0.22)] hover:border-slate-300/80"
    >
      <div className={`pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${accent.glow}`} />
      <span className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${accent.bar} opacity-0 transition-opacity duration-300 group-hover:opacity-90`} />
      <div className="relative z-10 mb-2.5 flex items-center justify-between">
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110 ${accent.chip}`}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <p className={`text-2xl font-bold leading-tight tracking-tight tabular-nums ${accent.value}`}>
          {prefix}{text}
        </p>
      )}
      {hint && !loading && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </motion.div>
  );
}

export default function PaymentAnalytics() {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // ─── State ───
  const [mode, setMode] = useState('overall_pending');
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Filter params
  const [installmentNo, setInstallmentNo] = useState('1');
  const [month, setMonth] = useState(String(currentMonth));
  const [year, setYear] = useState(String(currentYear));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expandable rows
  const [expandedRows, setExpandedRows] = useState(new Set());

  // ─── Fetch ───
  const fetchAnalytics = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ site_id: siteId, mode });
      if (mode === 'installment_pending') params.set('installment_no', installmentNo);
      if (mode === 'month_pending' || mode === 'no_payment_since') {
        params.set('month', month);
        params.set('year', year);
      }
      if (mode === 'custom_range') {
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
      }
      const res = await api.get(`/plots/payment-analytics?${params}`);
      setResults(res.data.results || []);
      setSummary(res.data.summary || {});
      setExpandedRows(new Set());
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setResults([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [siteId, mode, installmentNo, month, year, dateFrom, dateTo]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ─── Filtered results ───
  const filtered = useMemo(() => {
    if (!search) return results;
    const q = search.toLowerCase();
    return results.filter(r =>
      (r.buyer_name || '').toLowerCase().includes(q) ||
      (r.plot_no || '').toLowerCase().includes(q) ||
      (r.block || '').toLowerCase().includes(q)
    );
  }, [results, search]);

  // ─── Toggle expand ───
  const toggleExpand = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ─── Year options ───
  const yearOptions = [];
  for (let y = currentYear - 3; y <= currentYear + 2; y++) yearOptions.push(y);

  // ─── Mode info ───
  const currentMode = MODES.find(m => m.value === mode);

  // ─── Derived KPI ───
  const totalPending = filtered.reduce((s, r) => s + (Number(r.total_remaining) || 0), 0);
  const avgPerPerson = filtered.length ? totalPending / filtered.length : 0;

  // ─── Export ───
  const downloadCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Plot No', 'Block', 'Buyer Name', 'Sale Price', 'Received', 'Remaining', 'Interest Due', 'Status', 'Last Payment'];
    const rows = filtered.map(r => [
      r.plot_no, r.block || '', r.buyer_name || '', r.sale_price, r.total_received, r.total_remaining,
      r.interest_due || 0, r.plot_status || '', r.last_payment_date || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-analytics-${mode}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const CurrentModeIcon = currentMode?.icon || BarChart3;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-1">
      {/* ═══ Executive Hero ═══ */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-violet-50/40 to-white shadow-[0_2px_24px_-10px_rgba(30,41,59,0.18)]"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-gradient-to-br from-violet-300/25 to-indigo-300/15 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-gradient-to-tr from-rose-200/25 to-amber-200/10 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-sm shadow-violet-500/25">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Payment Analytics</h1>
                <p className="text-[13px] text-slate-500">Pending payments, overdue installments &amp; collection gaps</p>
              </div>
            </div>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                <CurrentModeIcon className="h-3.5 w-3.5 text-violet-500" /> {currentMode?.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Loading…'}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading} className="h-9 gap-1.5 rounded-xl text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={filtered.length === 0} className="h-9 gap-1.5 rounded-xl bg-slate-900 text-xs text-white hover:bg-slate-800">
                  <Download className="h-3.5 w-3.5" /> Export
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-slate-400">Export center</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={downloadCSV} className="text-xs">
                  <FileSpreadsheet className="mr-2 h-3.5 w-3.5 text-emerald-600" /> Download CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.print()} className="text-xs">
                  <Printer className="mr-2 h-3.5 w-3.5 text-slate-500" /> Print report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard index={0} icon={Users} tone="indigo" label="Persons" value={summary.total_persons} loading={loading} hint="With outstanding balance" />
        <StatCard index={1} icon={IndianRupee} tone="rose" label="Pending Amount" prefix="₹" compact value={summary.total_pending_amount} loading={loading} hint={`Avg ₹${fmtCompact(avgPerPerson)} / person`} />
        <StatCard index={2} icon={Percent} tone="amber" label="Interest Due" prefix="₹" compact value={summary.total_interest_due} loading={loading} hint="Accrued on overdue" />
        <StatCard index={3} icon={AlertTriangle} tone="orange" label="Overdue Persons" value={summary.overdue_persons} loading={loading} hint="Past due date" />
      </div>

      {/* ═══ Mode Selector ═══ */}
      <div>
        <p className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-violet-400 to-indigo-500" /> Analysis Mode
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {MODES.map((m, i) => {
            const Icon = m.icon;
            const active = mode === m.value;
            return (
              <motion.button
                key={m.value}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode(m.value)}
                className={`relative overflow-hidden rounded-2xl border p-3 text-left transition-all ${active
                  ? 'border-violet-300 bg-gradient-to-br from-violet-50 to-white shadow-[0_8px_24px_-12px_rgba(139,92,246,0.5)] ring-1 ring-violet-200'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
              >
                {active && <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-400 to-indigo-500" />}
                <div className="mb-1 flex items-center gap-2">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className={`text-xs font-semibold ${active ? 'text-violet-700' : 'text-slate-700'}`}>{m.label}</span>
                </div>
                <p className="text-[10px] leading-tight text-slate-400">{m.desc}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ═══ Filters Bar ═══ */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Search</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Plot no, buyer name, block..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>

          {mode === 'installment_pending' && (
            <div className="w-36 space-y-1">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Installment #</Label>
              <Select value={installmentNo} onValueChange={setInstallmentNo}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n}{n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} Installment</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(mode === 'month_pending' || mode === 'no_payment_since') && (
            <>
              <div className="w-36 space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (<SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28 space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {mode === 'custom_range' && (
            <>
              <div className="w-40 space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">From Date</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs" />
              </div>
              <div className="w-40 space-y-1">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">To Date</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs" />
              </div>
            </>
          )}

          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="h-9 text-xs text-slate-500">
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* ═══ Results Table ═══ */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_16px_-8px_rgba(16,24,40,0.12)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-slate-400" />
            <span className="text-[13px] font-semibold text-slate-900">Outstanding Ledger</span>
            {!loading && <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-500">{filtered.length}</Badge>}
          </div>
          <span className="text-[11px] text-slate-400">{currentMode?.desc}</span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">All clear — no pending payments</p>
            <p className="mt-0.5 max-w-xs text-xs text-slate-400">{currentMode?.desc}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur hover:bg-slate-50/95">
                  <TableHead className="w-8" />
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">#</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Plot</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Buyer</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sale Price</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Received</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Remaining</TableHead>
                  {mode === 'installment_pending' && (
                    <>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Installment</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Inst. Due</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Due Date</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                    </>
                  )}
                  {mode === 'overdue_till_date' && (
                    <>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Overdue Amt</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Max Days</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500"># Overdue</TableHead>
                    </>
                  )}
                  {(mode === 'month_pending' || mode === 'custom_range') && (
                    <>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Period Due</TableHead>
                      <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Period Remaining</TableHead>
                    </>
                  )}
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Interest</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, idx) => {
                  const hasExpandable = (r.overdue_installments?.length > 0) || (r.matching_installments?.length > 0) || (r.installments_detail?.length > 0);
                  const isExpanded = expandedRows.has(r.plot_id);
                  const expandableData = r.overdue_installments || r.matching_installments || r.installments_detail || [];
                  const isRisky = r.overdue_count > 0 || r.days_overdue > 0;
                  const initials = (r.buyer_name || '?').trim().charAt(0).toUpperCase();

                  return (
                    <>
                      <TableRow
                        key={r.plot_id}
                        className={`group cursor-pointer transition-colors ${isRisky ? 'bg-rose-50/40' : ''} ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/70'}`}
                        onClick={() => hasExpandable && toggleExpand(r.plot_id)}
                      >
                        <TableCell className="w-8 text-center">
                          {hasExpandable && (
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md transition-colors ${isExpanded ? 'bg-slate-200 text-slate-600' : 'text-slate-400 group-hover:bg-slate-100'}`}>
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-slate-400">{idx + 1}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {r.plot_no}{r.block ? ` · ${r.block}` : ''}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${isRisky ? 'bg-gradient-to-br from-rose-400 to-red-500' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
                              {initials}
                            </span>
                            <span className="text-xs font-medium text-slate-700">{r.buyer_name || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-slate-600">₹{fmt(r.sale_price)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-emerald-700">₹{fmt(r.total_received)}</TableCell>
                        <TableCell className="text-right text-xs font-bold tabular-nums text-red-600">₹{fmt(r.total_remaining)}</TableCell>

                        {mode === 'installment_pending' && (
                          <>
                            <TableCell className="text-xs text-slate-600">{r.installment_name}</TableCell>
                            <TableCell className="text-right text-xs font-semibold tabular-nums text-red-600">₹{fmt(r.installment_remaining)}</TableCell>
                            <TableCell className="text-xs tabular-nums">{fmtDate(r.installment_due_date)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] font-semibold ${STATUS_COLORS[r.installment_status] || STATUS_COLORS.pending}`}>
                                {r.installment_status === 'overdue' ? `Overdue ${r.days_overdue}d` : r.installment_status?.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                          </>
                        )}

                        {mode === 'overdue_till_date' && (
                          <>
                            <TableCell className="text-right text-xs font-bold tabular-nums text-red-600">₹{fmt(r.total_overdue_amount)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] font-semibold text-red-700">{r.max_overdue_days}d</Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold tabular-nums text-red-600">{r.overdue_count}</TableCell>
                          </>
                        )}

                        {(mode === 'month_pending' || mode === 'custom_range') && (
                          <>
                            <TableCell className="text-right text-xs tabular-nums">₹{fmt(r.month_total_due || r.range_total_due)}</TableCell>
                            <TableCell className="text-right text-xs font-bold tabular-nums text-red-600">₹{fmt(r.month_total_remaining || r.range_total_remaining)}</TableCell>
                          </>
                        )}

                        <TableCell className="text-right text-xs tabular-nums text-amber-700">₹{fmt(r.interest_due)}</TableCell>
                        <TableCell className="text-xs tabular-nums text-slate-500">{fmtDate(r.last_payment_date)}</TableCell>
                      </TableRow>

                      {isExpanded && expandableData.length > 0 && (
                        <TableRow key={`${r.plot_id}-detail`} className="bg-slate-50/60 hover:bg-slate-50/60">
                          <TableCell colSpan={20} className="p-0">
                            <div className="px-8 py-2.5">
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Installment Details</p>
                              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                      <TableHead className="text-[10px] font-semibold uppercase text-slate-400">Name</TableHead>
                                      <TableHead className="text-right text-[10px] font-semibold uppercase text-slate-400">Amount</TableHead>
                                      <TableHead className="text-right text-[10px] font-semibold uppercase text-slate-400">Paid</TableHead>
                                      <TableHead className="text-right text-[10px] font-semibold uppercase text-slate-400">Remaining</TableHead>
                                      <TableHead className="text-[10px] font-semibold uppercase text-slate-400">Due Date</TableHead>
                                      <TableHead className="text-[10px] font-semibold uppercase text-slate-400">Status</TableHead>
                                      {expandableData[0]?.days_overdue !== undefined && (
                                        <TableHead className="text-right text-[10px] font-semibold uppercase text-slate-400">Days Overdue</TableHead>
                                      )}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {expandableData.map((inst, i) => (
                                      <TableRow key={i}>
                                        <TableCell className="text-xs text-slate-700">{inst.name}</TableCell>
                                        <TableCell className="text-right text-xs tabular-nums">₹{fmt(inst.amount)}</TableCell>
                                        <TableCell className="text-right text-xs tabular-nums text-emerald-700">₹{fmt(inst.paid)}</TableCell>
                                        <TableCell className="text-right text-xs font-semibold tabular-nums text-red-600">₹{fmt(inst.remaining)}</TableCell>
                                        <TableCell className="text-xs tabular-nums">{fmtDate(inst.due_date)}</TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className={`text-[10px] font-semibold ${STATUS_COLORS[inst.status] || STATUS_COLORS.pending}`}>
                                            {(inst.status || 'pending').replace('_', ' ')}
                                          </Badge>
                                        </TableCell>
                                        {inst.days_overdue !== undefined && (
                                          <TableCell className="text-right text-xs tabular-nums text-red-600">{inst.days_overdue}d</TableCell>
                                        )}
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}

                {/* Totals Row */}
                <TableRow className="border-t-2 border-slate-200 bg-slate-50 hover:bg-slate-50">
                  <TableCell colSpan={4} className="px-4 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Total ({filtered.length} {filtered.length === 1 ? 'person' : 'persons'})
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <span className="text-xs font-bold tabular-nums text-slate-800">₹{fmt(filtered.reduce((s, r) => s + (r.sale_price || 0), 0))}</span>
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <span className="text-xs font-bold tabular-nums text-emerald-700">₹{fmt(filtered.reduce((s, r) => s + (r.total_received || 0), 0))}</span>
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <span className="text-sm font-bold tabular-nums text-red-600">₹{fmt(totalPending)}</span>
                  </TableCell>
                  <TableCell colSpan={20} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

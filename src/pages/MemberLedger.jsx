import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import eventBus from '../utils/eventBus';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  ArrowLeft, Search, X, Download, TrendingUp, TrendingDown,
  Scale, ListOrdered, Loader2, Printer, RefreshCw,
} from 'lucide-react';

/* Per-module accent. Literal class strings — Tailwind can't see interpolated names. */
const MODULE_TONE = {
  plot_payments: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  expenses: 'bg-orange-50 text-orange-700 border-orange-200',
  day_book: 'bg-blue-50 text-blue-700 border-blue-200',
  farmer_payments: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  plot_commission_payments: 'bg-purple-50 text-purple-700 border-purple-200',
  vendor_payments: 'bg-amber-50 text-amber-700 border-amber-200',
  firm_transactions: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  cash_flow: 'bg-slate-100 text-slate-700 border-slate-200',
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const num = (v) => parseFloat(v) || 0;

const STATUS_TONE = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

const StatTile = ({ icon, label, value, tone, sub }) => {
  const Icon = icon;
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider opacity-70">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] opacity-60">{sub}</p>}
    </div>
  );
};

export const MemberLedger = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModules, setActiveModules] = useState([]); // [] = all
  const [search, setSearch] = useState('');

  const fetchLedger = useCallback(async () => {
    if (!id || !siteId) { setLoading(false); return; }
    setLoading(true);
    // Never let a stalled request hang the spinner (same guard the other pages use).
    const watchdog = setTimeout(() => setLoading(false), 15000);
    try {
      const res = await api.get(`/members/${id}/ledger`, { params: { site_id: siteId } });
      setData(res.data);
    } catch (err) {
      console.error('Failed to load ledger:', err);
      toast.error(err.response?.data?.message || 'Failed to load ledger');
      setData(null);
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  }, [id, siteId]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  // Any write elsewhere in the app refreshes this view (see api.js interceptor).
  useEffect(() => {
    eventBus.on('data-mutated', fetchLedger);
    return () => eventBus.off('data-mutated', fetchLedger);
  }, [fetchLedger]);

  // Memoised: a fresh [] each render would re-run every downstream useMemo.
  const rows = useMemo(() => data?.transactions || [], [data]);
  const modules = useMemo(() => (data?.modules || []).filter((m) => m.count > 0), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeModules.length && !activeModules.includes(r.module)) return false;
      if (!q) return true;
      return [r.particular, r.counterparty, r.remark, r.ref, r.role, r.mode]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, activeModules, search]);

  // Running balance is computed oldest-first, then displayed newest-first, so the
  // top row shows the closing balance the way a ledger is normally read.
  const withBalance = useMemo(() => {
    const asc = [...filtered].reverse();
    let bal = 0;
    const map = new Map();
    for (const r of asc) {
      bal += num(r.credit) - num(r.debit);
      map.set(`${r.module}:${r.id}`, bal);
    }
    return filtered.map((r) => ({ ...r, balance: map.get(`${r.module}:${r.id}`) }));
  }, [filtered]);

  const totals = useMemo(() => filtered.reduce(
    (a, r) => ({ debit: a.debit + num(r.debit), credit: a.credit + num(r.credit) }),
    { debit: 0, credit: 0 },
  ), [filtered]);

  const toggleModule = (key) =>
    setActiveModules((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const moduleLabel = (key) => modules.find((m) => m.key === key)?.label
    || (data?.modules || []).find((m) => m.key === key)?.label || key;

  const handleExport = () => {
    if (!filtered.length) return toast.error('Nothing to export');
    // Mirrors the on-screen columns, including Remark and the running Balance.
    const aoa = [
      ['Date', 'Module', 'Particular', 'Remark', 'Role', 'Counterparty', 'Mode', 'Ref', 'Status', 'Debit', 'Credit', 'Balance'],
      ...withBalance.map((r) => [
        fmtDate(r.date), moduleLabel(r.module), r.particular || '', r.remark || '', r.role || '',
        r.counterparty || '', r.mode || '', r.ref || '', r.status || '',
        num(r.debit) || '', num(r.credit) || '', r.balance,
      ]),
      [],
      ['', '', '', '', '', '', '', '', 'TOTAL', totals.debit, totals.credit, ''],
      ['', '', '', '', '', '', '', '', 'NET', totals.credit - totals.debit, '', ''],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Ledger');
    const who = (data?.member?.full_name || 'member').replace(/[^a-z0-9]+/gi, '_');
    XLSX.writeFile(wb, `Ledger_${who}.xlsx`);
    toast.success('Ledger exported');
  };

  const m = data?.member;
  const net = totals.credit - totals.debit;

  if (!siteId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm font-medium text-slate-700">No site selected</p>
        <p className="mt-1 text-xs text-slate-500">Pick a site to view this member&apos;s ledger.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-5 pb-8 print:space-y-3">
      {/* ═══ Header ═══ */}
      {/* tailwindcss-animate is already loaded as a v4 @plugin in index.css */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-indigo-50/30 to-white p-5 shadow-[0_2px_24px_-10px_rgba(30,41,59,0.18)] animate-in fade-in slide-in-from-top-2 duration-500 sm:p-6 print:border-0 print:shadow-none">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl print:hidden">
          <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-300/25 to-violet-300/15 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-gradient-to-tr from-sky-200/25 to-emerald-200/10 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${id}`)}
              className="h-9 w-9 shrink-0 p-0 print:hidden" aria-label="Back to member profile">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">
                  {m?.full_name || 'Ledger'}
                </h1>
                {m?.member_type && (
                  <Badge className="border border-indigo-200 bg-indigo-50 text-[10px] text-indigo-700">
                    {m.member_type}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[13px] text-slate-500">
                Complete money ledger · all modules
                {currentSite?.name ? ` · ${currentSite.name}` : ''}
                {m?.phone ? ` · ${m.phone}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={fetchLedger} disabled={loading} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <Button size="sm" onClick={handleExport} className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-24 text-center">
          <p className="text-sm font-medium text-slate-700">Could not load this ledger</p>
          <Button variant="outline" size="sm" onClick={fetchLedger} className="mt-3 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      ) : (
        <>
          {/* ═══ Totals ═══ */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={TrendingDown} label="Total Debit" value={inr(totals.debit)}
              sub="Money out" tone="border-rose-200 bg-rose-50/60 text-rose-700" />
            <StatTile icon={TrendingUp} label="Total Credit" value={inr(totals.credit)}
              sub="Money in" tone="border-emerald-200 bg-emerald-50/60 text-emerald-700" />
            <StatTile icon={Scale} label="Net Balance" value={`${inr(Math.abs(net))} ${net >= 0 ? 'CR' : 'DR'}`}
              sub={net >= 0 ? 'Receivable / in favour' : 'Payable / against'}
              tone={net >= 0 ? 'border-emerald-200 bg-emerald-50/60 text-emerald-700' : 'border-rose-200 bg-rose-50/60 text-rose-700'} />
            <StatTile icon={ListOrdered} label="Entries" value={filtered.length}
              sub={filtered.length !== rows.length ? `of ${rows.length} total` : 'across all modules'}
              tone="border-slate-200 bg-white text-slate-700" />
          </div>

          {/* ═══ Module filter + search ═══ */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Module</span>
                <button type="button" onClick={() => setActiveModules([])}
                  aria-pressed={activeModules.length === 0}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    activeModules.length === 0
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}>
                  All ({rows.length})
                </button>
                {modules.map((mod) => {
                  const on = activeModules.includes(mod.key);
                  return (
                    <button key={mod.key} type="button" onClick={() => toggleModule(mod.key)}
                      aria-pressed={on}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        on ? 'border-slate-800 bg-slate-800 text-white' : MODULE_TONE[mod.key] || 'border-slate-200 bg-white text-slate-600'
                      }`}>
                      {mod.label} ({mod.count})
                    </button>
                  );
                })}
              </div>
              <div className="relative w-full shrink-0 lg:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search particular, party, remark..."
                  className="h-9 pl-9 pr-8 text-sm" />
                {search && (
                  <button type="button" onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md hover:bg-slate-100"
                    aria-label="Clear search">
                    <X className="h-3 w-3 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ═══ Ledger table ═══ */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_16px_-8px_rgba(30,41,59,0.12)]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm font-medium text-slate-700">
                  {rows.length === 0 ? 'No transactions for this member yet' : 'Nothing matches these filters'}
                </p>
                <p className="mt-1 max-w-md text-xs text-slate-500">
                  {rows.length === 0
                    ? 'Money linked to this member — plot payments they booked, expenses, commissions and more — will appear here.'
                    : 'Try clearing the search or selecting a different module.'}
                </p>
                {rows.length > 0 && (
                  <Button variant="outline" size="sm" className="mt-3"
                    onClick={() => { setActiveModules([]); setSearch(''); }}>
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="whitespace-nowrap text-[11px] font-semibold">Date</TableHead>
                      <TableHead className="text-[11px] font-semibold">Module</TableHead>
                      <TableHead className="text-[11px] font-semibold">Particular</TableHead>
                      <TableHead className="text-[11px] font-semibold">Role</TableHead>
                      <TableHead className="text-[11px] font-semibold">Party</TableHead>
                      <TableHead className="text-[11px] font-semibold">Mode</TableHead>
                      <TableHead className="text-[11px] font-semibold">Status</TableHead>
                      <TableHead className="whitespace-nowrap text-right text-[11px] font-semibold">Debit</TableHead>
                      <TableHead className="whitespace-nowrap text-right text-[11px] font-semibold">Credit</TableHead>
                      <TableHead className="whitespace-nowrap text-right text-[11px] font-semibold">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withBalance.map((r) => (
                      <TableRow key={`${r.module}-${r.id}`} className="hover:bg-slate-50/60">
                        <TableCell className="whitespace-nowrap py-2 text-xs tabular-nums text-slate-600">
                          {fmtDate(r.date)}
                        </TableCell>
                        <TableCell className="py-2">
                          <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${MODULE_TONE[r.module] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                            {moduleLabel(r.module)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate py-2 text-xs font-medium text-slate-800"
                          title={r.particular || ''}>
                          {r.particular || '—'}
                          {r.remark && <span className="block truncate text-[10px] font-normal text-slate-400" title={r.remark}>{r.remark}</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2 text-[11px] text-slate-500">{r.role || '—'}</TableCell>
                        <TableCell className="max-w-[160px] truncate py-2 text-xs text-slate-600" title={r.counterparty || ''}>
                          {r.counterparty || '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2 text-[11px] text-slate-500">
                          {r.mode || '—'}
                          {r.ref && <span className="block text-[10px] text-slate-400">#{r.ref}</span>}
                        </TableCell>
                        <TableCell className="py-2">
                          {r.status ? (
                            <span className={`inline-block whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${STATUS_TONE[String(r.status).toLowerCase()] || 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                              {r.status}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2 text-right text-xs font-medium tabular-nums text-rose-600">
                          {num(r.debit) > 0 ? inr(r.debit) : ''}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2 text-right text-xs font-medium tabular-nums text-emerald-600">
                          {num(r.credit) > 0 ? inr(r.credit) : ''}
                        </TableCell>
                        <TableCell className={`whitespace-nowrap py-2 text-right text-xs font-semibold tabular-nums ${r.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {inr(Math.abs(r.balance))} {r.balance >= 0 ? 'CR' : 'DR'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold hover:bg-slate-50/80">
                      <TableCell colSpan={7} className="py-2.5 text-right text-[11px] uppercase tracking-wider text-slate-500">
                        Total{activeModules.length ? ' (filtered)' : ''}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2.5 text-right text-xs tabular-nums text-rose-700">{inr(totals.debit)}</TableCell>
                      <TableCell className="whitespace-nowrap py-2.5 text-right text-xs tabular-nums text-emerald-700">{inr(totals.credit)}</TableCell>
                      <TableCell className={`whitespace-nowrap py-2.5 text-right text-xs tabular-nums ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {inr(Math.abs(net))} {net >= 0 ? 'CR' : 'DR'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <p className="px-1 text-[11px] text-slate-400">
            Bounced and returned cheques, and rejected entries, are excluded from these totals.
          </p>
        </>
      )}
    </div>
  );
};

export default MemberLedger;

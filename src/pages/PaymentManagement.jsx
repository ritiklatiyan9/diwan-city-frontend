import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Progress } from '../components/ui/progress';
import { Textarea } from '../components/ui/textarea';
import { Skeleton } from '../components/ui/skeleton';
import {
  Search, Filter, X, Loader2, Plus, Trash2, Edit2, Eye, IndianRupee,
  CalendarClock, AlertTriangle, CheckCircle2, Clock, CreditCard, Receipt, TrendingUp, Calendar,
  ArrowDownRight, ArrowUpRight, Landmark, Wallet, RefreshCw,
  Bell, ChevronLeft, ChevronRight, UserX, TimerOff, TrendingDown, Activity, FileWarning,
} from 'lucide-react';
import { motion } from 'framer-motion';
import VoucherUpload from '../components/VoucherUpload';

// ══════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════

const STATUS_CONFIG = {
  paid:           { label: 'Paid',           color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, cardRing: 'ring-emerald-500 border-emerald-300', hoverBorder: 'hover:border-emerald-200', bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  partially_paid: { label: 'Partial',        color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: Clock,        cardRing: 'ring-amber-500 border-amber-300',   hoverBorder: 'hover:border-amber-200',   bg: 'bg-amber-50',   iconColor: 'text-amber-600' },
  overdue:        { label: 'Overdue',        color: 'bg-red-50 text-red-700 border-red-200',             icon: AlertTriangle,cardRing: 'ring-red-500 border-red-300',       hoverBorder: 'hover:border-red-200',     bg: 'bg-red-50',     iconColor: 'text-red-600' },
  pending:        { label: 'Pending',        color: 'bg-slate-50 text-slate-600 border-slate-200',       icon: CalendarClock,cardRing: 'ring-slate-500 border-slate-300',   hoverBorder: 'hover:border-slate-200',   bg: 'bg-slate-50',   iconColor: 'text-slate-500' },
};

const DUE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Due Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'overdue', label: 'Overdue' },
];

const INTEREST_TYPES = [
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_month', label: 'Per Month' },
  { value: 'per_quarter', label: 'Per Quarter' },
  { value: 'per_year', label: 'Per Year' },
];

const PAYMENT_FROM_OPTIONS = [
  'BOOKING', 'CASH', 'BANK', 'TRANSFER', 'CHEQUE', 'UPI',
  'NEFT', 'RTGS', 'ADJUST', 'RETURN', 'REFUND',
];
const BANK_TYPE_FROMS = ['BANK', 'TRANSFER', 'CHEQUE', 'UPI', 'NEFT', 'RTGS'];
const derivePaymentType = (from) => from === 'CHEQUE' ? 'CHEQUE' : BANK_TYPE_FROMS.includes(from) ? 'BANK' : 'CASH';

const FROM_COLORS = {
  'BOOKING': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'CASH': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'BANK': 'bg-blue-50 text-blue-700 border-blue-200',
  'TRANSFER': 'bg-purple-50 text-purple-700 border-purple-200',
  'CHEQUE': 'bg-teal-50 text-teal-700 border-teal-200',
  'UPI': 'bg-green-50 text-green-700 border-green-200',
  'NEFT': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'RTGS': 'bg-sky-50 text-sky-700 border-sky-200',
  'ADJUST': 'bg-orange-50 text-orange-700 border-orange-200',
  'RETURN': 'bg-pink-50 text-pink-700 border-pink-200',
  'REFUND': 'bg-red-50 text-red-700 border-red-200',
};

const SEVERITY_CONFIG = {
  critical: { color: 'bg-red-50 border-red-200 text-red-800',       badge: 'bg-red-100 text-red-700 border-red-300',       dot: 'bg-red-500' },
  high:     { color: 'bg-orange-50 border-orange-200 text-orange-800', badge: 'bg-orange-100 text-orange-700 border-orange-300', dot: 'bg-orange-500' },
  medium:   { color: 'bg-amber-50 border-amber-200 text-amber-800',   badge: 'bg-amber-100 text-amber-700 border-amber-300',   dot: 'bg-amber-500' },
  low:      { color: 'bg-slate-50 border-slate-200 text-slate-700',    badge: 'bg-slate-100 text-slate-600 border-slate-300',    dot: 'bg-slate-400' },
};

const REMINDER_ICON = {
  overdue:      { icon: AlertTriangle,  cls: 'text-red-500' },
  upcoming:     { icon: CalendarClock,   cls: 'text-amber-500' },
  inactive:     { icon: UserX,           cls: 'text-orange-500' },
  low_progress: { icon: TrendingDown,    cls: 'text-rose-500' },
  slow_payer:   { icon: TimerOff,        cls: 'text-purple-500' },
  irregular:    { icon: Activity,        cls: 'text-indigo-500' },
  no_plan:      { icon: FileWarning,     cls: 'text-slate-500' },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const today = () => new Date().toISOString().split('T')[0];

// ══════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════

export default function PaymentManagement() {
  const { currentSite } = useAuth();
  const siteId = currentSite?.id;

  // ─── Data ───
  const [plots, setPlots] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [approvers, setApprovers] = useState([]);

  // ─── Filters ───
  const [statusFilter, setStatusFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState('all');
  const [search, setSearch] = useState('');

  // ─── Installment Detail Dialog ───
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPlot, setDetailPlot] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ─── Record Payment Dialog ───
  const [payOpen, setPayOpen] = useState(false);
  const [payPlot, setPayPlot] = useState(null);
  const [payMode, setPayMode] = useState('receive');
  const [payForm, setPayForm] = useState({ date: today(), amount: '', payment_from: '', payment_type: 'CASH', bank_details: '', narration: '', received_by: '', voucher_url: '', assigned_admin_id: '' });
  const [paySubmitting, setPaySubmitting] = useState(false);

  // ─── Create/Edit Installments Dialog ───
  const [instOpen, setInstOpen] = useState(false);
  const [instPlot, setInstPlot] = useState(null);
  const [instRows, setInstRows] = useState([]);
  const [instSubmitting, setInstSubmitting] = useState(false);

  // ─── Settings Dialog ───
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPlot, setSettingsPlot] = useState(null);
  const [settingsForm, setSettingsForm] = useState({ interest_enabled: false, interest_rate: '', interest_type: 'per_month' });
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  // ─── Confirm Dialog ───
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // ─── Reminders ───
  const [reminders, setReminders] = useState([]);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderPage, setReminderPage] = useState(1);
  const [reminderPagination, setReminderPagination] = useState({ totalItems: 0, totalPages: 1, currentPage: 1, itemsPerPage: 5 });
  const [reminderSummary, setReminderSummary] = useState({ total: 0, overdue: 0, inactive: 0, upcoming: 0, low_progress: 0, slow_payer: 0, irregular: 0, no_plan: 0 });
  const [reminderCollapsed, setReminderCollapsed] = useState(false);
  const REMINDER_LIMIT = 5;

  // ══════════════════════════════════════════════════
  //  FETCH DATA
  // ══════════════════════════════════════════════════

  const fetchData = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ site_id: siteId });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (dueFilter !== 'all') params.set('due_filter', dueFilter);
      if (search) params.set('search', search);
      const res = await api.get(`/plots/payment-management?${params}`);
      setPlots(res.data.plots || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }, [siteId, statusFilter, dueFilter, search]);

  const fetchApprovers = useCallback(async () => {
    try {
      const url = siteId ? `/admin/approvers?site_id=${siteId}` : '/admin/approvers';
      const res = await api.get(url);
      setApprovers(res.data.approvers || []);
    } catch (err) {
      console.error('Failed to fetch approvers', err);
    }
  }, [siteId]);

  useEffect(() => {
    fetchData();
    fetchApprovers();
  }, [fetchData, fetchApprovers]);

  // ── Fetch reminders ──
  const fetchReminders = useCallback(async (page = 1) => {
    if (!siteId) return;
    setReminderLoading(true);
    try {
      const res = await api.get(`/plots/payment-reminders?site_id=${siteId}&page=${page}&limit=${REMINDER_LIMIT}`);
      setReminders(res.data.reminders || []);
      setReminderPagination(res.data.pagination || { totalItems: 0, totalPages: 1, currentPage: page, itemsPerPage: REMINDER_LIMIT });
      setReminderSummary(res.data.summary || { total: 0, overdue: 0, inactive: 0, upcoming: 0, low_progress: 0, slow_payer: 0, irregular: 0, no_plan: 0 });
      setReminderPage(page);
    } catch {
      setReminders([]);
    } finally {
      setReminderLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchReminders(1); }, [fetchReminders]);

  // ── Fetch installments for a plot ──
  const fetchInstallments = useCallback(async (plotId) => {
    setDetailLoading(true);
    try {
      const instRes = await api.get(`/plots/${plotId}/installments`);
      setInstallments(instRes.data.installments || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load installments' });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ══════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════

  const getPlotStatus = (plot) => {
    if (plot.installment_count === 0) return 'pending';
    if (plot.overdue_count > 0) return 'overdue';
    if (plot.total_remaining <= 0) return 'paid';
    if (plot.total_paid > 0) return 'partially_paid';
    return 'pending';
  };

  const statusBadge = (status) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`text-[10px] font-semibold ${cfg.color} gap-1`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </Badge>
    );
  };

  const progressPct = (paid, total) => total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  const getAssignedAdminLabel = (adminId) => {
    if (!adminId) return null;
    const admin = approvers.find(a => a.id === parseInt(adminId));
    return admin ? admin.full_name : null;
  };

  // ── Filtered plots (client-side search for quick filter) ──
  const filteredPlots = useMemo(() => plots, [plots]); // server already filters

  // ══════════════════════════════════════════════════
  //  ACTIONS
  // ══════════════════════════════════════════════════

  // Open detail dialog
  const openDetail = (plot) => {
    setDetailPlot(plot);
    setDetailOpen(true);
    fetchInstallments(plot.id);
  };

  // Open payment dialog
  const openPayment = (plot) => {
    setPayPlot(plot);
    setPayMode('receive');
    setPayForm({
      date: today(),
      amount: '',
      payment_from: '',
      payment_type: 'CASH',
      bank_details: '',
      narration: '',
      received_by: '',
      voucher_url: '',
      assigned_admin_id: plot.assigned_admin_id || ''
    });
    setPayOpen(true);
  };

  // Record payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return setMessage({ type: 'error', text: 'Enter a valid amount' });
    setPaySubmitting(true);
    try {
      const rawAmt = Math.abs(parseFloat(payForm.amount) || 0);
      await api.post('/plots/payments', {
        plot_id: payPlot.id,
        date: payForm.date,
        payment_from: payForm.payment_from,
        payment_type: payForm.payment_type,
        bank_details: payForm.bank_details,
        narration: payForm.narration,
        received_by: payForm.received_by,
        amount: payMode === 'refund' ? -rawAmt : rawAmt,
        voucher_url: payForm.voucher_url || null,
        assigned_admin_id: payForm.assigned_admin_id || null,
      });
      setMessage({ type: 'success', text: payMode === 'refund' ? 'Refund recorded' : 'Payment recorded' });
      setPayOpen(false);
      fetchData();
      if (detailOpen && detailPlot?.id === payPlot.id) fetchInstallments(payPlot.id);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Payment failed' });
    } finally {
      setPaySubmitting(false);
    }
  };

  // Open create installments dialog
  const openCreateInstallments = (plot) => {
    setInstPlot(plot);
    setInstRows([{ installment_name: '', amount: '', due_date: '' }]);
    setInstOpen(true);
  };

  // Add installment row
  const addInstRow = () => setInstRows(prev => [...prev, { installment_name: '', amount: '', due_date: '' }]);
  const removeInstRow = (i) => setInstRows(prev => prev.filter((_, idx) => idx !== i));
  const updateInstRow = (i, field, val) => setInstRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  // Submit new installments
  const handleCreateInstallments = async (e) => {
    e.preventDefault();
    const valid = instRows.filter(r => r.amount && r.due_date);
    if (valid.length === 0) return setMessage({ type: 'error', text: 'Add at least one valid installment' });
    setInstSubmitting(true);
    try {
      await api.post(`/plots/${instPlot.id}/installments`, { installments: valid });
      setMessage({ type: 'success', text: `${valid.length} installment(s) created` });
      setInstOpen(false);
      fetchData();
      if (detailOpen && detailPlot?.id === instPlot.id) fetchInstallments(instPlot.id);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create installments' });
    } finally {
      setInstSubmitting(false);
    }
  };

  // Update single installment
  const handleUpdateInstallment = async (instId, data) => {
    try {
      await api.put(`/plots/installments/${instId}`, data);
      setMessage({ type: 'success', text: 'Installment updated' });
      if (detailPlot) fetchInstallments(detailPlot.id);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed' });
    }
  };

  // Delete installment
  const handleDeleteInstallment = async (instId) => {
    try {
      await api.delete(`/plots/installments/${instId}`);
      setMessage({ type: 'success', text: 'Installment deleted' });
      if (detailPlot) fetchInstallments(detailPlot.id);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Delete failed' });
    }
  };

  // Open settings dialog
  const openSettings = (plot) => {
    setSettingsPlot(plot);
    setSettingsForm({
      interest_enabled: !!plot.interest_enabled,
      interest_rate: plot.interest_rate || '',
      interest_type: plot.interest_type || 'per_month',
    });
    setSettingsOpen(true);
  };

  // Save settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSubmitting(true);
    try {
      await api.put(`/plots/${settingsPlot.id}/installment-settings`, settingsForm);
      setMessage({ type: 'success', text: 'Settings updated' });
      setSettingsOpen(false);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save settings' });
    } finally {
      setSettingsSubmitting(false);
    }
  };

  // Confirm wrapper
  const confirmAndDo = (action) => { setConfirmAction(() => action); setConfirmOpen(true); };
  const executeConfirm = () => { if (confirmAction) confirmAction(); setConfirmOpen(false); setConfirmAction(null); };

  // ══════════════════════════════════════════════════
  //  GUARD
  // ══════════════════════════════════════════════════

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-slate-400 gap-3">
        <IndianRupee className="w-10 h-10" />
        <p className="text-sm">Select a site to manage payments</p>
      </div>
    );
  }

  // ── Clear message after 5s ──
  if (message.text) setTimeout(() => setMessage({ type: '', text: '' }), 5000);

  // ══════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-indigo-50/40 to-white shadow-[0_2px_24px_-10px_rgba(30,41,59,0.18)]"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-300/25 to-violet-300/15 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-gradient-to-tr from-emerald-200/25 to-sky-200/10 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-500/25">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Payment Management</h1>
              <p className="text-[13px] text-slate-500">Track installments, collections &amp; overdue interest</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Outstanding</p>
              <p className="text-lg font-bold tabular-nums text-rose-600">₹{fmt(plots.reduce((s, p) => s + (Number(p.total_remaining) || 0), 0))}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Collected</p>
              <p className="text-lg font-bold tabular-nums text-emerald-600">₹{fmt(plots.reduce((s, p) => s + (Number(p.total_paid) || 0), 0))}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-9 gap-1.5 rounded-xl text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ── Message Banner ── */}
      {message.text && (
        <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
          <X className="w-4 h-4 ml-auto cursor-pointer" onClick={() => setMessage({ type: '', text: '' })} />
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {[
          { key: 'all',            label: 'Total Plots', count: summary.total_count,   icon: Receipt,       tone: 'indigo' },
          { key: 'overdue',        label: 'Overdue',     count: summary.overdue_count, icon: AlertTriangle, tone: 'rose' },
          { key: 'partially_paid', label: 'Partial',     count: summary.partial_count, icon: Clock,         tone: 'amber' },
          { key: 'pending',        label: 'Pending',     count: summary.pending_count, icon: CalendarClock, tone: 'slate' },
          { key: 'paid',           label: 'Fully Paid',  count: summary.paid_count,    icon: CheckCircle2,  tone: 'emerald' },
        ].map((c, i) => {
          const Icon = c.icon;
          const active = statusFilter === c.key;
          const tones = {
            indigo:  { chip: 'bg-indigo-50 text-indigo-600',  bar: 'from-indigo-400 to-violet-500', ring: 'ring-indigo-300' },
            rose:    { chip: 'bg-rose-50 text-rose-600',      bar: 'from-rose-400 to-red-500',      ring: 'ring-rose-300' },
            amber:   { chip: 'bg-amber-50 text-amber-600',    bar: 'from-amber-400 to-orange-500',  ring: 'ring-amber-300' },
            slate:   { chip: 'bg-slate-100 text-slate-500',   bar: 'from-slate-300 to-slate-400',   ring: 'ring-slate-300' },
            emerald: { chip: 'bg-emerald-50 text-emerald-600', bar: 'from-emerald-400 to-teal-500', ring: 'ring-emerald-300' },
          }[c.tone];
          return (
            <motion.button
              key={c.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -3 }}
              onClick={() => setStatusFilter(statusFilter === c.key ? 'all' : c.key)}
              className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:shadow-[0_14px_34px_-14px_rgba(16,24,40,0.22)] ${active ? `border-transparent ring-2 ${tones.ring}` : 'border-slate-200/70 hover:border-slate-300/80'}`}
            >
              <span className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${tones.bar} transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-80'}`} />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{c.label}</p>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-transform group-hover:scale-110 ${tones.chip}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{c.count ?? 0}</p>
            </motion.button>
          );
        })}
      </div>

      {/* ── Payment Reminders Card ── */}
      <Card className="overflow-hidden rounded-2xl border-slate-200/70 shadow-[0_2px_16px_-8px_rgba(16,24,40,0.12)]">
          <CardContent className="p-0">
            {/* Header */}
            <button
              onClick={() => setReminderCollapsed(!reminderCollapsed)}
              className={`w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 transition-colors ${
                reminderSummary.total > 0
                  ? 'bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 hover:from-red-100 hover:via-orange-100 hover:to-amber-100'
                  : 'bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${reminderSummary.total > 0 ? 'bg-red-100 border-red-200' : 'bg-emerald-100 border-emerald-200'}`}>
                  <Bell className={`w-4 h-4 ${reminderSummary.total > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-800">Payment Reminders</p>
                  <p className="text-[11px] text-slate-500">{reminderSummary.total > 0 ? `${reminderSummary.total} alert${reminderSummary.total !== 1 ? 's' : ''} need your attention` : 'All payments on track'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {reminderSummary.overdue > 0 && (
                  <Badge variant="outline" className="text-[10px] font-semibold bg-red-100 text-red-700 border-red-300 gap-1">
                    <AlertTriangle className="w-3 h-3" /> {reminderSummary.overdue} Overdue
                  </Badge>
                )}
                {reminderSummary.inactive > 0 && (
                  <Badge variant="outline" className="text-[10px] font-semibold bg-orange-100 text-orange-700 border-orange-300 gap-1">
                    <UserX className="w-3 h-3" /> {reminderSummary.inactive} Inactive
                  </Badge>
                )}
                {reminderSummary.upcoming > 0 && (
                  <Badge variant="outline" className="text-[10px] font-semibold bg-amber-100 text-amber-700 border-amber-300 gap-1">
                    <CalendarClock className="w-3 h-3" /> {reminderSummary.upcoming} Upcoming
                  </Badge>
                )}
                {reminderSummary.low_progress > 0 && (
                  <Badge variant="outline" className="text-[10px] font-semibold bg-rose-100 text-rose-700 border-rose-300 gap-1">
                    <TrendingDown className="w-3 h-3" /> {reminderSummary.low_progress} Low Progress
                  </Badge>
                )}
                {reminderSummary.slow_payer > 0 && (
                  <Badge variant="outline" className="text-[10px] font-semibold bg-purple-100 text-purple-700 border-purple-300 gap-1">
                    <TimerOff className="w-3 h-3" /> {reminderSummary.slow_payer} Slow Payer
                  </Badge>
                )}
                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${reminderCollapsed ? '' : 'rotate-90'}`} />
              </div>
            </button>

            {/* Body */}
            {!reminderCollapsed && (
              <>
                {reminderLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                  </div>
                ) : reminders.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-600">All Clear!</p>
                    <p className="text-xs text-slate-400 mt-0.5">No payment reminders right now</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {reminders.map((r, idx) => {
                      const sev = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.low;
                      const typeInfo = REMINDER_ICON[r.type] || REMINDER_ICON.overdue;
                      const Icon = typeInfo.icon;
                      return (
                        <div key={`${r.type}-${r.plot_id}-${idx}`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${sev.color}`}>
                            <Icon className={`w-4 h-4 ${typeInfo.cls}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800">Plot {r.plot_no}</span>
                              {r.block && <span className="text-xs text-slate-400">Block {r.block}</span>}
                              <Badge variant="outline" className={`text-[9px] font-bold uppercase ${sev.badge}`}>
                                {r.severity}
                              </Badge>
                              <Badge variant="outline" className="text-[9px] font-medium bg-slate-50 text-slate-500 border-slate-200 capitalize">
                                {r.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{r.message}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                <IndianRupee className="w-3 h-3" /> Due: ₹{fmt(r.amount_due || r.total_remaining)}
                              </span>
                              {r.last_payment_date && (
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Last: {fmtDate(r.last_payment_date)}
                                </span>
                              )}
                              {r.due_date && (
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> Due: {fmtDate(r.due_date)}
                                </span>
                              )}
                              {r.buyer_name && (
                                <span className="text-[11px] font-medium text-slate-500">{r.buyer_name}</span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs shrink-0 gap-1"
                            onClick={() => {
                              const plot = plots.find(p => p.id === r.plot_id);
                              if (plot) openDetail(plot);
                            }}
                          >
                            <Eye className="w-3 h-3" /> View
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {!reminderLoading && reminderPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                    <p className="text-[11px] text-slate-400">
                      {(reminderPage - 1) * REMINDER_LIMIT + 1}–{Math.min(reminderPage * REMINDER_LIMIT, reminderPagination.totalItems)} of {reminderPagination.totalItems}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={reminderPage <= 1 || reminderLoading}
                        onClick={() => fetchReminders(reminderPage - 1)}>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      {Array.from({ length: reminderPagination.totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === reminderPagination.totalPages || Math.abs(p - reminderPage) <= 1)
                        .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push('...'); acc.push(p); return acc; }, [])
                        .map((p, i) =>
                          p === '...'
                            ? <span key={`d-${i}`} className="text-xs text-slate-400 px-1">…</span>
                            : <Button key={p} variant={p === reminderPage ? 'default' : 'outline'} size="icon" className="h-7 w-7 text-xs"
                                onClick={() => fetchReminders(p)} disabled={reminderLoading}>{p}</Button>
                        )}
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={reminderPage >= reminderPagination.totalPages || reminderLoading}
                        onClick={() => fetchReminders(reminderPage + 1)}>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      {/* ── Filter Bar ── */}
      <Card className="rounded-2xl border-slate-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <CardContent className="p-3 space-y-3">
          {/* Row 1: Due filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400" />
            {DUE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setDueFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  dueFilter === f.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >{f.label}</button>
            ))}
          </div>
          {/* Row 2: Search */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search plot no, buyer, booking by…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
          {/* Row 3: Active badges */}
          {(statusFilter !== 'all' || dueFilter !== 'all' || search) && (
            <div className="flex items-center gap-2 flex-wrap">
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Status: {STATUS_CONFIG[statusFilter]?.label} <X className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter('all')} />
                </Badge>
              )}
              {dueFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Due: {DUE_FILTERS.find(f => f.value === dueFilter)?.label} <X className="w-3 h-3 cursor-pointer" onClick={() => setDueFilter('all')} />
                </Badge>
              )}
              {search && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Search: {search} <X className="w-3 h-3 cursor-pointer" onClick={() => setSearch('')} />
                </Badge>
              )}
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => { setStatusFilter('all'); setDueFilter('all'); setSearch(''); }}>Clear all</Button>
              <span className="text-xs text-slate-400 ml-auto">Showing {filteredPlots.length} plots</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Data Table ── */}
      <Card className="overflow-hidden rounded-2xl border-slate-200/70 shadow-[0_2px_16px_-8px_rgba(16,24,40,0.12)]">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-1.5 w-24 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : filteredPlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-50 to-indigo-50 ring-1 ring-slate-100">
                <Receipt className="h-7 w-7 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700">No plots with installments</p>
              <p className="mt-0.5 max-w-xs text-xs text-slate-400">Enable installments on plots from the Plot Payments page to start tracking collections here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur hover:bg-slate-50/95">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Plot</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Buyer</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Sale Price</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Progress</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Paid</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Remaining</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Next Due</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assigned To</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Interest</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlots.map((plot) => {
                    const st = getPlotStatus(plot);
                    const pct = progressPct(plot.total_paid, parseFloat(plot.sale_price) || 0);
                    return (
                      <TableRow key={plot.id} className="group transition-colors hover:bg-slate-50/70">
                        <TableCell className="text-sm font-medium">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {plot.plot_no}{plot.block ? ` · ${plot.block}` : ''}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${st === 'overdue' ? 'bg-gradient-to-br from-rose-400 to-red-500' : st === 'paid' ? 'bg-gradient-to-br from-emerald-400 to-teal-500' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
                              {(plot.buyer_name || '?').trim().charAt(0).toUpperCase()}
                            </span>
                            <span className="font-medium text-slate-700">{plot.buyer_name || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium">₹{fmt(plot.sale_price)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={pct} className="h-1.5 flex-1" />
                            <span className="text-[10px] text-slate-500 font-medium w-8 text-right">{pct}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right text-emerald-600 font-medium">₹{fmt(plot.total_paid)}</TableCell>
                        <TableCell className="text-sm text-right text-slate-600 font-medium">₹{fmt(plot.total_remaining)}</TableCell>
                        <TableCell className="text-xs">
                          {plot.next_due_date ? (
                            <div>
                              <div className={new Date(plot.next_due_date) < new Date() ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                                {fmtDate(plot.next_due_date)}
                              </div>
                              {plot.next_due_amount > 0 && (
                                <div className="text-[10px] text-slate-400">₹{fmt(plot.next_due_amount)}</div>
                              )}
                            </div>
                           ) : '—'}
                        </TableCell>
                        <TableCell>
                          {getAssignedAdminLabel(plot.assigned_admin_id) ? (
                            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                              {getAssignedAdminLabel(plot.assigned_admin_id)}
                            </Badge>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {plot.interest_due > 0 ? (
                            <span className="text-red-600 font-medium">₹{fmt(plot.interest_due)}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(st)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="View Installments" onClick={() => openDetail(plot)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Record Payment" onClick={() => openPayment(plot)}>
                              <CreditCard className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Add Installments" onClick={() => openCreateInstallments(plot)}>
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Interest Settings" onClick={() => openSettings(plot)}>
                              <TrendingUp className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════ DIALOG: Installment Detail ══════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Installments — Plot {detailPlot?.plot_no}</DialogTitle>
            <DialogDescription>{detailPlot?.buyer_name} · Sale Price: ₹{fmt(detailPlot?.sale_price)}</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : installments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No installments defined</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setDetailOpen(false); openCreateInstallments(detailPlot); }}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Installments
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary bar */}
              <div className="flex items-center gap-4 text-sm bg-slate-50 rounded-lg px-4 py-3">
                <div>
                  <span className="text-slate-400 text-xs">Total</span>
                  <p className="font-bold">₹{fmt(installments.reduce((s, i) => s + parseFloat(i.amount), 0))}</p>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div>
                  <span className="text-slate-400 text-xs">Paid</span>
                  <p className="font-bold text-emerald-600">₹{fmt(installments.reduce((s, i) => s + parseFloat(i.paid_amount), 0))}</p>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div>
                  <span className="text-slate-400 text-xs">Remaining</span>
                  <p className="font-bold text-slate-700">₹{fmt(installments.reduce((s, i) => s + i.remaining_amount, 0))}</p>
                </div>
                {installments.some(i => i.interest_due > 0) && (
                  <>
                    <Separator orientation="vertical" className="h-8" />
                    <div>
                      <span className="text-slate-400 text-xs">Interest Due</span>
                      <p className="font-bold text-red-600">₹{fmt(installments.reduce((s, i) => s + (i.interest_due || 0), 0))}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Installment timeline */}
              <div className="space-y-2">
                {installments.map((inst, idx) => {
                  const stCfg = STATUS_CONFIG[inst.status] || STATUS_CONFIG.pending;
                  const pct = progressPct(inst.paid_amount, inst.amount);
                  return (
                    <div key={inst.id} className={`rounded-lg border p-3 ${stCfg.color.split(' ').slice(0, 1).join(' ')} bg-opacity-30 border-slate-200`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-8 h-8 rounded-full ${stCfg.bg} flex items-center justify-center flex-shrink-0`}>
                            <span className="text-xs font-bold text-slate-600">{idx + 1}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{inst.installment_name || `Installment ${idx + 1}`}</p>
                            <p className="text-xs text-slate-500">Due: {fmtDate(inst.due_date)}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-slate-900">₹{fmt(inst.amount)}</p>
                          <p className="text-[10px] text-slate-500">Paid: ₹{fmt(inst.paid_amount)}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {statusBadge(inst.status)}
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Delete" onClick={() => confirmAndDo(() => handleDeleteInstallment(inst.id))}>
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={pct} className="h-1 flex-1" />
                        <span className="text-[10px] text-slate-500 w-8 text-right">{pct}%</span>
                      </div>
                      {inst.interest_due > 0 && (
                        <p className="text-[10px] text-red-500 mt-1">Interest due: ₹{fmt(inst.interest_due)}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openPayment(detailPlot); }}>
                  <CreditCard className="w-3.5 h-3.5 mr-1" /> Record Payment
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setDetailOpen(false); openCreateInstallments(detailPlot); }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Installments
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════ DIALOG: Record Payment ══════ */}
      <Dialog open={payOpen} onOpenChange={(open) => { setPayOpen(open); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {payMode === 'refund' ? 'Record Refund / Return' : 'Record Payment'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Plot {payPlot?.plot_no}{payPlot?.buyer_name ? ' — ' + payPlot?.buyer_name : ''} · Remaining: ₹{fmt(payPlot?.total_remaining)}
            </DialogDescription>
          </DialogHeader>

          {/* Receive / Refund toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button type="button" onClick={() => setPayMode('receive')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all ${payMode === 'receive' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
              <ArrowDownRight className="w-4 h-4" /> Receive Payment
            </button>
            <button type="button" onClick={() => setPayMode('refund')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold transition-all ${payMode === 'refund' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
              <ArrowUpRight className="w-4 h-4" /> Refund / Return
            </button>
          </div>

          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Date *</Label>
                <Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{payMode === 'refund' ? 'Refund Amount (₹) *' : 'Receive Amount (₹) *'}</Label>
                <div className="relative">
                  <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${payMode === 'refund' ? 'text-red-500' : 'text-emerald-600'}`}>
                    {payMode === 'refund' ? '−' : '+'}
                  </span>
                  <Input type="number" step="0.01" min="0" placeholder="50000" value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required
                    className={`pl-8 font-semibold tabular-nums ${payMode === 'refund' ? 'border-red-200 focus-visible:ring-red-400 text-red-700' : 'border-emerald-200 focus-visible:ring-emerald-400 text-emerald-700'}`} />
                </div>
                {payForm.amount && (
                  <p className={`text-[10px] font-medium ${payMode === 'refund' ? 'text-red-500' : 'text-emerald-600'}`}>
                    {payMode === 'refund' ? '−' : '+'} ₹{fmt(Math.abs(parseFloat(payForm.amount) || 0))}
                    {payMode === 'refund' ? ' will be deducted' : ' will be received'}
                  </p>
                )}
              </div>
            </div>

            {/* Bank / Cash type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payment Type (Bank / Cash) *</Label>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button type="button" onClick={() => setPayForm({ ...payForm, payment_type: 'BANK' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all ${payForm.payment_type === 'BANK' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                  <Landmark className="w-4 h-4" /> Bank
                </button>
                <button type="button" onClick={() => setPayForm({ ...payForm, payment_type: 'CASH' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-all ${payForm.payment_type === 'CASH' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                  <Wallet className="w-4 h-4" /> Cash
                </button>
              </div>
            </div>

            {/* Payment From */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payment From (Mode)</Label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_FROM_OPTIONS.map((f) => (
                  <button key={f} type="button"
                    onClick={() => {
                      const newFrom = payForm.payment_from === f ? '' : f;
                      setPayForm({ ...payForm, payment_from: newFrom, payment_type: newFrom ? derivePaymentType(newFrom) : payForm.payment_type });
                    }}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all ${payForm.payment_from === f
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : FROM_COLORS[f] || 'border-slate-200 bg-white text-slate-600'
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
              <Input placeholder="Or type custom mode..." className="mt-1.5"
                value={!PAYMENT_FROM_OPTIONS.includes(payForm.payment_from) ? payForm.payment_from : ''}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setPayForm({ ...payForm, payment_from: val, payment_type: val ? derivePaymentType(val) : payForm.payment_type });
                }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Bank Details</Label>
                <Input placeholder="CASH / SBI-613266 / UNB-037191" value={payForm.bank_details}
                  onChange={(e) => setPayForm({ ...payForm, bank_details: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Received By</Label>
                <Input placeholder="PRAVINDRA, SONU CHAUDHARY..." value={payForm.received_by}
                  onChange={(e) => setPayForm({ ...payForm, received_by: e.target.value.toUpperCase() })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Narration</Label>
              <Textarea placeholder={payMode === 'refund' ? 'REFUND, RETURN...' : 'REGISTRY, BOOKING, INSTALLMENT...'}
                value={payForm.narration} onChange={(e) => setPayForm({ ...payForm, narration: e.target.value.toUpperCase() })} rows={2} />
            </div>

             <div className="space-y-1.5">
              <Label className="text-xs font-medium">Voucher / Receipt</Label>
              <VoucherUpload value={payForm.voucher_url} onChange={(url) => setPayForm({ ...payForm, voucher_url: url })} />
            </div>

            {/* Assign to Admin */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Assign To Admin</Label>
              <Select
                value={payForm.assigned_admin_id?.toString() || "none"}
                onValueChange={(val) => setPayForm({ ...payForm, assigned_admin_id: val === "none" ? "" : val })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select Admin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Assigned</SelectItem>
                  {approvers.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id.toString()}>
                      {admin.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-[10px] text-slate-400">Payment will auto-apply to installments in order.</p>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setPayOpen(false)} disabled={paySubmitting}>Cancel</Button>
              <Button type="submit" size="sm" disabled={paySubmitting}
                className={payMode === 'refund' ? 'bg-red-600 hover:bg-red-700' : ''}>
                {paySubmitting
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{payMode === 'refund' ? 'Recording Refund...' : 'Recording Payment...'}</>
                  : payMode === 'refund' ? '↑ Record Refund' : '↓ Record Payment'
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══════ DIALOG: Create Installments ══════ */}
      <Dialog open={instOpen} onOpenChange={setInstOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Installments — {instPlot?.plot_no}</DialogTitle>
            <DialogDescription>{instPlot?.buyer_name} · Sale Price: ₹{fmt(instPlot?.sale_price)}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInstallments} className="space-y-4">
            <div className="space-y-2">
              {instRows.map((row, i) => (
                <div key={i} className="flex items-end gap-2 bg-slate-50 rounded-lg p-3">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-medium">Name</Label>
                    <Input
                      value={row.installment_name}
                      onChange={(e) => updateInstRow(i, 'installment_name', e.target.value)}
                      placeholder={`Installment ${i + 1}`}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="w-32 space-y-1.5">
                    <Label className="text-xs font-medium">Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={row.amount}
                      onChange={(e) => updateInstRow(i, 'amount', e.target.value)}
                      placeholder="₹0.00"
                      className="h-8 text-sm"
                      required
                    />
                  </div>
                  <div className="w-36 space-y-1.5">
                    <Label className="text-xs font-medium">Due Date *</Label>
                    <Input
                      type="date"
                      value={row.due_date}
                      onChange={(e) => updateInstRow(i, 'due_date', e.target.value)}
                      className="h-8 text-sm"
                      required
                    />
                  </div>
                  {instRows.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeInstRow(i)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={addInstRow}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
            </Button>
            <DialogFooter>
              <Button type="submit" disabled={instSubmitting}>
                {instSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create {instRows.length} Installment{instRows.length > 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══════ DIALOG: Interest Settings ══════ */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Interest Settings — {settingsPlot?.plot_no}</DialogTitle>
            <DialogDescription>Configure overdue interest for this plot</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <input
                type="checkbox"
                id="interest_enabled"
                checked={settingsForm.interest_enabled}
                onChange={(e) => setSettingsForm(p => ({ ...p, interest_enabled: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="interest_enabled" className="text-sm cursor-pointer">Enable overdue interest calculation</Label>
            </div>
            {settingsForm.interest_enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={settingsForm.interest_rate}
                    onChange={(e) => setSettingsForm(p => ({ ...p, interest_rate: e.target.value }))}
                    placeholder="e.g. 1.5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Interest Period</Label>
                  <Select value={settingsForm.interest_type} onValueChange={(v) => setSettingsForm(p => ({ ...p, interest_type: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTEREST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={settingsSubmitting}>
                {settingsSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Settings
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══════ DIALOG: Confirm ══════ */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={executeConfirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

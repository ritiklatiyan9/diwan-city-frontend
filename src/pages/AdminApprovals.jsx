import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { format } from 'date-fns';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Calendar } from '../components/ui/calendar';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import {
  AlertCircle, Check, Search, Building2, Calendar as CalendarIcon,
  Clock, CheckCircle2, XCircle, Filter, X, Loader2, ChevronDown,
  Eye, RefreshCw, ExternalLink, FileCheck,
} from 'lucide-react';

// ── Module Config ──
const MODULE_CONFIG = {
  farmer_payment:     { label: 'Farmer Payment',   color: 'bg-green-50 text-green-700 border-green-200' },
  plot_commission:    { label: 'Plot Commission',   color: 'bg-purple-50 text-purple-700 border-purple-200' },
  plot_commission_payment: { label: 'Plot Commission', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  cash_flow_entry:    { label: 'Cash Flow',         color: 'bg-blue-50 text-blue-700 border-blue-200' },
  firm_transaction:   { label: 'Firm Transaction',   color: 'bg-orange-50 text-orange-700 border-orange-200' },
  plot_payment:       { label: 'Plot Payment',       color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  expense:            { label: 'Expense',            color: 'bg-red-50 text-red-700 border-red-200' },
  daybook_farmer:     { label: 'Farmer Payment',     color: 'bg-green-50 text-green-700 border-green-200', countKey: 'farmer_payment' },
  daybook_commission: { label: 'Plot Commission',    color: 'bg-purple-50 text-purple-700 border-purple-200', countKey: 'plot_commission' },
  daybook_expense:    { label: 'Expense',            color: 'bg-red-50 text-red-700 border-red-200', countKey: 'expense' },
  vendor_payment:     { label: 'Vendor Payment',     color: 'bg-pink-50 text-pink-700 border-pink-200' },
  plot_registry_payment: { label: 'Registry Payment', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  daybook:            { label: 'DayBook',            color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

// ── Helpers ──
const toLocal = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const fmt = (val) => {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const MODE_COLORS = {
  'CASH': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'UPI': 'bg-green-50 text-green-700 border-green-200',
  'CHEQUE': 'bg-teal-50 text-teal-700 border-teal-200',
  'BANK': 'bg-blue-50 text-blue-700 border-blue-200',
  'TRANSFER': 'bg-purple-50 text-purple-700 border-purple-200',
  'NEFT': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'RTGS': 'bg-sky-50 text-sky-700 border-sky-200',
  'IMPS': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'ADJUST': 'bg-orange-50 text-orange-700 border-orange-200',
  'BOOKING': 'bg-amber-50 text-amber-700 border-amber-200',
  'RETURN': 'bg-rose-50 text-rose-700 border-rose-200',
  'REFUND': 'bg-pink-50 text-pink-700 border-pink-200',
};

const BANK_MODES = new Set(['BANK', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'CHEQUE', 'TRANSFER']);

/** Get the payment channel (FROM) and classification (TYPE) for an entry */
const getEntryFromType = (entry) => {
  if (entry.source === 'plot_payment') {
    // plot_payments: payment_from = channel, payment_mode (aliased from payment_type) = BANK/CASH
    const from = (entry.payment_from || '').toUpperCase() || null;
    const type = (entry.payment_mode || '').toUpperCase() || null;
    return { from, type };
  }
  // expenses, cash_flow_entry, firm_transaction, daybook, vendor_payment, etc.
  const mode = (entry.payment_mode || entry.cash_type || '').toUpperCase() || null;
  if (!mode) return { from: null, type: null };
  const type = mode === 'CASH' ? 'CASH' : BANK_MODES.has(mode) ? 'BANK' : null;
  return { from: mode, type };
};

export default function AdminApprovals() {
  const { user, sites, isAdmin, hasPermission, currentSite } = useAuth();
  const canApprove = isAdmin || hasPermission('expense_approval', 'read');

  // ── Tab ──
  const [activeTab, setActiveTab] = useState('approvals');

  // ── State ──
  const [entries, setEntries] = useState([]);
  const [counts, setCounts] = useState({});
  const [allowedModules, setAllowedModules] = useState(null); // null = admin (all), array = sub-admin
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: '', entry: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, entry: null });
  const [approvers, setApprovers] = useState([]);

  // ── Cheque Tab State ──
  const [chequeEntries, setChequeEntries] = useState([]);
  const [chequeCounts, setChequeCounts] = useState({ PENDING: 0, CLEARED: 0, BOUNCED: 0, RETURNED: 0 });
  const [chequeLoading, setChequeLoading] = useState(false);
  const [chequeStatusFilter, setChequeStatusFilter] = useState('PENDING');
  const [chequeSiteFilter, setChequeSiteFilter] = useState(() => currentSite?.id ? String(currentSite.id) : 'all');
  const [chequeSearch, setChequeSearch] = useState('');
  const [chequeUpdating, setChequeUpdating] = useState(null);
  const [chequeNoEdits, setChequeNoEdits] = useState({});
  const [chequeNoSaving, setChequeNoSaving] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSite, setFilterSite] = useState(() => currentSite?.id ? String(currentSite.id) : 'all');
  const [filterModule, setFilterModule] = useState('all');
  const [filterAssignedAdmin, setFilterAssignedAdmin] = useState('all');
  const [filterDate, setFilterDate] = useState(null);
  const [filterDateRange, setFilterDateRange] = useState({ from: null, to: null });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterMode, setFilterMode] = useState('single');

  // ── Fetch Entries ──
  const fetchEntries = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const params = {};
      if (filterModule !== 'all') params.module = filterModule;
      if (filterSite !== 'all') params.site_id = filterSite;
      if (filterAssignedAdmin !== 'all') params.assigned_admin_id = filterAssignedAdmin;
      if (filterMode === 'single' && filterDate) {
        const dateStr = toLocal(filterDate);
        params.date_from = dateStr;
        params.date_to = dateStr;
      } else if (filterMode === 'range') {
        if (filterDateRange.from) params.date_from = toLocal(filterDateRange.from);
        if (filterDateRange.to) params.date_to = toLocal(filterDateRange.to);
      }

      const [entriesRes, countsRes] = await Promise.all([
        api.get('/approvals/pending', { params }),
        api.get('/approvals/counts', { params: filterSite !== 'all' ? { site_id: filterSite } : {} }),
      ]);
      setEntries(entriesRes.data.entries || []);
      const countsData = countsRes.data || {};
      const { allowed_modules, ...countValues } = countsData;
      setCounts(countValues);
      setAllowedModules(allowed_modules); // null for admin, array for sub-admin
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
      setMessage({ type: 'error', text: 'Failed to load entries' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterModule, filterSite, filterAssignedAdmin, filterDate, filterDateRange, filterMode]);

  // ── Fetch Cheque Entries ──
  const fetchCheques = useCallback(async () => {
    try {
      setChequeLoading(true);
      const params = {};
      if (chequeSiteFilter !== 'all') params.site_id = chequeSiteFilter;
      const { data } = await api.get('/approvals/cheques', { params });
      setChequeEntries(data.entries || []);
      setChequeCounts(data.counts || { PENDING: 0, CLEARED: 0, BOUNCED: 0, RETURNED: 0 });
    } catch (err) {
      console.error('Failed to fetch cheque entries:', err);
    } finally {
      setChequeLoading(false);
    }
  }, [chequeSiteFilter]);

  useEffect(() => {
    if (activeTab === 'cheques') fetchCheques();
  }, [activeTab, fetchCheques]);

  // Fetch cheque counts on mount for the tab badge
  useEffect(() => {
    const params = currentSite?.id ? { site_id: currentSite.id } : {};
    api.get('/approvals/cheques', { params }).then(({ data }) => {
      setChequeCounts(data.counts || { PENDING: 0, CLEARED: 0, BOUNCED: 0, RETURNED: 0 });
    }).catch(() => {});
  }, [currentSite]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Sync filter when sidebar site changes ──
  useEffect(() => {
    const id = currentSite?.id ? String(currentSite.id) : 'all';
    setFilterSite(id);
    setChequeSiteFilter(id);
  }, [currentSite]);

  // ── Fetch approvers (site-scoped so sub-admins of the current site appear too) ──
  useEffect(() => {
    const url = currentSite?.id ? `/admin/approvers?site_id=${currentSite.id}` : '/admin/approvers';
    api.get(url)
      .then(res => setApprovers(res.data.approvers || []))
      .catch(() => setApprovers([]));
  }, [currentSite?.id]);

  // ── Client-side search filtering ──
  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(e =>
      e.entry_label?.toLowerCase().includes(q) ||
      e.site_name?.toLowerCase().includes(q) ||
      e.created_by_name?.toLowerCase().includes(q) ||
      e.assigned_admin_name?.toLowerCase().includes(q) ||
      MODULE_CONFIG[e.source]?.label.toLowerCase().includes(q)
    );
  }, [entries, searchQuery]);

  const canActOnEntry = useCallback((entry) => {
    if (!entry?.assigned_admin_id) return true;
    return String(entry.assigned_admin_id) === String(user?.id);
  }, [user?.id]);

  const actionableEntries = useMemo(
    () => filteredEntries.filter((entry) => canActOnEntry(entry)),
    [filteredEntries, canActOnEntry]
  );

  // ── Selection ──
  const handleSelectAll = (checked) => {
    if (checked) setSelectedIds(actionableEntries.map(e => ({ id: e.id, source: e.source })));
    else setSelectedIds([]);
  };

  const handleSelectOne = (entry, checked) => {
    if (!canActOnEntry(entry)) return;
    if (checked) setSelectedIds([...selectedIds, { id: entry.id, source: entry.source }]);
    else setSelectedIds(selectedIds.filter(item => !(item.id === entry.id && item.source === entry.source)));
  };

  const isSelected = (entry) => selectedIds.some(item => item.id === entry.id && item.source === entry.source);

  // Helper: get the actual source to send to the API for approve/reject
  const getApiSource = (entry) => {
    if (entry.source === 'daybook_farmer' || entry.source === 'daybook_commission' || entry.source === 'daybook_expense') return 'daybook';
    return entry.source;
  };

  // ── Actions ──
  const handleApprove = async (entry) => {
    try {
      setSubmitting(true);
      await api.put(`/approvals/${entry.id}/approve?source=${getApiSource(entry)}`);
      setMessage({ type: 'success', text: 'Entry approved successfully' });
      await fetchEntries(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to approve' });
    } finally {
      setSubmitting(false);
      setConfirmDialog({ open: false, type: '', entry: null });
    }
  };

  const handleReject = async (entry) => {
    try {
      setSubmitting(true);
      await api.put(`/approvals/${entry.id}/reject?source=${getApiSource(entry)}`);
      setMessage({ type: 'success', text: 'Entry rejected' });
      await fetchEntries(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to reject' });
    } finally {
      setSubmitting(false);
      setConfirmDialog({ open: false, type: '', entry: null });
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      setSubmitting(true);
      await api.post('/approvals/bulk-approve', { items: selectedIds.map(item => ({ ...item, source: ['daybook_farmer','daybook_commission','daybook_expense'].includes(item.source) ? 'daybook' : item.source })) });
      setMessage({ type: 'success', text: `${selectedIds.length} entries approved` });
      await fetchEntries(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Bulk approval failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    try {
      setSubmitting(true);
      await api.post('/approvals/bulk-reject', { items: selectedIds.map(item => ({ ...item, source: ['daybook_farmer','daybook_commission','daybook_expense'].includes(item.source) ? 'daybook' : item.source })) });
      setMessage({ type: 'success', text: `${selectedIds.length} entries rejected` });
      await fetchEntries(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Bulk rejection failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterSite('all');
    setFilterModule('all');
    setFilterAssignedAdmin('all');
    setFilterDate(null);
    setFilterDateRange({ from: null, to: null });
    setFilterMode('single');
  };

  // ── Cheque status change handler ──
  const handleChequeStatusChange = async (entry, newStatus) => {
    if (newStatus === entry.cheque_status) return;
    const label = newStatus === 'BOUNCED' || newStatus === 'RETURNED'
      ? `This will NULLIFY the cheque amount (no credit / no debit). Continue?`
      : newStatus === 'CLEARED'
      ? `Mark this cheque as CLEARED?`
      : `Change cheque status to ${newStatus}?`;
    if (!window.confirm(label)) return;

    setChequeUpdating(entry.id + '-' + entry.source);
    try {
      const key = `${entry.source}-${entry.id}`;
      const payload = {
        id: entry.id,
        source: entry.source,
        cheque_status: newStatus,
      };
      if (chequeNoEdits[key] !== undefined) {
        payload.cheque_no = chequeNoEdits[key];
      }
      await api.patch('/approvals/cheque-status', payload);
      setMessage({ type: 'success', text: `Cheque status updated to ${newStatus}` });
      setChequeNoEdits(prev => { const n = { ...prev }; delete n[key]; return n; });
      await fetchCheques();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update cheque status' });
    } finally {
      setChequeUpdating(null);
    }
  };

  // ── Save cheque_no independently ──
  const handleChequeNoSave = async (entry) => {
    const key = `${entry.source}-${entry.id}`;
    const newNo = (chequeNoEdits[key] ?? '').trim();
    if (newNo === (entry.cheque_no || '')) return;

    setChequeNoSaving(key);
    try {
      await api.patch('/approvals/cheque-status', {
        id: entry.id,
        source: entry.source,
        cheque_status: entry.cheque_status,
        cheque_no: newNo || null,
      });
      setMessage({ type: 'success', text: 'Cheque number updated' });
      setChequeNoEdits(prev => { const n = { ...prev }; delete n[key]; return n; });
      await fetchCheques();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update cheque number' });
    } finally {
      setChequeNoSaving(null);
    }
  };

  // Cheque filtered by search
  const filteredChequeEntries = useMemo(() => {
    let filtered = chequeEntries;
    if (chequeStatusFilter !== 'all') {
      filtered = filtered.filter(e => e.cheque_status === chequeStatusFilter);
    }
    if (chequeSearch) {
      const q = chequeSearch.toLowerCase();
      filtered = filtered.filter(e =>
        e.entry_label?.toLowerCase().includes(q) ||
        e.site_name?.toLowerCase().includes(q) ||
        e.cheque_no?.toLowerCase().includes(q) ||
        e.source?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [chequeEntries, chequeStatusFilter, chequeSearch]);

  const getModuleBadge = (source) => {
    const config = MODULE_CONFIG[source];
    if (!config) return <Badge variant="outline" className="text-[10px]">{source}</Badge>;
    return <Badge variant="outline" className={`text-[10px] font-medium ${config.color}`}>{config.label}</Badge>;
  };

  const getAmountDisplay = (entry) => {
    if (entry.amount !== undefined && entry.amount !== null) {
      const amt = parseFloat(entry.amount);
      return <span className={`text-sm font-semibold tabular-nums ${amt < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{amt < 0 ? '-' : ''}₹{fmt(Math.abs(amt))}</span>;
    }
    const d = parseFloat(entry.debit) || 0;
    const c = parseFloat(entry.credit) || 0;
    if (d > 0 && c > 0) return <span className="text-sm font-semibold tabular-nums text-slate-700">Dr:₹{fmt(d)} / Cr:₹{fmt(c)}</span>;
    if (d > 0) return <span className="text-sm font-semibold tabular-nums text-red-600">₹{fmt(d)}</span>;
    if (c > 0) return <span className="text-sm font-semibold tabular-nums text-emerald-700">₹{fmt(c)}</span>;
    return <span className="text-xs text-slate-300">—</span>;
  };

  const getAssignedAdminLabel = (entry) => {
    if (entry?.assigned_admin_name) return entry.assigned_admin_name;
    if (!entry?.assigned_admin_id) return null;
    const match = approvers.find((a) => String(a.id) === String(entry.assigned_admin_id));
    return match?.full_name || match?.name || match?.email || `Admin #${entry.assigned_admin_id}`;
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterSite !== 'all') count++;
    if (filterModule !== 'all') count++;
    if (filterAssignedAdmin !== 'all') count++;
    if (filterDate) count++;
    if (filterDateRange.from || filterDateRange.to) count++;
    if (searchQuery) count++;
    return count;
  }, [filterSite, filterModule, filterAssignedAdmin, filterDate, filterDateRange, searchQuery]);

  const hasActiveFilters = activeFilterCount > 0;
  const totalPending = counts.total || 0;

  // For sub-admins, only show modules they have access to.
  // allowedModules === null means admin (show all).
  const isModuleVisible = (key) => {
    if (!allowedModules) return true; // admin sees all
    // daybook sub-types check the 'daybook' module
    if (key.startsWith('daybook_') || key === 'daybook') return allowedModules.includes('daybook');
    return allowedModules.includes(key);
  };

  const visibleModules = useMemo(() =>
    Object.entries(MODULE_CONFIG).filter(([key]) => !key.startsWith('daybook_') && isModuleVisible(key)),
    [allowedModules]
  );

  if (!canApprove) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-red-300 mb-3" />
        <p className="text-sm text-slate-500">Access required</p>
        <p className="text-xs text-slate-400 mt-0.5">You do not have permission to approve entries</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {activeTab === 'approvals' ? 'Approvals' : 'Cheque Management'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {activeTab === 'approvals' ? 'Review and approve pending entries across all modules' : 'Track and manage cheque payment statuses'}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 ml-4">
            <button
              onClick={() => setActiveTab('approvals')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'approvals' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Clock className="w-3.5 h-3.5 inline mr-1.5" />
              Approvals
            </button>
            <button
              onClick={() => setActiveTab('cheques')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'cheques' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FileCheck className="w-3.5 h-3.5 inline mr-1.5" />
              Cheques
              {chequeCounts.PENDING > 0 && (
                <span className="ml-1.5 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{chequeCounts.PENDING}</span>
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'approvals' && (
            <>
              <Button variant="outline" size="sm" onClick={() => fetchEntries(true)} disabled={refreshing}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {selectedIds.length > 0 && (
                <>
                  <Button size="sm" onClick={handleBulkApprove} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Approve Selected ({selectedIds.length})
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleBulkReject} disabled={submitting}>
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Reject ({selectedIds.length})
                  </Button>
                </>
              )}
            </>
          )}
          {activeTab === 'cheques' && (
            <Button variant="outline" size="sm" onClick={() => fetchCheques()} disabled={chequeLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${chequeLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
          <button className="ml-auto" onClick={() => setMessage({ type: '', text: '' })}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'approvals' && (<>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card
          className={`shadow-none cursor-pointer transition-all ${filterModule === 'all' ? 'ring-2 ring-amber-500 border-amber-300' : 'border-slate-200 hover:border-amber-200'}`}
          onClick={() => setFilterModule('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">All Pending</p>
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1">{totalPending}</p>
          </CardContent>
        </Card>
        {visibleModules.map(([key, cfg]) => {
          const count = counts[key] || 0;
          return (
            <Card
              key={key}
              className={`shadow-none cursor-pointer transition-all ${filterModule === key ? 'ring-2 ring-slate-900 border-slate-300' : 'border-slate-200 hover:border-slate-300'}`}
              onClick={() => setFilterModule(filterModule === key ? 'all' : key)}
            >
              <CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium truncate">{cfg.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400" />

            {/* Site Filter */}
            <Select value={filterSite} onValueChange={setFilterSite}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue placeholder="All Sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {(sites || []).map((site) => (
                  <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Module Filter */}
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {Object.entries(MODULE_CONFIG).filter(([key]) => isModuleVisible(key)).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Assigned Admin Filter */}
            {approvers.length > 0 && (
              <Select value={filterAssignedAdmin} onValueChange={setFilterAssignedAdmin}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="All Approvers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Approvers</SelectItem>
                  {approvers.map((app) => (
                    <SelectItem key={app.id} value={String(app.id)}>{app.full_name || app.name || app.email || `Admin #${app.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Separator orientation="vertical" className="h-6" />

            {/* Date Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setFilterMode('single')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterMode === 'single' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              >
                Single Day
              </button>
              <button
                onClick={() => setFilterMode('range')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterMode === 'range' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              >
                Date Range
              </button>
            </div>

            {/* Calendar Picker */}
            {filterMode === 'single' ? (
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {filterDate ? format(filterDate, 'dd/MM/yyyy') : 'Select Date'}
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterDate}
                    onSelect={(date) => { setFilterDate(date); setCalendarOpen(false); }}
                    initialFocus
                  />
                  {filterDate && (
                    <div className="p-2 border-t">
                      <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setFilterDate(null); setCalendarOpen(false); }}>
                        Clear Date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {filterDateRange.from ? format(filterDateRange.from, 'dd/MM') : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filterDateRange.from} onSelect={(date) => setFilterDateRange(prev => ({ ...prev, from: date }))} initialFocus />
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-slate-400">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {filterDateRange.to ? format(filterDateRange.to, 'dd/MM') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={filterDateRange.to} onSelect={(date) => setFilterDateRange(prev => ({ ...prev, to: date }))} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <Separator orientation="vertical" className="h-6" />

            {/* Search */}
            <div className="relative flex-1 min-w-45">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search entry, site, created by..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Apply Filter */}
            <Button size="sm" onClick={() => fetchEntries(true)} className="h-8 text-xs">
              Apply Filter
            </Button>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              {filterSite !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Building2 className="w-3 h-3" />
                  {(sites || []).find(s => String(s.id) === filterSite)?.name || 'Site'}
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterSite('all')} />
                </Badge>
              )}
              {filterModule !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  {MODULE_CONFIG[filterModule]?.label || filterModule}
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterModule('all')} />
                </Badge>
              )}
              {filterAssignedAdmin !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  {approvers.find(a => String(a.id) === filterAssignedAdmin)?.full_name || approvers.find(a => String(a.id) === filterAssignedAdmin)?.name || approvers.find(a => String(a.id) === filterAssignedAdmin)?.email || 'Approver'}
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterAssignedAdmin('all')} />
                </Badge>
              )}
              {filterDate && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {format(filterDate, 'dd/MM/yyyy')}
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterDate(null)} />
                </Badge>
              )}
              {(filterDateRange.from || filterDateRange.to) && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  {filterDateRange.from ? format(filterDateRange.from, 'dd/MM') : '...'} → {filterDateRange.to ? format(filterDateRange.to, 'dd/MM') : '...'}
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterDateRange({ from: null, to: null })} />
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Search className="w-3 h-3" />
                  &quot;{searchQuery}&quot;
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setSearchQuery('')} />
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-slate-500 h-6 px-2">
                Clear all
              </Button>
              <span className="text-xs text-slate-400 ml-auto">
                Showing {filteredEntries.length} pending entries
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 className="w-10 h-10 text-emerald-200 mx-auto mb-3" />
              <p className="text-sm text-slate-600 font-medium">No pending approvals</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {hasActiveFilters ? 'Try different filters' : 'All entries have been reviewed'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-50/80">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.length === actionableEntries.length && actionableEntries.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Date</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Module</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Site</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Entry Details</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20">From</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20">Type</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-32">Amount</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cheque No</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Created By</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assigned To</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center w-36">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => {
                    const itemSelected = isSelected(entry);
                    const { from: entryFrom, type: entryType } = getEntryFromType(entry);
                    return (
                      <TableRow key={`${entry.source}-${entry.id}`} className={itemSelected ? 'bg-blue-50/50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={itemSelected}
                            disabled={!canActOnEntry(entry)}
                            onCheckedChange={(checked) => handleSelectOne(entry, checked)}
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="text-sm text-slate-700 tabular-nums">{fmtDate(entry.date)}</span>
                        </TableCell>
                        <TableCell>{getModuleBadge(entry.source)}</TableCell>
                        <TableCell>
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block w-fit">
                            {entry.site_name || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm text-slate-800 line-clamp-2">{entry.entry_label}</span>
                            <div className="flex items-center flex-wrap gap-1 mt-0.5">
                              {entry.plot_no && (
                                <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">Plot {entry.plot_no}</span>
                              )}
                              {entry.booked_by && (
                                <span className="text-[10px] text-slate-400">Booked by - {entry.booked_by}</span>
                              )}
                            </div>
                            {entry.voucher_url && (
                              <a href={entry.voucher_url} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-200 w-fit hover:bg-slate-200"
                                title="View Voucher">
                                <ExternalLink className="w-2.5 h-2.5" /> Voucher
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {entryFrom ? (
                            <Badge variant="outline" className={`text-[10px] font-medium ${MODE_COLORS[entryFrom] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{entryFrom}</Badge>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </TableCell>
                        <TableCell>
                          {entryType ? (
                            <Badge variant="outline" className={`text-[10px] font-medium ${MODE_COLORS[entryType] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{entryType}</Badge>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </TableCell>
                        <TableCell className="text-right">{getAmountDisplay(entry)}</TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-slate-600">{entry.cheque_no || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-500">{entry.created_by_name || '—'}</span>
                        </TableCell>
                        <TableCell>
                          {entry.assigned_admin_id ? (
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-50 text-purple-700 inline-block">
                              {getAssignedAdminLabel(entry) || '—'}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setDetailDialog({ open: true, entry })}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600" title="View Details">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {canActOnEntry(entry) ? (
                              <>
                                <Button variant="ghost" size="sm"
                                  onClick={() => setConfirmDialog({ open: true, type: 'approve', entry })}
                                  className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"
                                  title="Approve">
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm"
                                  onClick={() => setConfirmDialog({ open: true, type: 'reject', entry })}
                                  className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                  title="Reject">
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic px-1.5">Assigned</span>
                            )}
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
      </>)}

      {/* ── Cheques Tab ── */}
      {activeTab === 'cheques' && (<>
        {/* Cheque Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: 'PENDING',  label: 'Pending',  icon: Clock,        ring: 'ring-amber-500 border-amber-300',   text: 'text-amber-600',   bg: 'bg-amber-50',   iconColor: 'text-amber-600' },
            { key: 'CLEARED',  label: 'Cleared',  icon: CheckCircle2, ring: 'ring-emerald-500 border-emerald-300', text: 'text-emerald-600', bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
            { key: 'BOUNCED',  label: 'Bounced',  icon: XCircle,      ring: 'ring-red-500 border-red-300',       text: 'text-red-600',     bg: 'bg-red-50',     iconColor: 'text-red-600' },
            { key: 'RETURNED', label: 'Returned', icon: RefreshCw,    ring: 'ring-orange-500 border-orange-300', text: 'text-orange-600',  bg: 'bg-orange-50',  iconColor: 'text-orange-600' },
          ].map(({ key, label, icon: Icon, ring, text, bg, iconColor }) => (
            <Card
              key={key}
              className={`shadow-none cursor-pointer transition-all ${chequeStatusFilter === key ? `ring-2 ${ring}` : 'border-slate-200 hover:border-slate-300'}`}
              onClick={() => setChequeStatusFilter(chequeStatusFilter === key ? 'all' : key)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className={`text-[11px] uppercase tracking-wider font-medium ${chequeStatusFilter === key ? text : 'text-slate-400'}`}>{label}</p>
                  <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold mt-1 ${chequeStatusFilter === key ? text : 'text-slate-900'}`}>{chequeCounts[key] || 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cheque Filters */}
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={chequeSiteFilter} onValueChange={setChequeSiteFilter}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {(sites || []).map((site) => (
                    <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Separator orientation="vertical" className="h-6" />
              <div className="relative flex-1 min-w-45">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Search entry, site, cheque no..."
                  value={chequeSearch}
                  onChange={(e) => setChequeSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <span className="text-xs text-slate-400 ml-auto">
                {filteredChequeEntries.length} entries
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Cheque Entries Table */}
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-0">
            {chequeLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : filteredChequeEntries.length === 0 ? (
              <div className="text-center py-16">
                <FileCheck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-600 font-medium">No cheque entries found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {chequeStatusFilter !== 'all' ? 'Try a different status filter' : 'No cheque payments recorded yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-slate-50/80">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Date</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Module</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Site</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Entry Details</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cheque No</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-32">Amount</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center w-40">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChequeEntries.map((entry) => {
                      const isUpdating = chequeUpdating === `${entry.id}-${entry.source}`;
                      const amt = parseFloat(entry.amount) || 0;
                      return (
                        <TableRow key={`${entry.source}-${entry.id}`}>
                          <TableCell className="whitespace-nowrap">
                            <span className="text-sm text-slate-700 tabular-nums">{fmtDate(entry.date)}</span>
                          </TableCell>
                          <TableCell>{getModuleBadge(entry.source)}</TableCell>
                          <TableCell>
                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block w-fit">
                              {entry.site_name || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm text-slate-800 line-clamp-2">{entry.entry_label}</span>
                              <div className="flex items-center flex-wrap gap-1 mt-0.5">
                                {entry.plot_no && (
                                  <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">Plot {entry.plot_no}</span>
                                )}
                                {entry.booked_by && (
                                  <span className="text-[10px] font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5">Booked by - {entry.booked_by}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const key = `${entry.source}-${entry.id}`;
                              const isEditing = chequeNoEdits[key] !== undefined;
                              const isSaving = chequeNoSaving === key;
                              const val = isEditing ? chequeNoEdits[key] : (entry.cheque_no || '');
                              return (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={val}
                                    placeholder="—"
                                    onChange={(e) => setChequeNoEdits(prev => ({ ...prev, [key]: e.target.value }))}
                                    onBlur={() => { if (isEditing) handleChequeNoSave(entry); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && isEditing) handleChequeNoSave(entry); }}
                                    className="w-24 h-7 text-sm font-mono text-slate-700 border border-slate-200 rounded px-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
                                    disabled={isSaving}
                                  />
                                  {isSaving && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`text-sm font-semibold tabular-nums ${amt < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                              ₹{fmt(Math.abs(amt))}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {isUpdating ? (
                              <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" />
                            ) : (
                              <Select
                                value={entry.cheque_status}
                                onValueChange={(val) => handleChequeStatusChange(entry, val)}
                              >
                                <SelectTrigger className={`h-7 text-xs w-28 mx-auto font-medium ${
                                  entry.cheque_status === 'PENDING' ? 'border-amber-300 text-amber-700 bg-amber-50' :
                                  entry.cheque_status === 'CLEARED' ? 'border-emerald-300 text-emerald-700 bg-emerald-50' :
                                  entry.cheque_status === 'BOUNCED' ? 'border-red-300 text-red-700 bg-red-50' :
                                  'border-orange-300 text-orange-700 bg-orange-50'
                                }`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PENDING">Pending</SelectItem>
                                  <SelectItem value="CLEARED">Cleared</SelectItem>
                                  <SelectItem value="BOUNCED">Bounced</SelectItem>
                                  <SelectItem value="RETURNED">Returned</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
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
      </>)}

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ open, type: '', entry: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog.type === 'approve' ? (
                <><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Approve Entry</>
              ) : (
                <><XCircle className="w-5 h-5 text-red-600" /> Reject Entry</>
              )}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.type === 'approve'
                ? 'Are you sure you want to approve this entry?'
                : 'Are you sure you want to reject this entry?'}
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.entry && (
            <div className="mt-2 p-3 bg-slate-50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Module:</span>
                <span>{getModuleBadge(confirmDialog.entry.source)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Site:</span>
                <span className="font-medium">{confirmDialog.entry.site_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium">{fmtDate(confirmDialog.entry.date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Entry:</span>
                <span className="font-medium text-right max-w-60">{confirmDialog.entry.entry_label}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount:</span>
                {getAmountDisplay(confirmDialog.entry)}
              </div>
              {confirmDialog.entry.voucher_url && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Voucher:</span>
                  <a href={confirmDialog.entry.voucher_url} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> View Voucher
                  </a>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, type: '', entry: null })}>Cancel</Button>
            <Button
              onClick={() => confirmDialog.type === 'approve' ? handleApprove(confirmDialog.entry) : handleReject(confirmDialog.entry)}
              disabled={submitting}
              className={confirmDialog.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : confirmDialog.type === 'approve' ? (
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
              ) : (
                <XCircle className="w-4 h-4 mr-1.5" />
              )}
              {confirmDialog.type === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ open, entry: null })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-slate-600" />
              Entry Details
            </DialogTitle>
          </DialogHeader>

          {detailDialog.entry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Module</p>
                  <div>{getModuleBadge(detailDialog.entry.source)}</div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Site</p>
                  <p className="text-sm font-medium">{detailDialog.entry.site_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Date</p>
                  <p className="text-sm font-medium">{fmtDate(detailDialog.entry.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Amount</p>
                  <div>{getAmountDisplay(detailDialog.entry)}</div>
                </div>
                {(() => {
                  const { from: dFrom, type: dType } = getEntryFromType(detailDialog.entry);
                  return (<>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">From</p>
                      {dFrom ? <Badge variant="outline" className={`text-[10px] font-medium ${MODE_COLORS[dFrom] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{dFrom}</Badge> : <p className="text-sm">—</p>}
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Type</p>
                      {dType ? <Badge variant="outline" className={`text-[10px] font-medium ${MODE_COLORS[dType] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{dType}</Badge> : <p className="text-sm">—</p>}
                    </div>
                  </>);
                })()}
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Entry</p>
                  <p className="text-sm font-medium">{detailDialog.entry.entry_label}</p>
                  {detailDialog.entry.booked_by && (
                    <p className="text-xs text-slate-400">Booked by - {detailDialog.entry.booked_by}</p>
                  )}
                </div>
                {detailDialog.entry.created_by_name && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Created By</p>
                    <p className="text-sm font-medium">{detailDialog.entry.created_by_name}</p>
                  </div>
                )}
                {detailDialog.entry.voucher_url && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Voucher</p>
                    <a href={detailDialog.entry.voucher_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" /> View Voucher
                    </a>
                  </div>
                )}
              </div>

              <Separator />

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDetailDialog({ open: false, entry: null })}>Close</Button>
                {canActOnEntry(detailDialog.entry) ? (
                  <>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => { setDetailDialog({ open: false, entry: null }); setConfirmDialog({ open: true, type: 'approve', entry: detailDialog.entry }); }}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive"
                      onClick={() => { setDetailDialog({ open: false, entry: null }); setConfirmDialog({ open: true, type: 'reject', entry: detailDialog.entry }); }}>
                      <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 italic mr-1">Assigned to another admin</span>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

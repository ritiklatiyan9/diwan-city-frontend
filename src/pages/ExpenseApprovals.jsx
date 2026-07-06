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
  ArrowUpRight, ArrowDownRight, Eye, CreditCard, RefreshCw, ExternalLink,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';

// ── Constants ──
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
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
};

// ── Helper: Local Date ──
const toLocal = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const ExpenseApprovals = () => {
  const { sites, currentSite, setCurrentSite, isAdmin, hasPermission } = useAuth();
  const canApprove = isAdmin || hasPermission('expense_approval', 'read');

  // ── State ──
  const [expenses, setExpenses] = useState([]);
  const [statusCounts, setStatusCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: '', expense: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, expense: null });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSite, setFilterSite] = useState('all');
  const [filterDate, setFilterDate] = useState(null);
  const [filterDateRange, setFilterDateRange] = useState({ from: null, to: null });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterMode, setFilterMode] = useState('single'); // 'single' | 'range'
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  // ── Fetch Expenses by Status ──
  const fetchPendingExpenses = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const params = new URLSearchParams();
      params.append('status', statusFilter);
      if (filterSite !== 'all') params.append('site_id', filterSite);

      if (filterMode === 'single' && filterDate) {
        const dateStr = toLocal(filterDate);
        params.append('date_from', dateStr);
        params.append('date_to', dateStr);
      } else if (filterMode === 'range') {
        if (filterDateRange.from) params.append('date_from', toLocal(filterDateRange.from));
        if (filterDateRange.to) params.append('date_to', toLocal(filterDateRange.to));
      }

      const [pendingRes, countsRes] = await Promise.all([
        api.get(`/expenses/pending?${params.toString()}`),
        api.get(`/expenses/status-counts${filterSite !== 'all' ? `?site_id=${filterSite}` : ''}`),
      ]);

      setExpenses(pendingRes.data.expenses || []);
      setStatusCounts(countsRes.data || { pending: 0, approved: 0, rejected: 0 });
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
      setMessage({ type: 'error', text: 'Failed to load expenses' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterSite, filterDate, filterDateRange, filterMode, statusFilter]);

  useEffect(() => {
    if (canApprove) {
      fetchPendingExpenses();
    }
  }, [fetchPendingExpenses, canApprove]);

  // ── Filtering on client side ──
  const filteredExpenses = useMemo(() => {
    let list = expenses;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e =>
        e.from_entity?.toLowerCase().includes(q) ||
        e.to_entity?.toLowerCase().includes(q) ||
        e.remark?.toLowerCase().includes(q) ||
        e.site_name?.toLowerCase().includes(q) ||
        e.created_by_name?.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const da = new Date(a.date || 0).getTime();
      const db = new Date(b.date || 0).getTime();
      return sortOrder === 'asc' ? da - db : db - da;
    });
    return list;
  }, [expenses, searchQuery, sortOrder]);

  // ── Totals (exclude rejected items) ──
  const totals = useMemo(() => {
    let debit = 0, credit = 0;
    filteredExpenses.forEach(e => {
      if (e.status === 'rejected') return;
      debit += parseFloat(e.debit) || 0;
      credit += parseFloat(e.credit) || 0;
    });
    return { debit, credit };
  }, [filteredExpenses]);

  // ── Handlers ──
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(filteredExpenses.map(e => ({ id: e.id, source: e.source })));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (exp, checked) => {
    if (checked) {
      setSelectedIds([...selectedIds, { id: exp.id, source: exp.source }]);
    } else {
      setSelectedIds(selectedIds.filter(item => !(item.id === exp.id && item.source === exp.source)));
    }
  };

  const isSelected = (exp) => {
    return selectedIds.some(item => item.id === exp.id && item.source === exp.source);
  };

  const handleApprove = async (expense) => {
    try {
      setSubmitting(true);
      const sourceParam =
        (expense.source === 'daybook' || expense.source === 'farmer_payment' || expense.source === 'commission')
          ? '?source=daybook'
          : expense.source === 'vendor_payment'
            ? '?source=vendor_payment'
            : '';
      await api.put(`/expenses/${expense.id}/approve${sourceParam}`);
      setMessage({ type: 'success', text: 'Expense approved successfully' });
      await fetchPendingExpenses(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to approve expense' });
    } finally {
      setSubmitting(false);
      setConfirmDialog({ open: false, type: '', expense: null });
    }
  };

  const handleReject = async (expense) => {
    try {
      setSubmitting(true);
      const sourceParam =
        (expense.source === 'daybook' || expense.source === 'farmer_payment' || expense.source === 'commission')
          ? '?source=daybook'
          : expense.source === 'vendor_payment'
            ? '?source=vendor_payment'
            : '';
      await api.put(`/expenses/${expense.id}/reject${sourceParam}`);
      setMessage({ type: 'success', text: 'Expense rejected' });
      await fetchPendingExpenses(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to reject expense' });
    } finally {
      setSubmitting(false);
      setConfirmDialog({ open: false, type: '', expense: null });
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      setSubmitting(true);
      await api.post('/expenses/bulk-approve', { items: selectedIds });
      setMessage({ type: 'success', text: `${selectedIds.length} expense(s) approved successfully` });
      await fetchPendingExpenses(true);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Bulk approval failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterSite('all');
    setFilterDate(null);
    setFilterDateRange({ from: null, to: null });
    setFilterMode('single');
  };

  // ── Helpers ──
  const fmt = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getModeBadge = (mode) => {
    if (!mode) return null;
    const cls = MODE_COLORS[mode] || 'bg-slate-50 text-slate-600 border-slate-200';
    return <Badge variant="outline" className={`text-[10px] font-medium ${cls}`}>{mode}</Badge>;
  };

  const BANK_MODES = ['BANK', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'CHEQUE', 'TRANSFER'];
  const getPaymentType = (mode) => {
    if (!mode) return null;
    const upper = mode.toUpperCase();
    if (upper === 'CASH') return 'CASH';
    if (BANK_MODES.includes(upper)) return 'BANK';
    return null;
  };

  const hasActiveFilters = filterSite !== 'all' || filterDate || filterDateRange.from || filterDateRange.to || searchQuery;

  // ── Guard ──
  if (!canApprove) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-10 h-10 text-red-300 mb-3" />
        <p className="text-sm text-slate-500">Access required</p>
        <p className="text-xs text-slate-400 mt-0.5">You do not have permission to approve expenses</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  MAIN VIEW
  // ═══════════════════════════════════════════════════
  return (
    <div className="max-w-350 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Expense Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {statusFilter === 'pending' ? 'Review and approve pending expense requests' : `Viewing ${statusFilter} expenses`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPendingExpenses(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {statusFilter === 'pending' && selectedIds.length > 0 && (
            <Button
              size="sm"
              onClick={handleBulkApprove}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Approve Selected ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
          <button className="ml-auto" onClick={() => setMessage({ type: '', text: '' })}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Summary Cards - Clickable Filters */}
      <div className="grid grid-cols-4 gap-4">
        <Card
          className={`shadow-none cursor-pointer transition-all ${statusFilter === 'pending' ? 'ring-2 ring-amber-500 border-amber-300' : 'border-slate-200 hover:border-amber-200'}`}
          onClick={() => setStatusFilter('pending')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Pending</p>
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-2">{statusCounts.pending}</p>
            <p className="text-[10px] text-slate-400 mt-1">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-none cursor-pointer transition-all ${statusFilter === 'approved' ? 'ring-2 ring-emerald-500 border-emerald-300' : 'border-slate-200 hover:border-emerald-200'}`}
          onClick={() => setStatusFilter('approved')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Approved</p>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-2">{statusCounts.approved}</p>
            <p className="text-[10px] text-slate-400 mt-1">Total approved</p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-none cursor-pointer transition-all ${statusFilter === 'rejected' ? 'ring-2 ring-red-500 border-red-300' : 'border-slate-200 hover:border-red-200'}`}
          onClick={() => setStatusFilter('rejected')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Rejected</p>
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                <XCircle className="w-3.5 h-3.5 text-red-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600 mt-2">{statusCounts.rejected}</p>
            <p className="text-[10px] text-slate-400 mt-1">Total rejected</p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-none cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-blue-500 border-blue-300' : 'border-slate-200 hover:border-blue-200'}`}
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">All</p>
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-2">{statusCounts.pending + statusCounts.approved + statusCounts.rejected}</p>
            <p className="text-[10px] text-slate-400 mt-1">All expenses</p>
          </CardContent>
        </Card>
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
                {sites.map((site) => (
                  <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Separator orientation="vertical" className="h-6" />

            {/* Date Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setFilterMode('single')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterMode === 'single' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                  }`}
              >
                Single Day
              </button>
              <button
                onClick={() => setFilterMode('range')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterMode === 'range' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
                  }`}
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
                    onSelect={(date) => {
                      setFilterDate(date);
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                  {filterDate && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => {
                          setFilterDate(null);
                          setCalendarOpen(false);
                        }}
                      >
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
                    <Calendar
                      mode="single"
                      selected={filterDateRange.from}
                      onSelect={(date) => setFilterDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
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
                    <Calendar
                      mode="single"
                      selected={filterDateRange.to}
                      onSelect={(date) => setFilterDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <Separator orientation="vertical" className="h-6" />

            {/* Search */}
            <div className="relative flex-1 min-w-45">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search from, to, remark, site, created by..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Sort Order Toggle */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              title={sortOrder === 'desc' ? 'Newest first — click to sort oldest first' : 'Oldest first — click to sort newest first'}
            >
              {sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
              {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
            </Button>

            {/* Apply Filter Button */}
            <Button size="sm" onClick={() => fetchPendingExpenses(true)} className="h-8 text-xs">
              Apply Filter
            </Button>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              {filterSite !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Building2 className="w-3 h-3" />
                  {sites.find(s => String(s.id) === filterSite)?.name || 'Site'}
                  <X className="w-3 h-3 cursor-pointer ml-0.5" onClick={() => setFilterSite('all')} />
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
                Showing {filteredExpenses.length} {statusFilter === 'all' ? 'total' : statusFilter}
                — Debit: <span className="text-red-500 font-medium">₹{fmt(totals.debit)}</span>
                — Credit: <span className="text-emerald-600 font-medium">₹{fmt(totals.credit)}</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Expenses Table */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 className="w-10 h-10 text-emerald-200 mx-auto mb-3" />
              <p className="text-sm text-slate-600 font-medium">
                {statusFilter === 'pending' ? 'No pending approvals' : `No ${statusFilter} expenses`}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {hasActiveFilters ? 'Try different filters' : statusFilter === 'pending' ? 'All expenses have been reviewed' : 'No expenses found'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-50/80">
                    {statusFilter === 'pending' && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.length === filteredExpenses.length && filteredExpenses.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                    )}
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Date</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Site</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">FROM</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">TO</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20">From</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-20">Type</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">Debit (₹)</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-right w-28">Credit (₹)</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Remark</TableHead>
                    {statusFilter !== 'pending' && (
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24">Status</TableHead>
                    )}
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Created By</TableHead>
                    {statusFilter === 'pending' && (
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center w-36">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((exp) => {
                    const debit = parseFloat(exp.debit) || 0;
                    const credit = parseFloat(exp.credit) || 0;
                    const itemSelected = isSelected(exp);
                    const StatusIcon = STATUS_CONFIG[exp.status]?.icon || Clock;
                    const isRejected = exp.status === 'rejected';

                    return (
                      <TableRow key={`${exp.source}-${exp.id}`} className={`${itemSelected ? 'bg-blue-50/50' : ''} ${isRejected ? 'opacity-60' : ''}`}>
                        {statusFilter === 'pending' && (
                          <TableCell>
                            <Checkbox
                              checked={itemSelected}
                              onCheckedChange={(checked) => handleSelectOne(exp, checked)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="whitespace-nowrap">
                          <span className="text-sm text-slate-700 tabular-nums">{fmtDate(exp.date)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block w-fit">
                              {exp.site_name}
                            </span>
                            {exp.source === 'farmer_payment' && (
                              <span className="text-[9px] text-orange-500 ml-1 font-medium">via Farmer Payment</span>
                            )}
                            {exp.source === 'commission' && (
                              <span className="text-[9px] text-purple-500 ml-1 font-medium">via Commission</span>
                            )}
                            {exp.source === 'daybook' && (
                              <span className="text-[9px] text-slate-400 ml-1">via Day Book</span>
                            )}
                            {exp.source === 'vendor_payment' && (
                              <span className="text-[9px] text-emerald-500 ml-1 font-medium">via Vendor Payment</span>
                            )}
                            {exp.source === 'personal_ledger' && (
                              <span className="text-[9px] text-indigo-500 ml-1 font-medium">via Personal Ledger</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {exp.from_entity ? (
                            <span className="text-sm font-medium text-slate-800">{exp.from_entity}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {exp.to_entity ? (
                            <span className="text-sm font-medium text-slate-800">{exp.to_entity}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {exp.payment_mode ? getModeBadge(exp.payment_mode) : <span className="text-xs text-slate-300">—</span>}
                        </TableCell>
                        <TableCell>
                          {getPaymentType(exp.payment_mode) ? getModeBadge(getPaymentType(exp.payment_mode)) : <span className="text-xs text-slate-300">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {debit > 0 ? (
                            <span className={`text-sm font-semibold tabular-nums ${isRejected ? 'line-through text-slate-400' : 'text-red-600'}`}>{fmt(debit)}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {credit > 0 ? (
                            <span className={`text-sm font-semibold tabular-nums ${isRejected ? 'line-through text-slate-400' : 'text-emerald-700'}`}>{fmt(credit)}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {exp.remark ? (
                              <span className="text-xs text-slate-600 line-clamp-1" title={exp.remark}>
                                {exp.remark}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                            {exp.voucher_url && (
                              <a href={exp.voucher_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-200 w-fit hover:bg-slate-200" title="View Voucher">
                                <ExternalLink className="w-2.5 h-2.5" /> Voucher
                              </a>
                            )}
                          </div>
                        </TableCell>
                        {statusFilter !== 'pending' && (
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] font-medium ${STATUS_CONFIG[exp.status]?.className || ''}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {STATUS_CONFIG[exp.status]?.label || exp.status}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-500">{exp.created_by_name || '—'}</span>
                            {exp.booked_by && (
                              <span className="text-[10px] text-slate-400">Booked by - {exp.booked_by}</span>
                            )}
                          </div>
                        </TableCell>
                        {statusFilter === 'pending' && (
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDetailDialog({ open: true, expense: exp })}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDialog({ open: true, type: 'approve', expense: exp })}
                                className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50"
                                title="Approve"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDialog({ open: true, type: 'reject', expense: exp })}
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                title="Reject"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}

                  {/* Totals Row */}
                  <TableRow className="bg-slate-50 hover:bg-slate-50 border-t-2 border-slate-200">
                    <TableCell colSpan={statusFilter === 'pending' ? 7 : 6} className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Total ({filteredExpenses.length} {statusFilter === 'all' ? 'expenses' : statusFilter})
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-bold text-red-600 tabular-nums">₹{fmt(totals.debit)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-bold text-emerald-700 tabular-nums">₹{fmt(totals.credit)}</span>
                    </TableCell>
                    <TableCell colSpan={statusFilter === 'pending' ? 3 : 2} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ open, type: '', expense: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog.type === 'approve' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Approve Expense
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  Reject Expense
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.type === 'approve'
                ? 'Are you sure you want to approve this expense?'
                : 'Are you sure you want to reject this expense?'}
            </DialogDescription>
          </DialogHeader>

          {confirmDialog.expense && (
            <div className="mt-2 p-3 bg-slate-50 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Site:</span>
                <span className="font-medium">{confirmDialog.expense.site_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium">{fmtDate(confirmDialog.expense.date)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount:</span>
                <span className="font-medium">
                  {parseFloat(confirmDialog.expense.debit) > 0
                    ? <span className="text-red-600">₹{fmt(confirmDialog.expense.debit)} (Debit)</span>
                    : <span className="text-emerald-600">₹{fmt(confirmDialog.expense.credit)} (Credit)</span>
                  }
                </span>
              </div>
              {confirmDialog.expense.remark && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Remark:</span>
                  <span className="font-medium text-right max-w-50">{confirmDialog.expense.remark}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, type: '', expense: null })}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmDialog.type === 'approve'
                ? handleApprove(confirmDialog.expense)
                : handleReject(confirmDialog.expense)
              }
              disabled={submitting}
              className={confirmDialog.type === 'approve'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-600 hover:bg-red-700'
              }
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
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ open, expense: null })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-slate-600" />
              Expense Details
            </DialogTitle>
          </DialogHeader>

          {detailDialog.expense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Site</p>
                  <p className="text-sm font-medium">{detailDialog.expense.site_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Date</p>
                  <p className="text-sm font-medium">{fmtDate(detailDialog.expense.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">From Entity</p>
                  <p className="text-sm font-medium">{detailDialog.expense.from_entity || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">To Entity</p>
                  <p className="text-sm font-medium">{detailDialog.expense.to_entity || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Debit</p>
                  <p className="text-sm font-medium text-red-600">
                    {parseFloat(detailDialog.expense.debit) > 0 ? `₹${fmt(detailDialog.expense.debit)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Credit</p>
                  <p className="text-sm font-medium text-emerald-600">
                    {parseFloat(detailDialog.expense.credit) > 0 ? `₹${fmt(detailDialog.expense.credit)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">From</p>
                  <div>{detailDialog.expense.payment_mode ? getModeBadge(detailDialog.expense.payment_mode) : '—'}</div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Type</p>
                  <div>{getPaymentType(detailDialog.expense.payment_mode) ? getModeBadge(getPaymentType(detailDialog.expense.payment_mode)) : '—'}</div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Category</p>
                  <p className="text-sm font-medium">{detailDialog.expense.category || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Account No</p>
                  <p className="text-sm font-mono">{detailDialog.expense.account_no || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Branch</p>
                  <p className="text-sm font-medium">{detailDialog.expense.branch || '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Remark</p>
                  <p className="text-sm">{detailDialog.expense.remark || '—'}</p>
                </div>
                {detailDialog.expense.voucher_url && (
                  <div className="col-span-2 pt-2 border-t">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Attached Voucher</p>
                    <a href={detailDialog.expense.voucher_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md border border-blue-100 hover:bg-blue-100 transition-colors">
                      <ExternalLink className="w-4 h-4" /> View Voucher Document
                    </a>
                  </div>
                )}
                <div className="col-span-2 pt-2 border-t">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Created By</p>
                  <p className="text-sm font-medium">{detailDialog.expense.created_by_name || '—'}</p>
                </div>
                {detailDialog.expense.booked_by && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Booked By</p>
                    <p className="text-sm font-medium">{detailDialog.expense.booked_by}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailDialog({ open: false, expense: null })}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setDetailDialog({ open: false, expense: null });
                    setConfirmDialog({ open: true, type: 'approve', expense: detailDialog.expense });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDetailDialog({ open: false, expense: null });
                    setConfirmDialog({ open: true, type: 'reject', expense: detailDialog.expense });
                  }}
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  Reject
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExpenseApprovals;

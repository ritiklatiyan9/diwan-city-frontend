import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import UserAvatar from '../components/UserAvatar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Separator } from '../components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '../components/ui/tabs';
import {
  Plus, AlertCircle, Search, Loader2, IndianRupee, Wallet,
  Users, ArrowUpRight, ArrowDownRight, Check, X, RefreshCw,
  Send, Eye, Clock, CheckCircle2, XCircle, Banknote, Settings2, Undo2,
} from 'lucide-react';

// ── Helpers ──
const toLocal = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};
const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(num);
};

const STATUS_CONFIG = {
  PENDING_RECEIPT: { label: 'Pending Receipt', icon: Clock, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  RECEIVED: { label: 'Received', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', icon: XCircle, className: 'bg-red-50 text-red-700 border-red-200' },
  PENDING: { label: 'Pending', icon: Clock, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Approved', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejected', icon: XCircle, className: 'bg-red-50 text-red-700 border-red-200' },
  ACCEPTED: { label: 'Accepted', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const ImprestManagement = () => {
  const { currentSite, user, isAdmin, hasPermission, canManage } = useAuth();
  const canWrite  = canManage && hasPermission('imprest', 'write');
  const canUpdate = canManage && hasPermission('imprest', 'update');
  const canDelete = canManage && hasPermission('imprest', 'delete');

  // ── State ──
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const [balances, setBalances] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [expenseRequests, setExpenseRequests] = useState([]);
  const [subAdmins, setSubAdmins] = useState([]);
  const [approvers, setApprovers] = useState([]);

  // Returns
  const [returns, setReturns] = useState([]);

  // Modals
  const [allocateModal, setAllocateModal] = useState(false);
  const [adjustModal, setAdjustModal] = useState(false);
  const [detailModal, setDetailModal] = useState({ open: false, request: null });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: '', item: null });
  const [returnConfirmDialog, setReturnConfirmDialog] = useState({ open: false, type: '', item: null, remark: '' });

  // Allocation form
  const [allocForm, setAllocForm] = useState({
    sub_admin_id: '', amount: '', remark: '', date: toLocal(new Date()),
    assigned_admin_id: '',
  });

  // Adjustment form
  const [adjustForm, setAdjustForm] = useState({
    user_id: '', amount: '', remarks: '',
  });

  // ── Data loading ──
  const loadData = useCallback(async () => {
    if (!currentSite?.id) return;
    setLoading(true);
    try {
      const siteParam = { site_id: currentSite.id };
      const [balRes, allocRes, reqRes, saRes, appRes, retRes] = await Promise.all([
        api.get('/imprest/all-balances', { params: siteParam }),
        api.get('/imprest/allocations', { params: siteParam }),
        api.get('/imprest/expense-requests', { params: siteParam }),
        api.get('/admin/sub-admins'),
        api.get(`/admin/approvers?site_id=${currentSite.id}`).catch(() => ({ data: { approvers: [] } })),
        api.get('/imprest/returns', { params: siteParam }).catch(() => ({ data: { returns: [] } })),
      ]);
      setBalances(balRes.data.balances || []);
      setAllocations(allocRes.data.allocations || []);
      setExpenseRequests(reqRes.data.requests || []);
      setSubAdmins(saRes.data.subAdmins || []);
      setApprovers(appRes.data.approvers || []);
      setReturns(retRes.data.returns || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }, [currentSite?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Auto-dismiss messages ──
  useEffect(() => {
    if (message.text) {
      const t = setTimeout(() => setMessage({ type: '', text: '' }), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  // ── Summary stats ──
  const stats = useMemo(() => {
    const totalAllocated = balances.reduce((s, b) => s + (parseFloat(b.balance) > 0 ? parseFloat(b.balance) : 0), 0);
    const totalOverdraft = balances.reduce((s, b) => s + (parseFloat(b.balance) < 0 ? Math.abs(parseFloat(b.balance)) : 0), 0);
    const pendingAllocations = allocations.filter(a => a.status === 'PENDING_RECEIPT').length;
    const pendingRequests = expenseRequests.filter(r => r.status === 'PENDING').length;
    const pendingReturns = returns.filter(r => r.status === 'PENDING').length;
    return { totalAllocated, totalOverdraft, pendingAllocations, pendingRequests, pendingReturns };
  }, [balances, allocations, expenseRequests, returns]);

  // ── Allocate Imprest ──
  const handleAllocate = async () => {
    if (!allocForm.sub_admin_id || !allocForm.amount) {
      setMessage({ type: 'error', text: 'Sub-admin and amount are required' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/imprest/allocations', {
        ...allocForm,
        date: isAdmin ? (allocForm.date || toLocal(new Date())) : toLocal(new Date()),
        site_id: currentSite?.id,
      });
      setMessage({ type: 'success', text: 'Imprest allocated successfully' });
      setAllocateModal(false);
      setAllocForm({ sub_admin_id: '', amount: '', remark: '', date: toLocal(new Date()), assigned_admin_id: '' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to allocate' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Adjust Balance ──
  const handleAdjust = async () => {
    if (!adjustForm.user_id || adjustForm.amount === '') {
      setMessage({ type: 'error', text: 'User and amount are required' });
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/imprest/adjust', {
        ...adjustForm,
        site_id: currentSite?.id,
      });
      setMessage({ type: 'success', text: 'Balance adjusted successfully' });
      setAdjustModal(false);
      setAdjustForm({ user_id: '', amount: '', remarks: '' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to adjust' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Cancel Allocation ──
  const handleCancelAllocation = async (id) => {
    try {
      await api.delete(`/imprest/allocations/${id}`);
      setMessage({ type: 'success', text: 'Allocation cancelled' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to cancel' });
    }
  };

  // ── Approve/Reject Expense Request ──
  const handleExpenseRequestAction = async (id, action) => {
    setSubmitting(true);
    try {
      await api.put(`/imprest/expense-requests/${id}/${action}`, {
        review_remark: confirmDialog.remark || '',
      });
      setMessage({ type: 'success', text: `Request ${action}d successfully` });
      setConfirmDialog({ open: false, type: '', item: null });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || `Failed to ${action}` });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Accept / Reject Return ──
  const handleReturnAction = async (id, action) => {
    setSubmitting(true);
    try {
      await api.put(`/imprest/returns/${id}/${action}`, {
        review_remark: returnConfirmDialog.remark || '',
      });
      setMessage({ type: 'success', text: `Return ${action === 'accept' ? 'accepted' : 'rejected'} successfully` });
      setReturnConfirmDialog({ open: false, type: '', item: null, remark: '' });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || `Failed to ${action} return` });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Filtered data ──
  const filteredBalances = useMemo(() => {
    if (!searchQuery) return balances;
    const q = searchQuery.toLowerCase();
    return balances.filter(b => b.name?.toLowerCase().includes(q) || b.email?.toLowerCase().includes(q));
  }, [balances, searchQuery]);

  const filteredAllocations = useMemo(() => {
    if (!searchQuery) return allocations;
    const q = searchQuery.toLowerCase();
    return allocations.filter(a =>
      a.sub_admin_name?.toLowerCase().includes(q) || a.remark?.toLowerCase().includes(q)
    );
  }, [allocations, searchQuery]);

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`${cfg.className} text-[11px] font-medium gap-1`}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </Badge>
    );
  };

  // No site picked yet — avoid loading indefinitely or showing cross-site data.
  if (!currentSite?.id) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
          <Banknote className="w-6 h-6 text-slate-400" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Select a site</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Pick a site from the sidebar to manage imprest allocations, requests and returns for that site.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Imprest Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {currentSite?.name ? (
              <>
                Petty cash allocations for <span className="font-medium text-slate-700">{currentSite.name}</span>
              </>
            ) : (
              'Manage petty cash allocations to sub-admins'
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAdjustModal(true)} className="gap-1.5">
            <Settings2 className="w-3.5 h-3.5" /> Adjust
          </Button>
          <Button size="sm" onClick={() => setAllocateModal(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Allocate Imprest
          </Button>
        </div>
      </div>

      {/* ── Message ── */}
      {message.text && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
          message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50 to-indigo-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Outstanding</span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-blue-900 tabular-nums">{formatCurrency(stats.totalAllocated)}</p>
          <p className="text-[11px] text-blue-400 mt-1">{balances.length} sub-admin{balances.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="rounded-2xl border border-red-100 bg-linear-to-br from-red-50 to-rose-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Overdraft</span>
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-red-700 tabular-nums">{formatCurrency(stats.totalOverdraft)}</p>
          <p className="text-[11px] text-red-400 mt-1">{balances.filter(b => parseFloat(b.balance) < 0).length} account{balances.filter(b => parseFloat(b.balance) < 0).length !== 1 ? 's' : ''}</p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-linear-to-br from-amber-50 to-yellow-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">Pending Receipts</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-amber-800 tabular-nums">{stats.pendingAllocations}</p>
          <p className="text-[11px] text-amber-400 mt-1">awaiting confirmation</p>
        </div>

        <button
          onClick={() => stats.pendingRequests > 0 && setActiveTab('requests')}
          className={`rounded-2xl border p-4 text-left transition-all ${
            stats.pendingRequests > 0
              ? 'border-violet-200 bg-linear-to-br from-violet-50 to-purple-50 hover:shadow-md cursor-pointer'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">Pending Requests</span>
            <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
              <Send className="w-4 h-4 text-violet-600" />
            </div>
          </div>
          <p className={`text-xl font-bold tabular-nums ${stats.pendingRequests > 0 ? 'text-violet-700' : 'text-slate-900'}`}>
            {stats.pendingRequests}
          </p>
          <p className="text-[11px] text-violet-400 mt-1">{stats.pendingRequests > 0 ? 'tap to review' : 'no pending'}</p>
        </button>
      </div>

      {/* ── Pending requests alert banner ── */}
      {stats.pendingRequests > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50 border border-violet-200">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-violet-800">
              {stats.pendingRequests} imprest request{stats.pendingRequests !== 1 ? 's' : ''} awaiting your approval
            </p>
            <p className="text-xs text-violet-500 mt-0.5">Sub-admins are waiting for funds to continue their work</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveTab('requests')}
            className="border-violet-300 text-violet-700 hover:bg-violet-100 shrink-0"
          >
            Review Now
          </Button>
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Sub-Admin Balances</TabsTrigger>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
          <TabsTrigger value="requests">
            Expense Requests
            {stats.pendingRequests > 0 && (
              <Badge className="ml-1.5 bg-red-100 text-red-700 text-[10px] px-1.5">{stats.pendingRequests}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="returns">
            Returns
            {stats.pendingReturns > 0 && (
              <Badge className="ml-1.5 bg-purple-100 text-purple-700 text-[10px] px-1.5">{stats.pendingReturns}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Search ── */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* ── Tab: Overview ── */}
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 350px)', WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                    <tr>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sticky left-0 z-40 bg-slate-50 px-3 py-2 text-left" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>Sub-Admin</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Email</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Balance</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Transactions</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Last Activity</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBalances.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-sm text-slate-400">
                          No sub-admins found
                        </td>
                      </tr>
                    ) : (
                      filteredBalances.map((b) => (
                        <tr key={b.user_id} className="border-b hover:bg-slate-50/50" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}>
                          <td className="font-medium text-sm sticky left-0 z-10 bg-white px-3 py-2" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>{b.name}</td>
                          <td className="text-sm text-slate-500 px-3 py-2">{b.email}</td>
                          <td className={`text-right font-semibold text-sm px-3 py-2 ${parseFloat(b.balance) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(b.balance)}
                          </td>
                          <td className="text-right text-sm text-slate-500 px-3 py-2">{b.total_transactions}</td>
                          <td className="text-xs text-slate-400 px-3 py-2">
                            {b.last_transaction_at ? fmtDate(b.last_transaction_at) : '—'}
                          </td>
                          <td className="text-right px-3 py-2">
                            <Button
                              variant="outline" size="sm"
                              onClick={() => {
                                setAllocForm(f => ({ ...f, sub_admin_id: String(b.user_id) }));
                                setAllocateModal(true);
                              }}
                              className="gap-1 text-xs h-7"
                            >
                              <Plus className="w-3 h-3" /> Allocate
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Allocations ── */}
        <TabsContent value="allocations" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 350px)', WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                    <tr>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24 sticky left-0 z-40 bg-slate-50 px-3 py-2 text-left">Date</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 sticky left-24 z-40 bg-slate-50 px-3 py-2 text-left" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>Sub-Admin</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Amount</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Remark</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Assigned To</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Status</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Confirmed At</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Created By</th>
                      <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllocations.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-sm text-slate-400">
                          No allocations yet
                        </td>
                      </tr>
                    ) : (
                      filteredAllocations.map((a) => (
                        <tr key={a.id} className="border-b hover:bg-slate-50/50" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}>
                          <td className="text-sm sticky left-0 z-10 bg-white px-3 py-2">{fmtDate(a.created_at)}</td>
                          <td className="font-medium text-sm sticky left-24 z-10 bg-white px-3 py-2" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>{a.sub_admin_name}</td>
                          <td className="text-right font-semibold text-sm text-emerald-600 px-3 py-2">
                            {formatCurrency(a.amount)}
                          </td>
                          <td className="text-sm text-slate-500 max-w-[200px] truncate px-3 py-2">{a.remark || '—'}</td>
                          <td className="px-3 py-2">
                            {a.assigned_admin_name ? (
                              <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                                {a.assigned_admin_name}
                              </Badge>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                          <td className="text-xs text-slate-400 px-3 py-2">
                            {a.confirmed_at ? fmtDate(a.confirmed_at) : '—'}
                          </td>
                          <td className="text-xs text-slate-600 px-3 py-2">
                            <UserAvatar name={a.admin_name} label="Created by" />
                          </td>
                          <td className="text-right px-3 py-2">
                            {a.status === 'PENDING_RECEIPT' && (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => handleCancelAllocation(a.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 text-xs"
                              >
                                <X className="w-3 h-3 mr-1" /> Cancel
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Expense Requests (Overdraft) ── */}
        <TabsContent value="requests" className="mt-4">
          {expenseRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center">
                <Send className="w-6 h-6 text-violet-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">No expense requests</p>
                <p className="text-xs text-slate-400 mt-0.5">Sub-admin imprest requests will appear here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {expenseRequests.map((r) => {
                const data = typeof r.expense_data === 'string' ? JSON.parse(r.expense_data) : r.expense_data;
                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                const CfgIcon = cfg.icon;
                const isPending = r.status === 'PENDING';
                return (
                  <div key={r.id} className={`rounded-xl border bg-white px-4 py-4 transition-colors hover:bg-slate-50/60 ${isPending ? 'border-violet-200' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isPending ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-200'}`}>
                        <Send className={`w-4.5 h-4.5 ${isPending ? 'text-violet-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{r.sub_admin_name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{r.site_name} · {fmtDate(r.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <span className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(r.amount)}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.className}`}>
                              <CfgIcon className="w-3 h-3" /> {cfg.label}
                            </span>
                          </div>
                        </div>
                        {(r.reason || data?.remark) && (
                          <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 italic">
                            {r.reason || data?.remark}
                          </p>
                        )}
                        {r.assigned_admin_name && (
                          <div className="mt-1.5">
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 font-medium">
                              Assigned: {r.assigned_admin_name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {isPending && (
                      <div className="flex items-center gap-2 mt-3 ml-13 pl-0.5">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setDetailModal({ open: true, request: r })}
                          className="h-7 text-xs gap-1"
                        >
                          <Eye className="w-3 h-3" /> Details
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setConfirmDialog({ open: true, type: 'approve', item: r })}
                          className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs gap-1"
                        >
                          <Check className="w-3 h-3" /> Approve
                        </Button>
                        <Button
                          variant="destructive" size="sm"
                          onClick={() => setConfirmDialog({ open: true, type: 'reject', item: r })}
                          className="h-7 text-xs gap-1"
                        >
                          <X className="w-3 h-3" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
        {/* ── Tab: Returns ── */}
        <TabsContent value="returns" className="mt-4">
          {returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center">
                <Undo2 className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">No return requests</p>
                <p className="text-xs text-slate-400 mt-0.5">Sub-admin return requests will appear here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {returns.map((r) => {
                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING;
                const CfgIcon = cfg.icon;
                const isPending = r.status === 'PENDING';
                return (
                  <div key={r.id} className={`rounded-xl border bg-white px-4 py-4 transition-colors hover:bg-slate-50/60 ${isPending ? 'border-purple-200' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isPending ? 'bg-purple-50 border-purple-200' : 'bg-slate-50 border-slate-200'}`}>
                        <Undo2 className={`w-4.5 h-4.5 ${isPending ? 'text-purple-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{r.sub_admin_name || '—'}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(r.created_at)}{r.payment_mode ? ` · ${r.payment_mode}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <span className="text-base font-bold text-purple-700 tabular-nums">{formatCurrency(r.amount)}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.className}`}>
                              <CfgIcon className="w-3 h-3" /> {cfg.label}
                            </span>
                          </div>
                        </div>
                        {r.reason && (
                          <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 italic">{r.reason}</p>
                        )}
                        {!isPending && r.review_remark && (
                          <p className="text-xs text-slate-400 mt-1.5">Admin: {r.review_remark}</p>
                        )}
                      </div>
                    </div>
                    {isPending && (
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => setReturnConfirmDialog({ open: true, type: 'accept', item: r, remark: '' })}
                          className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs gap-1"
                        >
                          <Check className="w-3 h-3" /> Accept Return
                        </Button>
                        <Button
                          variant="destructive" size="sm"
                          onClick={() => setReturnConfirmDialog({ open: true, type: 'reject', item: r, remark: '' })}
                          className="h-7 text-xs gap-1"
                        >
                          <X className="w-3 h-3" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════
           MODAL: Allocate Imprest
         ═══════════════════════════════════════════════ */}
      <Dialog open={allocateModal} onOpenChange={setAllocateModal}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Banknote className="w-5 h-5" /> Allocate Imprest</DialogTitle>
            <DialogDescription>Allocate petty cash to a sub-admin</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Sub-Admin *</Label>
              <Select value={allocForm.sub_admin_id} onValueChange={(v) => setAllocForm(f => ({ ...f, sub_admin_id: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select sub-admin" />
                </SelectTrigger>
                <SelectContent>
                  {subAdmins.map((sa) => (
                    <SelectItem key={sa.id} value={String(sa.id)} className="text-sm">
                      {sa.name} ({sa.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={allocForm.amount}
                  onChange={(e) => setAllocForm(f => ({ ...f, amount: e.target.value }))}
                  className="h-9 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isAdmin ? 'Date' : 'Date (Auto)'}</Label>
                <Input
                  type="date"
                  value={isAdmin ? allocForm.date : toLocal(new Date())}
                  onChange={isAdmin ? ((e) => setAllocForm(f => ({ ...f, date: e.target.value }))) : undefined}
                  readOnly={!isAdmin}
                  disabled={!isAdmin}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Remark</Label>
              <Textarea
                value={allocForm.remark}
                onChange={(e) => setAllocForm(f => ({ ...f, remark: e.target.value }))}
                placeholder="e.g. Monthly petty cash"
                className="text-sm resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Assign To Admin</Label>
              <Select
                value={allocForm.assigned_admin_id || "none"}
                onValueChange={(val) => setAllocForm(f => ({ ...f, assigned_admin_id: val === "none" ? "" : val }))}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select Admin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Auto-assign</SelectItem>
                  {approvers.map((admin) => (
                    <SelectItem key={admin.id} value={String(admin.id)}>
                      {admin.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateModal(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleAllocate} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Allocate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
           MODAL: Adjust Balance
         ═══════════════════════════════════════════════ */}
      <Dialog open={adjustModal} onOpenChange={setAdjustModal}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 className="w-5 h-5" /> Adjust Imprest Balance</DialogTitle>
            <DialogDescription>Manually adjust a sub-admin's imprest balance (use negative for deduction)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Sub-Admin *</Label>
              <Select value={adjustForm.user_id} onValueChange={(v) => setAdjustForm(f => ({ ...f, user_id: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select sub-admin" />
                </SelectTrigger>
                <SelectContent>
                  {subAdmins.map((sa) => (
                    <SelectItem key={sa.id} value={String(sa.id)} className="text-sm">
                      {sa.name} ({sa.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                value={adjustForm.amount}
                onChange={(e) => setAdjustForm(f => ({ ...f, amount: e.target.value }))}
                className="h-9 text-sm"
                placeholder="Positive to add, negative to deduct"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Remarks</Label>
              <Textarea
                value={adjustForm.remarks}
                onChange={(e) => setAdjustForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="Reason for adjustment"
                className="text-sm resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModal(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Adjust
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
           MODAL: Request Detail
         ═══════════════════════════════════════════════ */}
      <Dialog open={detailModal.open} onOpenChange={(v) => setDetailModal({ open: v, request: null })}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Expense Request Detail</DialogTitle>
          </DialogHeader>
          {detailModal.request && (() => {
            const r = detailModal.request;
            const data = typeof r.expense_data === 'string' ? JSON.parse(r.expense_data) : r.expense_data;
            return (
              <div className="space-y-3 py-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-slate-400">Sub-Admin:</span> <span className="font-medium">{r.sub_admin_name}</span></div>
                  <div><span className="text-slate-400">Site:</span> <span className="font-medium">{r.site_name}</span></div>
                  <div><span className="text-slate-400">Amount:</span> <span className="font-semibold text-slate-900">{formatCurrency(r.amount)}</span></div>
                  <div><span className="text-slate-400">Date:</span> <span>{fmtDate(data?.date)}</span></div>
                  <div><span className="text-slate-400">Category:</span> <span>{data?.category || '—'}</span></div>
                  <div><span className="text-slate-400">Payment Mode:</span> <span>{data?.payment_mode || '—'}</span></div>
                  <div><span className="text-slate-400">To:</span> <span>{data?.to_entity || '—'}</span></div>
                  <div><span className="text-slate-400">From:</span> <span>{data?.from_entity || '—'}</span></div>
                </div>
                <Separator />
                <div><span className="text-slate-400">Reason:</span> <span>{r.reason || '—'}</span></div>
                <div><span className="text-slate-400">Remark:</span> <span>{data?.remark || '—'}</span></div>
              </div>
            );
          })()}
          <DialogFooter>
            {detailModal.request?.status === 'PENDING' && (
              <>
                <Button
                  onClick={() => {
                    setDetailModal({ open: false, request: null });
                    setConfirmDialog({ open: true, type: 'approve', item: detailModal.request });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                >
                  <Check className="w-4 h-4" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDetailModal({ open: false, request: null });
                    setConfirmDialog({ open: true, type: 'reject', item: detailModal.request });
                  }}
                  className="gap-1"
                >
                  <X className="w-4 h-4" /> Reject
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setDetailModal({ open: false, request: null })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
           MODAL: Confirm Approve/Reject
         ═══════════════════════════════════════════════ */}
      <Dialog open={confirmDialog.open} onOpenChange={(v) => { if (!v) setConfirmDialog({ open: false, type: '', item: null }); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.type === 'approve' ? 'Approve' : 'Reject'} Expense Request
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.type === 'approve'
                ? 'This will create the expense and record a negative imprest balance (overdraft).'
                : 'This will reject the expense request.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {confirmDialog.item && (
              <div className="text-sm">
                <span className="text-slate-400">Amount: </span>
                <span className="font-semibold">{formatCurrency(confirmDialog.item.amount)}</span>
                <span className="text-slate-400 ml-3">by </span>
                <span className="font-medium">{confirmDialog.item.sub_admin_name}</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Remark (optional)</Label>
              <Textarea
                value={confirmDialog.remark || ''}
                onChange={(e) => setConfirmDialog(c => ({ ...c, remark: e.target.value }))}
                placeholder="Add a remark..."
                className="text-sm resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, type: '', item: null })} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className={confirmDialog.type === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              variant={confirmDialog.type === 'reject' ? 'destructive' : 'default'}
              onClick={() => handleExpenseRequestAction(confirmDialog.item.id, confirmDialog.type)}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {confirmDialog.type === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ═══════════════════════════════════════════════
           MODAL: Confirm Accept/Reject Return
         ═══════════════════════════════════════════════ */}
      <Dialog open={returnConfirmDialog.open} onOpenChange={(v) => { if (!v) setReturnConfirmDialog({ open: false, type: '', item: null, remark: '' }); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-purple-600" />
              {returnConfirmDialog.type === 'accept' ? 'Accept' : 'Reject'} Return
            </DialogTitle>
            <DialogDescription>
              {returnConfirmDialog.type === 'accept'
                ? 'Accepting will deduct the amount from the sub-admin\'s imprest balance and record a REFUND ledger entry.'
                : 'This will reject the return request. The sub-admin\'s balance will not change.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {returnConfirmDialog.item && (
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 text-sm space-y-1">
                <div><span className="text-purple-500">Sub-Admin: </span><span className="font-medium">{returnConfirmDialog.item.sub_admin_name}</span></div>
                <div><span className="text-purple-500">Amount: </span><span className="font-semibold text-lg">{formatCurrency(returnConfirmDialog.item.amount)}</span></div>
                <div><span className="text-purple-500">Reason: </span><span>{returnConfirmDialog.item.reason || '—'}</span></div>
                <div><span className="text-purple-500">Payment Mode: </span><span>{returnConfirmDialog.item.payment_mode || 'CASH'}</span></div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Remark (optional)</Label>
              <Textarea
                value={returnConfirmDialog.remark}
                onChange={(e) => setReturnConfirmDialog(c => ({ ...c, remark: e.target.value }))}
                placeholder="Add a remark..."
                className="text-sm resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnConfirmDialog({ open: false, type: '', item: null, remark: '' })} disabled={submitting}>
              Cancel
            </Button>
            <Button
              className={returnConfirmDialog.type === 'accept' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              variant={returnConfirmDialog.type === 'reject' ? 'destructive' : 'default'}
              onClick={() => handleReturnAction(returnConfirmDialog.item.id, returnConfirmDialog.type)}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {returnConfirmDialog.type === 'accept' ? 'Accept Return' : 'Reject Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImprestManagement;

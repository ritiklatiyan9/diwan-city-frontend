import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import UserAvatar from '../components/UserAvatar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  AlertCircle,
  Check,
  IndianRupee,
  Plus,
  Store,
  Wallet,
  Loader2,
  Eye,
  UploadCloud,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Package,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';

const PAYMENT_MODES = ['cash', 'bank', 'upi', 'cheque', 'neft', 'rtgs', 'imps', 'other'];

const CASH_MODES = ['cash'];
const BANK_MODES = ['bank', 'upi', 'cheque', 'neft', 'rtgs', 'imps'];

const MODE_CHIP_COLORS = {
  cash: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  bank: 'bg-blue-50 text-blue-700 border-blue-200',
  upi: 'bg-green-50 text-green-700 border-green-200',
  cheque: 'bg-teal-50 text-teal-700 border-teal-200',
  neft: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  rtgs: 'bg-sky-50 text-sky-700 border-sky-200',
  imps: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  other: 'bg-slate-50 text-slate-600 border-slate-200',
};
const PAGE_LIMIT = 15;
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const emptyCommitmentForm = {
  vendor_member_id: '',
  vendor_name: '',
  head_id: '',
  head_name: '',
  work_title: '',
  start_date: todayISO(),
  due_date: '',
  note: '',
  inventory_items: [{ item_name: '', unit: 'pcs', qty_ordered: '', rate: '', discount_pct: '', discount_amount: '' }],
};

const emptyInvItem = { item_name: '', unit: 'pcs', qty_ordered: '', rate: '', discount_pct: '', discount_amount: '' };

const calcItemAmounts = (item) => {
  const qty = parseFloat(item.qty_ordered) || 0;
  const rate = parseFloat(item.rate) || 0;
  const gross = qty * rate;
  const discPct = parseFloat(item.discount_pct) || 0;
  const discAmt = parseFloat(item.discount_amount) || 0;
  const discTotal = discPct > 0 ? gross * discPct / 100 : discAmt;
  return { gross: Math.round(gross * 100) / 100, net: Math.round((gross - discTotal) * 100) / 100 };
};

const emptyPaymentForm = {
  commitment_id: '',
  payment_date: todayISO(),
  amount: '',
  payment_mode: 'cash',
  reference_no: '',
  note: '',
  voucher_url: '',
  assigned_admin_id: null,
};

const money = (n) => {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

const statusBadgeClass = (status) => {
  if (status === 'closed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'cancelled') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
};

const VendorManagement = () => {
  const navigate = useNavigate();
  const { currentSite, canManage, isAdmin, hasPermission } = useAuth();
  const canWrite  = canManage && hasPermission('vendors', 'write');
  const canUpdate = canManage && hasPermission('vendors', 'update');
  const canDelete = canManage && hasPermission('vendors', 'delete');
  const siteId = currentSite?.id;

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const voucherInputRef = useRef(null);

  const [vendorUsers, setVendorUsers] = useState([]);
  const [heads, setHeads] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [summary, setSummary] = useState({
    total_contracts: 0,
    total_contract_amount: 0,
    total_paid_amount: 0,
    total_remaining_amount: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });

  // Filter states (applied immediately via API)
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search
  const searchTimeout = useRef(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [commitmentDialogOpen, setCommitmentDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [headDialogOpen, setHeadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCommitment, setEditingCommitment] = useState(null);
  const [editForm, setEditForm] = useState({ vendor_name: '', head_id: '', head_name: '', work_title: '', start_date: '', due_date: '', note: '', contract_amount: '', status: 'open' });

  const [commitmentForm, setCommitmentForm] = useState({ ...emptyCommitmentForm });
  const [paymentForm, setPaymentForm] = useState({ ...emptyPaymentForm });
  const [headName, setHeadName] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const displayCommitments = sortOrder === 'asc' ? [...commitments].reverse() : commitments;

  // Debounce query input
  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(searchTimeout.current);
  }, [query]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter]);

  const loadCommitments = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    // Watchdog: never let the loader hang past 15s if a request stalls.
    const watchdog = setTimeout(() => setLoading(false), 15000);
    try {
      const params = {
        site_id: siteId,
        page: currentPage,
        limit: PAGE_LIMIT,
      };
      if (debouncedQuery) params.search = debouncedQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.head_id = categoryFilter;

      const res = await api.get('/vendors/commitments', { params });
      setCommitments(res.data.commitments || []);
      setPagination(res.data.pagination || { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
      setSummary(res.data.summary || {});
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load commitments' });
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  }, [siteId, currentPage, debouncedQuery, statusFilter, categoryFilter]);

  // Background refresh — does NOT toggle the page-wide loader, used after
  // create / update / delete so the dialog can close instantly.
  const refreshCommitments = useCallback(async () => {
    if (!siteId) return;
    try {
      const params = { site_id: siteId, page: currentPage, limit: PAGE_LIMIT };
      if (debouncedQuery) params.search = debouncedQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.head_id = categoryFilter;
      const res = await api.get('/vendors/commitments', { params });
      setCommitments(res.data.commitments || []);
      setPagination(res.data.pagination || { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
      setSummary(res.data.summary || {});
    } catch { /* swallow — keep current data */ }
  }, [siteId, currentPage, debouncedQuery, statusFilter, categoryFilter]);

  const loadStaticData = useCallback(async () => {
    if (!siteId) return;
    try {
      const [usersRes, headsRes, approversRes] = await Promise.all([
        api.get('/vendors/users', { params: { site_id: siteId } }),
        api.get('/vendors/heads', { params: { site_id: siteId } }),
        api.get(`/admin/approvers?site_id=${siteId}`).catch(() => ({ data: { approvers: [] } })),
      ]);
      setVendorUsers(usersRes.data.vendors || []);
      setHeads(headsRes.data.heads || []);
      setApprovers(approversRes.data.approvers || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load page data' });
    }
  }, [siteId]);

  useEffect(() => {
    loadStaticData();
  }, [loadStaticData]);

  useEffect(() => {
    loadCommitments();
  }, [loadCommitments]);

  useEffect(() => {
    if (!message.text) return;
    const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  const openCommitmentDialog = () => {
    setCommitmentForm({ ...emptyCommitmentForm, start_date: todayISO(), inventory_items: [{ ...emptyInvItem }] });
    setCommitmentDialogOpen(true);
  };

  const openEditDialog = (c) => {
    setEditingCommitment(c);
    setEditForm({
      vendor_name: c.vendor_name || '',
      head_id: String(c.head_id || ''),
      head_name: c.head_name || '',
      work_title: c.work_title || '',
      start_date: c.start_date ? c.start_date.split('T')[0] : '',
      due_date: c.due_date ? c.due_date.split('T')[0] : '',
      note: c.note || '',
      contract_amount: c.contract_amount || '',
      status: c.status || 'open',
    });
    setEditDialogOpen(true);
  };

  const handleEditCommitment = async () => {
    if (!editingCommitment || !siteId) return;
    setSubmitting(true);
    try {
      const head = heads.find((h) => String(h.id) === editForm.head_id);
      const { data } = await api.put(`/vendors/commitments/${editingCommitment.id}`, {
        site_id: siteId,
        vendor_name: editForm.vendor_name,
        head_id: editForm.head_id || null,
        head_name: head?.name || editForm.head_name,
        work_title: editForm.work_title,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        note: editForm.note,
        contract_amount: parseFloat(editForm.contract_amount) || 0,
        status: editForm.status,
      });
      // Optimistic in-place update so the dialog can close immediately.
      const updated = data?.commitment;
      if (updated) {
        setCommitments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      }
      setMessage({ type: 'success', text: 'Commitment updated' });
      setEditDialogOpen(false);
      refreshCommitments(); // background reconcile
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update commitment' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCommitment = async (c) => {
    if (!window.confirm(`Delete commitment for "${c.vendor_name}"? This will also delete all its payments.`)) return;
    // Optimistic removal — instant UI feedback.
    const snapshot = commitments;
    setCommitments((prev) => prev.filter((x) => x.id !== c.id));
    try {
      await api.delete(`/vendors/commitments/${c.id}`, { params: { site_id: siteId } });
      setMessage({ type: 'success', text: 'Commitment deleted' });
      refreshCommitments();
    } catch (err) {
      setCommitments(snapshot); // rollback
      setMessage({ type: 'error', text: err.response?.data?.message || 'Delete failed' });
    }
  };

  const openPaymentDialog = (commitment) => {
    setPaymentForm({
      ...emptyPaymentForm,
      commitment_id: String(commitment.id),
      payment_date: todayISO(),
      amount: commitment.remaining_amount > 0 ? String(commitment.remaining_amount) : '',
    });
    if (voucherInputRef.current) voucherInputRef.current.value = '';
    setPaymentDialogOpen(true);
  };

  const handleVoucherUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Invalid file type. Please upload image or PDF.' });
      return;
    }
    setUploadingVoucher(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/single?provider=s3', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPaymentForm((prev) => ({ ...prev, voucher_url: res.data.fileUrl || res.data.url || '' }));
      setMessage({ type: 'success', text: 'Voucher uploaded successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Voucher upload failed' });
    } finally {
      setUploadingVoucher(false);
    }
  };

  const onVendorMemberChange = (memberId) => {
    if (memberId === '_manual') {
      setCommitmentForm((prev) => ({ ...prev, vendor_member_id: '', vendor_name: '' }));
      return;
    }
    const vendor = vendorUsers.find((v) => String(v.id) === memberId);
    setCommitmentForm((prev) => ({
      ...prev,
      vendor_member_id: memberId,
      vendor_name: vendor?.full_name || '',
    }));
  };

  const onHeadChange = (headId) => {
    if (headId === '_manual') {
      setCommitmentForm((prev) => ({ ...prev, head_id: '', head_name: '' }));
      return;
    }
    const head = heads.find((h) => String(h.id) === headId);
    setCommitmentForm((prev) => ({
      ...prev,
      head_id: headId,
      head_name: head?.name || '',
    }));
  };

  const handleCreateHead = async () => {
    if (!siteId) return;
    if (!headName.trim()) {
      setMessage({ type: 'error', text: 'Head name is required' });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/vendors/heads', { site_id: siteId, name: headName.trim() });
      // Optimistic add — close dialog immediately.
      if (data?.head) setHeads((prev) => [...prev, data.head]);
      setMessage({ type: 'success', text: 'Vendor head created' });
      setHeadName('');
      setHeadDialogOpen(false);
      loadStaticData(); // background reconcile
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create head' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCommitment = async () => {
    if (!siteId) return;
    setSubmitting(true);
    try {
      const validItems = commitmentForm.inventory_items
        .filter((it) => it.item_name.trim() && parseFloat(it.qty_ordered) > 0)
        .map((it) => ({ ...it, item_category: commitmentForm.head_name || '' }));
      const totalNet = validItems.reduce((s, it) => s + calcItemAmounts(it).net, 0);
      if (totalNet <= 0) {
        setMessage({ type: 'error', text: 'Add at least one item with qty and rate' });
        setSubmitting(false);
        return;
      }
      await api.post('/vendors/commitments', {
        site_id: siteId,
        vendor_member_id: commitmentForm.vendor_member_id,
        vendor_name: commitmentForm.vendor_name,
        head_id: commitmentForm.head_id,
        head_name: commitmentForm.head_name,
        work_title: commitmentForm.work_title,
        start_date: commitmentForm.start_date || todayISO(),
        due_date: commitmentForm.due_date,
        note: commitmentForm.note,
        contract_amount: totalNet,
        inventory_items: validItems,
      });
      setMessage({ type: 'success', text: 'Vendor commitment created' });
      setCommitmentDialogOpen(false);
      // Refresh in background — the new commitment needs its computed paid /
      // remaining columns from the server, so we re-fetch instead of splicing.
      refreshCommitments();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create commitment' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPayment = async () => {
    if (!siteId || !paymentForm.commitment_id) return;
    setSubmitting(true);
    try {
      await api.post(`/vendors/commitments/${paymentForm.commitment_id}/payments`, {
        site_id: siteId,
        payment_date: paymentForm.payment_date || todayISO(),
        amount: parseFloat(paymentForm.amount) || 0,
        payment_mode: paymentForm.payment_mode,
        reference_no: paymentForm.reference_no,
        cheque_no: paymentForm.payment_mode === 'cheque' ? (paymentForm.reference_no || null) : null,
        note: paymentForm.note,
        voucher_url: paymentForm.voucher_url,
        assigned_admin_id: paymentForm.assigned_admin_id,
      });
      // Optimistic update — bump paid_amount on the commitment locally so the
      // table reflects the new total without waiting for a refetch.
      const paidDelta = parseFloat(paymentForm.amount) || 0;
      const targetId = parseInt(paymentForm.commitment_id);
      if (paidDelta > 0) {
        setCommitments((prev) => prev.map((c) => {
          if (c.id !== targetId) return c;
          const newPaid = (parseFloat(c.paid_amount) || 0) + paidDelta;
          const remaining = (parseFloat(c.contract_amount) || 0) - newPaid;
          return { ...c, paid_amount: newPaid, remaining_amount: remaining, payment_count: (c.payment_count || 0) + 1 };
        }));
      }
      setMessage({ type: 'success', text: 'Payment recorded successfully' });
      setPaymentDialogOpen(false);
      refreshCommitments(); // reconcile in background
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add payment' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Store className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to manage vendor commitments</p>
      </div>
    );
  }

  const { page, totalPages, total } = pagination;
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const endItem = Math.min(page * PAGE_LIMIT, total);

  return (
    <div className="w-full max-w-full md:max-w-350 space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-emerald-50/60 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Vendor Management</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Contracts &amp; payment transactions for <span className="font-medium text-slate-700">{currentSite.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate('/vendors/inventory')}>
              <Package className="w-4 h-4 mr-1.5" /> Inventory
            </Button>
            {canWrite && (
              <>
                <Button variant="outline" size="sm" onClick={() => setHeadDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add Category
                </Button>
                <Button size="sm" onClick={openCommitmentDialog} className="shadow-sm">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Commitment
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${message.type === 'success'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-red-50 border-red-100 text-red-700'
          }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Summary Cards */}
      {(() => {
        const contractAmt = parseFloat(summary.total_contract_amount) || 0;
        const paidAmt = parseFloat(summary.total_paid_amount) || 0;
        const paidPct = contractAmt > 0 ? Math.min(100, (paidAmt / contractAmt) * 100) : 0;
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contracts</span>
                <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Store className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{summary.total_contracts || 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contract Value</span>
                <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center">
                  <IndianRupee className="w-4 h-4 text-amber-600" />
                </div>
              </div>
              <p className="text-xl font-bold text-slate-900 tabular-nums">₹{money(contractAmt)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Paid</span>
                <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <p className="text-xl font-bold text-emerald-700 tabular-nums">₹{money(paidAmt)}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Remaining</span>
                <div className="h-8 w-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                </div>
              </div>
              <p className="text-xl font-bold text-red-600 tabular-nums">₹{money(summary.total_remaining_amount)}</p>
            </div>
          </div>
        );
      })()}

     

      {/* Filters */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 w-full sm:max-w-72">
            <Input
              placeholder="Search vendor, work, category..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 text-sm pr-8"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-34 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-44 text-sm font-medium bg-slate-50 border-slate-200">
              <div className="flex items-center gap-1.5 truncate">
                <Store className="w-3 h-3 text-slate-400 shrink-0" />
                <SelectValue placeholder="All Categories" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {heads.map((h) => (
                <SelectItem key={h.id} value={String(h.id)} className="text-[11px] font-medium">{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {total > 0 && (
            <span className="text-xs text-slate-400 ml-auto">
              {startItem}–{endItem} of {total} commitments
            </span>
          )}
        </CardContent>
      </Card>

      {/* Commitments Table */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>
          ) : commitments.length === 0 ? (
            <div className="text-center py-16">
              <Wallet className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No vendor commitments found</p>
              <p className="text-xs text-slate-400 mt-0.5">Add first commitment with contract amount and start recording payments</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-50/80">
                    <TableHead className="text-[11px] uppercase tracking-wider">
                      <Button variant="ghost" size="sm" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="h-6 px-1 text-[11px] uppercase tracking-wider font-semibold -ml-1">
                        Vendor <ArrowUpDown className="w-3 h-3 ml-1" />
                      </Button>
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Category / Work</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-right">Contract</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-right">Paid</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-right">Remaining</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Created By</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayCommitments.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => navigate(`/vendors/${c.id}`)}
                    >
                      <TableCell>
                        <p className="text-sm font-semibold text-slate-800">{c.vendor_name}</p>
                        <p className="text-[11px] text-slate-400">{c.vendor_member_name || 'Manual vendor'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-semibold text-slate-700">{c.head_name}</p>
                        <p className="text-xs text-slate-500">{c.work_title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {c.payment_count ?? 0} payments
                          {(parseInt(c.inventory_item_count) || 0) > 0 && (
                            <span className="ml-1.5 text-indigo-500">· {c.inventory_item_count} items</span>
                          )}
                        </p>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-slate-900">₹{money(c.contract_amount)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-emerald-700">₹{money(c.paid_amount)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-red-600">
                        {parseFloat(c.remaining_amount) < 0 ? (
                          <span className="text-red-600 bg-red-50 px-1 rounded">Overpaid: ₹{money(Math.abs(c.remaining_amount))}</span>
                        ) : (
                          `₹${money(c.remaining_amount)}`
                        )}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Badge variant="outline" className={`text-[10px] uppercase ${statusBadgeClass(c.status)}`}>
                          {parseFloat(c.remaining_amount) < 0 ? 'over-paid' : c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <UserAvatar name={c.created_by_name} label="Created by" />
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-slate-600"
                            title="View"
                            onClick={(e) => { e.stopPropagation(); navigate(`/vendors/${c.id}`); }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                       
                          {canUpdate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                              title="Edit"
                              onClick={(e) => { e.stopPropagation(); openEditDialog(c); }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50"
                              title="Delete"
                              onClick={(e) => { e.stopPropagation(); handleDeleteCommitment(c); }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>      
          )}
        </CardContent>

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {/* Page number buttons (show up to 5 pages around current) */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '...' ? (
                    <span key={`ellipsis-${idx}`} className="text-xs text-slate-400 px-1">…</span>
                  ) : (
                    <Button
                      key={item}
                      variant={item === page ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      onClick={() => setCurrentPage(item)}
                    >
                      {item}
                    </Button>
                  )
                )}

              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit Commitment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit Commitment</DialogTitle>
            <DialogDescription className="text-sm">Update commitment details. Inventory items can be managed from the detail page.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium">Vendor Name</Label>
              <Input value={editForm.vendor_name} onChange={(e) => setEditForm((p) => ({ ...p, vendor_name: e.target.value.toUpperCase() }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Select value={editForm.head_id || '_none'} onValueChange={(v) => {
                const h = heads.find((x) => String(x.id) === v);
                setEditForm((p) => ({ ...p, head_id: v === '_none' ? '' : v, head_name: h?.name || p.head_name }));
              }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {heads.map((h) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium">Work Title</Label>
              <Input value={editForm.work_title} onChange={(e) => setEditForm((p) => ({ ...p, work_title: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Contract Amount (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
                <Input type="number" min="0" step="0.01" value={editForm.contract_amount} onChange={(e) => setEditForm((p) => ({ ...p, contract_amount: e.target.value }))} className="pl-7 h-9 tabular-nums" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start Date</Label>
              <Input type="date" value={editForm.start_date} onChange={(e) => setEditForm((p) => ({ ...p, start_date: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Due Date</Label>
              <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm((p) => ({ ...p, due_date: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note</Label>
              <Input value={editForm.note} onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))} className="h-9" placeholder="Optional" />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button size="sm" onClick={handleEditCommitment} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={headDialogOpen} onOpenChange={setHeadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Add Category</DialogTitle>
            <DialogDescription className="text-sm">Create custom work/payment category like CIVIL WORK, MATERIAL, CONTRACTOR LABOUR.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Category Name</Label>
            <Input value={headName} onChange={(e) => setHeadName(e.target.value.toUpperCase())} placeholder="CIVIL WORK" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setHeadDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleCreateHead} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Commitment Dialog */}
      <Dialog open={commitmentDialogOpen} onOpenChange={setCommitmentDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0">
          <div className="px-5 pt-5 pb-3">
            <DialogHeader>
              <DialogTitle className="text-base">Create Vendor Commitment</DialogTitle>
              <DialogDescription className="text-xs text-slate-400">Add items below — contract amount auto-calculates from total.</DialogDescription>
            </DialogHeader>
          </div>

          {/* Vendor / Category / Title — compact strip */}
          <div className="px-5 pb-3 grid grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-slate-500">Vendor *</Label>
              {commitmentForm.vendor_member_id === '' && commitmentForm.vendor_name === '' ? (
                <Select value="" onValueChange={onVendorMemberChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select or type manual" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorUsers.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.full_name}</SelectItem>
                    ))}
                    <SelectItem value="_manual">✎ Type manually</SelectItem>
                  </SelectContent>
                </Select>
              ) : commitmentForm.vendor_member_id ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-8 px-2.5 flex items-center rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 truncate">
                    {commitmentForm.vendor_name}
                  </div>
                  <button type="button" className="text-slate-400 hover:text-red-500 shrink-0" onClick={() => setCommitmentForm((p) => ({ ...p, vendor_member_id: '', vendor_name: '' }))}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input value={commitmentForm.vendor_name} onChange={(e) => setCommitmentForm((p) => ({ ...p, vendor_name: e.target.value.toUpperCase() }))} placeholder="VENDOR NAME" className="h-8 text-xs" autoFocus />
                  <button type="button" className="text-slate-400 hover:text-red-500 shrink-0" onClick={() => setCommitmentForm((p) => ({ ...p, vendor_member_id: '', vendor_name: '' }))}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-slate-500">Category *</Label>
              {commitmentForm.head_id === '' && commitmentForm.head_name === '' ? (
                <Select value="" onValueChange={onHeadChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select or type new" />
                  </SelectTrigger>
                  <SelectContent>
                    {heads.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
                    ))}
                    <SelectItem value="_manual">✎ Type new category</SelectItem>
                  </SelectContent>
                </Select>
              ) : commitmentForm.head_id ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-8 px-2.5 flex items-center rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 truncate">
                    {commitmentForm.head_name}
                  </div>
                  <button type="button" className="text-slate-400 hover:text-red-500 shrink-0" onClick={() => setCommitmentForm((p) => ({ ...p, head_id: '', head_name: '' }))}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input value={commitmentForm.head_name} onChange={(e) => setCommitmentForm((p) => ({ ...p, head_name: e.target.value.toUpperCase() }))} placeholder="NEW CATEGORY" className="h-8 text-xs" autoFocus />
                  <button type="button" className="text-slate-400 hover:text-red-500 shrink-0" onClick={() => setCommitmentForm((p) => ({ ...p, head_id: '', head_name: '' }))}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-slate-500">Start Date</Label>
              <Input type="date" value={commitmentForm.start_date} onChange={(e) => setCommitmentForm((p) => ({ ...p, start_date: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-[10px] font-medium text-slate-500">Work Title *</Label>
              <Input value={commitmentForm.work_title} onChange={(e) => setCommitmentForm((p) => ({ ...p, work_title: e.target.value }))} placeholder="Cement supply for Block A" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-slate-500">Note</Label>
              <Input value={commitmentForm.note} onChange={(e) => setCommitmentForm((p) => ({ ...p, note: e.target.value }))} placeholder="Optional" className="h-8 text-xs" />
            </div>
          </div>

          {/* ── Items Table ─────────────────────── */}
          <div className="border-t border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left font-semibold px-3 py-2 w-8">#</th>
                    <th className="text-left font-semibold px-2 py-2">Item Name *</th>
                    <th className="text-right font-semibold px-2 py-2 w-20">Qty *</th>
                    <th className="text-left font-semibold px-2 py-2 w-16">Unit</th>
                    <th className="text-right font-semibold px-2 py-2 w-24">Rate ₹ *</th>
                    <th className="text-right font-semibold px-2 py-2 w-16">Disc%</th>
                    <th className="text-right font-semibold px-2 py-2 w-28">Net ₹</th>
                    <th className="text-center font-semibold px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commitmentForm.inventory_items.map((item, idx) => {
                    const amounts = calcItemAmounts(item);
                    const updateItem = (field, value) => {
                      setCommitmentForm((prev) => {
                        const items = [...prev.inventory_items];
                        items[idx] = { ...items[idx], [field]: value };
                        if (field === 'discount_pct' && parseFloat(value)) items[idx].discount_amount = '';
                        if (field === 'discount_amount' && parseFloat(value)) items[idx].discount_pct = '';
                        return { ...prev, inventory_items: items };
                      });
                    };
                    const removeItem = () => {
                      setCommitmentForm((prev) => ({
                        ...prev,
                        inventory_items: prev.inventory_items.length <= 1
                          ? [{ ...emptyInvItem }]
                          : prev.inventory_items.filter((_, i) => i !== idx),
                      }));
                    };

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="px-3 py-1.5 text-slate-400 font-medium">{idx + 1}</td>
                        <td className="px-1 py-1.5">
                          <Input value={item.item_name} onChange={(e) => updateItem('item_name', e.target.value)} placeholder="Cement, Bricks, Sand..." className="h-7 text-xs border-slate-200" />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input type="number" value={item.qty_ordered} onChange={(e) => updateItem('qty_ordered', e.target.value)} placeholder="0" className="h-7 text-xs text-right border-slate-200" />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input value={item.unit} onChange={(e) => updateItem('unit', e.target.value)} className="h-7 text-xs border-slate-200" />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input type="number" step="0.01" value={item.rate} onChange={(e) => updateItem('rate', e.target.value)} placeholder="0" className="h-7 text-xs text-right border-slate-200" />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input type="number" step="0.01" value={item.discount_pct} onChange={(e) => updateItem('discount_pct', e.target.value)} placeholder="0" className="h-7 text-xs text-right border-slate-200" />
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold text-slate-800 tabular-nums">
                          {amounts.net > 0 ? `₹${money(amounts.net)}` : '—'}
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          <button type="button" onClick={removeItem} className="text-slate-300 hover:text-red-500 transition-colors p-0.5">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add row + Total strip */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                onClick={() => setCommitmentForm((prev) => ({
                  ...prev,
                  inventory_items: [...prev.inventory_items, { ...emptyInvItem }],
                }))}
              >
                <Plus className="w-3.5 h-3.5" /> Add row
              </button>
              {(() => {
                const totalGross = commitmentForm.inventory_items.reduce((s, it) => s + calcItemAmounts(it).gross, 0);
                const totalNet = commitmentForm.inventory_items.reduce((s, it) => s + calcItemAmounts(it).net, 0);
                const totalDisc = totalGross - totalNet;
                return (
                  <div className="flex items-center gap-4 text-xs">
                    {totalDisc > 0 && <span className="text-orange-500">Disc: -₹{money(totalDisc)}</span>}
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                      <span className="text-slate-600 font-medium">Contract Amount</span>
                      <span className="text-lg font-bold text-emerald-700 tabular-nums">₹{money(totalNet)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="px-5 pb-4 pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setCommitmentDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleCreateCommitment} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Create Commitment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Add Vendor Payment</DialogTitle>
            <DialogDescription className="text-sm">Record payment made to vendor. Remaining amount updates automatically.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount + Date row */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-3 space-y-1.5">
                <Label className="text-xs font-medium">Amount (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-emerald-500">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="50000"
                    className="pl-9 text-lg h-11 font-bold tabular-nums border-emerald-200 focus-visible:ring-emerald-400 text-emerald-700"
                  />
                </div>
                {paymentForm.amount && (
                  <p className="text-[10px] font-medium text-emerald-500">
                    ₹{(parseFloat(paymentForm.amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} will be deducted
                  </p>
                )}
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Date *</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_date: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>

            {/* Payment Mode chips */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payment Mode</Label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_MODES.map((m) => (
                  <button
                    key={m} type="button"
                    onClick={() => setPaymentForm((prev) => ({ ...prev, payment_mode: m, reference_no: CASH_MODES.includes(m) ? '' : prev.reference_no }))}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${paymentForm.payment_mode === m
                      ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                      : MODE_CHIP_COLORS[m] || 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Bank-only: Reference No */}
            {!CASH_MODES.includes(paymentForm.payment_mode) && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reference / UTR / Cheque No</Label>
                <Input
                  value={paymentForm.reference_no}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference_no: e.target.value.toUpperCase() }))}
                  placeholder="UTR / CHQ / TXN NO"
                  className="h-9"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note</Label>
              <Textarea
                rows={2}
                value={paymentForm.note}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Payment milestone or remark"
                className="resize-none"
              />
            </div>

            {approvers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Assign To Admin</Label>
                <Select
                  value={paymentForm.assigned_admin_id?.toString() || '_none'}
                  onValueChange={(val) => setPaymentForm((prev) => ({ ...prev, assigned_admin_id: val === '_none' ? null : parseInt(val) }))}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select approver" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Auto-assign —</SelectItem>
                    {approvers.map((app) => (
                      <SelectItem key={app.id} value={String(app.id)}>{app.full_name || app.name || app.email || `Admin #${app.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-medium">Voucher (Image/PDF)</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => voucherInputRef.current?.click()}
                  disabled={uploadingVoucher}
                >
                  {uploadingVoucher ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-1.5" />}
                  {uploadingVoucher ? 'Uploading...' : 'Upload Voucher'}
                </Button>
                <input
                  ref={voucherInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleVoucherUpload}
                  className="hidden"
                />
                {paymentForm.voucher_url && (
                  <a
                    href={paymentForm.voucher_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Attached
                  </a>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPaymentDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleAddPayment} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5">
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <IndianRupee className="w-3.5 h-3.5 mr-1.5" />}
              Add Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorManagement;

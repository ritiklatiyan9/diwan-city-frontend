import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
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
  ChevronLeft,
  ChevronRight,
  Eye,
  IndianRupee,
  Loader2,
  Package,
  Plus,
  Receipt,
  Search,
  Store,
  Wallet,
  X,
} from 'lucide-react';

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const money = (n) => {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
};

const STATUS_META = {
  open:      { label: 'Unpaid',    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  partial:   { label: 'Partial',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const PAGE_LIMIT = 20;

const emptyForm = {
  vendor_member_id: '',
  vendor_name: '',
  item_name: '',
  item_category: '',
  unit: 'pcs',
  qty_ordered: '',
  rate: '',
  discount_pct: '',
  discount_amount: '',
  order_date: todayLocal(),
  expected_date: '',
  note: '',
};

const CATEGORY_PALETTE = [
  { bg: 'from-blue-50 to-blue-100/60',       border: 'border-blue-200',    text: 'text-blue-700',    bar: 'bg-blue-500' },
  { bg: 'from-amber-50 to-amber-100/60',     border: 'border-amber-200',   text: 'text-amber-700',   bar: 'bg-amber-500' },
  { bg: 'from-emerald-50 to-emerald-100/60', border: 'border-emerald-200', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  { bg: 'from-violet-50 to-violet-100/60',   border: 'border-violet-200',  text: 'text-violet-700',  bar: 'bg-violet-500' },
  { bg: 'from-pink-50 to-pink-100/60',       border: 'border-pink-200',    text: 'text-pink-700',    bar: 'bg-pink-500' },
  { bg: 'from-cyan-50 to-cyan-100/60',       border: 'border-cyan-200',    text: 'text-cyan-700',    bar: 'bg-cyan-500' },
];
const catColor = (i) => CATEGORY_PALETTE[i % CATEGORY_PALETTE.length];

const VendorInventory = () => {
  const navigate   = useNavigate();
  const { currentSite, canManage, hasPermission } = useAuth();
  const canWrite  = canManage && hasPermission('vendors', 'write');
  const canDelete = canManage && hasPermission('vendors', 'delete');
  const siteId    = currentSite?.id;

  const [loading,    setLoading]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message,    setMessage]    = useState({ type: '', text: '' });

  const [orders,     setOrders]     = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
  const [vendors,    setVendors]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [heads,      setHeads]      = useState([]);
  const [stockSummary, setStockSummary] = useState({ categories: [], recentTransactions: [], totals: {} });

  const [search,      setSearch]      = useState('');
  const [statusFilter,setStatusFilter]= useState('all');
  const [catFilter,   setCatFilter]   = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const gross = (() => {
    const q = parseFloat(form.qty_ordered) || 0;
    const r = parseFloat(form.rate) || 0;
    return q * r;
  })();
  const effectiveDiscount = (() => {
    const pct = parseFloat(form.discount_pct) || 0;
    const flat = parseFloat(form.discount_amount) || 0;
    if (pct > 0) return Math.round(gross * pct / 100 * 100) / 100;
    return flat;
  })();
  const net = Math.max(0, gross - effectiveDiscount);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setCurrentPage(1);
    }, 380);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, catFilter]);

  const loadStatic = useCallback(async () => {
    if (!siteId) return;
    try {
      const [vendorsRes, catsRes, stockRes, headsRes] = await Promise.all([
        api.get('/vendors/users', { params: { site_id: siteId } }),
        api.get('/vendors/inventory/categories', { params: { site_id: siteId } }),
        api.get('/vendors/inventory/stock-summary', { params: { site_id: siteId } }),
        api.get('/vendors/heads', { params: { site_id: siteId } }),
      ]);
      setVendors(vendorsRes.data.vendors || []);
      setCategories(catsRes.data.categories || []);
      setHeads(headsRes.data.heads || []);
      setStockSummary(stockRes.data || { categories: [], recentTransactions: [], totals: {} });
    } catch { /* silent */ }
  }, [siteId]);

  const loadOrders = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    // Watchdog so the spinner can't hang on a stalled request.
    const watchdog = setTimeout(() => setLoading(false), 15000);
    try {
      const params = { site_id: siteId, page: currentPage, limit: PAGE_LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (catFilter !== 'all') params.category = catFilter;

      const res = await api.get('/vendors/inventory', { params });
      setOrders(res.data.orders || []);
      setPagination(res.data.pagination || { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load inventory' });
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  }, [siteId, currentPage, debouncedSearch, statusFilter, catFilter]);

  // Background refresh — does NOT toggle the loader.
  const refreshOrders = useCallback(async () => {
    if (!siteId) return;
    try {
      const params = { site_id: siteId, page: currentPage, limit: PAGE_LIMIT };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (catFilter !== 'all') params.category = catFilter;
      const res = await api.get('/vendors/inventory', { params });
      setOrders(res.data.orders || []);
      setPagination(res.data.pagination || { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });
    } catch { /* keep current */ }
  }, [siteId, currentPage, debouncedSearch, statusFilter, catFilter]);

  useEffect(() => { loadStatic(); }, [loadStatic]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const setF = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const onVendorChange = (id) => {
    const v = vendors.find((x) => String(x.id) === id);
    setForm((p) => ({ ...p, vendor_member_id: id, vendor_name: v?.full_name || p.vendor_name }));
  };

  const onDiscountPct  = (val) => setForm((p) => ({ ...p, discount_pct: val, discount_amount: val ? '' : p.discount_amount }));
  const onDiscountFlat = (val) => setForm((p) => ({ ...p, discount_amount: val, discount_pct: val ? '' : p.discount_pct }));

  const openCreate = () => {
    setForm({ ...emptyForm, order_date: todayLocal() });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!siteId) return;
    if (!form.item_name.trim()) return setMessage({ type: 'error', text: 'Item name is required' });
    if (!form.unit.trim())      return setMessage({ type: 'error', text: 'Unit is required' });
    if (!(parseFloat(form.qty_ordered) > 0)) return setMessage({ type: 'error', text: 'Qty must be > 0' });
    if (!form.vendor_name.trim() && !form.vendor_member_id) return setMessage({ type: 'error', text: 'Vendor name is required' });
    setSubmitting(true);
    try {
      await api.post('/vendors/inventory', { site_id: siteId, ...form });
      setMessage({ type: 'success', text: 'Item added' });
      setDialogOpen(false);
      // Reconcile in background — both refreshes run concurrently and don't
      // block the dialog close.
      refreshOrders();
      loadStatic();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create item' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item and all its payment transactions?')) return;
    // Optimistic removal — instant UI feedback.
    const snapshot = orders;
    setOrders((prev) => prev.filter((o) => o.id !== id));
    try {
      await api.delete(`/vendors/inventory/${id}`, { params: { site_id: siteId } });
      setMessage({ type: 'success', text: 'Item deleted' });
      refreshOrders();
      loadStatic();
    } catch (err) {
      setOrders(snapshot); // rollback
      setMessage({ type: 'error', text: err.response?.data?.message || 'Delete failed' });
    }
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view inventory</p>
      </div>
    );
  }

  const { page, totalPages, total } = pagination;
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
  const endItem   = Math.min(page * PAGE_LIMIT, total);
  const totals    = stockSummary.totals || {};

  const totalValue = parseFloat(totals.total_value || 0);
  const totalPaid  = parseFloat(totals.total_paid  || 0);
  const totalOutstanding = parseFloat(totals.total_outstanding || 0);
  const paidPct    = totalValue > 0 ? Math.min(100, (totalPaid / totalValue) * 100) : 0;

  return (
    <div className="w-full max-w-full md:max-w-350 space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-indigo-50/60 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <button onClick={() => navigate('/vendors')} className="hover:text-slate-600 transition-colors">Vendor Management</button>
              <span>/</span>
              <span className="font-medium text-slate-600">Inventory</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Inventory</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Items, orders &amp; payment transactions for <span className="font-medium text-slate-700">{currentSite.name}</span>
            </p>
          </div>
          {canWrite && (
            <Button size="sm" onClick={openCreate} className="shadow-sm">
              <Plus className="w-4 h-4 mr-1.5" /> New Item
            </Button>
          )}
        </div>
      </div>

      {/* Alert */}
      {message.text && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
          <button className="ml-auto" onClick={() => setMessage({ type: '', text: '' })}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Items</span>
            <div className="h-8 w-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Package className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{totals.total_items || 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Value</span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 tabular-nums">₹{money(totalValue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Paid</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-xl font-bold text-emerald-700 tabular-nums">₹{money(totalPaid)}</p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Outstanding</span>
            <div className="h-8 w-8 rounded-xl bg-red-50 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <p className="text-xl font-bold text-red-600 tabular-nums">₹{money(totalOutstanding)}</p>
        </div>
      </div>

      {/* Category Breakdown */}
      {stockSummary.categories?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" /> By Category
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stockSummary.categories.map((cat, idx) => {
              const c = catColor(idx);
              const val  = parseFloat(cat.total_value) || 0;
              const paid = parseFloat(cat.total_paid) || 0;
              const out  = parseFloat(cat.outstanding) || 0;
              const pct  = val > 0 ? Math.min(100, (paid / val) * 100) : 0;
              const isActive = catFilter === cat.category;
              return (
                <button
                  key={cat.category}
                  onClick={() => setCatFilter(isActive ? 'all' : cat.category)}
                  className={`text-left rounded-2xl border ${isActive ? 'ring-2 ring-indigo-400 ' + c.border : c.border} bg-gradient-to-br ${c.bg} p-4 transition-all hover:shadow-md`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-sm font-bold uppercase tracking-wide ${c.text}`}>{cat.category}</h3>
                    <Badge variant="outline" className={`text-[9px] font-semibold ${c.border} ${c.text} px-1.5 py-0`}>
                      {cat.item_count} items
                    </Badge>
                  </div>
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-500">Paid</span>
                      <span className="font-semibold text-slate-700 tabular-nums">₹{money(paid)} / ₹{money(val)}</span>
                    </div>
                    <div className="w-full h-2 bg-white/80 rounded-full overflow-hidden">
                      <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-white/60">
                    <span className={out > 0 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                      {out > 0 ? `Due: ₹${money(out)}` : '✓ Paid'}
                    </span>
                    <span className="text-slate-400 font-semibold text-[10px] tabular-nums">{Math.round(pct)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {stockSummary.recentTransactions?.length > 0 && (
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-0">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-700">Recent Payment Transactions</span>
            </div>
            <div className="divide-y divide-slate-50">
              {stockSummary.recentTransactions.slice(0, 6).map((t) => (
                <div key={t.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{t.item_name}</p>
                      <p className="text-[10px] text-slate-400">
                        {fmtDate(t.date)}
                        {t.item_category && <> &middot; {t.item_category}</>}
                        {t.payment_mode && <> &middot; {t.payment_mode.toUpperCase()}</>}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-emerald-700 tabular-nums">₹{money(t.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-3.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder="Search item, vendor, category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36 h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="completed">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {heads.map((h) => (
                  <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>
                ))}
                {categories.filter(c => !heads.some(h => h.name === c)).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {catFilter !== 'all' && (
              <Button variant="ghost" size="sm" className="h-9 text-xs text-slate-500" onClick={() => setCatFilter('all')}>
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card className="shadow-none border-slate-200 overflow-hidden">
        {catFilter !== 'all' && (
          <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700">Showing: {catFilter}</span>
            <button onClick={() => setCatFilter('all')} className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
              <X className="w-3 h-3" /> Show All
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-9 h-9 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-500">No inventory items found</p>
            <p className="text-xs text-slate-400 mt-1">
              {search || statusFilter !== 'all' || catFilter !== 'all' ? 'Try clearing your filters' : 'Add items via "New Item" or from a Vendor Commitment'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 border-b border-slate-200">
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wide pl-4 py-2.5">Item / Vendor</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wide py-2.5">Category</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right py-2.5">Qty × Rate</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right py-2.5">Net Value</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right py-2.5">Paid</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wide text-right py-2.5">Due</TableHead>
                    <TableHead className="text-[10px] font-bold text-slate-500 uppercase tracking-wide py-2.5">Status</TableHead>
                    <TableHead className="py-2.5 pr-4 w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const outstanding = parseFloat(o.outstanding) || 0;
                    const orderValue  = parseFloat(o.order_value) || 0;
                    const paid = parseFloat(o.total_paid) || 0;
                    const pct  = orderValue > 0 ? Math.min(100, (paid / orderValue) * 100) : 0;
                    return (
                      <TableRow
                        key={o.id}
                        className="hover:bg-slate-50/60 cursor-pointer border-b border-slate-50 transition-colors"
                        onClick={() => navigate(`/vendors/inventory/${o.id}`)}
                      >
                        <TableCell className="pl-4 py-2.5">
                          <p className="text-sm font-semibold text-slate-900 leading-tight">{o.item_name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Store className="w-3 h-3 shrink-0" /> {o.vendor_name}
                            {o.head_name && <span className="text-[10px] text-slate-400 ml-1">• {o.head_name}</span>}
                          </p>
                        </TableCell>
                        <TableCell className="py-2.5">
                          {o.item_category ? (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold uppercase">{o.item_category}</span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-right py-2.5">
                          <p className="text-sm font-medium text-slate-700 tabular-nums">
                            {money(o.qty_ordered)} <span className="text-[10px] text-slate-400">{o.unit}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 tabular-nums">@ ₹{money(o.rate)}</p>
                        </TableCell>
                        <TableCell className="text-right py-2.5 tabular-nums text-sm font-semibold text-slate-900">₹{money(orderValue)}</TableCell>
                        <TableCell className="text-right py-2.5">
                          <p className="text-sm font-medium text-emerald-700 tabular-nums">₹{money(paid)}</p>
                          <div className="mt-1 ml-auto w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-2.5 tabular-nums text-sm font-semibold">
                          <span className={outstanding > 0 ? 'text-red-600' : 'text-slate-300'}>{outstanding > 0 ? `₹${money(outstanding)}` : '—'}</span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="outline" className={`text-[9px] font-semibold px-2 py-0.5 ${STATUS_META[o.status]?.cls || ''}`}>
                            {STATUS_META[o.status]?.label || o.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5 justify-end">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600" onClick={() => navigate(`/vendors/inventory/${o.id}`)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-red-500" onClick={() => handleDelete(o.id)}>
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60">
              <p className="text-xs text-slate-500">{total === 0 ? 'No results' : `${startItem}–${endItem} of ${total}`}</p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-slate-600 px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Create Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" /> New Inventory Item
            </DialogTitle>
            <DialogDescription className="text-sm">
              Record an ordered item. Track payment transactions against it — no stock in/out flow.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Vendor (from users)</Label>
              <Select value={form.vendor_member_id} onValueChange={onVendorChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Or Manual Vendor Name</Label>
              <Input
                value={form.vendor_name}
                onChange={(e) => setF('vendor_name', e.target.value.toUpperCase())}
                placeholder="SHARMA BRICKS"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium">Item Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.item_name}
                onChange={(e) => setF('item_name', e.target.value)}
                placeholder="Red Clay Bricks / Cement 53 Grade / TMT Steel…"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Select value={form.item_category} onValueChange={(val) => setF('item_category', val)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {heads.map((h) => (
                    <SelectItem key={h.id} value={h.name}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Unit <span className="text-red-500">*</span></Label>
              <Input
                value={form.unit}
                onChange={(e) => setF('unit', e.target.value)}
                placeholder="pcs / kg / bag / sqft / ton"
                className="h-9"
                list="unit-list"
              />
              <datalist id="unit-list">
                {['pcs', 'kg', 'bag', 'sqft', 'ton', 'rft', 'cft', 'litre', 'bundle', 'set'].map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Qty <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={form.qty_ordered}
                onChange={(e) => setF('qty_ordered', e.target.value)}
                placeholder="10000"
                className="h-9 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rate per {form.unit || 'unit'} (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.rate}
                  onChange={(e) => setF('rate', e.target.value)}
                  placeholder="8.50"
                  className="pl-7 h-9 tabular-nums"
                />
              </div>
            </div>

            {gross > 0 && (
              <div className="col-span-2 bg-slate-50 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 text-xs">Gross Amount</span>
                  <span className="font-semibold text-slate-800 tabular-nums">₹{money(gross)}</span>
                </div>
                {effectiveDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm mt-1.5">
                    <span className="text-slate-500 text-xs">Discount</span>
                    <span className="font-medium text-amber-600 tabular-nums">- ₹{money(effectiveDiscount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-200">
                  <span className="text-xs font-semibold text-slate-700">Net Amount</span>
                  <span className="font-bold text-emerald-700 tabular-nums">₹{money(net)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Discount % <span className="text-slate-400 font-normal">(auto-calc)</span></Label>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={form.discount_pct}
                  onChange={(e) => onDiscountPct(e.target.value)}
                  placeholder="0"
                  className="pr-7 h-9 tabular-nums"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Discount ₹ <span className="text-slate-400 font-normal">(manual flat)</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={form.discount_amount}
                  onChange={(e) => onDiscountFlat(e.target.value)}
                  placeholder="0"
                  className="pl-7 h-9 tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Order Date</Label>
              <Input type="date" value={form.order_date} onChange={(e) => setF('order_date', e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Expected Date</Label>
              <Input type="date" value={form.expected_date} onChange={(e) => setF('expected_date', e.target.value)} className="h-9" />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium">Note</Label>
              <Textarea
                rows={2}
                value={form.note}
                onChange={(e) => setF('note', e.target.value)}
                placeholder="Any special terms, quality spec, delivery address…"
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Create Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorInventory;

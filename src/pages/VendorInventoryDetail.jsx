import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  ImageIcon,
  IndianRupee,
  Loader2,
  Package,
  Pencil,
  Plus,
  Receipt,
  Store,
  Tag,
  Trash2,
  UploadCloud,
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

const PAYMENT_MODES = ['cash', 'bank', 'upi', 'cheque', 'neft', 'rtgs', 'imps', 'other'];
const CASH_MODES = ['cash'];
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

const emptyPaymentForm = { payment_date: todayLocal(), amount: '', payment_mode: 'cash', reference_no: '', note: '', voucher_url: '' };
const emptyEditForm = {
  item_name: '', item_category: '', unit: '', qty_ordered: '', rate: '',
  discount_pct: '', discount_amount: '', order_date: '', expected_date: '', note: '',
  vendor_name: '',
};

const VendorInventoryDetail = () => {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { currentSite, canManage, hasPermission } = useAuth();
  const canWrite  = canManage && hasPermission('vendors', 'write');
  const canUpdate = canManage && hasPermission('vendors', 'update');
  const canDelete = canManage && hasPermission('vendors', 'delete');
  const siteId    = currentSite?.id;

  const [loading,          setLoading]          = useState(true);
  const [submitting,       setSubmitting]       = useState(false);
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [message,          setMessage]          = useState({ type: '', text: '' });
  const voucherRef = useRef(null);

  const [order,    setOrder]    = useState(null);
  const [payments, setPayments] = useState([]);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editOpen,    setEditOpen]    = useState(false);

  const [paymentForm, setPaymentForm] = useState({ ...emptyPaymentForm });
  const [editForm,    setEditForm]    = useState({ ...emptyEditForm });

  const editGross = (() => {
    const q = parseFloat(editForm.qty_ordered) || 0;
    const r = parseFloat(editForm.rate) || 0;
    return q * r;
  })();
  const editDiscount = (() => {
    const pct  = parseFloat(editForm.discount_pct) || 0;
    const flat = parseFloat(editForm.discount_amount) || 0;
    if (pct > 0) return Math.round(editGross * pct / 100 * 100) / 100;
    return flat;
  })();
  const editNet = Math.max(0, editGross - editDiscount);

  const loadDetail = useCallback(async () => {
    if (!siteId || !id) return;
    setLoading(true);
    // Watchdog so the spinner can never hang.
    const watchdog = setTimeout(() => setLoading(false), 15000);
    try {
      const res = await api.get(`/vendors/inventory/${id}`, { params: { site_id: siteId } });
      setOrder(res.data.order);
      setPayments(res.data.payments || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to load item' });
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  }, [siteId, id]);

  // Background refresh — does NOT toggle the loader.
  const refreshDetail = useCallback(async () => {
    if (!siteId || !id) return;
    try {
      const res = await api.get(`/vendors/inventory/${id}`, { params: { site_id: siteId } });
      setOrder(res.data.order);
      setPayments(res.data.payments || []);
    } catch { /* keep current */ }
  }, [siteId, id]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ type: '', text: '' }), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const openEdit = () => {
    if (!order) return;
    setEditForm({
      item_name:       order.item_name || '',
      item_category:   order.item_category || '',
      unit:            order.unit || '',
      qty_ordered:     String(order.qty_ordered || ''),
      rate:            String(order.rate || ''),
      discount_pct:    parseFloat(order.discount_pct) > 0 ? String(order.discount_pct) : '',
      discount_amount: parseFloat(order.discount_amount) > 0 && !(parseFloat(order.discount_pct) > 0) ? String(order.discount_amount) : '',
      order_date:      order.order_date ? order.order_date.slice(0, 10) : todayLocal(),
      expected_date:   order.expected_date ? order.expected_date.slice(0, 10) : '',
      note:            order.note || '',
      vendor_name:     order.vendor_name || '',
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!siteId) return;
    setSubmitting(true);
    try {
      const { data } = await api.put(`/vendors/inventory/${id}`, { site_id: siteId, ...editForm });
      // Optimistic update — close dialog instantly.
      if (data?.order) setOrder((prev) => ({ ...(prev || {}), ...data.order }));
      setMessage({ type: 'success', text: 'Item updated' });
      setEditOpen(false);
      refreshDetail(); // reconcile computed values from server
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Update failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const openAddPayment = () => {
    const outstanding = parseFloat(order?.outstanding) || 0;
    setPaymentForm({
      ...emptyPaymentForm,
      payment_date: todayLocal(),
      amount: outstanding > 0 ? String(outstanding) : '',
    });
    if (voucherRef.current) voucherRef.current.value = '';
    setPaymentOpen(true);
  };

  const handleVoucherUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) return setMessage({ type: 'error', text: 'Invalid file type' });
    setUploadingVoucher(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload/single?provider=s3', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPaymentForm((p) => ({ ...p, voucher_url: res.data.fileUrl || res.data.url || '' }));
      setMessage({ type: 'success', text: 'Voucher uploaded' });
    } catch {
      setMessage({ type: 'error', text: 'Voucher upload failed' });
    } finally {
      setUploadingVoucher(false);
    }
  };

  const handleAddPayment = async () => {
    if (!siteId) return;
    const amount = parseFloat(paymentForm.amount);
    if (!(amount > 0)) return setMessage({ type: 'error', text: 'Amount must be > 0' });
    setSubmitting(true);
    try {
      const { data } = await api.post(`/vendors/inventory/${id}/payments`, { site_id: siteId, ...paymentForm });
      // Optimistic prepend — close dialog instantly.
      if (data?.payment) setPayments((prev) => [data.payment, ...prev]);
      setMessage({ type: 'success', text: 'Transaction recorded' });
      setPaymentOpen(false);
      refreshDetail(); // reconcile order.total_paid / outstanding from trigger
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to add transaction' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Delete this transaction record?')) return;
    // Optimistic removal — instant UI feedback.
    const snapshot = payments;
    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    try {
      await api.delete(`/vendors/inventory/inv-payments/${paymentId}`, { params: { site_id: siteId } });
      setMessage({ type: 'success', text: 'Transaction deleted' });
      refreshDetail();
    } catch (err) {
      setPayments(snapshot); // rollback
      setMessage({ type: 'error', text: err.response?.data?.message || 'Delete failed' });
    }
  };

  const setP = (key, val) => setPaymentForm((p) => ({ ...p, [key]: val }));
  const setE = (key, val) => setEditForm((p) => ({ ...p, [key]: val }));

  const onEditDiscPct  = (val) => setEditForm((p) => ({ ...p, discount_pct: val, discount_amount: val ? '' : p.discount_amount }));
  const onEditDiscFlat = (val) => setEditForm((p) => ({ ...p, discount_amount: val, discount_pct: val ? '' : p.discount_pct }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="w-9 h-9 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Item not found</p>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate('/vendors/inventory')}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Inventory
        </Button>
      </div>
    );
  }

  const orderGross  = parseFloat(order.order_gross) || (parseFloat(order.qty_ordered) * parseFloat(order.rate)) || 0;
  const discount    = parseFloat(order.discount_pct) > 0
    ? Math.round(orderGross * parseFloat(order.discount_pct) / 100 * 100) / 100
    : (parseFloat(order.discount_amount) || 0);
  const net         = parseFloat(order.order_value) || Math.max(0, orderGross - discount);
  const paid        = parseFloat(order.total_paid) || 0;
  const outstanding = Number.isFinite(parseFloat(order.outstanding)) ? parseFloat(order.outstanding) : (net - paid);
  const paidPct     = net > 0 ? Math.min(100, (paid / net) * 100) : 0;

  return (
    <div className="w-full max-w-full md:max-w-350 space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-indigo-50/60 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0" onClick={() => navigate('/vendors/inventory')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <button onClick={() => navigate('/vendors')} className="hover:text-slate-600 transition-colors">Vendor</button>
                <span>/</span>
                <button onClick={() => navigate('/vendors/inventory')} className="hover:text-slate-600 transition-colors">Inventory</button>
                <span>/</span>
                <span className="text-slate-600 truncate">#{order.id}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{order.item_name}</h1>
                <Badge variant="outline" className={`text-[11px] font-semibold ${STATUS_META[order.status]?.cls || ''}`}>
                  {STATUS_META[order.status]?.label || order.status}
                </Badge>
                {order.item_category && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {order.item_category}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <Store className="w-3.5 h-3.5" /> {order.vendor_name}
                <span className="text-slate-300 mx-1">·</span>
                <CalendarDays className="w-3.5 h-3.5" /> Ordered {fmtDate(order.order_date)}
                {order.expected_date && (
                  <>
                    <span className="text-slate-300 mx-1">·</span>
                    Expected {fmtDate(order.expected_date)}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canUpdate && (
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
            )}
            {canWrite && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAddPayment}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Transaction
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Alert */}
      {message.text && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
          message.type === 'success'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
            : 'bg-red-50 border-red-100 text-red-700'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
          <button className="ml-auto" onClick={() => setMessage({ type: '', text: '' })}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-none border-slate-200 md:col-span-2">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Payment Progress
              </p>
              <span className="text-xs text-slate-500 tabular-nums">
                ₹{money(paid)} / ₹{money(net)}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Paid</span>
                <span className="font-semibold text-slate-700">{Math.round(paidPct)}%</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${paidPct >= 100 ? 'bg-emerald-500' : paidPct > 0 ? 'bg-emerald-400' : 'bg-slate-200'}`}
                  style={{ width: `${paidPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Ordered</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums mt-0.5">
                  {money(order.qty_ordered)} <span className="text-[10px] font-normal text-slate-400">{order.unit}</span>
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Rate</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums mt-0.5">₹{money(order.rate)}<span className="text-[10px] font-normal text-slate-400">/{order.unit}</span></p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Transactions</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums mt-0.5">{payments.length}</p>
              </div>
            </div>

            {order.note && (
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 leading-relaxed">
                {order.note}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none border-slate-200">
          <CardContent className="p-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-3">
              <IndianRupee className="w-3.5 h-3.5" /> Financial Summary
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Gross ({money(order.qty_ordered)} × ₹{money(order.rate)})</span>
              <span className="font-medium tabular-nums">₹{money(orderGross)}</span>
            </div>
            {(parseFloat(order.discount_pct) > 0 || parseFloat(order.discount_amount) > 0) && (
              <div className="flex justify-between text-sm">
                <span className="text-amber-600">Discount{parseFloat(order.discount_pct) > 0 ? ` (${order.discount_pct}%)` : ''}</span>
                <span className="font-medium text-amber-600 tabular-nums">− ₹{money(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2">
              <span className="text-slate-800">Net Amount</span>
              <span className="tabular-nums">₹{money(net)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-emerald-600">Paid</span>
              <span className="font-semibold text-emerald-700 tabular-nums">₹{money(paid)}</span>
            </div>
            <div className={`flex justify-between text-sm font-bold border-t border-slate-100 pt-2 ${outstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              <span>Outstanding</span>
              <span className="tabular-nums">{outstanding > 0 ? `₹${money(outstanding)}` : '—'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card className="shadow-none border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-400" />
            Transactions
            <span className="text-xs text-slate-400 font-normal">({payments.length})</span>
          </h2>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={openAddPayment} className="h-7 text-xs px-3">
              <Plus className="w-3 h-3 mr-1" /> Add Transaction
            </Button>
          )}
        </div>
        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-sm text-slate-500 font-medium">No transactions yet</p>
            <p className="text-xs text-slate-400 mt-0.5">Payments against this item will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 border-b border-slate-100">
                  <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide pl-4 py-2.5">Date</TableHead>
                  <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide text-right py-2.5">Amount</TableHead>
                  <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2.5">Mode</TableHead>
                  <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2.5">Ref / Note</TableHead>
                  <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2.5">Voucher</TableHead>
                  <TableHead className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide py-2.5">By</TableHead>
                  {canDelete && <TableHead className="py-2.5 pr-4 w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <TableCell className="pl-4 py-2.5 text-sm text-slate-700">{fmtDate(p.payment_date)}</TableCell>
                    <TableCell className="text-right py-2.5 tabular-nums text-sm font-semibold text-emerald-700">
                      ₹{money(p.amount)}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${MODE_CHIP_COLORS[p.payment_mode] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {p.payment_mode?.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-slate-500 max-w-40">
                      {p.reference_no && <span className="font-mono text-slate-700 block truncate">{p.reference_no}</span>}
                      {p.note && <span className="truncate block">{p.note}</span>}
                      {!p.reference_no && !p.note && '—'}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {p.voucher_url ? (
                        <a
                          href={p.voucher_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:text-blue-700 flex items-center gap-1 text-xs"
                        >
                          <ImageIcon className="w-3.5 h-3.5" /> View
                        </a>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-slate-400">{p.created_by_name || '—'}</TableCell>
                    {canDelete && (
                      <TableCell className="pr-4 py-2.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-300 hover:text-red-500"
                          onClick={() => handleDeletePayment(p.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-t border-slate-100">
              <span className="text-xs text-slate-500">Total Paid</span>
              <span className="text-sm font-bold text-emerald-700 tabular-nums">₹{money(paid)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Item</DialogTitle>
            <DialogDescription className="text-sm">Update item details, quantity, rate, or discount.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium">Vendor Name</Label>
              <Input value={editForm.vendor_name} onChange={(e) => setE('vendor_name', e.target.value.toUpperCase())} className="h-9" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium">Item Name</Label>
              <Input value={editForm.item_name} onChange={(e) => setE('item_name', e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Input value={editForm.item_category} onChange={(e) => setE('item_category', e.target.value.toUpperCase())} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Unit</Label>
              <Input value={editForm.unit} onChange={(e) => setE('unit', e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Qty Ordered</Label>
              <Input type="number" min="0" step="any" value={editForm.qty_ordered} onChange={(e) => setE('qty_ordered', e.target.value)} className="h-9 tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Rate (₹ per {editForm.unit || 'unit'})</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
                <Input type="number" min="0" step="any" value={editForm.rate} onChange={(e) => setE('rate', e.target.value)} className="pl-7 h-9 tabular-nums" />
              </div>
            </div>

            {editGross > 0 && (
              <div className="col-span-2 bg-slate-50 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 text-xs">Gross Amount</span>
                  <span className="font-semibold text-slate-800 tabular-nums">₹{money(editGross)}</span>
                </div>
                {editDiscount > 0 && (
                  <div className="flex items-center justify-between text-sm mt-1.5">
                    <span className="text-slate-500 text-xs">Discount</span>
                    <span className="font-medium text-amber-600 tabular-nums">− ₹{money(editDiscount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-200">
                  <span className="text-xs font-semibold text-slate-700">Net Amount</span>
                  <span className="font-bold text-emerald-700 tabular-nums">₹{money(editNet)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Discount %</Label>
              <div className="relative">
                <Input type="number" min="0" max="100" step="any" value={editForm.discount_pct} onChange={(e) => onEditDiscPct(e.target.value)} className="pr-7 h-9 tabular-nums" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Discount ₹</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
                <Input type="number" min="0" step="any" value={editForm.discount_amount} onChange={(e) => onEditDiscFlat(e.target.value)} className="pl-7 h-9 tabular-nums" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Order Date</Label>
              <Input type="date" value={editForm.order_date} onChange={(e) => setE('order_date', e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Expected Date</Label>
              <Input type="date" value={editForm.expected_date} onChange={(e) => setE('expected_date', e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-medium">Note</Label>
              <Textarea rows={2} value={editForm.note} onChange={(e) => setE('note', e.target.value)} className="resize-none" />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)} disabled={submitting}>Cancel</Button>
            <Button size="sm" onClick={handleUpdate} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" /> Add Transaction
            </DialogTitle>
            <DialogDescription className="text-sm">
              Record a payment made to the vendor for this item.
              {outstanding > 0 && <> Outstanding: <strong>₹{money(outstanding)}</strong></>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-3 space-y-1.5">
                <Label className="text-xs font-medium">Amount (₹) <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-emerald-500">₹</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={paymentForm.amount}
                    onChange={(e) => setP('amount', e.target.value)}
                    placeholder="0"
                    className="pl-9 h-11 text-lg font-bold tabular-nums border-emerald-200 focus-visible:ring-emerald-400 text-emerald-700"
                    autoFocus
                  />
                </div>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Date</Label>
                <Input type="date" value={paymentForm.payment_date} onChange={(e) => setP('payment_date', e.target.value)} className="h-11" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payment Mode</Label>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentForm((p) => ({ ...p, payment_mode: m, reference_no: CASH_MODES.includes(m) ? '' : p.reference_no }))}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${
                      paymentForm.payment_mode === m
                        ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                        : MODE_CHIP_COLORS[m] || 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {!CASH_MODES.includes(paymentForm.payment_mode) && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reference / UTR / Cheque No</Label>
                <Input
                  value={paymentForm.reference_no}
                  onChange={(e) => setP('reference_no', e.target.value.toUpperCase())}
                  placeholder="UTR / CHQ / TXN NO"
                  className="h-9"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note</Label>
              <Textarea rows={2} value={paymentForm.note} onChange={(e) => setP('note', e.target.value)} placeholder="Advance payment, partial payment…" className="resize-none" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Voucher / Receipt</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => voucherRef.current?.click()}
                  disabled={uploadingVoucher}
                  className="h-8 text-xs"
                >
                  {uploadingVoucher ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-1.5" />}
                  Upload
                </Button>
                {paymentForm.voucher_url && (
                  <a href={paymentForm.voucher_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 flex items-center gap-1 hover:underline">
                    <ImageIcon className="w-3.5 h-3.5" /> View uploaded
                  </a>
                )}
              </div>
              <input ref={voucherRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleVoucherUpload} />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setPaymentOpen(false)} disabled={submitting}>Cancel</Button>
            <Button size="sm" onClick={handleAddPayment} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <IndianRupee className="w-3.5 h-3.5 mr-1.5" />}
              Record Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VendorInventoryDetail;

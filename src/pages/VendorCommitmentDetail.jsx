import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import UserAvatar from '../components/UserAvatar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
import { ArrowLeft, CalendarDays, ExternalLink, IndianRupee, Printer, Receipt, Store, Trash2, Wallet, Pencil, Loader2, Plus, UploadCloud, ImageIcon, ArrowDownRight, Package, ChevronDown, ChevronUp } from 'lucide-react';
import QRCode from 'qrcode';

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

const money = (n) => {
  const num = parseFloat(n) || 0;
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day} / ${month} / ${year}`;
};

const statusBadgeClass = (status) => {
  if (status === 'closed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'cancelled') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
};

const paymentStatusBadgeClass = (status) => {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'rejected') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
};

const VendorCommitmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentSite, isAdmin, canManage, user } = useAuth();
  const siteId = currentSite?.id;
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commitment, setCommitment] = useState(null);
  const [payments, setPayments] = useState([]);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState(null);
  const [approvers, setApprovers] = useState([]);
  const [editForm, setEditForm] = useState({
    payment_date: '',
    amount: '',
    payment_mode: 'cash',
    reference_no: '',
    note: '',
    voucher_url: '',
    assigned_admin_id: null,
  });

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const voucherInputRef = useState(null);
  const [inventoryOrders, setInventoryOrders] = useState([]);
  const [heads, setHeads] = useState([]);
  const [invDialogOpen, setInvDialogOpen] = useState(false);
  const [invForm, setInvForm] = useState({ item_name: '', item_category: '', unit: 'pcs', qty_ordered: '', rate: '', discount_pct: '0', discount_amount: '0', order_date: '', expected_date: '', note: '' });
  const [expandedItem, setExpandedItem] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_date: todayISO(),
    amount: '',
    payment_mode: 'cash',
    reference_no: '',
    note: '',
    voucher_url: '',
    assigned_admin_id: null,
  });
  // per-item delivery + split amounts inside the unified modal
  const [itemRows, setItemRows] = useState([]); // [{ order_id, item_name, unit, qty_pending, order_value, already_paid, outstanding, delivery_qty: '', alloc_amount: '' }]

  const fetchDetail = useCallback(async () => {
    if (!siteId || !id) return;
    setLoading(true);
    // Watchdog — never let the loader hang past 15s on a stalled request.
    const watchdog = setTimeout(() => setLoading(false), 15000);
    try {
      const [res, appRes, headsRes] = await Promise.all([
        api.get(`/vendors/commitments/${id}`, { params: { site_id: siteId } }),
        api.get(`/admin/approvers?site_id=${siteId}`).catch(() => ({ data: { approvers: [] } })),
        api.get('/vendors/heads', { params: { site_id: siteId } }).catch(() => ({ data: { heads: [] } })),
      ]);
      setCommitment(res.data.commitment || null);
      setPayments(res.data.payments || []);
      setInventoryOrders(res.data.inventoryOrders || []);
      setApprovers(appRes.data.approvers || []);
      setHeads(headsRes.data.heads || []);
    } catch (err) {
      setCommitment(null);
      setPayments([]);
      setInventoryOrders([]);
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  }, [id, siteId]);

  // Background refresh — does NOT toggle the page-wide loader, used after
  // create / update / delete so the dialog can close instantly.
  const refreshDetail = useCallback(async () => {
    if (!siteId || !id) return;
    try {
      const res = await api.get(`/vendors/commitments/${id}`, { params: { site_id: siteId } });
      setCommitment(res.data.commitment || null);
      setPayments(res.data.payments || []);
      setInventoryOrders(res.data.inventoryOrders || []);
    } catch { /* keep current */ }
  }, [id, siteId]);

  const getAssignedAdminLabel = (payment) => {
    if (!payment.assigned_admin_id || approvers.length === 0) return null;
    const admin = approvers.find((a) => String(a.id) === String(payment.assigned_admin_id));
    if (!admin) return `Admin #${payment.assigned_admin_id}`;
    return admin.full_name || admin.name || admin.email || `Admin #${admin.id}`;
  };

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const printReceipt = async (payment) => {
    if (!siteId) return;
    const amt = parseFloat(payment.amount) || 0;
    const absAmt = Math.abs(amt);
    const siteName = (currentSite?.name || 'ALLOTMENT DIVISION').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const payDate = payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const isCash = (payment.payment_mode || '').toLowerCase() === 'cash';
    const signerName = user?.full_name || user?.name || '';

    let qrDataUrl = null;
    if (payment.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(payment.verifyUrl, {
          width: 640, margin: 2, errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch { qrDataUrl = null; }
    }
    const qrSection = qrDataUrl
      ? `<div class="qr-section"><img src="${qrDataUrl}" alt="Verify QR" /><div class="qr-label">Scan to verify</div></div>`
      : '';

    const receiptBlock = (copyLabel) => `
      <div class="receipt-copy">
        <div class="copy-label">${copyLabel}</div>
        <div class="border-frame"></div>
        <div class="watermark">${siteName}</div>
        <div class="content">
          <div class="header">
            <h1>${siteName}</h1>
            <p>${siteAddr || 'VENDOR PAYMENT DIVISION'}</p>
          </div>
          <div class="doc-type"><h2>Vendor Payment Receipt</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> VPR-${payment.id}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>
          <div class="kv-qr-wrap">
            <div class="kv-section">
              <div class="kv-row"><div class="k">Paid To (Vendor)</div><div class="c">:</div><div class="v">${(commitment?.vendor_name || '—').toUpperCase()}</div></div>
              <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:#059669">RS ${fmtINR(absAmt)}/-</div></div>
              <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${(payment.payment_mode || '—').toUpperCase()}</div></div>
            </div>
            ${qrSection}
          </div>
          <div class="settlement-title">Payment Details:</div>
          <table class="data-table">
            <tr><th>S.No.</th><td>#${payment.id}</td></tr>
            <tr><th>Date</th><td>${payDate || '—'}</td></tr>
            <tr><th>Payment Mode</th><td>${(payment.payment_mode || '—').toUpperCase()}</td></tr>
            <tr><th>Reference No</th><td>${(payment.reference_no || '—').toUpperCase()}</td></tr>
            <tr><th>Note</th><td>${payment.note || '—'}</td></tr>
            <tr><th>Amount</th><td style="color:#059669">RS ${fmtINR(absAmt)}/-</td></tr>
          </table>
          ${isCash ? '<div class="bank-proviso">STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.</div>' : ''}
          <div class="footer">
            <div class="sig-box"><div class="sig-line">Vendor Signature</div></div>
            <div class="sig-box"><div class="digital-signature">${signerName}</div><div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
  <title>VENDOR PAYMENT RECEIPT - ${payment.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@400;500;600;700&display=swap');
    @page { size: A4 portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a1a; background: #f1f5f9; display: flex; justify-content: center; padding: 10mm 0; }
    .document { background: #fff; width: 210mm; min-height: 297mm; padding: 8mm 15mm; position: relative; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
    .receipt-copy { position: relative; flex: 1; display: flex; flex-direction: column; padding: 3mm 5mm; overflow: hidden; }
    .copy-label { position: absolute; top: 2mm; right: 3mm; font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .scissor-line { position: relative; border: none; border-top: 1.5px dashed #94a3b8; margin: 2mm 0; overflow: visible; }
    .scissor-line::before { content: '✂'; position: absolute; top: -10px; left: -2px; font-size: 16px; color: #94a3b8; line-height: 1; }
    .border-frame { position: absolute; top: 2mm; left: 2mm; right: 2mm; bottom: 2mm; border: 1px solid #cbd5e1; pointer-events: none; }
    .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-family: 'Cinzel', serif; font-size: 60px; color: rgba(226,232,240,0.25); font-weight: 700; z-index: 1; pointer-events: none; white-space: nowrap; text-transform: uppercase; }
    .content { position: relative; z-index: 10; flex: 1; display: flex; flex-direction: column; }
    .header { text-align: center; margin-bottom: 2mm; border-bottom: 2px double #0f172a; padding: 2mm 3mm 1.5mm; background: #f0fdf4; border-radius: 4px; }
    .header h1 { font-family: 'Cinzel', serif; font-size: 17px; color: #166534; letter-spacing: 2px; margin-bottom: 1px; text-transform: uppercase; }
    .header p { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; max-width: 80%; margin: 0 auto; }
    .doc-type { text-align: center; margin-bottom: 2mm; }
    .doc-type h2 { font-family: 'Cinzel', serif; font-size: 11px; color: #64748b; letter-spacing: 4px; text-transform: uppercase; display: inline-block; padding: 1px 15px; border-bottom: 1px solid #cbd5e1; }
    .meta-info { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 10px; padding: 0 3mm; }
    .meta-item b { color: #64748b; font-size: 8px; text-transform: uppercase; margin-right: 3px; }
    .kv-qr-wrap { display: flex; align-items: flex-start; gap: 4mm; padding: 0 3mm; margin-bottom: 2mm; }
    .kv-section { flex: 1; min-width: 0; }
    .kv-row { display: grid; grid-template-columns: 44% 4% 52%; gap: 1px; align-items: baseline; margin: 1mm 0; font-size: 10px; }
    .kv-row .k { color: #0f172a; font-weight: 600; } .kv-row .c { text-align: center; color: #475569; font-weight: 700; } .kv-row .v { color: #0f172a; font-weight: 600; text-transform: uppercase; }
    .qr-section { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; background: #fff; padding: 1.5mm; border: 1px solid #0f172a; border-radius: 3px; }
    .qr-section img { display: block; width: 30mm; height: 30mm; image-rendering: pixelated; image-rendering: crisp-edges; }
    .qr-label { font-size: 7px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; margin-top: 1mm; }
    .settlement-title { margin: 1mm 3mm 0.8mm; font-size: 10px; color: #0f172a; font-weight: 700; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
    .data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 0.8mm 3mm; text-align: left; line-height: 1.25; }
    .data-table th { background: #f8fafc; font-size: 8px; text-transform: uppercase; color: #64748b; width: 35%; }
    .data-table td { font-size: 10px; font-weight: 600; color: #0f172a; }
    .bank-proviso { margin-top: 1mm; padding: 1.8mm 2.5mm; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 8px; font-style: italic; color: #64748b; text-align: center; line-height: 1.4; }
    .footer { flex-shrink: 0; margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding: 3mm 5mm 1mm; }
    .sig-box { text-align: center; width: 55mm; min-height: 14mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-line { border-top: 1.5px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 22px; font-weight: 700; color: #1a237e; margin-bottom: 1px; line-height: 1; height: 8mm; display: flex; align-items: flex-end; justify-content: center; }
    .print-meta { flex-shrink: 0; text-align: center; font-size: 7.5px; color: #64748b; margin-top: 1.5mm; padding: 0.8mm 0 0; border-top: 1px dashed #e2e8f0; letter-spacing: 0.3px; }
    .print-meta b { color: #0f172a; font-weight: 600; }
    @media print { body { background: white; padding: 0; } .document { box-shadow: none !important; border: none !important; width: 210mm; height: 297mm; margin: 0 !important; padding: 8mm 15mm !important; } .receipt-copy { padding: 3mm 5mm !important; } .header { padding: 2mm 3mm !important; margin-bottom: 1.5mm !important; } .header h1 { font-size: 16px !important; } .doc-type { margin-bottom: 1.5mm !important; } .meta-info { margin-bottom: 1.5mm !important; } .kv-qr-wrap { margin-bottom: 1mm !important; } .qr-section img { width: 24mm !important; height: 24mm !important; } .settlement-title { margin: 1mm 3mm 0.5mm !important; } .data-table { margin-bottom: 1.5mm !important; } .data-table th, .data-table td { padding: 0.8mm 3mm !important; } .bank-proviso { margin-top: 1mm !important; padding: 1.5mm 2mm !important; font-size: 7px !important; line-height: 1.35 !important; } .footer { padding: 1.5mm 5mm 0 !important; } .sig-box { min-height: 11mm !important; } .digital-signature { font-size: 18px !important; height: 6mm !important; } .print-meta { margin-top: 0.5mm !important; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="document">
    ${receiptBlock('Office Copy')}
    <hr class="scissor-line" />
    ${receiptBlock('Vendor Copy')}
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=1000,height=750');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const openAddPaymentDialog = () => {
    const rows = inventoryOrders.map((o) => ({
      order_id: o.id,
      item_name: o.item_name,
      unit: o.unit,
      qty_ordered: parseFloat(o.qty_ordered) || 0,
      order_value: parseFloat(o.order_value) || 0,
      already_paid: parseFloat(o.total_paid) || 0,
      outstanding: Math.max(0, (parseFloat(o.order_value) || 0) - (parseFloat(o.total_paid) || 0)),
      alloc_amount: '',
    }));
    setItemRows(rows);
    setPaymentForm({
      payment_date: todayISO(),
      amount: commitment?.remaining_amount > 0 ? String(commitment.remaining_amount) : '',
      payment_mode: 'cash',
      reference_no: '',
      note: '',
      voucher_url: '',
      assigned_admin_id: null,
    });
    setPaymentDialogOpen(true);
  };

  // auto-distribute payment amount proportionally across items with outstanding balance
  const autoDistribute = (totalAmt) => {
    const total = parseFloat(totalAmt) || 0;
    if (total <= 0) { setItemRows(prev => prev.map(r => ({ ...r, alloc_amount: '' }))); return; }
    const totalOutstanding = itemRows.reduce((s, r) => s + r.outstanding, 0);
    if (totalOutstanding <= 0) return;
    setItemRows(prev => prev.map(r => {
      const share = totalOutstanding > 0 ? Math.min(r.outstanding, Math.round(total * (r.outstanding / totalOutstanding) * 100) / 100) : 0;
      return { ...r, alloc_amount: share > 0 ? String(share) : '' };
    }));
  };

  const handleVoucherUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVoucher(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/single?provider=s3', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data.fileUrl || res.data.url || '';
      if (editDialogOpen) setEditForm(prev => ({ ...prev, voucher_url: url }));
      else setPaymentForm(prev => ({ ...prev, voucher_url: url }));
    } catch (err) {
      alert('Upload failed');
    } finally {
      setUploadingVoucher(false);
    }
  };

  const handleAddPayment = async () => {
    if (!siteId || !id) return;
    setSubmitting(true);
    try {
      // 1. Record the commitment-level payment.
      const txDate = paymentForm.payment_date || todayISO();
      const totalPayment = parseFloat(paymentForm.amount) || 0;
      const totalOutstanding = itemRows.reduce((s, r) => s + r.outstanding, 0);

      // 2. Build allocations for items with outstanding balance.
      const allocations = [];
      for (const row of itemRows) {
        if (totalPayment > 0 && row.outstanding > 0 && totalOutstanding > 0) {
          const share = Math.min(
            row.outstanding,
            Math.round(totalPayment * (row.outstanding / totalOutstanding) * 100) / 100
          );
          if (share > 0) allocations.push({ order_id: row.order_id, amount: share });
        }
      }

      // 3. Send commitment-level payment + bulk distribute call IN PARALLEL.
      //    The single distribute endpoint replaces N round-trips.
      const tasks = [
        api.post(`/vendors/commitments/${id}/payments`, {
          site_id: siteId,
          payment_date: txDate,
          amount: totalPayment,
          payment_mode: paymentForm.payment_mode,
          reference_no: paymentForm.reference_no,
          note: paymentForm.note,
          voucher_url: paymentForm.voucher_url,
          assigned_admin_id: paymentForm.assigned_admin_id,
        }),
      ];
      if (allocations.length > 0) {
        tasks.push(api.post(`/vendors/commitments/${id}/distribute-payment`, {
          site_id: siteId,
          allocations,
          payment_date: txDate,
          payment_mode: paymentForm.payment_mode,
          reference_no: paymentForm.reference_no,
          note: paymentForm.note,
        }));
      }
      await Promise.all(tasks);

      // Close dialog immediately; reconcile in background.
      setPaymentDialogOpen(false);
      refreshDetail();
    } catch (err) {
      // surface error briefly — keep modal open
      alert(err?.response?.data?.message || 'Something failed. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditPaymentDialog = (payment) => {
    setEditingPayment(payment);
    setEditForm({
      payment_date: payment.payment_date ? payment.payment_date.split('T')[0] : '',
      amount: String(payment.amount || ''),
      payment_mode: (payment.payment_mode || 'cash').toLowerCase(),
      reference_no: payment.reference_no || '',
      note: payment.note || '',
      voucher_url: payment.voucher_url || '',
      assigned_admin_id: payment.assigned_admin_id || null,
    });
    setEditDialogOpen(true);
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment || !siteId) return;
    setSubmitting(true);
    try {
      const { data } = await api.put(`/vendors/payments/${editingPayment.id}`, {
        site_id: siteId,
        payment_date: editForm.payment_date || todayISO(),
        amount: parseFloat(editForm.amount) || 0,
        payment_mode: editForm.payment_mode,
        reference_no: editForm.reference_no,
        note: editForm.note,
        voucher_url: editForm.voucher_url,
        assigned_admin_id: editForm.assigned_admin_id,
      });
      // Optimistic in-place update of the payment row.
      const updated = data?.payment;
      if (updated) {
        setPayments((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      }
      setEditDialogOpen(false);
      setEditingPayment(null);
      refreshDetail(); // background reconcile (paid_amount / remaining)
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete || !siteId) return;
    setSubmitting(true);
    // Optimistic removal — instant UI feedback.
    const targetId = paymentToDelete.id;
    const snapshot = payments;
    setPayments((prev) => prev.filter((p) => p.id !== targetId));
    setDeleteDialogOpen(false);
    setPaymentToDelete(null);
    try {
      await api.delete(`/vendors/payments/${targetId}`, { params: { site_id: siteId } });
      refreshDetail();
    } catch (err) {
      setPayments(snapshot); // rollback
      alert(err?.response?.data?.message || 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPaid = useMemo(() => payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0), [payments]);

  // ── Inventory computed values ──────────────────────────────
  const inventorySummary = useMemo(() => {
    const totNet = inventoryOrders.reduce((s, o) => s + (parseFloat(o.order_value) || 0), 0);
    const totPaid = inventoryOrders.reduce((s, o) => s + (parseFloat(o.total_paid) || 0), 0);
    return { totalItems: inventoryOrders.length, totalNet: totNet, totalPaid: totPaid, outstanding: totNet - totPaid };
  }, [inventoryOrders]);

  // helper to calc gross / net on the fly in the form
  const calcInvFormAmounts = (form) => {
    const qty = parseFloat(form.qty_ordered) || 0;
    const rate = parseFloat(form.rate) || 0;
    const gross = qty * rate;
    const discPct = parseFloat(form.discount_pct) || 0;
    const discAmt = parseFloat(form.discount_amount) || 0;
    const discTotal = discPct > 0 ? gross * discPct / 100 : discAmt;
    return { gross: Math.round(gross * 100) / 100, net: Math.round((gross - discTotal) * 100) / 100 };
  };

  // ── Inventory handlers ──────────────────────────────────
  const openInvDialog = () => {
    setInvForm({ item_name: '', item_category: '', unit: 'pcs', qty_ordered: '', rate: '', discount_pct: '0', discount_amount: '0', order_date: todayISO(), expected_date: '', note: '' });
    setInvDialogOpen(true);
  };

  const handleAddInvItem = async () => {
    if (!siteId || !id) return;
    setSubmitting(true);
    try {
      await api.post('/vendors/inventory', {
        site_id: siteId,
        commitment_id: id,
        vendor_member_id: commitment?.vendor_member_id || null,
        vendor_name: commitment?.vendor_name || '',
        item_name: invForm.item_name,
        item_category: invForm.item_category,
        unit: invForm.unit,
        qty_ordered: parseFloat(invForm.qty_ordered) || 0,
        rate: parseFloat(invForm.rate) || 0,
        discount_pct: parseFloat(invForm.discount_pct) || 0,
        discount_amount: parseFloat(invForm.discount_amount) || 0,
        order_date: invForm.order_date || todayISO(),
        expected_date: invForm.expected_date || null,
        note: invForm.note,
      });
      setInvDialogOpen(false);
      refreshDetail(); // background reconcile (computed fields come from server)
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteInvItem = async (orderId) => {
    if (!siteId || !confirm('Delete this inventory item and all its transactions?')) return;
    // Optimistic removal — instant UI feedback.
    const snapshot = inventoryOrders;
    setInventoryOrders((prev) => prev.filter((o) => o.id !== orderId));
    try {
      await api.delete(`/vendors/inventory/${orderId}`, { params: { site_id: siteId } });
      refreshDetail();
    } catch (err) {
      setInventoryOrders(snapshot); // rollback
      alert(err?.response?.data?.message || 'Delete failed');
    }
  };

  const handleDeleteInvPayment = async (paymentId) => {
    if (!siteId || !confirm('Delete this transaction?')) return;
    // Optimistic removal — strip the payment from whichever item holds it.
    const snapshot = inventoryOrders;
    setInventoryOrders((prev) => prev.map((o) => ({
      ...o,
      payments: (o.payments || []).filter((p) => p.id !== paymentId),
    })));
    try {
      await api.delete(`/vendors/inventory/inv-payments/${paymentId}`, { params: { site_id: siteId } });
      refreshDetail();
    } catch (err) {
      setInventoryOrders(snapshot); // rollback
      alert(err?.response?.data?.message || 'Delete failed');
    }
  };

  const invStatusLabel = (s) => s === 'completed' ? 'Paid' : s === 'partial' ? 'Partial' : s === 'cancelled' ? 'Cancelled' : 'Unpaid';
  const invStatusColor = (s) => {
    if (s === 'completed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'cancelled') return 'bg-red-100 text-red-700 border-red-200';
    if (s === 'partial') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  if (!currentSite) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Store className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Select a site to view vendor payment records</p>
      </div>
    );
  }

  return (
    <div className="max-w-350 space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-linear-to-r from-white via-slate-50 to-emerald-50/60 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/vendors')} className="h-8 w-8 p-0 mt-0.5">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Vendor Commitment</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Payment records for {currentSite?.name || 'site'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openAddPaymentDialog}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Payment
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      ) : !commitment ? (
        <div className="text-center py-16">
          <p className="text-sm text-slate-500">Commitment not found.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-blue-200/80 bg-linear-to-br from-blue-50/50 via-white to-blue-50/30 p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500/80">Vendor</p>
                <Store className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-xl font-bold text-slate-900 truncate">{commitment.vendor_name}</p>
            </div>
            
            <div className="rounded-2xl border border-slate-200/80 bg-linear-to-br from-slate-50/50 via-white to-slate-50/30 p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500/80">Contract</p>
                <IndianRupee className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xl font-bold text-slate-900">₹{money(commitment.contract_amount)}</p>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 bg-linear-to-br from-emerald-50/50 via-white to-emerald-50/30 p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">Paid Total</p>
                <div className="p-1 rounded-full bg-emerald-100/50"><ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" /></div>
              </div>
              <p className="text-xl font-bold text-emerald-700">₹{money(totalPaid)}</p>
            </div>

            <div className="rounded-2xl border border-red-200/80 bg-linear-to-br from-red-50/50 via-white to-red-50/30 p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-500/80">Remaining</p>
                <Wallet className="w-4 h-4 text-red-400" />
              </div>
              <div className="mt-1">
                {parseFloat(commitment.remaining_amount) < 0 ? (
                  <p className="text-xl font-black text-emerald-600">Overpaid: ₹{money(Math.abs(commitment.remaining_amount))}</p>
                ) : (
                  <p className="text-xl font-black text-red-600">₹{money(commitment.remaining_amount)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Commitment Info */}
          <div className="rounded-2xl border border-slate-200/90 bg-white/60 backdrop-blur-sm px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">{commitment.head_name} <span className="mx-2 text-slate-300">/</span> {commitment.work_title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Created {fmtDate(commitment.created_at)}</span>
                    {commitment.start_date && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="flex items-center gap-1.5">Start: {fmtDate(commitment.start_date)}</span>
                      </>
                    )}
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> {payments.length} Payments</span>
                  </div>
                </div>
              </div>
              <Badge variant="outline" className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-xs ${statusBadgeClass(commitment.status)}`}>
                {commitment.status}
              </Badge>
            </div>
          </div>

          {/* ── Inventory Items Section ─────────────────────────── */}
          <Card className="shadow-none border-slate-200">
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-800">Inventory Items ({inventoryOrders.length})</h3>
                  {inventorySummary.totalItems > 0 && (
                    <span className="text-[10px] text-slate-400 ml-2">
                      Net: ₹{money(inventorySummary.totalNet)} &middot; Paid: ₹{money(inventorySummary.totalPaid)} &middot; Due: ₹{money(inventorySummary.outstanding)}
                    </span>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openInvDialog}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
                    </Button>
                  </div>
                )}
              </div>

              {inventoryOrders.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No inventory items added yet. Add items to track orders &amp; payment transactions.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {inventoryOrders.map((item) => {
                    const isExpanded = expandedItem === item.id;
                    const qtyOrdered = parseFloat(item.qty_ordered) || 0;
                    const orderVal = parseFloat(item.order_value) || 0;
                    const paidAmt = parseFloat(item.total_paid) || 0;
                    const outstanding = parseFloat(item.outstanding) || 0;
                    const payPct = orderVal > 0 ? Math.min(100, (paidAmt / orderVal) * 100) : 0;

                    return (
                      <div key={item.id} className="bg-white">
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-900 truncate">{item.item_name}</span>
                              {item.item_category && (
                                <Badge variant="secondary" className="px-1.5 py-0 text-[9px] uppercase">{item.item_category}</Badge>
                              )}
                              <Badge variant="outline" className={`px-1.5 py-0 text-[9px] uppercase font-medium ${invStatusColor(item.status)}`}>
                                {invStatusLabel(item.status)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 flex-wrap">
                              <span>{money(qtyOrdered)} <span className="text-slate-400">{item.unit}</span> × ₹{money(item.rate)}</span>
                              <span>Net: ₹{money(orderVal)}</span>
                              <span className="text-emerald-600 font-medium">Paid: ₹{money(paidAmt)}</span>
                              <span className={outstanding > 0 ? 'text-red-500 font-medium' : 'text-emerald-600 font-medium'}>
                                {outstanding > 0 ? `Due: ₹${money(outstanding)}` : 'Paid ✓'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5 max-w-md">
                              <span className="text-[9px] text-slate-400 w-12 shrink-0">Payment</span>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${payPct}%` }} />
                              </div>
                              <span className="text-[9px] text-slate-400 w-8 text-right">{Math.round(payPct)}%</span>
                            </div>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 bg-slate-50/50 border-t border-slate-100">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs">
                              <div><span className="text-slate-400 block">Qty Ordered</span><span className="font-semibold text-slate-800">{money(qtyOrdered)} {item.unit}</span></div>
                              <div><span className="text-slate-400 block">Rate</span><span className="font-semibold text-slate-800">₹{money(item.rate)} / {item.unit}</span></div>
                              <div><span className="text-slate-400 block">Discount</span><span className="font-semibold text-slate-800">{parseFloat(item.discount_pct) > 0 ? `${item.discount_pct}%` : `₹${money(item.discount_amount)}`}</span></div>
                              <div><span className="text-slate-400 block">Gross Amount</span><span className="font-semibold text-slate-800">₹{money(item.order_gross)}</span></div>
                              <div><span className="text-slate-400 block">Net Amount</span><span className="font-semibold text-emerald-700">₹{money(orderVal)}</span></div>
                              <div><span className="text-slate-400 block">Total Paid</span><span className="font-semibold text-blue-700">₹{money(paidAmt)}</span></div>
                              <div><span className="text-slate-400 block">Outstanding</span><span className={`font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{money(outstanding)}</span></div>
                              <div><span className="text-slate-400 block">Transactions</span><span className="font-semibold text-slate-800">{item.payments?.length || 0}</span></div>
                            </div>

                            {/* Transactions (payment records) */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Transactions ({item.payments?.length || 0})</span>
                              </div>
                              {(item.payments?.length || 0) === 0 ? (
                                <p className="text-[11px] text-slate-400 pl-5">No transactions yet.</p>
                              ) : (
                                <div className="space-y-1 pl-5">
                                  {item.payments.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between bg-white rounded px-3 py-1.5 text-xs border border-slate-100">
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-slate-500">{fmtDate(p.payment_date)}</span>
                                        <span className="font-semibold text-emerald-700 tabular-nums">₹{money(p.amount)}</span>
                                        <Badge variant="secondary" className="px-1.5 py-0 text-[9px] uppercase">{p.payment_mode}</Badge>
                                        {p.reference_no && <span className="text-slate-400">{p.reference_no}</span>}
                                        {p.note && <span className="text-slate-400 truncate max-w-40">{p.note}</span>}
                                      </div>
                                      {canManage && (
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); handleDeleteInvPayment(p.id); }}>
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {canManage && (
                              <div className="flex justify-end pt-2 border-t border-slate-100">
                                <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); handleDeleteInvItem(item.id); }}>
                                  <Trash2 className="w-3 h-3 mr-1" /> Delete Item
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none border-slate-200">
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">Payment Records ({payments.length})</h3>
              </div>
              {payments.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">No payments recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="text-xs font-semibold py-3 h-11 text-slate-900">Date</TableHead>
                        <TableHead className="text-xs font-semibold py-3 h-11 text-slate-900">Mode</TableHead>
                        <TableHead className="text-xs font-semibold py-3 h-11 text-slate-900">Status</TableHead>
                        <TableHead className="text-xs font-semibold py-3 h-11 text-slate-900">Reference / Note</TableHead>
                        <TableHead className="text-xs font-semibold py-3 h-11 text-slate-900">Voucher</TableHead>
                        <TableHead className="text-xs font-semibold py-3 h-11 text-slate-900">Assigned Admin</TableHead>
                        <TableHead className="text-xs font-semibold py-3 h-11 text-slate-900">Created By</TableHead>
                        <TableHead className="text-xs font-semibold py-3 h-11 text-slate-900 text-right">Amount</TableHead>
                        <TableHead className="text-xs font-semibold py-3 h-11 text-slate-900 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="py-2.5">
                            <span className="flex items-center gap-2 text-sm text-slate-700">
                              <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                              {fmtDate(p.payment_date)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="secondary" className="px-2 py-0 text-[10px] uppercase font-medium">
                              {p.payment_mode}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="outline" className={`px-2 py-0 text-[10px] uppercase font-medium ${paymentStatusBadgeClass(p.status)}`}>
                              {p.status || 'pending'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5 max-w-64">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-slate-900">{p.reference_no || '—'}</span>
                              <span className="text-[11px] text-slate-500 line-clamp-1">{p.note || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            {p.voucher_url ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-slate-500"
                                onClick={() => window.open(p.voucher_url, '_blank')}
                                title="View Voucher"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {p.assigned_admin_id ? (
                              <span className="text-xs font-medium text-slate-700">
                                {getAssignedAdminLabel(p)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <UserAvatar name={p.created_by_name} label="Created by" />
                          </TableCell>
                          <TableCell className="py-2.5 text-right">
                            <span className="text-sm font-semibold text-slate-900">₹{money(p.amount)}</span>
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            <div className="inline-flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600"
                                title="Print receipt"
                                onClick={() => printReceipt(p)}
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                                title="Edit payment"
                                onClick={() => openEditPaymentDialog(p)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
                                title="Delete payment"
                                onClick={() => {
                                  setPaymentToDelete(p);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Payment</DialogTitle>
            <DialogDescription className="text-sm">Update vendor transaction details.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-3 space-y-1.5">
                <Label className="text-xs font-medium">Amount (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-emerald-500">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="pl-9 text-lg h-11 font-bold tabular-nums border-emerald-200 focus-visible:ring-emerald-400 text-emerald-700"
                  />
                </div>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Date</Label>
                <Input
                  type="date"
                  value={editForm.payment_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, payment_date: e.target.value }))}
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
                    onClick={() => setEditForm((prev) => ({ ...prev, payment_mode: m, reference_no: CASH_MODES.includes(m) ? '' : prev.reference_no }))}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${editForm.payment_mode === m
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
            {!CASH_MODES.includes(editForm.payment_mode) && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Reference / UTR / Cheque No</Label>
                <Input
                  value={editForm.reference_no}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, reference_no: e.target.value.toUpperCase() }))}
                  placeholder="UTR / CHQ / TXN NO"
                  className="h-9"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note</Label>
              <Textarea
                rows={2}
                value={editForm.note}
                onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Payment milestone or remark"
                className="resize-none"
              />
            </div>

            {approvers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Assign To Admin</Label>
                <Select
                  value={editForm.assigned_admin_id?.toString() || '_none'}
                  onValueChange={(val) => setEditForm((prev) => ({ ...prev, assigned_admin_id: val === '_none' ? null : parseInt(val) }))}
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
                  onClick={() => document.getElementById('voucher-edit-upload').click()}
                  disabled={uploadingVoucher}
                >
                  {uploadingVoucher ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-1.5" />}
                  {uploadingVoucher ? 'Uploading...' : 'Upload'}
                </Button>
                <input
                  id="voucher-edit-upload"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleVoucherUpload}
                  className="hidden"
                />
                {editForm.voucher_url && (
                  <a href={editForm.voucher_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                    <ImageIcon className="w-3.5 h-3.5" /> Attached
                  </a>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleUpdatePayment} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5 mr-1.5" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Payment</DialogTitle>
            <DialogDescription className="text-sm">This will permanently remove this transaction entry.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleDeletePayment} disabled={submitting}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Unified Record Payment Dialog ───────────────────────── */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-600" /> Record Payment
            </DialogTitle>
            <DialogDescription className="text-sm">
              Enter payment details. If inventory items exist, the amount is auto-distributed to each item by outstanding balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount + Date */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="sm:col-span-3 space-y-1.5">
                <Label className="text-xs font-medium">Amount (₹) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-emerald-500">₹</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => {
                      setPaymentForm((prev) => ({ ...prev, amount: e.target.value }));
                      autoDistribute(e.target.value);
                    }}
                    placeholder="50000"
                    className="pl-9 text-lg h-11 font-bold tabular-nums border-emerald-200 focus-visible:ring-emerald-400 text-emerald-700"
                  />
                </div>
                {paymentForm.amount && (
                  <p className="text-[10px] font-medium text-emerald-500">
                    ₹{(parseFloat(paymentForm.amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })} will be recorded
                  </p>
                )}
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Date</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
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
                  onClick={() => document.getElementById('voucher-detail-upload').click()}
                  disabled={uploadingVoucher}
                >
                  {uploadingVoucher ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5 mr-1.5" />}
                  {uploadingVoucher ? 'Uploading...' : 'Upload Voucher'}
                </Button>
                <input
                  id="voucher-detail-upload"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleVoucherUpload}
                  className="hidden"
                />
                {paymentForm.voucher_url && (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" /> Attached
                  </span>
                )}
              </div>
            </div>

            {/* ── Inventory Items: auto-allocated ── */}
            {itemRows.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-700">Auto-allocation to Items</span>
                  <span className="text-[10px] text-slate-400 ml-1">(payment distributed proportionally by outstanding)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-500 border-t border-slate-100">
                        <th className="text-left font-semibold px-3 py-2">Item</th>
                        <th className="text-right font-semibold px-2 py-2">Net Value</th>
                        <th className="text-right font-semibold px-2 py-2">Already Paid</th>
                        <th className="text-right font-semibold px-2 py-2">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemRows.map((row) => (
                        <tr key={row.order_id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-medium text-slate-800">
                            {row.item_name}
                            {row.unit && <span className="text-slate-400 ml-1">({row.unit})</span>}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-slate-700">₹{money(row.order_value)}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-emerald-600">₹{money(row.already_paid)}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-red-600">
                            {row.outstanding > 0 ? `₹${money(row.outstanding)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPaymentDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleAddPayment} disabled={submitting || !paymentForm.amount} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5">
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <IndianRupee className="w-3.5 h-3.5 mr-1.5" />}
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Inventory Item Dialog ───────────────────────── */}
      <Dialog open={invDialogOpen} onOpenChange={setInvDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Add Inventory Item</DialogTitle>
            <DialogDescription className="text-sm">Track an ordered item for this commitment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Item Name *</Label>
                <Input value={invForm.item_name} onChange={(e) => setInvForm(p => ({ ...p, item_name: e.target.value }))} placeholder="e.g. Bricks, Cement" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Category</Label>
                <Select value={invForm.item_category} onValueChange={(val) => setInvForm(p => ({ ...p, item_category: val }))}>
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
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Qty Ordered *</Label>
                <Input type="number" value={invForm.qty_ordered} onChange={(e) => setInvForm(p => ({ ...p, qty_ordered: e.target.value }))} placeholder="10000" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Unit</Label>
                <Input value={invForm.unit} onChange={(e) => setInvForm(p => ({ ...p, unit: e.target.value }))} placeholder="pcs / bags / kg" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Rate (₹) *</Label>
                <Input type="number" step="0.01" value={invForm.rate} onChange={(e) => setInvForm(p => ({ ...p, rate: e.target.value }))} placeholder="7.50" className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Discount %</Label>
                <Input type="number" step="0.01" value={invForm.discount_pct} onChange={(e) => setInvForm(p => ({ ...p, discount_pct: e.target.value, discount_amount: '0' }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Discount ₹ (flat)</Label>
                <Input type="number" step="0.01" value={invForm.discount_amount} onChange={(e) => setInvForm(p => ({ ...p, discount_amount: e.target.value, discount_pct: '0' }))} className="h-9" />
              </div>
            </div>
            {/* Live formula preview */}
            {(parseFloat(invForm.qty_ordered) > 0 && parseFloat(invForm.rate) > 0) && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs space-y-0.5">
                <div className="flex justify-between"><span className="text-slate-500">Gross ({invForm.qty_ordered} × ₹{invForm.rate})</span><span className="font-semibold">₹{money(calcInvFormAmounts(invForm).gross)}</span></div>
                {(parseFloat(invForm.discount_pct) > 0 || parseFloat(invForm.discount_amount) > 0) && (
                  <div className="flex justify-between text-orange-600"><span>Discount</span><span>- ₹{money(calcInvFormAmounts(invForm).gross - calcInvFormAmounts(invForm).net)}</span></div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1"><span className="font-semibold text-slate-700">Net Amount</span><span className="font-bold text-emerald-700">₹{money(calcInvFormAmounts(invForm).net)}</span></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Order Date</Label>
                <Input type="date" value={invForm.order_date} onChange={(e) => setInvForm(p => ({ ...p, order_date: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Expected Date</Label>
                <Input type="date" value={invForm.expected_date} onChange={(e) => setInvForm(p => ({ ...p, expected_date: e.target.value }))} className="h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note</Label>
              <Textarea rows={2} value={invForm.note} onChange={(e) => setInvForm(p => ({ ...p, note: e.target.value }))} placeholder="Additional details" className="resize-none" />
            </div>
          </div>
          <DialogFooter className="pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setInvDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button type="button" size="sm" onClick={handleAddInvItem} disabled={submitting || !invForm.item_name.trim() || !invForm.qty_ordered || !invForm.rate} className="bg-slate-800 hover:bg-slate-900 text-white px-5">
              {submitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Package className="w-3.5 h-3.5 mr-1.5" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default VendorCommitmentDetail;

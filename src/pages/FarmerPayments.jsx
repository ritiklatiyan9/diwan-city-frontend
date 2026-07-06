import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import UserAvatar from '../components/UserAvatar';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  ArrowLeft, Plus, Edit2, Trash2, AlertCircle, Check,
  IndianRupee, Calendar, X, Tractor,
  Download, Phone, MapPin, Camera, Clock, Send, Loader2,
  Banknote, CreditCard, Building2, FileSpreadsheet, Printer, Eye, FileText,
  ArrowDownRight, ArrowUpRight,
} from 'lucide-react';
import VoucherUpload, { VoucherThumbnail } from '../components/VoucherUpload';
import ApprovalStatusBadge from '../components/ApprovalStatusBadge';
import ChequeStatusControl from '../components/ChequeStatusControl';
import QRCode from 'qrcode';

const CASH_PARTICULARS = ['CASH'];
const BANK_PARTICULARS = ['RTGS', 'NEFT', 'UPI','IMPS', 'BANK TRANSFER'];
const getParticularsForMode = (mode) => {
  if (mode === 'BANK') return BANK_PARTICULARS;
  if (mode === 'CHEQUE') return ['CHEQUE'];
  return CASH_PARTICULARS;
};

const todayISO = () => new Date().toISOString().split('T')[0];


const FarmerPayments = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, canManage, user, currentSite, hasPermission } = useAuth();
  const canWrite  = canManage && hasPermission('farmers', 'write');
  const canUpdate = canManage && hasPermission('farmers', 'update');
  const canDelete = canManage && hasPermission('farmers', 'delete');

  const [farmer, setFarmer] = useState(null);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({ total_amount: 0, total_paid: 0, remaining: 0, cash_to_pay: 0, bank_to_pay: 0, cash_paid: 0, bank_paid: 0, cash_remaining: 0, bank_remaining: 0 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [approvers, setApprovers] = useState([]);
  const [proofPhoto, setProofPhoto] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [editRequestPending, setEditRequestPending] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const receiptRef = useRef(null);
  const statementRef = useRef(null);

  const [formData, setFormData] = useState({
    date: todayISO(),
    transaction_type: 'credit',
    particular: 'CASH',
    mode: 'CASH',
    amount: '',
    by_note: '',
    remarks: '',
    payment_mode: 'CASH',
    cash_amount: '',
    bank_amount: '',
    bank_name: '',
    bank_account_no: '',
    bank_reference: '',
    bank_ifsc: '',
    voucher_url: '',
    assigned_admin_id: null,
    cheque_no: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Watchdog so the spinner can never hang on a stalled request.
      const watchdog = setTimeout(() => setLoading(false), 15000);
      const res = await api.get(`/farmers/${id}/payments`);
      clearTimeout(watchdog);
      setFarmer(res.data.farmer);
      setPayments(res.data.payments || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Failed to fetch farmer payments:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Background refresh — does NOT toggle the page-wide loader, used after
  // create / update / delete so the dialog can close instantly.
  const refreshData = useCallback(async () => {
    try {
      const res = await api.get(`/farmers/${id}/payments`);
      setFarmer(res.data.farmer);
      setPayments(res.data.payments || []);
      setSummary(res.data.summary || {});
    } catch { /* keep current */ }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const url = currentSite?.id ? `/admin/approvers?site_id=${currentSite.id}` : '/admin/approvers';
    api.get(url)
      .then((res) => setApprovers(res.data.approvers || []))
      .catch(() => setApprovers([]));
  }, [currentSite?.id]);

  const getAssignedAdminLabel = (entry) => {
    if (entry?.assigned_admin_name) return entry.assigned_admin_name;
    const assignedId = entry?.assigned_admin_id;
    if (!assignedId) return null;
    const approver = approvers.find((a) => String(a.id) === String(assignedId));
    return approver?.full_name || approver?.name || approver?.email || `Admin #${assignedId}`;
  };

  const resetForm = () => {
    setFormData({
      date: todayISO(),
      transaction_type: 'credit',
      particular: 'CASH',
      mode: 'CASH',
      amount: '',
      by_note: '',
      remarks: '',
      payment_mode: 'CASH',
      cash_amount: '',
      bank_amount: '',
      bank_name: '',
      bank_account_no: '',
      bank_reference: '',
      bank_ifsc: '',
      voucher_url: '',
      assigned_admin_id: null,
      cheque_no: '',
    });
    setEditingPayment(null);
    setMessage({ type: '', text: '' });
    setProofPhoto(null);
    setProofPreview(null);
    setEditRequestPending(false);
    setSubmitting(false);
  };

  const handleProofPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProofPhoto(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (payment) => {
    const mode = payment.payment_mode === 'CHEQUE' || payment.particular === 'CHEQUE'
      ? 'CHEQUE'
      : (payment.payment_mode === 'BANK' || BANK_PARTICULARS.includes(payment.particular))
        ? 'BANK'
        : 'CASH';
    const absAmount = Math.abs(parseFloat(payment.amount) || 0);
    const transactionType = (parseFloat(payment.amount) || 0) < 0 ? 'debit' : 'credit';
    setFormData({
      date: payment.date ? payment.date.split('T')[0] : '',
      particular: payment.particular || 'CASH',
      transaction_type: transactionType,
      mode,
      amount: absAmount || '',
      by_note: payment.by_note || '',
      remarks: payment.remarks || '',
      payment_mode: payment.payment_mode || 'CASH',
      cash_amount: payment.cash_amount ? Math.abs(payment.cash_amount) : '',
      bank_amount: payment.bank_amount ? Math.abs(payment.bank_amount) : '',
      bank_name: payment.bank_name || '',
      bank_account_no: payment.bank_account_no || '',
      bank_reference: payment.bank_reference || '',
      bank_ifsc: payment.bank_ifsc || '',
      voucher_url: payment.voucher_url || '',
      assigned_admin_id: payment.assigned_admin_id || null,
      cheque_no: payment.cheque_no || '',
    });
    setEditingPayment(payment.id);
    setDialogOpen(true);
  };

  // Handle form changes with mode-based logic
  const handleFormChange = (field, value) => {
    const newForm = { ...formData, [field]: value };

    // When mode changes, reset particular to first option of that mode & clear irrelevant fields
    if (field === 'mode') {
      const particulars = getParticularsForMode(value);
      newForm.particular = particulars[0];
      newForm.payment_mode = value;
      newForm.cheque_no = value === 'CHEQUE' ? (newForm.cheque_no || '') : '';
      if (value === 'CASH') {
        newForm.bank_name = '';
        newForm.bank_account_no = '';
        newForm.bank_reference = '';
        newForm.bank_ifsc = '';
      }
    }

    setFormData(newForm);
  };

  // ─────────────────────────────────────────────────────────────
  // Local helper: re-derive the summary card numbers (paid / remaining /
  // cash / bank) from a given payments array. Used by every optimistic
  // update so the cards stay in sync with the table without waiting for
  // a refetch.
  // ─────────────────────────────────────────────────────────────
  const recomputeSummary = useCallback((nextPayments, baseFarmer) => {
    const f = baseFarmer || farmer || {};
    const totalAmount = parseFloat(f.total_amount) || 0;
    const cashToPay = parseFloat(f.cash_amount) || 0;
    const bankToPay = parseFloat(f.bank_amount) || 0;
    let totalPaid = 0, cashPaid = 0, bankPaid = 0, totalInterest = 0;
    for (const p of nextPayments) {
      if (p.cheque_status === 'BOUNCED' || p.cheque_status === 'RETURNED') continue;
      totalPaid += parseFloat(p.amount) || 0;
      cashPaid += parseFloat(p.cash_amount) || 0;
      bankPaid += parseFloat(p.bank_amount) || 0;
      totalInterest += parseFloat(p.interest_amount) || 0;
    }
    return {
      total_amount: totalAmount,
      total_paid: totalPaid,
      total_interest: totalInterest,
      remaining: totalAmount - totalPaid,
      cash_to_pay: cashToPay,
      bank_to_pay: bankToPay,
      cash_paid: cashPaid,
      bank_paid: bankPaid,
      cash_remaining: cashToPay - cashPaid,
      bank_remaining: bankToPay - bankPaid,
    };
  }, [farmer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setSubmitting(true);

    const baseAmt = parseFloat(formData.amount) || 0;
    const totalAmt = formData.transaction_type === 'debit' ? -Math.abs(baseAmt) : Math.abs(baseAmt);
    const payload = {
      ...formData,
      date: formData.date || todayISO(),
      amount: totalAmt,
      cash_amount: formData.mode === 'CASH' ? totalAmt : 0,
      bank_amount: formData.mode === 'BANK' ? totalAmt : 0,
      assigned_admin_id: formData.assigned_admin_id,
      payment_mode: formData.mode,
      cheque_no: formData.mode === 'CHEQUE' ? (formData.cheque_no || null) : null,
    };

    try {
      // ── Sub-admin edit-request branch (no optimistic update — admin must approve) ──
      if (editingPayment && !canUpdate) {
        const fd = new FormData();
        fd.append('module', 'farmer_payment');
        fd.append('record_id', editingPayment);
        fd.append('proposed_data', JSON.stringify(payload));
        if (farmer?.site_id) fd.append('site_id', farmer.site_id);
        if (proofPhoto) fd.append('proof_photo', proofPhoto);
        await api.post('/edit-requests', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setMessage({ type: 'success', text: 'Edit request submitted for admin approval' });
        setEditRequestPending(true);
        setDialogOpen(false);
        return;
      }

      // ── Create / direct-update branches ──
      // CLOSE THE DIALOG IMMEDIATELY and apply optimistic UI before the
      // network call. The user-visible latency drops to ~0ms regardless of
      // the API round-trip; we roll back on failure.
      const snapshotPayments = payments;
      const snapshotSummary = summary;

      if (editingPayment) {
        // Optimistic edit: splice the new values into the existing row.
        const optimisticPayments = payments.map((p) =>
          p.id === editingPayment ? { ...p, ...payload, id: editingPayment } : p
        );
        setPayments(optimisticPayments);
        setSummary(recomputeSummary(optimisticPayments));
      } else {
        // Optimistic create: append a temp row (server returns payments in
        // date-ASC order, so the newest one belongs at the end). We use a
        // negative id so refreshData() can identify and replace it.
        const tempId = -Date.now();
        const tempPayment = {
          id: tempId,
          farmer_id: parseInt(id),
          ...payload,
          status: 'pending',
          cheque_status: payload.payment_mode === 'CHEQUE' ? 'PENDING' : null,
          created_by: user?.id || null,
          created_by_name: user?.full_name || user?.name || null,
          created_at: new Date().toISOString(),
        };
        const optimisticPayments = [...payments, tempPayment];
        setPayments(optimisticPayments);
        setSummary(recomputeSummary(optimisticPayments));
      }

      // Close dialog now — feels instant to the user.
      setDialogOpen(false);

      try {
        if (editingPayment) {
          await api.put(`/farmers/${id}/payments/${editingPayment}`, payload);
          setMessage({ type: 'success', text: 'Payment updated' });
        } else {
          await api.post(`/farmers/${id}/payments`, payload);
          setMessage({ type: 'success', text: 'Payment added' });
        }
        // Reconcile in the background — server computes verifyUrl, totals,
        // running balance, and replaces the temp negative-id row with the
        // canonical record.
        refreshData();
      } catch (err) {
        // Roll back to the snapshot taken before the optimistic update.
        setPayments(snapshotPayments);
        setSummary(snapshotSummary);
        setMessage({ type: 'error', text: err.response?.data?.message || 'Operation failed' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (paymentId) => {
    if (!window.confirm('Delete this payment entry?')) return;
    // Optimistic removal — instant UI feedback. Recompute summary too.
    const snapshotPayments = payments;
    const snapshotSummary = summary;
    const nextPayments = payments.filter((p) => p.id !== paymentId);
    setPayments(nextPayments);
    setSummary(recomputeSummary(nextPayments));
    try {
      await api.delete(`/farmers/${id}/payments/${paymentId}`);
      refreshData();
    } catch (err) {
      setPayments(snapshotPayments);
      setSummary(snapshotSummary);
      console.error('Failed to delete payment:', err);
    }
  };

  const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Running total
  const paymentsWithRunning = useMemo(() => {
    let runningTotal = 0;
    return payments.map((p) => {
      runningTotal += parseFloat(p.amount) || 0;
      return { ...p, running_total: runningTotal };
    });
  }, [payments]);

  // Completion percentage
  const progressPct = summary.total_amount > 0 ? Math.min((summary.total_paid / summary.total_amount) * 100, 100) : 0;

  // ── Receipt & Export Functions ──
  const openReceipt = (payment) => {
    setReceiptPayment(payment);
    setReceiptDialogOpen(true);
  };

  const handlePrintReceipt = async (paymentArg) => {
    const pay = paymentArg || receiptPayment;
    if (!pay) return;
    const amt = parseFloat(pay.amount) || 0;
    const absAmt = Math.abs(amt);
    const siteName = (currentSite?.name || 'ALLOTMENT DIVISION').toUpperCase();
    const siteAddr = [currentSite?.address, currentSite?.city, currentSite?.state].filter(Boolean).join(', ').toUpperCase();
    const fmtINR = (v) => parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
    const payDate = pay.date ? new Date(pay.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const printedAt = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
    const isCash = (pay.payment_mode || '').toUpperCase() === 'CASH';
    const signerName = user?.full_name || user?.name || '';
    const bankInfo = pay.bank_name ? `${pay.bank_name}${pay.bank_account_no ? ' - ' + pay.bank_account_no : ''}` : '—';

    let qrDataUrl = null;
    if (pay.verifyUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(pay.verifyUrl, {
          width: 640,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch (e) {
        qrDataUrl = null;
      }
    }

    const qrSection = qrDataUrl ? `
      <div class="qr-section">
        <img src="${qrDataUrl}" alt="Verify QR" />
        <div class="qr-label">Scan to verify</div>
      </div>
    ` : '';

    const receiptBlock = (copyLabel) => `
      <div class="receipt-copy">
        <div class="copy-label">${copyLabel}</div>
        <div class="border-frame"></div>
        <div class="watermark">${siteName}</div>
        <div class="content">
          <div class="header">
            <h1>${siteName}</h1>
            <p>${siteAddr || 'FARMER PAYMENT DIVISION'}</p>
          </div>
          <div class="doc-type"><h2>Farmer Payment Receipt</h2></div>
          <div class="meta-info">
            <div class="meta-item"><b>Ref:</b> FPR-${pay.id}</div>
            <div class="meta-item"><b>Date:</b> ${payDate}</div>
          </div>
          <div class="kv-qr-wrap">
            <div class="kv-section">
              <div class="kv-row"><div class="k">Paid To (Farmer)</div><div class="c">:</div><div class="v">${(farmer?.name || '—').toUpperCase()}</div></div>
              <div class="kv-row"><div class="k">Amount</div><div class="c">:</div><div class="v" style="color:#059669">RS ${fmtINR(absAmt)}/-</div></div>
              <div class="kv-row"><div class="k">Payment Mode</div><div class="c">:</div><div class="v">${(pay.payment_mode || '—').toUpperCase()}</div></div>
            </div>
            ${qrSection}
          </div>
          <div class="settlement-title">Payment Details:</div>
          <table class="data-table">
            <tr><th>S.No.</th><td>#${pay.id}</td></tr>
            <tr><th>Date</th><td>${payDate || '—'}</td></tr>
            <tr><th>Particular</th><td>${(pay.particular || '—').toUpperCase()}</td></tr>
            <tr><th>Payment Mode</th><td>${(pay.payment_mode || '—').toUpperCase()}</td></tr>
            <tr><th>Bank Details</th><td>${bankInfo.toUpperCase()}</td></tr>
            <tr><th>Remarks</th><td>${pay.remarks || '—'}</td></tr>
            <tr><th>Amount</th><td style="color:#059669">RS ${fmtINR(absAmt)}/-</td></tr>
          </table>
          ${isCash ? '<div class="bank-proviso">STATUTORY PROVISO: Cash received exclusively as a temporary custodian on behalf of our designated banking institution for immediate reconciliation and ledger entry.</div>' : ''}
          <div class="footer">
            <div class="sig-box"><div class="sig-line">Farmer Signature</div></div>
            <div class="sig-box"><div class="digital-signature">${signerName}</div><div class="sig-line">Authorized Signatory & Seal</div></div>
          </div>
          <div class="print-meta">Printed on: <b>${printedAt}</b></div>
        </div>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html><head>
  <title>FARMER PAYMENT RECEIPT - ${pay.id}</title>
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
    .settlement-title { margin: 1mm 3mm 0.8mm; font-size: 10px; color: #0f172a; font-weight: 700; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
    .data-table th, .data-table td { border: 1px solid #e2e8f0; padding: 0.8mm 3mm; text-align: left; line-height: 1.25; }
    .data-table th { background: #f8fafc; font-size: 8px; text-transform: uppercase; color: #64748b; width: 35%; }
    .data-table td { font-size: 10px; font-weight: 600; color: #0f172a; }
    .bank-proviso { margin-top: 1mm; padding: 1.8mm 2.5mm; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 8px; font-style: italic; color: #64748b; text-align: center; line-height: 1.4; }
    .qr-section { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; background: #fff; padding: 1.5mm; border: 1px solid #0f172a; border-radius: 3px; }
    .qr-section img { display: block; width: 30mm; height: 30mm; image-rendering: pixelated; image-rendering: crisp-edges; }
    .qr-label { font-size: 7px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; margin-top: 1mm; }
    .print-meta { flex-shrink: 0; text-align: center; font-size: 7.5px; color: #64748b; margin-top: 1.5mm; padding: 0.8mm 0 0; border-top: 1px dashed #e2e8f0; letter-spacing: 0.3px; }
    .print-meta b { color: #0f172a; font-weight: 600; }
    .footer { flex-shrink: 0; margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding: 3mm 5mm 1mm; }
    .sig-box { text-align: center; width: 55mm; min-height: 14mm; display: flex; flex-direction: column; justify-content: flex-end; }
    .sig-line { border-top: 1.5px solid #0f172a; padding-top: 3px; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
    .digital-signature { font-family: 'Dancing Script', 'Brush Script MT', cursive; font-size: 22px; font-weight: 700; color: #1a237e; margin-bottom: 1px; line-height: 1; height: 8mm; display: flex; align-items: flex-end; justify-content: center; }
    @media print { body { background: white; padding: 0; } .document { box-shadow: none !important; border: none !important; width: 210mm; height: 297mm; margin: 0 !important; padding: 8mm 15mm !important; } .receipt-copy { padding: 3mm 5mm !important; } .header { padding: 2mm 3mm !important; margin-bottom: 1.5mm !important; } .header h1 { font-size: 16px !important; } .doc-type { margin-bottom: 1.5mm !important; } .meta-info { margin-bottom: 1.5mm !important; } .kv-qr-wrap { margin-bottom: 1mm !important; } .qr-section img { width: 24mm !important; height: 24mm !important; } .settlement-title { margin: 1mm 3mm 0.5mm !important; } .data-table { margin-bottom: 1.5mm !important; } .data-table th, .data-table td { padding: 0.8mm 3mm !important; } .bank-proviso { margin-top: 1mm !important; padding: 1.5mm 2mm !important; font-size: 7px !important; line-height: 1.35 !important; } .footer { padding: 1.5mm 5mm 0 !important; } .sig-box { min-height: 11mm !important; } .digital-signature { font-size: 18px !important; height: 6mm !important; } .print-meta { margin-top: 0.5mm !important; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="document">
    ${receiptBlock('Office Copy')}
    <hr class="scissor-line" />
    ${receiptBlock('Farmer Copy')}
  </div>
  <div class="no-print" style="position:fixed; bottom: 30px; left:0; right:0; text-align:center; z-index:1000;">
    <button onclick="(async () => { try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch(e){} window.print(); })()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#0f172a; color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);">EXECUTE PRINT (A4)</button>
    <button onclick="window.close()" style="padding:12px 50px; font-size:15px; font-weight:700; background:#fff; color:#475569; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer; margin-left:15px;">TERMINATE</button>
  </div>
</body></html>`;

    const win = window.open('', '_blank', 'width=1000,height=750');
    win.document.write(html);
    win.document.close();
  };

  const handleDownloadReceiptPDF = () => {
    const el = receiptRef.current;
    if (!el) return;
    html2pdf().set({
      margin: 0.3,
      filename: `Receipt_${farmer.name}_${receiptPayment?.id || 'payment'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    }).from(el).save();
  };

  const handleDownloadStatementPDF = () => {
    const el = statementRef.current;
    if (!el) return;
    el.style.display = 'block';
    html2pdf().set({
      margin: 0.3,
      filename: `Statement_${farmer.name}_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' },
    }).from(el).save().then(() => { el.style.display = 'none'; });
  };

  const handleExportExcel = () => {
    const data = paymentsWithRunning.map((p, i) => ({
      '#': i + 1,
      Date: formatDate(p.date),
      Particular: p.particular || '',
      Mode: p.payment_mode || 'CASH',
      'Total Amount': parseFloat(p.amount) || 0,
      'Cash (₹)': parseFloat(p.cash_amount) || 0,
      'Bank (₹)': parseFloat(p.bank_amount) || 0,
      By: p.by_note || '',
      'Running Total': parseFloat(p.running_total) || 0,
      'Bank Name': p.bank_name || '',
      'Account No': p.bank_account_no || '',
      'IFSC': p.bank_ifsc || '',
      'Bank Ref': p.bank_reference || '',
      Remarks: p.remarks || '',
    }));
    // Add summary row
    data.push({});
    data.push({
      '#': '',
      Date: 'SUMMARY',
      Particular: `Total Amount: ₹${formatCurrency(summary.total_amount)}`,
      Mode: '',
      'Total Amount': parseFloat(summary.total_paid) || 0,
      'Cash (₹)': parseFloat(summary.cash_paid) || 0,
      'Bank (₹)': parseFloat(summary.bank_paid) || 0,
      By: '',
      'Running Total': '',
      Remarks: `Remaining: ₹${formatCurrency(summary.remaining)}`,
    });
    const ws = XLSX.utils.json_to_sheet(data);
    // Set column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 14 }, { wch: 22 }, { wch: 8 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 20 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Farmer Payments');
    XLSX.writeFile(wb, `Farmer_${farmer.name}_Payments.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Tractor className="w-10 h-10 text-slate-200 mb-3" />
        <p className="text-sm text-slate-500">Farmer not found</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/farmers')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Farmers
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full md:max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/farmers')} className="h-8 w-8 p-0 text-slate-400">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{farmer.name}</h1>
              <Badge variant="outline" className={`text-[10px] capitalize ${
                farmer.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : farmer.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
                {farmer.status}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              {farmer.phone && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {farmer.phone}
                </span>
              )}
              {farmer.address && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {farmer.address}
                </span>
              )}
            </div>

          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} title="Download Excel">
            <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadStatementPDF} title="Download Full Statement PDF">
            <FileText className="w-4 h-4 mr-1.5" /> Statement
          </Button>
          {canWrite && (
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Payment
            </Button>
          )}
        </div>
      </div>

      {/* Overall Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Total Amount</p>
            <p className="text-lg font-bold text-slate-900 mt-1">₹{formatCurrency(summary.total_amount)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Total Paid</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">₹{formatCurrency(summary.total_paid)}</p>
            <div className="w-full h-1 bg-slate-100 rounded-full mt-1.5">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[9px] text-slate-400 mt-0.5">{progressPct.toFixed(1)}% done</p>
          </CardContent>
        </Card>
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Remaining</p>
            <p className={`text-lg font-bold mt-1 ${summary.remaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              ₹{formatCurrency(summary.remaining)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cash & Bank Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Cash Card */}
        <Card className="shadow-none border-green-200 bg-green-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <Banknote className="w-4 h-4 text-green-700" />
              </div>
              <p className="text-sm font-semibold text-green-800">Cash</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-green-600/70 font-medium">To Pay</p>
                <p className="text-base font-bold text-green-900 mt-0.5">₹{formatCurrency(summary.cash_to_pay)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-green-600/70 font-medium">Paid</p>
                <p className="text-base font-bold text-green-700 mt-0.5">₹{formatCurrency(summary.cash_paid)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-green-600/70 font-medium">Remaining</p>
                <p className={`text-base font-bold mt-0.5 ${summary.cash_remaining > 0 ? 'text-amber-600' : 'text-green-700'}`}>₹{formatCurrency(summary.cash_remaining)}</p>
              </div>
            </div>
            {summary.cash_to_pay > 0 && (
              <div className="w-full h-1.5 bg-green-100 rounded-full mt-3">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min((summary.cash_paid / summary.cash_to_pay) * 100, 100)}%` }} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bank Card */}
        <Card className="shadow-none border-blue-200 bg-blue-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-700" />
              </div>
              <p className="text-sm font-semibold text-blue-800">Bank</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-blue-600/70 font-medium">To Pay</p>
                <p className="text-base font-bold text-blue-900 mt-0.5">₹{formatCurrency(summary.bank_to_pay)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-blue-600/70 font-medium">Paid</p>
                <p className="text-base font-bold text-blue-700 mt-0.5">₹{formatCurrency(summary.bank_paid)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-blue-600/70 font-medium">Remaining</p>
                <p className={`text-base font-bold mt-0.5 ${summary.bank_remaining > 0 ? 'text-amber-600' : 'text-blue-700'}`}>₹{formatCurrency(summary.bank_remaining)}</p>
              </div>
            </div>
            {summary.bank_to_pay > 0 && (
              <div className="w-full h-1.5 bg-blue-100 rounded-full mt-3">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min((summary.bank_paid / summary.bank_to_pay) * 100, 100)}%` }} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Land & Commission Details */}
      <Card className="shadow-none border-amber-200 bg-amber-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Tractor className="w-4 h-4 text-amber-700" />
              </div>
              <p className="text-sm font-semibold text-amber-800">Land &amp; Commission Details</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-amber-600/70 font-medium">Size of Land</p>
                <p className="text-base font-bold text-amber-900 mt-0.5">
                  {farmer.land_size_bigha ? `${parseFloat(farmer.land_size_bigha).toLocaleString('en-IN')} Bigha` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-amber-600/70 font-medium">Rate of Land</p>
                <p className="text-base font-bold text-amber-900 mt-0.5">
                  {farmer.land_rate ? `₹${parseFloat(farmer.land_rate).toLocaleString('en-IN')}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-amber-600/70 font-medium">Commission %</p>
                <p className="text-base font-bold text-amber-900 mt-0.5">
                  {farmer.commission_percentage ? `${parseFloat(farmer.commission_percentage)}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-amber-600/70 font-medium">Commission Amount</p>
                <p className="text-base font-bold text-amber-700 mt-0.5">
                  {farmer.commission_amount ? `₹${parseFloat(farmer.commission_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                </p>
                {farmer.commission_percentage && farmer.land_rate && farmer.land_size_bigha && (
                  <p className="text-[9px] text-amber-500 mt-0.5">
                    {farmer.commission_percentage}% × ₹{parseFloat(farmer.land_rate).toLocaleString('en-IN')} × {farmer.land_size_bigha} Bigha
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Farmer Notes */}
      {farmer.notes && (
        <Card className="shadow-none border-slate-200 bg-amber-50/40">
          <CardContent className="p-3">
            <p className="text-xs text-amber-700"><strong>Notes:</strong> {farmer.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Payments Table */}
      <Card className="shadow-none border-slate-200">
        <CardContent className="p-0">
          {paymentsWithRunning.length === 0 ? (
            <div className="text-center py-16">
              <IndianRupee className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No payments yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Add the first installment payment</p>
            </div>
          ) : (
            <div className="overflow-auto relative z-0 will-change-scroll" style={{ maxHeight: 'calc(100vh - 320px)', WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-30 bg-slate-50" style={{ boxShadow: '0 1px 0 0 #e2e8f0' }}>
                  <tr>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-10 sticky left-0 z-40 bg-slate-50 px-3 py-2 text-left">#</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-24 sticky left-10 z-40 bg-slate-50 px-3 py-2 text-left" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>Date</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Particular</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Mode</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Cheque No</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Amount (₹)</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Cash (₹)</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Bank (₹)</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">By</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Running Total (₹)</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Remarks</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Assigned To</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Created By</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Status</th>
                    <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-left">Voucher</th>
                    {(canUpdate || canDelete) && <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Actions</th>}
                    {!(canUpdate || canDelete) && <th className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-2 text-right">Edit</th>}
                  </tr>
                </thead>
                <tbody>
                  {paymentsWithRunning.map((payment, idx) => {
                    const isPayAdvance = payment.particular?.toUpperCase().includes('PAY ADVANCE');

                    return (
                      <tr
                        key={payment.id}
                        className={`border-b hover:bg-slate-50/50 ${isPayAdvance ? 'bg-yellow-50' : ''}`}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}
                      >
                        <td className="text-xs text-slate-400 font-mono sticky left-0 z-10 bg-white px-3 py-2">{idx + 1}</td>
                        <td className="text-sm text-slate-700 whitespace-nowrap sticky left-10 z-10 bg-white px-3 py-2" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>
                          {formatDate(payment.date)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-sm font-medium ${isPayAdvance ? 'text-yellow-700' : 'text-slate-800'}`}>
                            {payment.particular}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] ${
                            payment.payment_mode === 'CASH' ? 'bg-green-50 text-green-700 border-green-200'
                            : payment.payment_mode === 'BANK' ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : payment.payment_mode === 'SPLIT' ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : payment.payment_mode === 'CHEQUE' ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {payment.payment_mode || 'CASH'}
                          </Badge>
                          <ChequeStatusControl
                            chequeStatus={payment.cheque_status}
                            source="farmer_payment"
                            entryId={payment.id}
                            isAdmin={isAdmin}
                            onStatusChange={fetchData}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-mono text-slate-600">{payment.cheque_no || '—'}</span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className={`text-sm font-medium tabular-nums ${
                            parseFloat(payment.amount) < 0 ? 'text-red-600' : 'text-slate-800'
                          }`}>
                            {formatCurrency(payment.amount)}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm tabular-nums text-green-600">
                            {parseFloat(payment.cash_amount) > 0 ? formatCurrency(payment.cash_amount) : '—'}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm tabular-nums text-blue-600">
                            {parseFloat(payment.bank_amount) > 0 ? formatCurrency(payment.bank_amount) : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-sm text-slate-600">{payment.by_note || '—'}</span>
                        </td>
                        <td className="text-right px-3 py-2">
                          <span className="text-sm font-medium text-slate-700 tabular-nums">
                            {formatCurrency(payment.running_total)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs text-slate-500 max-w-30 truncate block">{payment.remarks || '—'}</span>
                        </td>
                        <td className="px-3 py-2">
                          {payment.assigned_admin_id ? (
                            <span className="inline-flex items-center text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-md">
                              {getAssignedAdminLabel(payment) || '—'}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">Unassigned</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <UserAvatar name={payment.created_by_name} label="Created by" />
                        </td>
                        <td className="px-3 py-2">
                          <ApprovalStatusBadge status={payment.status || 'pending'} />
                        </td>
                        <td className="px-3 py-2">
                          <VoucherThumbnail url={payment.voucher_url} />
                        </td>
                        {(canUpdate || canDelete) && (
                          <td className="text-right px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintReceipt(payment)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-green-600"
                                title="Print Receipt"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                              {canUpdate && <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEdit(payment)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>}
                              {canDelete && <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(payment.id)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>}
                            </div>
                          </td>
                        )}
                        {!(canUpdate || canDelete) && (
                          <td className="text-right px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintReceipt(payment)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-green-600"
                                title="Print Receipt"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEdit(payment)}
                                className="h-7 w-7 p-0 text-amber-400 hover:text-amber-600"
                                title="Request Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 z-30 bg-slate-50" style={{ boxShadow: '0 -1px 0 0 #e2e8f0' }}>
                  <tr>
                    <td className="sticky left-0 z-40 bg-slate-50 px-3 py-2" colSpan={1}></td>
                    <td className="sticky left-10 z-40 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider" style={{boxShadow: '2px 0 4px -1px rgba(0,0,0,0.08)'}}>
                      Total ({payments.length})
                    </td>
                    <td className="px-3 py-2" colSpan={3}></td>
                    <td className="text-right px-3 py-2 text-sm font-semibold text-slate-900">
                      ₹{formatCurrency(summary.total_paid)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm font-semibold text-green-700">
                      ₹{formatCurrency(summary.cash_paid)}
                    </td>
                    <td className="text-right px-3 py-2 text-sm font-semibold text-blue-700">
                      ₹{formatCurrency(summary.bank_paid)}
                    </td>
                    <td className="px-3 py-2" colSpan={canManage ? 8 : 7}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{editingPayment ? (canUpdate ? 'Edit Payment' : 'Request Payment Edit') : 'Add Payment'}</DialogTitle>
            <DialogDescription className="text-sm">
              {editingPayment ? (canUpdate ? 'Update installment details.' : 'Submit edit request with proof for admin approval.') : `Add a new installment for ${farmer.name}. Choose how to split between Cash and Bank.`}
            </DialogDescription>
          </DialogHeader>

          {message.text && (
            <div className={`flex gap-2 p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
                : 'bg-red-50 border border-red-100 text-red-700'
            }`}>
              {message.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ── Transaction Type: Credit / Debit ── */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Transaction Type *</Label>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button type="button" onClick={() => handleFormChange('transaction_type', 'credit')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-all ${formData.transaction_type === 'credit' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                  <ArrowDownRight className="w-4 h-4" /> Received <span className="text-xs ml-0.5">(+ve)</span>
                </button>
                <button type="button" onClick={() => handleFormChange('transaction_type', 'debit')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-all ${formData.transaction_type === 'debit' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                  <ArrowUpRight className="w-4 h-4" /> Refund <span className="text-xs ml-0.5">(-ve)</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                {formData.transaction_type === 'credit' ? 'Payment received from farmer (credit)' : 'Payment given back to farmer (refund/debit)'}
              </p>
            </div>

            {/* ── Mode Toggle: CASH / BANK / CHEQUE ── */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Mode *</Label>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button type="button" onClick={() => handleFormChange('mode', 'CASH')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-all ${formData.mode === 'CASH' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                  <Banknote className="w-4 h-4" /> Cash
                </button>
                <button type="button" onClick={() => handleFormChange('mode', 'BANK')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-all ${formData.mode === 'BANK' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                  <Building2 className="w-4 h-4" /> Bank
                </button>
                <button type="button" onClick={() => handleFormChange('mode', 'CHEQUE')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-all ${formData.mode === 'CHEQUE' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                  <CreditCard className="w-4 h-4" /> Cheque
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                {formData.mode === 'CASH' ? 'Payment will be recorded as cash' : formData.mode === 'BANK' ? 'Payment will be recorded as bank transfer' : 'Cheque payment — will require approval'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Date *
                </Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                  required
                />
              </div>
              {formData.mode !== 'CHEQUE' ? (
                <div className="space-y-1.5">
                  <Label>Particular *</Label>
                  <Select value={formData.particular} onValueChange={(val) => handleFormChange('particular', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {getParticularsForMode(formData.mode).map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Particular</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border bg-teal-50 text-sm font-semibold text-teal-700 border-teal-200">
                    CHEQUE
                  </div>
                </div>
              )}
            </div>

            {/* ── Cheque No — CHEQUE mode only ── */}
            {formData.mode === 'CHEQUE' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Cheque No *
                </Label>
                <Input
                  placeholder="Enter cheque number"
                  value={formData.cheque_no || ''}
                  onChange={(e) => handleFormChange('cheque_no', e.target.value)}
                  required
                />
              </div>
            )}

            {/* ── Amount + By ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`border rounded-lg p-3 space-y-2 ${
                formData.mode === 'CASH' ? 'border-green-200 bg-green-50/30' :
                formData.mode === 'BANK' ? 'border-blue-200 bg-blue-50/30' :
                'border-teal-200 bg-teal-50/30'
              }`}>
                <Label className={`text-xs flex items-center gap-1.5 font-semibold ${
                  formData.mode === 'CASH' ? 'text-green-700' :
                  formData.mode === 'BANK' ? 'text-blue-700' :
                  'text-teal-700'
                }`}>
                  {formData.mode === 'CASH' ? <Banknote className="w-4 h-4" /> : formData.mode === 'BANK' ? <Building2 className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                  {formData.transaction_type === 'debit' 
                    ? (formData.mode === 'CASH' ? 'Refund in Cash (₹) *' : formData.mode === 'BANK' ? 'Refund in Bank (₹) *' : 'Refund Cheque (₹) *')
                    : (formData.mode === 'CASH' ? 'Received in Cash (₹) *' : formData.mode === 'BANK' ? 'Received in Bank (₹) *' : 'Cheque Amount (₹) *')}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => handleFormChange('amount', e.target.value)}
                  required
                  className={
                    formData.mode === 'CASH' ? 'border-green-200 focus-visible:ring-green-300' :
                    formData.mode === 'BANK' ? 'border-blue-200 focus-visible:ring-blue-300' :
                    'border-teal-200 focus-visible:ring-teal-300'
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>By (who / reference)</Label>
                <Input
                  placeholder="OM / PRAVINDER / KULDEEP JI"
                  value={formData.by_note}
                  onChange={(e) => handleFormChange('by_note', e.target.value)}
                />
              </div>
            </div>

            {/* ── Bank Details — BANK mode only ── */}
            {formData.mode === 'BANK' && (
              <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/20 space-y-3">
                <p className="text-xs font-medium text-blue-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Bank Details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bank Name</Label>
                    <Input
                      placeholder="State Bank of India"
                      value={formData.bank_name}
                      onChange={(e) => handleFormChange('bank_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Account No.</Label>
                    <Input
                      placeholder="1234567890"
                      value={formData.bank_account_no}
                      onChange={(e) => handleFormChange('bank_account_no', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Reference / UTR No.</Label>
                    <Input
                      placeholder="UTR / Txn Ref"
                      value={formData.bank_reference}
                      onChange={(e) => handleFormChange('bank_reference', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">IFSC Code</Label>
                    <Input
                      placeholder="SBIN0001234"
                      value={formData.bank_ifsc}
                      onChange={(e) => handleFormChange('bank_ifsc', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea
                placeholder="biyaz 9 month, chq RTGS OM 19-1-26, etc."
                value={formData.remarks}
                onChange={(e) => handleFormChange('remarks', e.target.value)}
                rows={2}
              />
            </div>

            {approvers.length > 0 && (
              <div className="space-y-1.5">
                <Label>Send To Admin For Approval</Label>
                <Select
                  value={formData.assigned_admin_id?.toString() || '_none'}
                  onValueChange={(val) => handleFormChange('assigned_admin_id', val === '_none' ? null : parseInt(val))}
                >
                  <SelectTrigger><SelectValue placeholder="Select approver" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">- Auto-assign or no preference -</SelectItem>
                    {approvers.map((app) => (
                      <SelectItem key={app.id} value={String(app.id)}>{app.full_name || app.name || app.email || `Admin #${app.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Voucher / Receipt Upload */}
            <VoucherUpload
              value={formData.voucher_url}
              onChange={(url) => handleFormChange('voucher_url', url || '')}
              disabled={submitting}
            />

            {/* Proof Photo Upload (sub-admin editing only) - OPTIONAL */}
            {editingPayment && !canUpdate && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-slate-600">
                  <Camera className="w-3.5 h-3.5" /> Proof Photo <span className="text-[10px] text-slate-400">(optional)</span>
                </Label>
                <Input type="file" accept="image/*" onChange={handleProofPhotoChange} />
                {proofPreview && (
                  <img src={proofPreview} alt="Proof preview" className="h-24 rounded-lg border object-contain mt-1" />
                )}
                <p className="text-[11px] text-slate-500">Attach a photo as supporting evidence (optional)</p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={submitting || editRequestPending}>
                {submitting ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {editingPayment && !canUpdate ? 'Submitting Request...' : editingPayment ? 'Updating...' : 'Adding...'}
                  </>
                ) : editRequestPending ? (
                  <><Clock className="w-3.5 h-3.5 mr-1.5" /> Request Sent</>
                ) : editingPayment && !canUpdate ? (
                  <><Send className="w-3.5 h-3.5 mr-1.5" /> Submit Edit Request</>
                ) : (
                  editingPayment ? 'Update' : 'Add Payment'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Receipt Viewer Dialog ── */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Payment Receipt</DialogTitle>
            <DialogDescription className="text-sm">Receipt for payment #{receiptPayment?.id}</DialogDescription>
          </DialogHeader>

          {receiptPayment && (
            <>
              <div ref={receiptRef}>
                <div style={{ fontFamily: 'Arial, sans-serif', color: '#1a1a1a', maxWidth: '680px', margin: '0 auto', padding: '24px', border: '2px solid #1e293b', borderRadius: '4px' }}>
                  {/* Header */}
                  <div style={{ borderBottom: '3px solid #1e293b', paddingBottom: '16px', marginBottom: '16px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '22px', fontWeight: '800', margin: '0', letterSpacing: '1px', textTransform: 'uppercase', color: '#0f172a' }}>Payment Receipt</h1>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0', letterSpacing: '0.5px' }}>Farmer Payment Acknowledgement</p>
                  </div>

                  {/* Receipt No & Date Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Receipt No: </span>
                      <strong style={{ color: '#0f172a' }}>FP-{String(receiptPayment.id).padStart(5, '0')}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Date: </span>
                      <strong style={{ color: '#0f172a' }}>{formatDate(receiptPayment.date)}</strong>
                    </div>
                  </div>

                  {/* Farmer Info Box */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '12px 16px', marginBottom: '20px' }}>
                    <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: '3px 0', color: '#64748b', width: '120px' }}>Farmer Name</td>
                          <td style={{ padding: '3px 0', fontWeight: '600' }}>{farmer.name}</td>
                          <td style={{ padding: '3px 0', color: '#64748b', width: '100px' }}>Phone</td>
                          <td style={{ padding: '3px 0', fontWeight: '600' }}>{farmer.phone || '—'}</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '3px 0', color: '#64748b' }}>Address</td>
                          <td style={{ padding: '3px 0' }} colSpan={3}>{farmer.address || '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Payment Details Table */}
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '20px' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#fff' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600' }}>Description</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px' }}>Particular</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500' }}>{receiptPayment.particular}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f0fdf4' }}>
                        <td style={{ padding: '8px 12px', color: '#15803d' }}>● Cash Payment</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#15803d' }}>₹{formatCurrency(receiptPayment.cash_amount || 0)}</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#eff6ff' }}>
                        <td style={{ padding: '8px 12px', color: '#1d4ed8' }}>● Bank Payment</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#1d4ed8' }}>₹{formatCurrency(receiptPayment.bank_amount || 0)}</td>
                      </tr>
                      <tr style={{ background: '#0f172a', color: '#fff' }}>
                        <td style={{ padding: '10px 12px', fontWeight: '700', fontSize: '13px' }}>TOTAL AMOUNT</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>₹{formatCurrency(receiptPayment.amount)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Bank Details (if applicable) */}
                  {(parseFloat(receiptPayment.bank_amount) > 0) && (
                    <div style={{ border: '1px solid #bfdbfe', borderRadius: '4px', padding: '12px 16px', marginBottom: '20px', background: '#eff6ff' }}>
                      <p style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bank Transfer Details</p>
                      <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ padding: '2px 0', color: '#64748b', width: '130px' }}>Bank Name</td>
                            <td style={{ padding: '2px 0', fontWeight: '500' }}>{receiptPayment.bank_name || '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '2px 0', color: '#64748b' }}>Account No.</td>
                            <td style={{ padding: '2px 0', fontWeight: '500' }}>{receiptPayment.bank_account_no || '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '2px 0', color: '#64748b' }}>IFSC Code</td>
                            <td style={{ padding: '2px 0', fontWeight: '500' }}>{receiptPayment.bank_ifsc || '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '2px 0', color: '#64748b' }}>Reference / UTR</td>
                            <td style={{ padding: '2px 0', fontWeight: '500' }}>{receiptPayment.bank_reference || '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* By & Remarks */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', fontSize: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#64748b' }}>Paid By: </span>
                      <strong>{receiptPayment.by_note || '—'}</strong>
                    </div>
                    {receiptPayment.remarks && (
                      <div style={{ flex: 1 }}>
                        <span style={{ color: '#64748b' }}>Remarks: </span>
                        <span>{receiptPayment.remarks}</span>
                      </div>
                    )}
                  </div>

                  {/* Summary Bar */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '10px 16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <div><span style={{ color: '#64748b' }}>Total Agreed: </span><strong>₹{formatCurrency(summary.total_amount)}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Total Paid: </span><strong style={{ color: '#15803d' }}>₹{formatCurrency(summary.total_paid)}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Remaining: </span><strong style={{ color: summary.remaining > 0 ? '#d97706' : '#15803d' }}>₹{formatCurrency(summary.remaining)}</strong></div>
                  </div>

                  {/* Signature Area */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderTop: '1px solid #94a3b8', width: '160px', paddingTop: '6px' }}>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Receiver’s Signature</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ borderTop: '1px solid #94a3b8', width: '160px', paddingTop: '6px' }}>
                        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Authorized Signature</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '20px', paddingTop: '8px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>This is a computer-generated receipt. Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrintReceipt}>
                  <Printer className="w-4 h-4 mr-1.5" /> Print
                </Button>
                <Button size="sm" onClick={handleDownloadReceiptPDF}>
                  <Download className="w-4 h-4 mr-1.5" /> Download PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Hidden Statement for PDF Export ── */}
      <div ref={statementRef} style={{ display: 'none' }}>
        <div style={{ fontFamily: 'Arial, sans-serif', color: '#1a1a1a', padding: '20px' }}>
          {/* Statement Header */}
          <div style={{ borderBottom: '3px solid #1e293b', paddingBottom: '12px', marginBottom: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '800', margin: '0', textAlign: 'center', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '1px' }}>Farmer Payment Statement</h1>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0', textAlign: 'center' }}>Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
          </div>

          {/* Farmer Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '10px 14px' }}>
            <div>
              <span style={{ color: '#64748b' }}>Farmer: </span>
              <strong>{farmer?.name}</strong>
              {farmer?.phone && <span style={{ marginLeft: '12px', color: '#64748b' }}>Ph: {farmer.phone}</span>}
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Status: </span>
              <strong style={{ textTransform: 'capitalize' }}>{farmer?.status}</strong>
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', fontSize: '11px' }}>
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ color: '#64748b' }}>Total Amount</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>₹{formatCurrency(summary.total_amount)}</div>
            </div>
            <div style={{ flex: 1, border: '1px solid #bbf7d0', borderRadius: '4px', padding: '8px 12px', textAlign: 'center', background: '#f0fdf4' }}>
              <div style={{ color: '#15803d' }}>Cash (To Pay / Paid)</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#15803d' }}>₹{formatCurrency(summary.cash_to_pay)} / ₹{formatCurrency(summary.cash_paid)}</div>
            </div>
            <div style={{ flex: 1, border: '1px solid #bfdbfe', borderRadius: '4px', padding: '8px 12px', textAlign: 'center', background: '#eff6ff' }}>
              <div style={{ color: '#1d4ed8' }}>Bank (To Pay / Paid)</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1d4ed8' }}>₹{formatCurrency(summary.bank_to_pay)} / ₹{formatCurrency(summary.bank_paid)}</div>
            </div>
            <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ color: '#d97706' }}>Remaining</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#d97706' }}>₹{formatCurrency(summary.remaining)}</div>
            </div>
          </div>

          {/* Payments Table */}
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginBottom: '16px' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#fff' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Date</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Particular</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Mode</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Amount</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Cash</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Bank</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>By</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600' }}>Running</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {paymentsWithRunning.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '5px 8px' }}>{i + 1}</td>
                  <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{formatDate(p.date)}</td>
                  <td style={{ padding: '5px 8px' }}>{p.particular}</td>
                  <td style={{ padding: '5px 8px' }}>{p.payment_mode || 'CASH'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '500' }}>₹{formatCurrency(p.amount)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#15803d' }}>₹{formatCurrency(p.cash_amount || 0)}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#1d4ed8' }}>₹{formatCurrency(p.bank_amount || 0)}</td>
                  <td style={{ padding: '5px 8px' }}>{p.by_note || '—'}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '500' }}>₹{formatCurrency(p.running_total)}</td>
                  <td style={{ padding: '5px 8px', fontSize: '10px' }}>{p.remarks || '—'}</td>
                </tr>
              ))}
              {/* Totals */}
              <tr style={{ background: '#0f172a', color: '#fff', fontWeight: '700' }}>
                <td colSpan={4} style={{ padding: '7px 8px', fontSize: '11px' }}>TOTAL ({payments.length} payments)</td>
                <td style={{ padding: '7px 8px', textAlign: 'right' }}>₹{formatCurrency(summary.total_paid)}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#86efac' }}>₹{formatCurrency(summary.cash_paid)}</td>
                <td style={{ padding: '7px 8px', textAlign: 'right', color: '#93c5fd' }}>₹{formatCurrency(summary.bank_paid)}</td>
                <td colSpan={3} style={{ padding: '7px 8px' }}></td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #94a3b8', width: '160px', paddingTop: '6px' }}>
                <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Farmer’s Signature</p>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #94a3b8', width: '160px', paddingTop: '6px' }}>
                <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Authorized Signature</p>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '16px', paddingTop: '6px', textAlign: 'center' }}>
            <p style={{ fontSize: '9px', color: '#94a3b8', margin: 0 }}>Computer-generated statement. Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FarmerPayments;
